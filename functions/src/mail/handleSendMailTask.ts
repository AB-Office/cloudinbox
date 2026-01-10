/**
 * handleSendMailTask - メール送信タスク処理
 * 
 * Cloud Tasksから呼び出され、実際のSMTPメール送信と送信済みメールの保存を行う
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import * as MailParser from 'mailparser';
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
 * メール送信タスクペイロードの型定義
 */
export interface SendMailTaskPayload {
  uid: string;
  taskId?: string; // タスク結果保存用（タスク1.3で使用）
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
 * メール送信タスク結果の型定義
 */
export interface SendMailTaskResult {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
}

/**
 * メール送信タスクを処理する
 * 
 * @param payload - メール送信タスクペイロード
 * @returns メール送信タスク結果
 */
export async function handleSendMailTask(
  payload: SendMailTaskPayload
): Promise<SendMailTaskResult> {
  // パラメータ検証
  if (!payload.uid || typeof payload.uid !== 'string' || payload.uid.trim() === '') {
    throw new Error('uid is required');
  }

  if (!payload.accountId || typeof payload.accountId !== 'string' || payload.accountId.trim() === '') {
    throw new Error('accountId is required');
  }

  if (!payload.to || !Array.isArray(payload.to) || payload.to.length === 0) {
    throw new Error('to is required and must be a non-empty array');
  }

  if (!payload.subject || typeof payload.subject !== 'string' || payload.subject.trim() === '') {
    throw new Error('subject is required');
  }

  if (!payload.body || typeof payload.body !== 'string' || payload.body.trim() === '') {
    throw new Error('body is required');
  }

  // メールアドレス形式の検証（簡易版）
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const allRecipients = [
    ...payload.to,
    ...(payload.cc || []),
    ...(payload.bcc || []),
  ];
  
  for (const email of allRecipients) {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }

  const db = admin.firestore();
  const storage = admin.storage();

  try {
    // メールアカウント情報を取得
    const accountRef = db
      .collection('users')
      .doc(payload.uid)
      .collection('mailAccounts')
      .doc(payload.accountId);

    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      throw new Error('Account not found');
    }

    const accountData = accountDoc.data();
    
    if (!accountData) {
      throw new Error('Account data is empty');
    }

    const email = accountData.email || '';
    const smtpConfig = accountData.smtp;

    if (!smtpConfig) {
      throw new Error('SMTP configuration is required for sending mail');
    }

    // SMTPパスワードを復号化
    const passwordEnc = smtpConfig.passwordEnc;
    if (!passwordEnc) {
      throw new Error('SMTP password not found in account');
    }

    let password: string;
    try {
      password = await decryptPassword(payload.uid, passwordEnc);
    } catch (error: any) {
      functions.logger.error('Failed to decrypt SMTP password:', error);
      throw new Error(`Failed to decrypt SMTP password: ${error.message}`);
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
    if (payload.attachments && payload.attachments.length > 0) {
      for (const att of payload.attachments) {
        attachments.push({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType,
        });
      }
    }

    // 送信元メールアドレス検証
    const fromAddress = (accountData.email || '').trim();
    const emailRegexFrom = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegexFrom.test(fromAddress)) {
      throw new Error('Valid sender email address is required in account');
    }

    // SMTP経由でメール送信
    functions.logger.info(`handleSendMailTask: Preparing to send mail - from: ${fromAddress}, auth user: ${smtpConfig.userName}, accountId: ${payload.accountId}`);
    
    // In-Reply-Toヘッダーを準備（返信・転送の場合）
    const customHeaders: Record<string, string> = {};
    if (payload.inReplyToMessageId && payload.inReplyToMessageId.trim() !== '') {
      const sanitizeHeader = (v: string) => v.replace(/\r?\n/g, ' ').trim();
      const id = `<${sanitizeHeader(payload.inReplyToMessageId.trim())}>`;
      customHeaders['In-Reply-To'] = id;
      customHeaders['References'] = id;
    }
    
    try {
      await sendSmtpMail(
        smtpSettings,
        fromAddress,
        payload.to,
        payload.cc,
        payload.bcc,
        payload.subject,
        payload.body,
        attachments.length > 0 ? attachments : undefined,
        Object.keys(customHeaders).length > 0 ? customHeaders : undefined
      );

      functions.logger.info(`Mail sent successfully via SMTP for account: ${payload.accountId}`);
    } catch (error: any) {
      // セキュリティ: パスワードを破棄
      password = '';
      
      functions.logger.error('Failed to send mail via SMTP:', error);
      throw new Error(`Failed to send mail: ${error.message || 'SMTP error'}`);
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
    const toHeader = payload.to.map(sanitizeHeader).join(', ');
    const ccHeader = (payload.cc && payload.cc.length > 0) ? payload.cc.map(sanitizeHeader).join(', ') : undefined;
    const headers: string[] = [];
    headers.push(`Message-ID: ${messageId}`);
    headers.push(`Date: ${dateStr}`);
    headers.push(`MIME-Version: 1.0`);
    headers.push(`From: ${sanitizeHeader(email)}`);
    headers.push(`To: ${toHeader}`);
    if (ccHeader) {
      headers.push(`Cc: ${ccHeader}`);
    }
    headers.push(`Subject: ${encodeSubject(payload.subject)}`);
    // In-Reply-To/References ヘッダーを追加（返信・転送の場合）
    if (payload.inReplyToMessageId && payload.inReplyToMessageId.trim() !== '') {
      const id = `<${sanitizeHeader(payload.inReplyToMessageId.trim())}>`;
      headers.push(`In-Reply-To: ${id}`);
      headers.push(`References: ${id}`);
    }
    const normalizeCRLF = (v: string) => v.replace(/\r?\n/g, CRLF);
    // quoted-printableモジュールを使用してエンコード
    // UTF-8文字列をBufferに変換してからエンコード（quoted-printableはバイト列を期待）
    const bodyBuffer = Buffer.from(payload.body, 'utf8');
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
    if (payload.threadId) {
      threadId = payload.threadId;
    } else {
      threadId = generateThreadId(parsed);
    }

    // 送信済みメールを保存（saveMail関数を使用、isSentMail=trueを指定）
    const sentMessageId = parsed.messageId
      ? parsed.messageId.replace(/[<>]/g, '')
      : crypto.randomBytes(16).toString('hex');

    await saveMail(payload.uid, sentMessageId, threadId, mimeMessage, parsed, db, storage, true);

    functions.logger.info(`Sent mail saved: messageId=${sentMessageId}, threadId=${threadId}`);

    // タスク結果をFirestoreに保存（成功時）
    if (payload.taskId) {
      try {
        const taskResultRef = db
          .collection('users')
          .doc(payload.uid)
          .collection('mailTaskResults')
          .doc(payload.taskId);

        await taskResultRef.set({
          success: true,
          messageId: sentMessageId,
          taskId: payload.taskId,
          accountId: payload.accountId,
          subject: payload.subject,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: false });

        functions.logger.info(`Task result saved: taskId=${payload.taskId}, success=true, messageId=${sentMessageId}`);
      } catch (taskResultError: any) {
        // タスク結果保存の失敗はメール送信処理のエラーとしては扱わない
        functions.logger.error(`Failed to save task result: taskId=${payload.taskId}`, taskResultError);
      }
    }

    return {
      success: true,
      messageId: sentMessageId,
    };
  } catch (error: any) {
    functions.logger.error('Error in handleSendMailTask:', error);

    // タスク結果をFirestoreに保存（失敗時）
    if (payload.taskId) {
      try {
        const taskResultRef = db
          .collection('users')
          .doc(payload.uid)
          .collection('mailTaskResults')
          .doc(payload.taskId);

        await taskResultRef.set({
          success: false,
          errorMessage: error.message || 'Unknown error',
          taskId: payload.taskId,
          accountId: payload.accountId,
          subject: payload.subject,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: false });

        functions.logger.info(`Task result saved: taskId=${payload.taskId}, success=false, errorMessage=${error.message}`);
      } catch (taskResultError: any) {
        // タスク結果保存の失敗はメール送信処理のエラーとしては扱わない
        functions.logger.error(`Failed to save task result: taskId=${payload.taskId}`, taskResultError);
      }
    }
    
    // エラーをスローしてCloud Tasksの再試行ポリシーに委ねる
    throw error;
  }
}

