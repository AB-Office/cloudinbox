/**
 * sendMail - メール送信
 * 
 * メール送信リクエストを受け付け、Cloud Tasksにタスクを投入する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getCloudTasksClient } from './cloudTasksClient';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * メール送信リクエストの型定義
 */
interface SendMailRequest {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    contentType?: string;
  }>;
  threadId?: string; // 返信・転送の場合
  inReplyToMessageId?: string; // 返信・転送時の元のメールID（In-Reply-Toヘッダー用）
}

/**
 * メール送信レスポンスの型定義
 */
interface SendMailResponse {
  success: boolean;
  taskId?: string; // タスクID
  errorMessage?: string;
}

/**
 * メール送信を実行するHTTP Callable Function
 * 実際のメール送信処理はCloud Tasksに投入され、非同期で実行される
 */
export const sendMail: any = functions
  .region('asia-northeast1')
  .runWith({
    timeoutSeconds: 60, // タスク投入のみのため60秒に短縮
    memory: '256MB', // タスク投入のみのため256MBに削減
  })
  .https.onCall(
    async (data: SendMailRequest, context: functions.https.CallableContext): Promise<SendMailResponse> => {
      // 認証チェック
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const uid = context.auth.uid;

      // パラメータ検証
      if (!data.accountId || typeof data.accountId !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'accountId is required'
        );
      }

      if (!data.to || !Array.isArray(data.to) || data.to.length === 0) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'to is required and must be a non-empty array'
        );
      }

      if (!data.subject || typeof data.subject !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'subject is required'
        );
      }

      if (!data.body || typeof data.body !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'body is required'
        );
      }

      // メールアドレス形式の検証（簡易版）
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const allRecipients = [
        ...data.to,
        ...(data.cc || []),
        ...(data.bcc || []),
      ];
      
      for (const email of allRecipients) {
        if (!emailRegex.test(email)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `Invalid email address: ${email}`
          );
        }
      }

      const db = admin.firestore();

      try {
        // メールアカウント情報を取得（SMTP設定の存在確認のため）
        const accountRef = db
          .collection('users')
          .doc(uid)
          .collection('mailAccounts')
          .doc(data.accountId);

        const accountDoc = await accountRef.get();

        if (!accountDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            'Account not found'
          );
        }

        const accountData = accountDoc.data();
        
        if (!accountData) {
          throw new functions.https.HttpsError(
            'internal',
            'Account data is empty'
          );
        }

        const smtpConfig = accountData.smtp;

        if (!smtpConfig) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'SMTP configuration is required for sending mail'
          );
        }

        // Cloud Tasksにメール送信タスクを投入
        const cloudTasksClient = getCloudTasksClient();
        const { taskId } = await cloudTasksClient.enqueueSendMailTask(uid, {
          accountId: data.accountId,
          to: data.to,
          cc: data.cc,
          bcc: data.bcc,
          subject: data.subject,
          body: data.body,
          attachments: data.attachments,
          threadId: data.threadId,
          inReplyToMessageId: data.inReplyToMessageId,
        });

        functions.logger.info(`Send mail task enqueued: taskId=${taskId}, uid=${uid}, accountId=${data.accountId}`);

        return {
          success: true,
          taskId,
        };
      } catch (error: any) {
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        functions.logger.error('Error enqueuing send mail task:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Failed to enqueue send mail task: ${error.message || 'Unknown error'}`
        );
      }
    }
  );
