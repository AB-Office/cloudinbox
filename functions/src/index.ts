/**
 * CloudInbox MVP - Cloud Functions
 * 
 * Main entry point for Firebase Cloud Functions
 */

import * as admin from 'firebase-admin';

// Firebase Admin SDKの初期化
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

// ユーザー初期化
export { onUserCreate } from './users/onUserCreate';

// メールアカウント接続テスト
export { accountTest } from './mail/accountTest';

// パスワード暗号化
export { encryptPasswordFunction } from './mail/encryptPassword';

// メール自動受信
export { fetchMails } from './mail/fetchMails';

// メール本文復号
export { decryptMail } from './mail/decryptMail';

// ゴミ箱完全削除
export { purgeTrash } from './mail/purgeTrash';

// メール送信
export { sendMail } from './mail/sendMail';

