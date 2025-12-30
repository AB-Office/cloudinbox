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
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
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
      // 受信トレイ: 'inbox'ラベルを含むものを取得（'trash'除外はクライアント側でフィルタリング）
      // フィルタリングで件数が減る可能性があるため、多めに取得
      q = query(
        collection(db, 'users', uid, 'mailThreads'),
        where('labels', 'array-contains', 'inbox'),
        orderBy('lastMessageAt', 'desc'),
        limit((limitCount + 1) * 2) // フィルタリングのため多めに取得
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
    let docs = snapshot.docs;

    // 受信トレイの場合は、クライアント側で'trash'ラベルを含まないものだけをフィルタリング
    // （Firestoreでは複数のarray-contains条件を組み合わせられないため）
    if (label === 'inbox') {
      docs = docs.filter(doc => {
        const data = doc.data();
        const labels = (data.labels as string[]) || [];
        return labels.includes('inbox') && !labels.includes('trash');
      });
    }

    // ページネーション判定: フィルタリング後の件数で判定
    const hasMore = docs.length > limitCount;
    const threadsToReturn = hasMore ? docs.slice(0, limitCount) : docs;

    const threads = threadsToReturn.map(doc => ({
      id: doc.id,
      threadId: doc.id,
      ...doc.data(),
    })) as MailThread[];

    // lastDocumentは、フィルタリング後の最後のドキュメントを使用
    // （次のクエリのstartAfterで使用される。フィルタリング後のドキュメントでも問題ない）
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
      let docs = snapshot.docs;

      // 受信トレイの場合は、クライアント側で'trash'ラベルを含まないものだけをフィルタリング
      if (label === 'inbox') {
        docs = docs.filter(doc => {
          const data = doc.data();
          const labels = (data.labels as string[]) || [];
          return labels.includes('inbox') && !labels.includes('trash');
        });
      }

      const threads = docs.map(doc => ({
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
   * 添付ファイルをダウンロードする
   * @param messageId メッセージID
   * @param filename ファイル名
   * @returns ダウンロードされたファイル情報（Base64エンコードされたコンテンツ、ファイル名、Content-Type、サイズ）
   */
  async downloadAttachment(
    messageId: string,
    filename: string
  ): Promise<{ content: string; filename: string; contentType: string; size: number }> {
    const downloadAttachment = httpsCallable(functions, 'downloadAttachment');
    const result = await downloadAttachment({ messageId, filename });
    return result.data as { content: string; filename: string; contentType: string; size: number };
  },

  /**
   * メールを既読にする
   * @param messageId メッセージID
   * @param threadId スレッドID
   */
  async markAsRead(messageId: string, threadId: string): Promise<void> {
    const markAsRead = httpsCallable(functions, 'markAsRead');
    try {
      await markAsRead({ messageId, threadId });
    } catch (e: unknown) {
      // CORSエラーやその他のエラーを無視（開発環境などでエミュレーターが動いていない場合など）
      // エラーをログに記録するが、ユーザーには表示しない
      console.warn('Failed to mark message as read:', e);
      // エラーを再スローしない（UIの動作を妨げないため）
    }
  },

  /**
   * メールをゴミ箱に移動する
   * @param messageId メッセージID
   */
  async moveToTrash(messageId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // メールメッセージドキュメントを取得してthreadIdを取得
    const messageRef = doc(db, 'users', uid, 'mailMessages', messageId);
    const messageDoc = await getDoc(messageRef);
    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const data = messageDoc.data();
    const threadId = data.threadId as string | undefined;
    if (!threadId) {
      throw new Error('Thread ID not found');
    }

    // Firestoreのバッチ更新を作成
    const batch = writeBatch(db);

    // メールメッセージドキュメントの更新
    // labelsにtrashを追加（inboxラベルは削除しない）
    batch.update(messageRef, {
      labels: arrayUnion('trash'),
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // メールスレッドドキュメントの更新は行わない（スレッド全体の誤ラベリング防止）
    // 必要であればサーバー側集約ロジックで対応する

    // バッチ更新をコミット
    await batch.commit();
  },

  /**
   * メールをゴミ箱から復元する
   * @param messageId メッセージID
   */
  async restoreFromTrash(messageId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // メールメッセージドキュメントを取得してthreadIdを取得
    const messageRef = doc(db, 'users', uid, 'mailMessages', messageId);
    const messageDoc = await getDoc(messageRef);
    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const data = messageDoc.data();
    const threadId = data.threadId as string | undefined;
    if (!threadId) {
      throw new Error('Thread ID not found');
    }

    // Firestoreのバッチ更新を作成
    const batch = writeBatch(db);

    // メールメッセージドキュメントの更新
    // labelsからtrashを削除、deletedAtをnullに設定
    batch.update(messageRef, {
      labels: arrayRemove('trash'),
      deletedAt: null,
      updatedAt: serverTimestamp(),
    });

    // メールスレッドドキュメントの更新
    const threadRef = doc(db, 'users', uid, 'mailThreads', threadId);
    batch.update(threadRef, {
      labels: arrayRemove('trash'),
      updatedAt: serverTimestamp(),
    });

    // バッチ更新をコミット
    await batch.commit();
  },

  /**
   * メールをアーカイブする
   * @param messageId メッセージID
   */
  async archive(messageId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // メールメッセージドキュメントを取得してthreadIdを取得
    const messageRef = doc(db, 'users', uid, 'mailMessages', messageId);
    const messageDoc = await getDoc(messageRef);
    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const data = messageDoc.data();
    const threadId = data.threadId as string | undefined;
    if (!threadId) {
      throw new Error('Thread ID not found');
    }

    // Firestoreのバッチ更新を作成
    const batch = writeBatch(db);

    // メールメッセージドキュメントの更新
    // labelsからinboxを削除
    batch.update(messageRef, {
      labels: arrayRemove('inbox'),
      updatedAt: serverTimestamp(),
    });

    // メールスレッドドキュメントの更新
    const threadRef = doc(db, 'users', uid, 'mailThreads', threadId);
    batch.update(threadRef, {
      labels: arrayRemove('inbox'),
      updatedAt: serverTimestamp(),
    });

    // バッチ更新をコミット
    await batch.commit();
  },

  /**
   * メールを受信箱に戻す
   * @param messageId メッセージID
   */
  async restoreToInbox(messageId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // メールメッセージドキュメントを取得してthreadIdを取得
    const messageRef = doc(db, 'users', uid, 'mailMessages', messageId);
    const messageDoc = await getDoc(messageRef);
    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const data = messageDoc.data();
    const threadId = data.threadId as string | undefined;
    if (!threadId) {
      throw new Error('Thread ID not found');
    }

    // Firestoreのバッチ更新を作成
    const batch = writeBatch(db);

    // メールメッセージドキュメントの更新
    // labelsにinboxを追加
    batch.update(messageRef, {
      labels: arrayUnion('inbox'),
      updatedAt: serverTimestamp(),
    });

    // メールスレッドドキュメントの更新
    const threadRef = doc(db, 'users', uid, 'mailThreads', threadId);
    batch.update(threadRef, {
      labels: arrayUnion('inbox'),
      updatedAt: serverTimestamp(),
    });

    // バッチ更新をコミット
    await batch.commit();
  },
};
