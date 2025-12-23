import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { decryptPassword } from '../encryption';
import { Pop3sClient } from './pop3sClient';
import * as MailParser from 'mailparser';
import { generateThreadId } from './mailProcessing';
import { saveMail } from './saveMail';

export interface ProcessAccountParams {
  uid: string;
  accountId: string;
  accountData: any;
  db: admin.firestore.Firestore;
}

/**
 * アカウントのメールを受信する
 *
 * @param uid - ユーザーID
 * @param accountId - アカウントID
 * @param accountData - アカウントデータ
 * @param db - Firestoreインスタンス
 */
export async function processAccount(
  uid: string,
  accountId: string,
  accountData: any,
  db: admin.firestore.Firestore
): Promise<void> {
  const pop3Config = accountData.pop3;

  // useSsl必須チェック
  if (!pop3Config.useSsl) {
    throw new Error('SSL/TLS is required for POP3 connections');
  }

  // パスワードを復号化
  const decryptStartTime = Date.now();
  const password = await decryptPassword(uid, pop3Config.passwordEnc);
  const decryptTime = Date.now() - decryptStartTime;
  functions.logger.info(`Decrypted password for account: ${accountId} (took ${decryptTime}ms)`);

  let client: Pop3sClient | null = null;

  try {
    // POP3S接続を確立
    client = new Pop3sClient(
      pop3Config.host,
      pop3Config.port,
      pop3Config.userName,
      password,
      pop3Config.useSsl
    );

    const connectStartTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - connectStartTime;
    functions.logger.info(`Connected to POP3S server for account: ${accountId} (took ${connectTime}ms)`);

    // メール一覧を取得
    const listStartTime = Date.now();
    const messages = await client.listMessages();
    const listTime = Date.now() - listStartTime;
    functions.logger.info(`Found ${messages.length} messages for account: ${accountId} (took ${listTime}ms)`);

    if (messages.length === 0) {
      functions.logger.info(`No messages to fetch for account: ${accountId}`);
      return;
    }

    // 各メールを処理
    const processStartTime = Date.now();
    const storage = admin.storage();
    let shouldStopFetching = false;
    let processedCount = 0;
    const maxMessagesPerRun = 50; // 1回の実行で処理する最大メール数（タイムアウトを避けるため）

    for (const message of messages) {
      // 全体処理時間が10分を超えた場合は後続メッセージの処理を中断する
      const elapsed = Date.now() - processStartTime;
      if (elapsed > 10 * 60 * 1000) {
        functions.logger.info(
          `Processing time exceeded 10 minutes for account: ${accountId}, stopping message loop (elapsed=${elapsed}ms, processed=${processedCount})`
        );
        break;
      }

      // タイムアウトを避けるため、1回の実行で処理するメール数を制限
      if (processedCount >= maxMessagesPerRun) {
        functions.logger.info(`Processed ${processedCount} messages, stopping to avoid timeout for account: ${accountId}`);
        break;
      }
      try {
        // 容量超過で受信停止する場合はループを抜ける
        if (shouldStopFetching) {
          functions.logger.info(`Stopping fetch due to storage limit for account: ${accountId}`);
          break;
        }

        // メール本文を取得
        const retrieveStartTime = Date.now();
        let rawMessage = await client.retrieveMessage(message.number);
        const retrieveTime = Date.now() - retrieveStartTime;

        // POP3サーバーからのレスポンス行（+OK ...）を除去
        // MIMEメッセージの最初の行が+OKで始まる場合は除去
        if (rawMessage.startsWith('+OK')) {
          const firstNewline = rawMessage.indexOf('\n');
          if (firstNewline !== -1) {
            rawMessage = rawMessage.substring(firstNewline + 1);
            functions.logger.info(`Removed POP3 response line from retrieved message ${message.number} for account: ${accountId}`);
          }
        }

        functions.logger.info(`Retrieved message ${message.number} for account: ${accountId} (took ${retrieveTime}ms, size: ${rawMessage.length} bytes)`);

        // MIMEパース
        const parseStartTime = Date.now();
        const parsed = await MailParser.simpleParser(rawMessage);
        const parseTime = Date.now() - parseStartTime;
        const parsedTextLength = typeof parsed.text === 'string' ? parsed.text.length : 0;
        const parsedHtmlLength = typeof parsed.html === 'string' ? parsed.html.length : 0;
        functions.logger.info(`Parsed message ${message.number} for account: ${accountId} (took ${parseTime}ms), parsed.text length=${parsedTextLength}, parsed.html length=${parsedHtmlLength}, hasAttachments=${!!parsed.attachments && parsed.attachments.length > 0}`);

        // 本文が空の場合は警告
        if (parsedTextLength === 0 && parsedHtmlLength === 0) {
          functions.logger.warn(`WARNING: Message ${message.number} has no text or HTML body. parsed.text=${!!parsed.text}, parsed.html=${!!parsed.html}, rawMessage length=${rawMessage.length}`);
        }

        // スレッドID生成
        const threadId = generateThreadId(parsed);

        // メッセージID生成（Message-IDから、または生成）
        const messageId = parsed.messageId
          ? parsed.messageId.replace(/[<>]/g, '')
          : crypto.randomBytes(16).toString('hex');

        try {
          // メールを保存（暗号化保存、mailThreads/mailMessages更新、使用量更新）
          const saveStartTime = Date.now();
          await saveMail(uid, messageId, threadId, rawMessage, parsed, db, storage);
          const saveTime = Date.now() - saveStartTime;
          functions.logger.info(
            `Saved message ${message.number}: messageId=${messageId}, threadId=${threadId} (took ${saveTime}ms)`
          );

          // 保存成功後、POP3Sサーバから削除（deleteAfterFetch: trueの場合）
          const deleteAfterFetch = accountData.deleteAfterFetch !== false; // デフォルトはtrue

          if (deleteAfterFetch && client) {
            const deleteStartTime = Date.now();
            await client.deleteMessage(message.number);
            const deleteTime = Date.now() - deleteStartTime;
            functions.logger.info(`Deleted message ${message.number} from POP3S server (took ${deleteTime}ms)`);
          }

          processedCount++;
        } catch (error: any) {
          // 容量超過エラーの場合は受信を停止
          if (error.message === 'Storage limit exceeded') {
            functions.logger.warn(
              `Storage limit exceeded for user ${uid}, stopping fetch for account: ${accountId}`
            );
            shouldStopFetching = true;
            break;
          }

          // その他のエラーはログに記録して続行
          functions.logger.error(`Error saving message ${message.number}:`, error);
          continue;
        }
      } catch (error: any) {
        functions.logger.error(`Error processing message ${message.number}:`, error);
        // 個別メールのエラーはログに記録して続行
        continue;
      }
    }

    // アカウントの最終受信日時を更新
    const accountRef = db
      .collection('users')
      .doc(uid)
      .collection('mailAccounts')
      .doc(accountId);

    await accountRef.update({
      lastFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
      lastErrorMessage: null,
    });

    functions.logger.info(`Completed processing account: ${accountId}, processed ${processedCount} messages`);
  } catch (error: any) {
    functions.logger.error(`Error processing account ${accountId}:`, error);

    // アカウント状態をerrorに更新
    const accountRef = db
      .collection('users')
      .doc(uid)
      .collection('mailAccounts')
      .doc(accountId);

    let errorMessage = error.message || 'Unknown error';

    // SSL/TLS証明書エラーの適切な処理
    if (error.code === 'CERT_ERROR' || error.message.includes('certificate')) {
      errorMessage = 'SSL/TLS certificate verification failed';
    }

    await accountRef.update({
      status: 'error',
      lastErrorMessage: errorMessage,
    });

    throw error;
  } finally {
    // 接続を閉じる
    if (client) {
      try {
        await client.disconnect();
      } catch (error: any) {
        functions.logger.error(`Error disconnecting from POP3S server:`, error);
      }
    }
  }
}


