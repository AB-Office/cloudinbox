import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  type QueryDocumentSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebase';
import type { MailThread, MailMessage, AttachmentListItem } from '@/types/mail';

const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, 'asia-northeast1');

/**
 * 画面サイズに応じた表示可能件数を計算する
 */
export function calculateItemsPerPage(): number {
  // 画面サイズとメール一覧アイテムの高さから表示可能件数を計算
  // デフォルトは15件、画面が大きい場合は20件、小さい場合は10件
  if (typeof window === 'undefined') return 15;
  const viewportHeight = window.innerHeight;
  const itemHeight = 80; // メール一覧アイテムの推定高さ（px）
  const headerHeight = 100; // ヘッダー・ナビゲーションの推定高さ（px）
  const availableHeight = viewportHeight - headerHeight;
  const calculatedItems = Math.floor(availableHeight / itemHeight);
  // 10-20件の範囲に制限し、若干の余裕を持たせる
  return Math.max(10, Math.min(20, calculatedItems + 3));
}

export const mailService = {
  /**
   * メールスレッド一覧を取得する（ページネーション対応）
   * @param label ラベル（'inbox', 'trash', 'all'）
   * @param limitCount 取得件数
   * @param lastDoc 前回取得した最後のドキュメント（追加読み込み時）
   * @returns メールスレッド一覧、最後のドキュメント、hasMoreフラグ
   */
  async fetchThreads(
    label: string,
    limitCount: number,
    lastDoc: QueryDocumentSnapshot | null = null
  ): Promise<{
    threads: MailThread[];
    lastDocument: QueryDocumentSnapshot | null;
    hasMore: boolean;
  }> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // ページネーション: limitCount + 1件を取得し、hasMoreを判定
    // 実際に返すのはlimitCount件のみ
    let q = query(
      collection(db, 'users', uid, 'mailThreads'),
      orderBy('lastMessageAt', 'desc'),
      limit(limitCount + 1)
    );

    if (label === 'inbox') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'inbox'),
        orderBy('lastMessageAt', 'desc'),
        limit(limitCount + 1)
      );
    } else if (label === 'trash') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'trash'),
        orderBy('lastMessageAt', 'desc'),
        limit(limitCount + 1)
      );
    }
    // label === 'all' の場合はフィルタリングなし

    // 追加読み込み時は前回の最後のドキュメントから開始
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > limitCount;
    // hasMoreがtrueの場合は最後の1件を除外（次のページ判定用に保持）
    const threadsToReturn = hasMore ? docs.slice(0, limitCount) : docs;

    const threads = threadsToReturn.map(doc => ({
      id: doc.id,
      threadId: doc.id,
      ...doc.data(),
    })) as MailThread[];

    return {
      threads,
      lastDocument: threadsToReturn.length > 0 ? threadsToReturn[threadsToReturn.length - 1] : null,
      hasMore,
    };
  },

  /**
   * メールスレッド一覧のリアルタイム更新を監視する
   * @param label ラベル（'inbox', 'trash', 'all'）
   * @param callback 更新時のコールバック関数
   * @returns 監視を停止する関数
   */
  watchThreads(label: string, callback: (threads: MailThread[]) => void): () => void {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    let q = query(collection(db, 'users', uid, 'mailThreads'), orderBy('lastMessageAt', 'desc'));

    if (label === 'inbox') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'inbox'),
        orderBy('lastMessageAt', 'desc')
      );
    } else if (label === 'trash') {
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'trash'),
        orderBy('lastMessageAt', 'desc')
      );
    }
    // label === 'all' の場合はフィルタリングなし

    return onSnapshot(q, snapshot => {
      const threads = snapshot.docs.map(doc => ({
        id: doc.id,
        threadId: doc.id,
        ...doc.data(),
      })) as MailThread[];
      callback(threads);
    });
  },

  /**
   * メールメッセージを取得する
   * @param messageId メッセージID
   * @returns メールメッセージ
   */
  async fetchMessage(messageId: string): Promise<MailMessage> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const docRef = doc(db, 'users', uid, 'mailMessages', messageId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Message not found');
    }

    return {
      id: docSnap.id,
      messageId: docSnap.id,
      ...docSnap.data(),
    } as MailMessage;
  },

  /**
   * メール本文を復号化する
   * @param messageId メッセージID
   * @returns 復号化されたメール本文
   */
  async decryptMailBody(messageId: string): Promise<{ bodyText?: string; bodyHtml?: string }> {
    const decryptMail = httpsCallable(functions, 'decryptMail');
    const result = await decryptMail({ messageId });
    return result.data as { bodyText?: string; bodyHtml?: string };
  },

  /**
   * 添付ファイル一覧を取得する
   * @param messageId メッセージID
   * @returns 添付ファイル一覧
   */
  async getAttachmentsList(messageId: string): Promise<AttachmentListItem[]> {
    const getAttachmentsList = httpsCallable(functions, 'getAttachmentsList');
    const result = await getAttachmentsList({ messageId });
    const response = result.data as { attachments: AttachmentListItem[] };
    return response.attachments || [];
  },

  /**
   * メールを既読にする
   * @param messageId メッセージID
   * @param threadId スレッドID
   */
  async markAsRead(messageId: string, threadId: string): Promise<void> {
    const markAsRead = httpsCallable(functions, 'markAsRead');
    await markAsRead({ messageId, threadId });
  },
};
