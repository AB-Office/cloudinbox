/**
 * CloudInbox MVP - Cloud Functions
 * 
 * Main entry point for Firebase Cloud Functions
 */

// ユーザー初期化
export { onUserCreate } from './users/onUserCreate';

// メールアカウント接続テスト
export { accountTest } from './mail/accountTest';

// メール自動受信
export { fetchMails } from './mail/fetchMails';

// メール本文復号
export { decryptMail } from './mail/decryptMail';

// ゴミ箱完全削除
export { purgeTrash } from './mail/purgeTrash';

