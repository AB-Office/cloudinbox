/**
 * decryptMail - メール本文復号
 *
 * 暗号化されたメール本文を復号してクライアントに返すHTTP Callable Function
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { decryptForUser } from '../encryption';
import { EncryptedData, MailMessageDoc } from './types';

/**
 * リクエストペイロード
 */
interface DecryptMailRequest {
  messageId: string;
}

/**
 * レスポンスペイロード
 */
export interface DecryptMailResponse {
  bodyText?: string;
  bodyHtml?: string;
}

/**
 * コアロジック本体（テスト用に直接呼び出し可能）
 */
export async function executeDecryptMail(
  uid: string,
  messageId: string,
  db: admin.firestore.Firestore,
  storage: admin.storage.Storage
): Promise<DecryptMailResponse> {
  // メッセージを取得
  const messageRef = db
    .collection('users')
    .doc(uid)
    .collection('mailMessages')
    .doc(messageId);

  const messageDoc = await messageRef.get();

  if (!messageDoc.exists) {
    throw new Error('Message not found');
  }

  const messageData = messageDoc.data() as MailMessageDoc;

  // 小さい本文（Firestore）の場合
  if (!messageData.hasLargeBody) {
    const encrypted = messageData.bodyTextEncrypted;

    if (!encrypted) {
      throw new Error('Encrypted bodyText not found');
    }

    const decryptedBuffer = await decryptForUser(
      uid,
      encrypted as EncryptedData
    );
    const bodyText = decryptedBuffer.toString('utf-8');
    return { bodyText };
  }

  // 大きい本文（Storage）の場合
  const largeBodyPath = messageData.storage.largeBodyPath;

  if (!largeBodyPath) {
    throw new Error('Large body path not found');
  }

  const bucket = storage.bucket();
  const file = bucket.file(largeBodyPath);

  const [buffer] = await file.download();

  const encrypted = JSON.parse(buffer.toString('utf-8')) as EncryptedData;

  const decryptedBuffer = await decryptForUser(uid, encrypted);
  const bodyHtml = decryptedBuffer.toString('utf-8');

  return { bodyHtml };
}

/**
 * メール本文を復号して返すHTTP Callable Function
 *
 * テストコードから直接呼び出しやすくするため、型はanyとしてエクスポートする
 */
export const decryptMail: any = functions.region('asia-northeast1').https.onCall(
  async (
    data: DecryptMailRequest,
    context: functions.https.CallableContext
  ): Promise<DecryptMailResponse> => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const uid = context.auth.uid;
    const messageId = data?.messageId;

    if (!messageId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'messageId is required'
      );
    }

    const db = admin.firestore();
    const storage = admin.storage();

    try {
      return await executeDecryptMail(uid, messageId, db, storage);
    } catch (error: any) {
      functions.logger.error('Failed to decrypt message body', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to decrypt message body'
      );
    }
  }
);


