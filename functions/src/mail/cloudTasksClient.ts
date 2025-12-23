/**
 * cloudTasksClient - Cloud Tasks APIラッパー
 *
 * Cloud Tasks APIを使用してメール受信タスクをキューイングする
 */

import { CloudTasksClient } from '@google-cloud/tasks';
import * as functions from 'firebase-functions';

export class CloudTasksClientWrapper {
  private client: CloudTasksClient;
  private projectId: string;
  private location: string;
  private queueName: string;
  private cloudRunJobUrl: string;

  constructor() {
    this.client = new CloudTasksClient();

    // 環境変数から設定を取得
    this.projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
    this.location = process.env.CLOUD_TASKS_LOCATION || 'asia-northeast1';
    this.queueName = process.env.CLOUD_TASKS_QUEUE_NAME || 'mail-fetch-queue';
    this.cloudRunJobUrl = process.env.CLOUD_RUN_JOB_URL || '';

    if (!this.projectId) {
      throw new Error('GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT environment variable is required');
    }
    if (!this.cloudRunJobUrl) {
      throw new Error('CLOUD_RUN_JOB_URL environment variable is required');
    }

    functions.logger.info(
      `CloudTasksClient initialized: project=${this.projectId}, location=${this.location}, queue=${this.queueName}`
    );
  }

  /**
   * タスクをCloud Tasks Queueにエンキューする
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
      const payload = {
        uid,
        accountId,
      };

      // HTTPリクエストタスクを作成
      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: this.cloudRunJobUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        },
        scheduleTime: {
          seconds: Math.floor(Date.now() / 1000), // 即座に実行
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
        `Enqueuing task: uid=${uid}, accountId=${accountId}, queue=${this.queueName}`
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
}

let clientInstance: CloudTasksClientWrapper | null = null;

export function getCloudTasksClient(): CloudTasksClientWrapper {
  if (!clientInstance) {
    clientInstance = new CloudTasksClientWrapper();
  }
  return clientInstance;
}


