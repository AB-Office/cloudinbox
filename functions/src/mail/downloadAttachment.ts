/**
 * downloadAttachment - 添付ファイルダウンロード・復号化
 *
 * メッセージに含まれる添付ファイルをダウンロードして復号化するHTTP Callable Function
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { decryptForUser } from '../encryption';
import { EncryptedData } from './types';
import { getAttachmentPath } from './storagePaths';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * レスポンスペイロード
 */
export interface DownloadAttachmentResponse {
  content: string;  // Base64エンコードされたファイル内容
  filename: string;
  contentType: string;
  size: number;  // bytes
}

/**
 * コアロジック本体（テスト用に直接呼び出し可能）
 */
export async function executeDownloadAttachment(
  uid: string,
  messageId: string,
  filename: string,
  db: admin.firestore.Firestore,
  storage: admin.storage.Storage
): Promise<DownloadAttachmentResponse> {
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

  // 認証・認可チェック: Firestoreのパス構造（users/{uid}/mailMessages/{messageId}）により自動的にチェックされる

  functions.logger.info(`Downloading attachment: messageId=${messageId}, filename=${filename}`);

  // 添付ファイルのパスを構築
  const attachmentPath = getAttachmentPath(uid, messageId, filename);

  functions.logger.info(`Attachment path: ${attachmentPath} for message: ${messageId}, filename: ${filename}`);

  try {
    const bucket = storage.bucket();
    const file = bucket.file(attachmentPath);

    // ファイルの存在確認
    const [exists] = await file.exists();
    if (!exists) {
      functions.logger.error(`Storage file does not exist: ${attachmentPath} for message: ${messageId}, filename: ${filename}`);
      throw new Error(`Storage file does not exist: ${attachmentPath}`);
    }

    // メタデータを取得
    const [metadata] = await file.getMetadata();
    const size = parseInt(String(metadata.size || '0'), 10);
    const contentType = metadata.contentType || 'application/octet-stream';

    functions.logger.info(`Downloading attachment from Storage: ${attachmentPath} for message: ${messageId}`);
    const [buffer] = await file.download();
    functions.logger.info(`Downloaded buffer size: ${buffer.length} bytes for message: ${messageId}, filename: ${filename}`);

    const encrypted = JSON.parse(buffer.toString('utf-8')) as EncryptedData;
    functions.logger.info(`Parsed encrypted data, keys: ${Object.keys(encrypted).join(', ')} for message: ${messageId}, filename: ${filename}`);

    functions.logger.info(`Starting decryption for attachment, message: ${messageId}, filename: ${filename}`);
    const decryptedBuffer = await decryptForUser(uid, encrypted);
    functions.logger.info(`Decryption completed, buffer length: ${decryptedBuffer.length} bytes for message: ${messageId}, filename: ${filename}`);

    // Base64エンコード
    const content = decryptedBuffer.toString('base64');

    functions.logger.info(`Successfully downloaded and decrypted attachment: messageId=${messageId}, filename=${filename}, size=${size}, contentType=${contentType}`);

    return {
      content,
      filename,
      contentType,
      size,
    };
  } catch (error: any) {
    functions.logger.error(`Failed to download attachment: messageId=${messageId}, filename=${filename}`, error);
    functions.logger.error(`Error details: ${JSON.stringify(error)}`);
    functions.logger.error(`Error stack: ${error.stack}`);
    throw new Error(`Failed to download attachment: ${error.message}`);
  }
}

/**
 * リクエストペイロード
 */
interface DownloadAttachmentRequest {
  messageId: string;
  filename: string;
}

/**
 * 添付ファイルをダウンロードして復号化して返すHTTP Callable Function
 *
 * テストコードから直接呼び出しやすくするため、型はanyとしてエクスポートする
 */
export const downloadAttachment: any = functions.region('asia-northeast1').https.onCall(
  async (
    data: DownloadAttachmentRequest,
    context: functions.https.CallableContext
  ): Promise<DownloadAttachmentResponse> => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const uid = context.auth.uid;
    const messageId = data?.messageId;
    const filename = data?.filename;

    if (!messageId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'messageId is required'
      );
    }

    if (!filename) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'filename is required'
      );
    }

    const db = admin.firestore();
    const storage = admin.storage();

    try {
      const result = await executeDownloadAttachment(uid, messageId, filename, db, storage);
      functions.logger.info(`Successfully downloaded attachment: messageId=${messageId}, filename=${filename}, size=${result.size}`);
      return result;
    } catch (error: any) {
      functions.logger.error(`Failed to download attachment: messageId=${messageId}, filename=${filename}`, error);
      functions.logger.error(`Error stack: ${error.stack}`);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to download attachment: ${error.message}`
      );
    }
  }
);

