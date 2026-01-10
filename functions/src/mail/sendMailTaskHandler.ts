/**
 * sendMailTaskHandler - Cloud Tasksハンドラ
 * 
 * Cloud Tasksから呼び出され、メール送信タスクを処理する
 */

import * as functions from 'firebase-functions';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { handleSendMailTask, SendMailTaskPayload } from './handleSendMailTask';

/**
 * メール送信タスクを処理する内部関数
 * 
 * @param payload - メール送信タスクペイロード
 */
export async function handleSendMailTaskHandler(payload: any): Promise<void> {
  const uid = payload?.uid;
  const accountId = payload?.accountId;
  const to = payload?.to;
  const subject = payload?.subject;
  const body = payload?.body;

  // 必須パラメータの検証
  if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required');
  }

  if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'accountId is required');
  }

  if (!to || !Array.isArray(to) || to.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'to is required and must be a non-empty array');
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'subject is required');
  }

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'body is required');
  }

  // SendMailTaskPayloadに変換
  const sendMailPayload: SendMailTaskPayload = {
    uid,
    taskId: payload.taskId,
    accountId,
    to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject,
    body,
    attachments: payload.attachments,
    threadId: payload.threadId,
    inReplyToMessageId: payload.inReplyToMessageId,
  };

  // handleSendMailTaskを呼び出し
  await handleSendMailTask(sendMailPayload);
}

/**
 * Cloud Tasksから呼び出されるメール送信タスクハンドラ
 */
export const sendMailTaskHandler = onTaskDispatched(
  {
    region: 'asia-northeast1',
    timeoutSeconds: 540, // 9分（メール送信処理のタイムアウトと同じ）
    retryConfig: {
      maxAttempts: 3,
      maxRetrySeconds: 3600, // 1時間
      maxBackoffSeconds: 300, // 5分
    },
  },
  async (task) => {
    try {
      // デバッグ: 受信したタスクデータをログ出力
      functions.logger.info('sendMailTaskHandler received task', {
        taskData: task.data,
        taskDataType: typeof task.data,
        taskDataKeys: task.data ? Object.keys(task.data) : null,
        taskDataData: task.data?.data,
      });
      
      // onTaskDispatched は HTTP ターゲット経由の場合、{ data: { ... } } 形式で
      // リクエストボディを受け取るため、task.data.data から実際のペイロードを取得
      const payload = task.data?.data || task.data;
      
      if (!payload || typeof payload !== 'object') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid task payload format');
      }

      await handleSendMailTaskHandler(payload);
    } catch (error: any) {
      // Cloud Tasks の再試行ポリシーに委ねるため、エラーはそのままスローする
      functions.logger.error('sendMailTaskHandler failed', error);
      throw error;
    }
  }
);

