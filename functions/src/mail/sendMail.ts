/**
 * sendMail - メール送信
 * 
 * SMTP経由でメールを送信し、送信済みメールを保存する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as MailParser from 'mailparser';
// mailbuildはFirebase Functions環境で互換性の問題があるため、手動でMIME構築を行う
// import mailbuild = require('mailbuild');
import * as quotedPrintable from 'quoted-printable';
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
  inReplyToMessageId?: string; // 返信・転送時の元のメールID（In-Reply-Toヘッダー用）
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

        // 送信元メールアドレス検証
        const fromAddress = (accountData.email || '').trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(fromAddress)) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Valid sender email address is required in account'
          );
        }

        // SMTP経由でメール送信
        functions.logger.info(`sendMail: Preparing to send mail - from: ${fromAddress}, auth user: ${smtpConfig.userName}, accountId: ${data.accountId}`);
        
        // In-Reply-Toヘッダーを準備（返信・転送の場合）
        const customHeaders: Record<string, string> = {};
        if (data.inReplyToMessageId && data.inReplyToMessageId.trim() !== '') {
          const sanitizeHeader = (v: string) => v.replace(/\r?\n/g, ' ').trim();
          const inReplyToValue = `<${sanitizeHeader(data.inReplyToMessageId.trim())}>`;
          customHeaders['In-Reply-To'] = inReplyToValue;
        }
        
        try {
          await sendSmtpMail(
            smtpSettings,
            fromAddress,
            data.to,
            data.cc,
            data.bcc,
            data.subject,
            data.body,
            attachments.length > 0 ? attachments : undefined,
            Object.keys(customHeaders).length > 0 ? customHeaders : undefined
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
        // mailbuildがFirebase Functions環境で互換性の問題があるため、手動でMIME構築
        const messageId = `<${crypto.randomBytes(16).toString('hex')}@cloudinbox.local>`;
        const now = new Date();
        
        // RFC 2822に準拠した基本的なMIMEメールを構築
        const dateStr = now.toUTCString().replace(/GMT$/, '+0000');
        const boundary = `----=_Part_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;
        
        // ヘッダーを構築（CRLFで統一）
        const CRLF = '\r\n';
        const sanitizeHeader = (v: string) => v.replace(/\r?\n/g, ' ').trim();
        const encodeSubject = (v: string) => `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
        const toHeader = data.to.map(sanitizeHeader).join(', ');
        const ccHeader =  (data.cc && data.cc.length > 0) ? data.cc.map(sanitizeHeader).join(', ') : undefined;
        const headers: string[] = [];
        headers.push(`Message-ID: ${messageId}`);
        headers.push(`Date: ${dateStr}`);
        headers.push(`MIME-Version: 1.0`);
        headers.push(`From: ${sanitizeHeader(email)}`);
        headers.push(`To: ${toHeader}`);
        if (ccHeader) {
          headers.push(`Cc: ${ccHeader}`);
        }
        headers.push(`Subject: ${encodeSubject(data.subject)}`);
        // In-Reply-Toヘッダーを追加（返信・転送の場合）
        if (data.inReplyToMessageId && data.inReplyToMessageId.trim() !== '') {
          // Message-IDは<>で囲まれた形式で、保存時は<>が削除されているため、再度<>で囲む
          const inReplyToValue = `<${sanitizeHeader(data.inReplyToMessageId.trim())}>`;
          headers.push(`In-Reply-To: ${inReplyToValue}`);
        }
        const normalizeCRLF = (v: string) => v.replace(/\r?\n/g, CRLF);
        // quoted-printableモジュールを使用してエンコード
        // UTF-8文字列をBufferに変換してからエンコード（quoted-printableはバイト列を期待）
        const bodyBuffer = Buffer.from(data.body, 'utf8');
        const bodyQp = quotedPrintable.encode(bodyBuffer.toString('latin1'));
        
        let mimeBody = '';
        if (attachments.length > 0) {
          headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
          
          // 本文パート
          mimeBody += `--${boundary}${CRLF}`;
          mimeBody += `Content-Type: text/plain; charset=utf-8${CRLF}`;
          mimeBody += `Content-Transfer-Encoding: quoted-printable${CRLF}${CRLF}`;
          mimeBody += normalizeCRLF(bodyQp) + CRLF;

          // 添付ファイル
          for (const att of attachments) {
            const encodedFilename = `=?UTF-8?B?${Buffer.from(att.filename, 'utf8').toString('base64')}?=`;
            const base64Content = att.content.toString('base64').replace(/(.{1,76})/g, '$1' + CRLF).trimEnd();
            mimeBody += `--${boundary}${CRLF}`;
            mimeBody += `Content-Type: ${att.contentType || 'application/octet-stream'}${CRLF}`;
            mimeBody += `Content-Disposition: attachment; filename="${encodedFilename}${CRLF}`;
            mimeBody += `Content-Transfer-Encoding: base64${CRLF}${CRLF}`;
            mimeBody += base64Content + CRLF;
          }
          mimeBody += `--${boundary}--${CRLF}`;
        } else {
          // シンプルなテキストメッセージ
          headers.push(`Content-Type: text/plain; charset=utf-8`);
          headers.push(`Content-Transfer-Encoding: quoted-printable`);
          mimeBody = normalizeCRLF(bodyQp);
        }
        
        // ヘッダーとボディを結合
        const mimeMessage = headers.join(CRLF) + CRLF + CRLF + mimeBody;
        
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

