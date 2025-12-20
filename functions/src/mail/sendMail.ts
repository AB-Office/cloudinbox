/**
 * sendMail - メール送信
 * 
 * SMTP経由でメールを送信し、送信済みメールを保存する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as MailParser from 'mailparser';
import mailbuild = require('mailbuild');
import { decryptPassword } from '../encryption';
import { sendSmtpMail, SmtpConfig, Attachment } from './smtpClient';
import { saveMail } from './saveMail';
import { generateThreadId } from './mailProcessing';

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
}

/**
 * メール送信レスポンスの型定義
 */
interface SendMailResponse {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
}

/**
 * メール送信を実行するHTTP Callable Function
 */
export const sendMail: any = functions
  .region('asia-northeast1')
  .runWith({
    timeoutSeconds: 540, // 9分
    memory: '512MB',
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
      const storage = admin.storage();

      try {
        // メールアカウント情報を取得
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

        const email = accountData.email || '';
        const smtpConfig = accountData.smtp;

        if (!smtpConfig) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'SMTP configuration is required for sending mail'
          );
        }

        // SMTPパスワードを復号化
        const passwordEnc = smtpConfig.passwordEnc;
        if (!passwordEnc) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'SMTP password not found in account'
          );
        }

        let password: string;
        try {
          password = await decryptPassword(uid, passwordEnc);
        } catch (error: any) {
          functions.logger.error('Failed to decrypt SMTP password:', error);
          throw new functions.https.HttpsError(
            'internal',
            `Failed to decrypt SMTP password: ${error.message}`
          );
        }

        // SMTP設定を構築
        const smtpSettings: SmtpConfig = {
          host: smtpConfig.host,
          port: smtpConfig.port,
          useSsl: smtpConfig.useSsl !== false, // デフォルトはtrue
          userName: smtpConfig.userName,
          password,
        };

        // 添付ファイルを処理
        const attachments: Attachment[] = [];
        if (data.attachments && data.attachments.length > 0) {
          for (const att of data.attachments) {
            attachments.push({
              filename: att.filename,
              content: Buffer.from(att.content, 'base64'),
              contentType: att.contentType,
            });
          }
        }

        // SMTP経由でメール送信
        try {
          await sendSmtpMail(
            smtpSettings,
            email,
            data.to,
            data.cc,
            data.bcc,
            data.subject,
            data.body,
            attachments.length > 0 ? attachments : undefined
          );

          functions.logger.info(`Mail sent successfully via SMTP for account: ${data.accountId}`);
        } catch (error: any) {
          // セキュリティ: パスワードを破棄
          password = '';
          
          functions.logger.error('Failed to send mail via SMTP:', error);
          throw new functions.https.HttpsError(
            'internal',
            `Failed to send mail: ${error.message || 'SMTP error'}`
          );
        }

        // セキュリティ: パスワードを破棄
        password = '';

        // 送信済みメール保存用にMIMEメールを作成
        const messageId = `<${crypto.randomBytes(16).toString('hex')}@cloudinbox.local>`;
        const now = new Date();
        
        // mailbuildを使用してMIMEメールを作成
        const builder = mailbuild({
          from: email,
          to: data.to.join(', '),
          subject: data.subject,
          date: now,
          messageId: messageId,
          text: data.body,
        });

        if (data.cc && data.cc.length > 0) {
          builder.cc(data.cc.join(', '));
        }

        if (data.bcc && data.bcc.length > 0) {
          builder.bcc(data.bcc.join(', '));
        }

        // 添付ファイルを追加
        for (const att of attachments) {
          builder.attachment({
            filename: att.filename,
            contents: att.content,
            contentType: att.contentType || 'application/octet-stream',
          });
        }

        const mimeMessage = builder.build();

        // MIMEメールをmailparserで解析
        const parsed = await MailParser.simpleParser(mimeMessage);

        // スレッドIDを決定（返信・転送の場合は既存のthreadIdを使用、新規の場合は生成）
        let threadId: string;
        if (data.threadId) {
          threadId = data.threadId;
        } else {
          threadId = generateThreadId(parsed);
        }

        // 送信済みメールを保存（saveMail関数を使用、isSentMail=trueを指定）
        const sentMessageId = parsed.messageId
          ? parsed.messageId.replace(/[<>]/g, '')
          : crypto.randomBytes(16).toString('hex');

        await saveMail(uid, sentMessageId, threadId, mimeMessage, parsed, db, storage, true);

        functions.logger.info(`Sent mail saved: messageId=${sentMessageId}, threadId=${threadId}`);

        return {
          success: true,
          messageId: sentMessageId,
        };
      } catch (error: any) {
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        functions.logger.error('Error sending mail:', error);
        throw new functions.https.HttpsError(
          'internal',
          `Failed to send mail: ${error.message || 'Unknown error'}`
        );
      }
    }
  );

