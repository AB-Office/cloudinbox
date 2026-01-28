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
export { encryptPasswordFunction as encryptPassword } from './mail/encryptPassword';

// メール自動受信
export { fetchMails } from './mail/fetchMails';

// Cloud Tasksハンドラ（processAccount用）
export { processAccountTaskHandler } from './mail/processAccountTaskHandler';

// Cloud Tasksハンドラ（sendMail用）
export { sendMailTaskHandler } from './mail/sendMailTaskHandler';

// メール本文復号
export { decryptMail } from './mail/decryptMail';

// ゴミ箱完全削除
export { purgeTrash } from './mail/purgeTrash';

// メール送信
export { sendMail } from './mail/sendMail';

// 添付ファイルリスト取得
export { getAttachmentsList } from './mail/getAttachmentsList';

// 添付ファイルダウンロード
export { downloadAttachment } from './mail/downloadAttachment';

// Stripe Checkout Session作成
export { createCheckoutSession } from './subscription/createCheckoutSession';

// Stripe Webhook
export { stripeWebhook } from './subscription/stripeWebhook';

