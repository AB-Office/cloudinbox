/**
 * getAttachmentsList - 添付ファイルリスト取得
 *
 * メッセージに含まれる添付ファイルのリストを取得するHTTP Callable Function
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { MailMessageDoc } from './types';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * リクエストペイロード
 */
interface GetAttachmentsListRequest {
  messageId: string;
}

/**
 * レスポンスペイロード
 */
export interface AttachmentListItem {
  filename: string;
  size: number;  // bytes
  contentType: string;
}

/**
 * レスポンスペイロード
 */
export interface GetAttachmentsListResponse {
  attachments: AttachmentListItem[];
}

/**
 * コアロジック本体（テスト用に直接呼び出し可能）
 */
export async function executeGetAttachmentsList(
  uid: string,
  messageId: string,
  db: admin.firestore.Firestore,
  storage: admin.storage.Storage
): Promise<AttachmentListItem[]> {
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

  functions.logger.info(`Getting attachments list: messageId=${messageId}, hasAttachments=${messageData.hasAttachments}, attachmentsBasePath=${messageData.storage?.attachmentsBasePath}`);

  // hasAttachmentsがfalseの場合は空リストを返す
  if (!messageData.hasAttachments) {
    functions.logger.info(`Message has no attachments: messageId=${messageId}`);
    return [];
  }

  // attachmentsBasePathが存在しない場合は空リストを返す
  const attachmentsBasePath = messageData.storage?.attachmentsBasePath;
  if (!attachmentsBasePath) {
    functions.logger.warn(`attachmentsBasePath not found for message with hasAttachments=true: messageId=${messageId}`);
    return [];
  }

  try {
    const bucket = storage.bucket();
    
    // Storageからファイルリストを取得
    functions.logger.info(`Getting files from Storage with prefix: ${attachmentsBasePath} for message: ${messageId}`);
    const [files] = await bucket.getFiles({ prefix: attachmentsBasePath });

    functions.logger.info(`Found ${files.length} files in Storage for message: ${messageId}`);

    // ファイルリストを処理
    const attachments: AttachmentListItem[] = [];

    for (const file of files) {
      try {
        // メタデータを取得
        const [metadata] = await file.getMetadata();
        
        // ファイル名をStorageパスから抽出（.enc拡張子を除去）
        // パス形式: mail-data/{uid}/{messageId}/attachments/{filename}.enc
        const fullPath = file.name;
        const pathParts = fullPath.split('/');
        const filenameWithExt = pathParts[pathParts.length - 1];
        
        // .enc拡張子を除去
        let filename = filenameWithExt;
        if (filename.endsWith('.enc')) {
          filename = filename.slice(0, -4);
        }

        // サイズとcontentTypeを取得
        const size = parseInt(String(metadata.size || '0'), 10);
        const contentType = metadata.contentType || 'application/octet-stream';

        attachments.push({
          filename,
          size,
          contentType,
        });

        functions.logger.info(`Added attachment: filename=${filename}, size=${size}, contentType=${contentType} for message: ${messageId}`);
      } catch (error: any) {
        functions.logger.error(`Failed to get metadata for file: ${file.name} for message: ${messageId}`, error);
        // 個別のファイルのメタデータ取得に失敗しても続行
      }
    }

    functions.logger.info(`Successfully retrieved ${attachments.length} attachments for message: ${messageId}`);
    return attachments;
  } catch (error: any) {
    functions.logger.error(`Failed to get attachments list from Storage for message: ${messageId}`, error);
    functions.logger.error(`Error details: ${JSON.stringify(error)}`);
    throw new Error('Failed to get attachments list');
  }
}

/**
 * 添付ファイルリストを取得して返すHTTP Callable Function
 *
 * テストコードから直接呼び出しやすくするため、型はanyとしてエクスポートする
 */
export const getAttachmentsList: any = functions.region('asia-northeast1').https.onCall(
  async (
    data: GetAttachmentsListRequest,
    context: functions.https.CallableContext
  ): Promise<GetAttachmentsListResponse> => {
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
      const attachments = await executeGetAttachmentsList(uid, messageId, db, storage);
      functions.logger.info(`Successfully retrieved attachments list: messageId=${messageId}, count=${attachments.length}`);
      return { attachments };
    } catch (error: any) {
      functions.logger.error(`Failed to get attachments list: messageId=${messageId}`, error);
      functions.logger.error(`Error stack: ${error.stack}`);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to get attachments list: ${error.message}`
      );
    }
  }
);

