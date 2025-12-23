import * as functions from 'firebase-functions';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import * as admin from 'firebase-admin';
import { processAccount } from './processAccount';

export async function handleProcessAccountTask(payload: any): Promise<void> {
  const uid = payload?.uid;
  const accountId = payload?.accountId;

  if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required');
  }

  if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'accountId is required');
  }

  const db = admin.firestore();

  const accountSnap = await db
    .collection('users')
    .doc(uid)
    .collection('mailAccounts')
    .doc(accountId)
    .get();

  if (!accountSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'mail account not found');
  }

  const accountData = accountSnap.data();

  if (!accountData) {
    throw new functions.https.HttpsError('not-found', 'mail account data is empty');
  }

  await processAccount(uid, accountId, accountData, db);
}

export const processAccountTaskHandler = onTaskDispatched(
  {
    region: 'asia-northeast1',
    timeoutSeconds: 900, // 15分（v2 onTaskDispatched の上限 1800 秒の範囲内）
    retryConfig: {
      maxAttempts: 3,
      maxRetrySeconds: 3600, // 1時間
      maxBackoffSeconds: 300, // 5分
    },
  },
  async (task) => {
    try {
      // デバッグ: 受信したタスクデータをログ出力
      functions.logger.info('processAccountTaskHandler received task', {
        taskData: task.data,
        taskDataType: typeof task.data,
        taskDataKeys: task.data ? Object.keys(task.data) : null,
        taskDataData: task.data?.data,
      });
      
      // onTaskDispatched は HTTP ターゲット経由の場合、{ data: { ... } } 形式で
      // リクエストボディを受け取るため、task.data.data から実際のペイロードを取得
      const payload = task.data?.data || task.data;
      await handleProcessAccountTask(payload);
    } catch (error: any) {
      // Cloud Tasks の再試行ポリシーに委ねるため、エラーはそのままスローする
      functions.logger.error('processAccountTaskHandler failed', error);
      throw error;
    }
  }
);


