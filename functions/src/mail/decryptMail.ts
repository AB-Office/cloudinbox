/**
 * decryptMail - メール本文復号
 *
 * 暗号化されたメール本文を復号してクライアントに返すHTTP Callable Function
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as MailParser from 'mailparser';
import { decryptForUser } from '../encryption';
import { EncryptedData, MailMessageDoc } from './types';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

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

  functions.logger.info(`Decrypting message: messageId=${messageId}, hasLargeBody=${messageData.hasLargeBody}, hasBodyTextEncrypted=${!!messageData.bodyTextEncrypted}, storage=${JSON.stringify(messageData.storage)}`);

  // 小さい本文（Firestore）の場合
  if (!messageData.hasLargeBody) {
    const encrypted = messageData.bodyTextEncrypted;

    if (!encrypted) {
      functions.logger.error(`Encrypted bodyText not found for message: ${messageId}`);
      throw new Error('Encrypted bodyText not found');
    }

    try {
      // 暗号化データのサイズを確認
      const encryptedSize = JSON.stringify(encrypted).length;
      functions.logger.info(`Encrypted data size: ${encryptedSize} bytes for message: ${messageId}`);
      functions.logger.info(`Encrypted data keys: ${Object.keys(encrypted).join(', ')} for message: ${messageId}`);
      functions.logger.info(`Starting decryption for message: ${messageId}`);
      
      const decryptedBuffer = await decryptForUser(
        uid,
        encrypted as EncryptedData
      );
      functions.logger.info(`Decryption completed, buffer length: ${decryptedBuffer.length} bytes for message: ${messageId}`);
      
      const bodyText = decryptedBuffer.toString('utf-8');
      functions.logger.info(`Decrypted bodyText length: ${bodyText.length} for message: ${messageId}`);
      functions.logger.info(`Decrypted bodyText preview (first 200 chars): ${bodyText.substring(0, 200)}`);
      
      // 復号結果が空の場合は、StorageからMIME原本を取得してそのまま返す
      if (bodyText.length === 0) {
        functions.logger.warn(`WARNING: Decrypted bodyText is empty for message: ${messageId}. Encrypted data exists (size: ${encryptedSize} bytes) but decryption resulted in empty string. Trying to get raw MIME from Storage.`);
        
        // StorageからMIME原本を取得
        const rawMimePath = messageData.storage?.rawMimePath;
        if (rawMimePath) {
          try {
            functions.logger.info(`Fetching raw MIME from Storage: ${rawMimePath} for message: ${messageId}`);
            const bucket = storage.bucket();
            const file = bucket.file(rawMimePath);
            const [exists] = await file.exists();
            if (exists) {
              const [buffer] = await file.download();
              const encrypted = JSON.parse(buffer.toString('utf-8')) as EncryptedData;
              const rawMimeBuffer = await decryptForUser(uid, encrypted);
              const rawMime = rawMimeBuffer.toString('utf-8');
              
              // MIME原本をパースして本文のみを抽出（仕様書に基づき、本文のみを返す）
              try {
                const parsed = await MailParser.simpleParser(rawMime);
                
                // 本文を取得（text優先、なければhtml、それもなければtextAsHtml）
                let bodyText = '';
                if (parsed.text) {
                  bodyText = parsed.text;
                } else if (parsed.html) {
                  // HTMLからテキストを抽出（簡易版）
                  bodyText = parsed.html
                    .replace(/<[^>]+>/g, '')  // HTMLタグを削除
                    .replace(/&nbsp;/g, ' ')   // &nbsp;をスペースに
                    .replace(/&[a-z]+;/gi, '') // その他のエンティティを削除
                    .trim();
                } else if (parsed.textAsHtml) {
                  // textAsHtmlからテキストを抽出
                  bodyText = parsed.textAsHtml
                    .replace(/<[^>]+>/g, '')  // HTMLタグを削除
                    .replace(/&nbsp;/g, ' ')   // &nbsp;をスペースに
                    .replace(/&[a-z]+;/gi, '') // その他のエンティティを削除
                    .trim();
                }
                
                if (bodyText.length === 0) {
                  functions.logger.warn(`WARNING: Parsed body is empty for message: ${messageId}`);
                }
                
                return { bodyText };
              } catch (parseError: any) {
                functions.logger.error(`Failed to parse MIME for message: ${messageId}`, parseError);
                // パースに失敗した場合は、MIME原本をそのまま返す（フォールバック）
                functions.logger.warn(`Returning raw MIME as fallback for message: ${messageId}`);
                return { bodyText: rawMime };
              }
            } else {
              functions.logger.error(`Raw MIME file does not exist in Storage: ${rawMimePath} for message: ${messageId}`);
            }
          } catch (error: any) {
            functions.logger.error(`Failed to get raw MIME from Storage for message: ${messageId}`, error);
            functions.logger.error(`Error details: ${JSON.stringify(error)}`);
          }
        } else {
          functions.logger.error(`Raw MIME path not found in storage object for message: ${messageId}`);
        }
      }
      
      // 必ず何か返す（空文字列でも返す）
      return { bodyText: bodyText || '' };
    } catch (error: any) {
      functions.logger.error(`Failed to decrypt bodyText for message: ${messageId}`, error);
      // フォールバック: StorageのMIME原本を取得して本文を抽出
      const rawMimePath = messageData.storage?.rawMimePath;
      if (rawMimePath) {
        try {
          const bucket = storage.bucket();
          const file = bucket.file(rawMimePath);
          const [exists] = await file.exists();
          if (exists) {
            const [buffer] = await file.download();
            const enc = JSON.parse(buffer.toString('utf-8')) as EncryptedData;
            const rawMimeBuffer = await decryptForUser(uid, enc);
            const rawMime = rawMimeBuffer.toString('utf-8');
            try {
              const parsed = await MailParser.simpleParser(rawMime);
              let fallbackText = '';
              if (parsed.text) {
                fallbackText = parsed.text;
              } else if (parsed.html) {
                fallbackText = parsed.html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, '').trim();
              } else if (parsed.textAsHtml) {
                fallbackText = parsed.textAsHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, '').trim();
              }
              return { bodyText: fallbackText || '' };
            } catch {
              return { bodyText: rawMime }
            }
          }
        } catch (e) {
          functions.logger.error(`Failed to parse MIME for message: ${messageId}`, e);
        }
      }
      return { bodyText: '' };
    }
  }

  // 大きい本文（Storage）の場合
  const largeBodyPath = messageData.storage?.largeBodyPath;

  functions.logger.info(`Large body path for message: ${messageId}, path: ${largeBodyPath}, storage object: ${JSON.stringify(messageData.storage)}`);

  if (!largeBodyPath) {
    functions.logger.error(`Large body path not found for message: ${messageId}. hasLargeBody=${messageData.hasLargeBody}, storage=${JSON.stringify(messageData.storage)}`);
    throw new Error('Large body path not found');
  }

  try {
    const bucket = storage.bucket();
    const file = bucket.file(largeBodyPath);

    // ファイルの存在確認
    const [exists] = await file.exists();
    if (!exists) {
      functions.logger.error(`Storage file does not exist: ${largeBodyPath} for message: ${messageId}`);
      throw new Error(`Storage file does not exist: ${largeBodyPath}`);
    }

    functions.logger.info(`Downloading large body from Storage: ${largeBodyPath} for message: ${messageId}`);
    const [buffer] = await file.download();
    functions.logger.info(`Downloaded buffer size: ${buffer.length} bytes for message: ${messageId}`);

    const encrypted = JSON.parse(buffer.toString('utf-8')) as EncryptedData;
    functions.logger.info(`Parsed encrypted data, keys: ${Object.keys(encrypted).join(', ')} for message: ${messageId}`);

    functions.logger.info(`Starting decryption for large body, message: ${messageId}`);
    const decryptedBuffer = await decryptForUser(uid, encrypted);
    functions.logger.info(`Decryption completed, buffer length: ${decryptedBuffer.length} bytes for message: ${messageId}`);
    
    const bodyHtml = decryptedBuffer.toString('utf-8');
    functions.logger.info(`Decrypted bodyHtml length: ${bodyHtml.length} for message: ${messageId}`);
    functions.logger.info(`Decrypted bodyHtml preview (first 200 chars): ${bodyHtml.substring(0, 200)}`);
    
    // bodyHtmlが空の場合は警告を出す
    if (bodyHtml.length === 0) {
      functions.logger.warn(`WARNING: Decrypted bodyHtml is empty for message: ${messageId}. Encrypted data exists but decryption resulted in empty string.`);
    }
    
    // 必ず何か返す（空文字列でも返す）
    return { bodyHtml: bodyHtml || '' };
  } catch (error: any) {
    functions.logger.error(`Failed to decrypt bodyHtml for message: ${messageId}, path: ${largeBodyPath}`, error);
    functions.logger.error(`Error details: ${JSON.stringify(error)}`);
    functions.logger.error(`Error stack: ${error.stack}`);
    // エラーが発生しても空文字列を返す（エラーをthrowしない）
    functions.logger.warn(`Returning empty bodyHtml due to decryption error for message: ${messageId}`);
    return { bodyHtml: '' };
  }
}

/**
 * メール本文を復号して返すHTTP Callable Function
 *
 * テストコードから直接呼び出しやすくするため、型はanyとしてエクスポートする
 */
export const decryptMail: any = functions
  .region('asia-northeast1')
  .runWith({
    minInstances: 1, // コールドスタート回避のため、常に1インスタンスを起動状態に保つ
  })
  .https.onCall(
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
      const result = await executeDecryptMail(uid, messageId, db, storage);
      functions.logger.info(`Successfully decrypted message: messageId=${messageId}, bodyText length=${result.bodyText?.length || 0}, bodyHtml length=${result.bodyHtml?.length || 0}`);
      return result;
    } catch (error: any) {
      functions.logger.error(`Failed to decrypt message body: messageId=${messageId}`, error);
      functions.logger.error(`Error stack: ${error.stack}`);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to decrypt message body: ${error.message}`
      );
    }
  }
);


