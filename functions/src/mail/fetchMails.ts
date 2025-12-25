/**
 * fetchMails - メール自動受信
 * 
 * 定期実行により、すべてのアクティブなメールアカウントからPOP3Sサーバへ接続し、
 * メールを受信・保存する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getCloudTasksClient } from './cloudTasksClient';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * メール自動受信を実行する
 * 
 * Cloud Schedulerから定期実行される（毎時0分、10分、、20分、30分、40分、50分）
 * タイムアウト: 9分（540秒）- メール取得処理に時間がかかるため
 */
export const fetchMails = functions
  .region('asia-northeast1')
  .runWith({
    timeoutSeconds: 540, // 9分（最大値）
    memory: '512MB',
  })
  .pubsub.schedule('0,10,20,30,40,50 * * * *') // 毎時0分、10分、20分、30分、40分、50分
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    const functionStartTime = Date.now();
    try {
      const db = admin.firestore();
      const tasksClient = getCloudTasksClient();
      
      // すべてのユーザーを取得
      const usersStartTime = Date.now();
      const usersSnapshot = await db.collection('users').get();
      const usersTime = Date.now() - usersStartTime;
      functions.logger.info(`Fetched users (took ${usersTime}ms, found ${usersSnapshot.size} users)`);
      
      if (usersSnapshot.empty) {
        functions.logger.info('No users found');
        return;
      }

      // 各ユーザーを走査
      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        
        try {
          // アクティブなメールアカウントを取得
          const accountsStartTime = Date.now();
          // statusが'active'または未設定（デフォルトでactiveとみなす）のアカウントを取得
          const accountsSnapshot = await db
            .collection('users')
            .doc(uid)
            .collection('mailAccounts')
            .get();
          const accountsTime = Date.now() - accountsStartTime;
          
          // statusが'active'、'error'、または未設定のアカウントをフィルタリング
          // 'error'状態のアカウントも再試行する（前回のエラーが一時的な可能性があるため）
          const activeAccounts = accountsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const status = data.status;
            // statusが'active'、'error'、または未設定（undefined/null）の場合は処理対象とする
            // 'inactive'（論理削除）と'disabled'は除外
            return !status || status === 'active' || status === 'error';
          });
          
          functions.logger.info(`Fetched accounts for user ${uid} (took ${accountsTime}ms, found ${accountsSnapshot.size} total, ${activeAccounts.length} active)`);

          if (activeAccounts.length === 0) {
            functions.logger.info(`No active accounts for user: ${uid}`);
            // デバッグ用: すべてのアカウントの状態をログに記録
            if (accountsSnapshot.size > 0) {
              accountsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                functions.logger.info(`Account ${doc.id} status: ${data.status || 'undefined'}, label: ${data.label || 'N/A'}`);
              });
            }
            continue;
          }

          // 各アカウントを走査し、Cloud Tasksにタスクを投入
          for (const accountDoc of activeAccounts) {
            const accountId = accountDoc.id;
            functions.logger.info(`Enqueueing processAccount task for account: ${accountId} of user: ${uid}`);

            try {
              await tasksClient.enqueueTask(uid, accountId);
            } catch (error: any) {
              functions.logger.error(`Error enqueuing task for account ${accountId} for user ${uid}:`, error);
              continue;
            }
          }
        } catch (error: any) {
          functions.logger.error(`Error processing user ${uid}:`, error);
          // エラーが発生しても次のユーザーの処理を継続
          continue;
        }
      }

      const functionTime = Date.now() - functionStartTime;
      functions.logger.info(`fetchMails completed (total time: ${functionTime}ms)`);
    } catch (error: any) {
      const functionTime = Date.now() - functionStartTime;
      functions.logger.error(`fetchMails failed after ${functionTime}ms:`, error);
      throw error;
    }
  });
