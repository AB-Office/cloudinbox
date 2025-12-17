/**
 * fetchMails - メール自動受信
 * 
 * 定期実行により、すべてのアクティブなメールアカウントからPOP3Sサーバへ接続し、
 * メールを受信・保存する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { decryptPassword } from '../encryption';
import { Pop3sClient } from './pop3sClient';
import * as MailParser from 'mailparser';
import { generateThreadId } from './mailProcessing';
import { saveMail } from './saveMail';

/**
 * メール自動受信を実行する
 * 
 * Cloud Schedulerから定期実行される（15-30分間隔）
 */
export const fetchMails = functions.pubsub
  .schedule('every 15 minutes')
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      
      // すべてのユーザーを取得
      const usersSnapshot = await db.collection('users').get();
      
      if (usersSnapshot.empty) {
        functions.logger.info('No users found');
        return;
      }

      // 各ユーザーを走査
      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        
        try {
          // アクティブなメールアカウントを取得
          const accountsSnapshot = await db
            .collection('users')
            .doc(uid)
            .collection('mailAccounts')
            .where('status', '==', 'active')
            .get();

          if (accountsSnapshot.empty) {
            functions.logger.info(`No active accounts for user: ${uid}`);
            continue;
          }

          // 各アカウントを走査
          for (const accountDoc of accountsSnapshot.docs) {
            const accountId = accountDoc.id;
            const accountData = accountDoc.data();
            
            functions.logger.info(`Processing account: ${accountId} for user: ${uid}`);
            
            try {
              await processAccount(uid, accountId, accountData, db);
            } catch (error: any) {
              functions.logger.error(`Error processing account ${accountId} for user ${uid}:`, error);
              // エラーが発生しても次のアカウントの処理を継続
              continue;
            }
          }
        } catch (error: any) {
          functions.logger.error(`Error processing user ${uid}:`, error);
          // エラーが発生しても次のユーザーの処理を継続
          continue;
        }
      }

      functions.logger.info('fetchMails completed');
    } catch (error: any) {
      functions.logger.error('fetchMails failed:', error);
      throw error;
    }
  });

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
  const password = await decryptPassword(uid, pop3Config.passwordEnc);

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

    await client.connect();
    functions.logger.info(`Connected to POP3S server for account: ${accountId}`);

    // メール一覧を取得
    const messages = await client.listMessages();
    functions.logger.info(`Found ${messages.length} messages for account: ${accountId}`);

    // 各メールを処理
    const storage = admin.storage();
    let shouldStopFetching = false;

    for (const message of messages) {
      try {
        // 容量超過で受信停止する場合はループを抜ける
        if (shouldStopFetching) {
          functions.logger.info(`Stopping fetch due to storage limit for account: ${accountId}`);
          break;
        }

        // メール本文を取得
        const rawMessage = await client.retrieveMessage(message.number);
        
        // MIMEパース
        const parsed = await MailParser.simpleParser(rawMessage);
        
        functions.logger.info(`Parsed message ${message.number} for account: ${accountId}`);
        
        // スレッドID生成
        const threadId = generateThreadId(parsed);
        
        // メッセージID生成（Message-IDから、または生成）
        const messageId = parsed.messageId
          ? parsed.messageId.replace(/[<>]/g, '')
          : crypto.randomBytes(16).toString('hex');
        
        try {
          // メールを保存（暗号化保存、mailThreads/mailMessages更新、使用量更新）
          await saveMail(uid, messageId, threadId, rawMessage, parsed, db, storage);
          
          functions.logger.info(
            `Saved message ${message.number}: messageId=${messageId}, threadId=${threadId}`
          );
          
          // 保存成功後、POP3Sサーバから削除（deleteAfterFetch: trueの場合）
          const deleteAfterFetch = accountData.deleteAfterFetch !== false; // デフォルトはtrue
          
          if (deleteAfterFetch && client) {
            await client.deleteMessage(message.number);
            functions.logger.info(`Deleted message ${message.number} from POP3S server`);
          }
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

    functions.logger.info(`Completed processing account: ${accountId}`);
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

