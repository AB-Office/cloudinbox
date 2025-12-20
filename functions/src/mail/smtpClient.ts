/**
 * SMTP接続クライアント
 * 
 * SSL/TLSを使用したSMTP接続と認証テスト、メール送信を実行する
 */

import nodemailer from 'nodemailer';
import * as functions from 'firebase-functions';

/**
 * SMTP接続テストの結果
 */
export interface SmtpTestResult {
  success: boolean;
  errorMessage?: string;
}

/**
 * SMTP設定
 */
export interface SmtpConfig {
  host: string;
  port: number;
  useSsl: boolean;
  userName: string;
  password: string;
}

/**
 * 添付ファイル
 */
export interface Attachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * SMTP接続をテストする
 * 
 * @param host - SMTPサーバーのホスト名
 * @param port - SMTPサーバーのポート番号（通常587または465）
 * @param useSsl - SSL/TLSを使用するか（必須: true）
 * @param userName - ユーザー名
 * @param password - パスワード（平文）
 * @returns 接続テスト結果
 */
export async function testSmtpConnection(
  host: string,
  port: number,
  useSsl: boolean,
  userName: string,
  password: string
): Promise<SmtpTestResult> {
  // SSL/TLS必須チェック
  if (!useSsl) {
    return {
      success: false,
      errorMessage: 'SSL/TLS is required for SMTP connections',
    };
  }

  functions.logger.info(`testSmtpConnection: Connecting to ${host}:${port}`);

  try {
    // nodemailerのトランスポートを作成
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // ポート465の場合はsecure: true、587の場合はstarttlsを使用
      auth: {
        user: userName,
        pass: password,
      },
      // SSL/TLS設定
      tls: {
        rejectUnauthorized: true, // 証明書検証を有効化
      },
      connectionTimeout: 10000, // 10秒の接続タイムアウト
      greetingTimeout: 10000, // 10秒のグリーティングタイムアウト
    });

    // 接続テスト（verify）を実行
    await transporter.verify();

    functions.logger.info(`testSmtpConnection: Connection and authentication successful for ${host}:${port}`);

    // トランスポートを閉じる
    transporter.close();

    return { success: true };
  } catch (error: any) {
    functions.logger.error(`testSmtpConnection error for ${host}:${port}:`, error);

    // エラーメッセージを適切にフォーマット
    let errorMessage = 'Connection or authentication failed';
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to SMTP server: ${error.message || error.code}`;
    } else if (error.code === 'EAUTH') {
      errorMessage = `Authentication failed: ${error.message || 'Invalid username or password'}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      errorMessage,
    };
  }
}

/**
 * SMTP経由でメールを送信する
 * 
 * @param config - SMTP設定
 * @param from - 送信元メールアドレス
 * @param to - 宛先メールアドレス配列
 * @param cc - CCメールアドレス配列（オプション）
 * @param bcc - BCCメールアドレス配列（オプション）
 * @param subject - 件名
 * @param body - 本文（テキスト形式）
 * @param attachments - 添付ファイル配列（オプション）
 * @returns Promise<void>
 */
export async function sendSmtpMail(
  config: SmtpConfig,
  from: string,
  to: string[],
  cc?: string[],
  bcc?: string[],
  subject?: string,
  body?: string,
  attachments?: Attachment[]
): Promise<void> {
  // SSL/TLS必須チェック
  if (!config.useSsl) {
    throw new Error('SSL/TLS is required for SMTP connections');
  }

  functions.logger.info(`sendSmtpMail: Sending mail via ${config.host}:${config.port} from ${from} to ${to.join(', ')}`);

  try {
    // nodemailerのトランスポートを作成
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // ポート465の場合はsecure: true、587の場合はstarttlsを使用
      auth: {
        user: config.userName,
        pass: config.password,
      },
      // SSL/TLS設定
      tls: {
        rejectUnauthorized: true, // 証明書検証を有効化
      },
      connectionTimeout: 30000, // 30秒の接続タイムアウト
      greetingTimeout: 30000, // 30秒のグリーティングタイムアウト
    });

    // メール送信オプション
    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: to.join(', '),
      subject: subject || '',
      text: body || '',
    };

    // CCがある場合は追加
    if (cc && cc.length > 0) {
      mailOptions.cc = cc.join(', ');
    }

    // BCCがある場合は追加
    if (bcc && bcc.length > 0) {
      mailOptions.bcc = bcc.join(', ');
    }

    // 添付ファイルがある場合は追加
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));
    }

    // メール送信を実行
    const info = await transporter.sendMail(mailOptions);

    functions.logger.info(`sendSmtpMail: Mail sent successfully. Message ID: ${info.messageId}`);

    // トランスポートを閉じる
    transporter.close();
  } catch (error: any) {
    functions.logger.error(`sendSmtpMail error for ${config.host}:${config.port}:`, error);

    // エラーメッセージを適切にフォーマット
    let errorMessage = 'Mail sending failed';
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to SMTP server: ${error.message || error.code}`;
    } else if (error.code === 'EAUTH') {
      errorMessage = `Authentication failed: ${error.message || 'Invalid username or password'}`;
    } else if (error.responseCode === 550 || error.responseCode === 551 || error.responseCode === 552) {
      errorMessage = `Mail delivery failed: ${error.response || error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}

