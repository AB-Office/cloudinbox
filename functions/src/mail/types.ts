/**
 * Firestore型定義
 * 
 * メールスレッドとメッセージのFirestoreドキュメント型定義
 */

import * as admin from 'firebase-admin';

/**
 * 暗号化されたデータの形式
 */
export interface EncryptedData {
  ciphertext: string; // base64エンコードされた暗号文
  nonce: string;      // base64エンコードされたnonce（12バイト）
  tag: string;        // base64エンコードされた認証タグ
}

/**
 * Storageパス情報
 */
export interface StoragePaths {
  rawMimePath: string;                    // MIME原本のパス
  largeBodyPath?: string;                  // 大きいHTML本文のパス（hasLargeBodyがtrueの場合）
  attachmentsBasePath?: string;            // 添付ファイルのベースパス（添付がある場合）
}

/**
 * メールスレッドドキュメント
 */
export interface MailThreadDoc {
  threadId: string;
  latestMessageId: string;
  subject: string;
  from: string;
  to: string[];
  preview: string;                         // bodyPreview
  hasUnread: boolean;
  labels: string[];                        // ["inbox"], ["archive"], ["trash"] など
  lastMessageAt: admin.firestore.Timestamp;
  sentAt: admin.firestore.Timestamp;       // 最新メッセージの送信日時
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * メールメッセージドキュメント
 */
export interface MailMessageDoc {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  sentAt: admin.firestore.Timestamp;
  receivedAt: admin.firestore.Timestamp;
  bodyPreview: string;                     // プレビュー用（最初の200文字程度）
  bodyTextEncrypted?: EncryptedData;      // 小さい本文（1MiB未満）のみ
  hasLargeBody: boolean;                   // 大きい本文はStorageに保存
  hasAttachments: boolean;
  storage: StoragePaths;
  isRead: boolean;
  labels: string[];                        // ["inbox"], ["archive"], ["trash"] など
  deletedAt: admin.firestore.Timestamp | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

