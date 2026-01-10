/**
 * cloudTasksClient - Firebase Functions v2 タスクキューラッパー
 *
 * Firebase Functions v2 の onTaskDispatched ハンドラに対してタスクを投入する
 * @google-cloud/tasks を使用して、関数名を直接指定してタスクを投入する
 */

import { CloudTasksClient } from '@google-cloud/tasks';
import * as functions from 'firebase-functions';

export class CloudTasksClientWrapper {
  private client: CloudTasksClient;
  private projectId: string;
  private location: string;
  private queueName: string;
  private functionName: string;

  constructor() {
    this.client = new CloudTasksClient();

    // 環境変数から設定を取得
    this.projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
    this.location = process.env.CLOUD_TASKS_LOCATION || 'asia-northeast1';
    // Firebase Functions v2 の onTaskDispatched は関数名に基づいてキューを自動生成する
    // デフォルトでは関数名と同じ名前のキューが作成される
    this.queueName = process.env.CLOUD_TASKS_QUEUE_NAME || 'processAccountTaskHandler';
    // processAccountTaskHandler の関数名（デプロイ時に自動生成される）
    this.functionName = process.env.PROCESS_ACCOUNT_TASK_HANDLER_NAME || 'processAccountTaskHandler';

    if (!this.projectId) {
      throw new Error('GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT environment variable is required');
    }

    functions.logger.info(
      `CloudTasksClient initialized: project=${this.projectId}, location=${this.location}, queue=${this.queueName}, function=${this.functionName}`
    );
  }

  /**
   * タスクをFirebase Functions v2 の onTaskDispatched ハンドラにエンキューする
   *
   * @param uid - ユーザーID
   * @param accountId - アカウントID
   * @returns タスク名（完全なリソースパス）
   */
  async enqueueTask(uid: string, accountId: string): Promise<string> {
    const startTime = Date.now();

    try {
      // 入力検証
      if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
        throw new Error('uid must be a non-empty string');
      }
      if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
        throw new Error('accountId must be a non-empty string');
      }

      // キューパスを構築
      const queuePath = this.client.queuePath(this.projectId, this.location, this.queueName);

      // タスクペイロードを構築
      // Firebase Functions v2 の onTaskDispatched は、HTTPターゲット経由の場合、
      // リクエストボディを { data: { ... } } 形式でラップする必要がある
      const payload = {
        data: {
          uid,
          accountId,
        },
      };

      // Cloud Functions v2 の onTaskDispatched ハンドラを直接呼び出すタスクを作成
      // 関数名を指定してタスクを作成（HTTPターゲットではなく、直接関数を呼び出す）
      // OIDC トークンを使用して認証する
      const serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT || 
        `${this.projectId}@appspot.gserviceaccount.com`;
      const defaultUrl = `https://${this.location}-${this.projectId}.cloudfunctions.net/${this.functionName}`;
      const targetUrl = process.env.CLOUD_TASKS_HANDLER_URL || defaultUrl;
      
      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: targetUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          oidcToken: {
            serviceAccountEmail: serviceAccountEmail,
          },
        },
      };

      // リトライ設定
      const retryConfig = {
        maxAttempts: 3,
        maxRetryDuration: {
          seconds: 3600, // 1時間
        },
        minBackoff: {
          seconds: 10,
        },
        maxBackoff: {
          seconds: 300, // 5分
        },
      };

      const request = {
        parent: queuePath,
        task: {
          ...task,
          retryConfig,
        },
      };

      functions.logger.info(
        `Enqueuing task: uid=${uid}, accountId=${accountId}, queue=${this.queueName}, function=${this.functionName}`
      );

      const [response] = await this.client.createTask(request);
      const taskName = response.name || '';
      const enqueueTime = Date.now() - startTime;

      functions.logger.info(
        `Task enqueued successfully: taskName=${taskName}, uid=${uid}, accountId=${accountId}, took ${enqueueTime}ms`
      );

      return taskName;
    } catch (error: any) {
      const enqueueTime = Date.now() - startTime;
      functions.logger.error(
        `Failed to enqueue task: uid=${uid}, accountId=${accountId}, error=${error.message}, took ${enqueueTime}ms`,
        error
      );
      throw error;
    }
  }

  /**
   * メール送信タスクをFirebase Functions v2 の onTaskDispatched ハンドラにエンキューする
   *
   * @param uid - ユーザーID
   * @param payload - メール送信タスクペイロード
   * @returns タスク名とタスクIDのオブジェクト
   */
  async enqueueSendMailTask(
    uid: string,
    payload: {
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
      threadId?: string;
      inReplyToMessageId?: string;
    }
  ): Promise<{ taskName: string; taskId: string }> {
    const startTime = Date.now();

    try {
      // 入力検証
      if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
        throw new Error('uid must be a non-empty string');
      }
      if (!payload.accountId || typeof payload.accountId !== 'string' || payload.accountId.trim().length === 0) {
        throw new Error('accountId is required');
      }
      if (!payload.to || !Array.isArray(payload.to) || payload.to.length === 0) {
        throw new Error('to is required and must be a non-empty array');
      }
      if (!payload.subject || typeof payload.subject !== 'string' || payload.subject.trim().length === 0) {
        throw new Error('subject is required');
      }
      if (!payload.body || typeof payload.body !== 'string' || payload.body.trim().length === 0) {
        throw new Error('body is required');
      }

      // タスクIDを生成（sendmail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}形式）
      const taskId = `sendmail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // キューパスを構築（sendMailTaskHandler用のキュー名）
      const sendMailQueueName = process.env.SEND_MAIL_TASK_QUEUE_NAME || 'sendMailTaskHandler';
      const queuePath = this.client.queuePath(this.projectId, this.location, sendMailQueueName);

      // タスクペイロードを構築
      // Firebase Functions v2 の onTaskDispatched は、HTTPターゲット経由の場合、
      // リクエストボディを { data: { ... } } 形式でラップする必要がある
      const taskPayload = {
        data: {
          uid,
          taskId,
          accountId: payload.accountId,
          to: payload.to,
          cc: payload.cc,
          bcc: payload.bcc,
          subject: payload.subject,
          body: payload.body,
          attachments: payload.attachments,
          threadId: payload.threadId,
          inReplyToMessageId: payload.inReplyToMessageId,
        },
      };

      // Cloud Functions v2 の onTaskDispatched ハンドラを直接呼び出すタスクを作成
      // sendMailTaskHandler をターゲットとするHTTPリクエストを作成
      // OIDC トークンを使用して認証する
      const serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT || 
        `${this.projectId}@appspot.gserviceaccount.com`;
      const sendMailFunctionName = process.env.SEND_MAIL_TASK_HANDLER_NAME || 'sendMailTaskHandler';
      const defaultUrl = `https://${this.location}-${this.projectId}.cloudfunctions.net/${sendMailFunctionName}`;
      const targetUrl = process.env.SEND_MAIL_TASK_HANDLER_URL || defaultUrl;
      
      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: targetUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
          oidcToken: {
            serviceAccountEmail: serviceAccountEmail,
          },
        },
      };

      // リトライ設定（maxAttempts: 3, maxRetrySeconds: 3600, maxBackoffSeconds: 300）
      const retryConfig = {
        maxAttempts: 3,
        maxRetryDuration: {
          seconds: 3600, // 1時間
        },
        minBackoff: {
          seconds: 10,
        },
        maxBackoff: {
          seconds: 300, // 5分
        },
      };

      const request = {
        parent: queuePath,
        task: {
          ...task,
          retryConfig,
        },
      };

      functions.logger.info(
        `Enqueuing send mail task: uid=${uid}, accountId=${payload.accountId}, taskId=${taskId}, queue=${sendMailQueueName}, function=${sendMailFunctionName}`
      );

      const [response] = await this.client.createTask(request);
      const taskName = response.name || '';
      const enqueueTime = Date.now() - startTime;

      functions.logger.info(
        `Send mail task enqueued successfully: taskName=${taskName}, taskId=${taskId}, uid=${uid}, accountId=${payload.accountId}, took ${enqueueTime}ms`
      );

      return {
        taskName,
        taskId,
      };
    } catch (error: any) {
      const enqueueTime = Date.now() - startTime;
      functions.logger.error(
        `Failed to enqueue send mail task: uid=${uid}, accountId=${payload.accountId}, error=${error.message}, took ${enqueueTime}ms`,
        error
      );
      throw error;
    }
  }
}

let clientInstance: CloudTasksClientWrapper | null = null;

export function getCloudTasksClient(): CloudTasksClientWrapper {
  if (!clientInstance) {
    clientInstance = new CloudTasksClientWrapper();
  }
  return clientInstance;
}


