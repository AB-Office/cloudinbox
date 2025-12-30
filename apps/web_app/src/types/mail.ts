import { Timestamp } from 'firebase/firestore';

/**
 * 暗号化されたデータの形式
 */
export interface EncryptedData {
  ciphertext: string; // base64エンコードされた暗号文
  nonce: string; // base64エンコードされたnonce（12バイト）
  tag: string; // base64エンコードされた認証タグ
}

/**
 * Storageパス情報
 */
export interface StoragePaths {
  rawMimePath: string;
  largeBodyPath?: string;
  attachmentsBasePath?: string;
}

/**
 * メールスレッド
 */
export interface MailThread {
  id?: string; // FirestoreドキュメントID（オプショナル）
  threadId: string;
  latestMessageId: string;
  subject: string;
  from: string;
  to: string[];
  preview: string; // bodyPreview
  hasUnread: boolean;
  labels: string[]; // ["inbox"], ["archive"], ["trash"] など
  lastMessageAt: Timestamp;
  sentAt: Timestamp; // 最新メッセージの送信日時
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * メールメッセージ
 */
export interface MailMessage {
  id?: string; // FirestoreドキュメントID（オプショナル）
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  sentAt: Timestamp;
  receivedAt: Timestamp;
  bodyPreview: string; // プレビュー用（最初の200文字程度）
  bodyTextEncrypted?: EncryptedData; // 小さい本文（1MiB未満）のみ
  hasLargeBody: boolean; // 大きい本文はStorageに保存
  hasAttachments: boolean;
  storage?: StoragePaths;
  isRead: boolean;
  labels: string[]; // ["inbox"], ["archive"], ["trash"] など
  deletedAt?: Timestamp | null; // ゴミ箱に移動した日時、復元時はnull
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 復号化されたメール本文
 */
export interface DecryptedMailBody {
  bodyText?: string;
  bodyHtml?: string;
}

/**
 * 添付ファイル情報
 */
export interface AttachmentListItem {
  filename: string;
  size: number; // bytes
  contentType: string;
}
