/**
 * Storageパスユーティリティ
 * 
 * メールデータのStorageパスを生成する
 */

/**
 * MIME原本のパスを取得する
 * 
 * @param uid - ユーザーID
 * @param messageId - メッセージID
 * @returns Storageパス
 */
export function getRawMimePath(uid: string, messageId: string): string {
  return `mail-data/${uid}/${messageId}/raw.eml.enc`;
}

/**
 * 大きいHTML本文のパスを取得する
 * 
 * @param uid - ユーザーID
 * @param messageId - メッセージID
 * @returns Storageパス
 */
export function getBodyHtmlPath(uid: string, messageId: string): string {
  return `mail-data/${uid}/${messageId}/body.html.enc`;
}

/**
 * 添付ファイルのベースパスを取得する
 * 
 * @param uid - ユーザーID
 * @param messageId - メッセージID
 * @returns Storageパス（ディレクトリ）
 */
export function getAttachmentsBasePath(uid: string, messageId: string): string {
  return `mail-data/${uid}/${messageId}/attachments/`;
}

/**
 * 添付ファイルのパスを取得する
 * 
 * @param uid - ユーザーID
 * @param messageId - メッセージID
 * @param filename - ファイル名
 * @returns Storageパス
 */
export function getAttachmentPath(uid: string, messageId: string, filename: string): string {
  return `${getAttachmentsBasePath(uid, messageId)}${filename}.enc`;
}

