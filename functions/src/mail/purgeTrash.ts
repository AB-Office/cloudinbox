/**
 * purgeTrash - ゴミ箱完全削除
 * 
 * ゴミ箱に入ってから30日が経過したメールを完全削除する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { MailMessageDoc } from './types';

/**
 * ゴミ箱完全削除を実行する（内部ロジック）
 * 
 * @param db - Firestoreインスタンス
 * @param storage - Storageインスタンス
 */
export async function executePurgeTrash(
  db: admin.firestore.Firestore,
  storage: admin.storage.Storage
): Promise<void> {
  const bucket = storage.bucket();

  // 30日前の日時を計算
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

  // 30日以上前に削除されたメールを検索（labelsにtrashを含む）
  const messagesQuery = db
    .collectionGroup('mailMessages')
    .where('labels', 'array-contains', 'trash')
    .where('deletedAt', '<=', thirtyDaysAgoTimestamp);

  const messagesSnapshot = await messagesQuery.get();

  if (messagesSnapshot.empty) {
    functions.logger.info('No messages to purge');
    return;
  }

  functions.logger.info(`Found ${messagesSnapshot.size} messages to purge`);

  // ユーザーごとにグループ化
  const messagesByUser = new Map<string, Array<{ doc: admin.firestore.QueryDocumentSnapshot; data: MailMessageDoc }>>();

  for (const messageDoc of messagesSnapshot.docs) {
    const messageData = messageDoc.data() as MailMessageDoc;
    const uid = messageDoc.ref.parent.parent?.id;
    
    if (!uid) {
      functions.logger.warn(`Message ${messageDoc.id} has no parent user ID`);
      continue;
    }

    if (!messagesByUser.has(uid)) {
      messagesByUser.set(uid, []);
    }
    messagesByUser.get(uid)!.push({ doc: messageDoc, data: messageData });
  }

  // ユーザーごとに処理
  for (const [uid, messages] of messagesByUser.entries()) {
    try {
      await processUserTrash(uid, messages, db, bucket);
    } catch (error: any) {
      functions.logger.error(`Error processing user ${uid}:`, error);
      // エラーが発生しても次のユーザーの処理を継続
      continue;
    }
  }

  functions.logger.info('purgeTrash completed');
}

/**
 * ゴミ箱完全削除を実行する
 * 
 * Cloud Schedulerから定期実行される（1日1回推奨）
 */
export const purgeTrash = functions.region('asia-northeast1').pubsub
  .schedule('0 2 * * *') // 毎日午前2時（UTC）
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const storage = admin.storage();
      await executePurgeTrash(db, storage);
    } catch (error: any) {
      functions.logger.error('purgeTrash failed:', error);
      throw error;
    }
  });

/**
 * ユーザーのゴミ箱メールを処理する
 * 
 * @param uid - ユーザーID
 * @param messages - 削除対象のメッセージ
 * @param db - Firestoreインスタンス
 * @param bucket - Storageバケット
 */
async function processUserTrash(
  uid: string,
  messages: Array<{ doc: admin.firestore.QueryDocumentSnapshot; data: MailMessageDoc }>,
  db: admin.firestore.Firestore,
  bucket: any
): Promise<void> {
  const batch = db.batch();
  let totalDeletedSize = 0;
  const threadIds = new Set<string>();

  // 各メッセージを処理
  for (const { doc: messageDoc, data: messageData } of messages) {
    const messageId = messageData.messageId;
    const threadId = messageData.threadId;
    threadIds.add(threadId);

    // Storageファイルを削除
    const deletedSize = await deleteStorageFiles(uid, messageId, messageData, bucket);
    totalDeletedSize += deletedSize;

    // Firestoreからメッセージを削除
    batch.delete(messageDoc.ref);
  }

  // バッチコミット
  await batch.commit();

  // スレッド内のすべてのメールが削除されたかチェック
  for (const threadId of threadIds) {
    const threadMessagesQuery = db
      .collection('users')
      .doc(uid)
      .collection('mailMessages')
      .where('threadId', '==', threadId);

    const threadMessagesSnapshot = await threadMessagesQuery.get();

    if (threadMessagesSnapshot.empty) {
      // スレッド内のすべてのメールが削除された場合、スレッドも削除
      const threadRef = db
        .collection('users')
        .doc(uid)
        .collection('mailThreads')
        .doc(threadId);

      await threadRef.delete();
      functions.logger.info(`Deleted thread ${threadId} for user ${uid}`);
    }
  }

  // 使用量を更新
  if (totalDeletedSize > 0) {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const now = admin.firestore.Timestamp.now();
      await userRef.update({
        'usage.storageBytes': admin.firestore.FieldValue.increment(-totalDeletedSize),
        'usage.updatedAt': now,
      });

      functions.logger.info(`Updated usage for user ${uid}: -${totalDeletedSize} bytes`);
    }
  }
}

/**
 * Storageファイルを削除する
 * 
 * @param uid - ユーザーID
 * @param messageId - メッセージID
 * @param messageData - メッセージデータ
 * @param bucket - Storageバケット
 * @returns 削除されたファイルサイズの合計（バイト）
 */
async function deleteStorageFiles(
  uid: string,
  messageId: string,
  messageData: MailMessageDoc,
  bucket: any
): Promise<number> {
  let totalSize = 0;

  // MIME原本を削除
  if (messageData.storage.rawMimePath) {
    const rawMimeFile = bucket.file(messageData.storage.rawMimePath);
    const [exists] = await rawMimeFile.exists();
    if (exists) {
      const [metadata] = await rawMimeFile.getMetadata();
      totalSize += parseInt(metadata.size || '0', 10);
      await rawMimeFile.delete();
      functions.logger.info(`Deleted raw MIME: ${messageData.storage.rawMimePath}`);
    }
  }

  // 大きい本文を削除
  if (messageData.hasLargeBody && messageData.storage.largeBodyPath) {
    const bodyFile = bucket.file(messageData.storage.largeBodyPath);
    const [exists] = await bodyFile.exists();
    if (exists) {
      const [metadata] = await bodyFile.getMetadata();
      totalSize += parseInt(metadata.size || '0', 10);
      await bodyFile.delete();
      functions.logger.info(`Deleted large body: ${messageData.storage.largeBodyPath}`);
    }
  }

  // Firestoreの暗号化データサイズを計算（小さい本文の場合）
  if (!messageData.hasLargeBody && messageData.bodyTextEncrypted) {
    const bodyJsonSize = Buffer.byteLength(
      JSON.stringify(messageData.bodyTextEncrypted),
      'utf8'
    );
    totalSize += bodyJsonSize;
  }

  // 添付ファイルを削除
  if (messageData.hasAttachments && messageData.storage.attachmentsBasePath) {
    const attachmentsPath = messageData.storage.attachmentsBasePath;
    const [files] = await bucket.getFiles({ prefix: attachmentsPath });

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      totalSize += parseInt(metadata.size || '0', 10);
      await file.delete();
      functions.logger.info(`Deleted attachment: ${file.name}`);
    }
  }

  return totalSize;
}

