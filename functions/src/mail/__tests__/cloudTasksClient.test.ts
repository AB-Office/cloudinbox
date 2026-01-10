/**
 * cloudTasksClient - Cloud Tasksクライアントのテスト
 */

/// <reference types="jest" />

import { CloudTasksClientWrapper, getCloudTasksClient } from '../cloudTasksClient';

const mockCreateTask = jest.fn();
const mockQueuePath = jest.fn(() => 'projects/test-project/locations/asia-northeast1/queues/mail-fetch-queue');

jest.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: jest.fn(() => ({
      queuePath: mockQueuePath,
      createTask: mockCreateTask,
    })),
  };
});

describe('CloudTasksClientWrapper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GCLOUD_PROJECT: 'test-project',
      CLOUD_TASKS_LOCATION: 'asia-northeast1',
      CLOUD_TASKS_QUEUE_NAME: 'mail-fetch-queue',
      PROCESS_ACCOUNT_TASK_HANDLER_NAME: 'processAccountTaskHandler',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uidまたはaccountIdが空の場合はエラーを投げる', async () => {
    const client = new CloudTasksClientWrapper();

    await expect(client.enqueueTask('', 'account-1')).rejects.toThrow();
    await expect(client.enqueueTask('user-1', '')).rejects.toThrow();
  });

  it('有効なuid/accountIdでcreateTaskを呼び出す', async () => {
    mockCreateTask.mockResolvedValue([{ name: 'tasks/123' }]);

    const client = getCloudTasksClient();

    const taskName = await client.enqueueTask('user-1', 'account-1');

    expect(mockQueuePath).toHaveBeenCalledWith(
      'test-project',
      'asia-northeast1',
      'mail-fetch-queue'
    );
    expect(mockCreateTask).toHaveBeenCalledTimes(1);

    const request = mockCreateTask.mock.calls[0][0];
    expect(request.parent).toBe('projects/test-project/locations/asia-northeast1/queues/mail-fetch-queue');
    expect(request.task.httpRequest.url).toBe('https://asia-northeast1-test-project.cloudfunctions.net/processAccountTaskHandler');
    expect(request.task.retryConfig).toBeDefined();
    
    // リクエストボディが { data: { uid, accountId } } 形式であることを確認
    const bodyBuffer = Buffer.from(request.task.httpRequest.body, 'base64');
    const bodyJson = JSON.parse(bodyBuffer.toString());
    expect(bodyJson).toEqual({
      data: {
        uid: 'user-1',
        accountId: 'account-1',
      },
    });
    
    // OIDCトークンが設定されていることを確認
    expect(request.task.httpRequest.oidcToken).toBeDefined();
    expect(request.task.httpRequest.oidcToken.serviceAccountEmail).toBe('test-project@appspot.gserviceaccount.com');
    
    expect(taskName).toBe('tasks/123');
  });

  describe('enqueueSendMailTask', () => {
    beforeEach(() => {
      process.env.SEND_MAIL_TASK_HANDLER_NAME = 'sendMailTaskHandler';
      process.env.CLOUD_TASKS_QUEUE_NAME = 'sendMailTaskHandler';
    });

    it('uidが空の場合はエラーを投げる', async () => {
      const client = new CloudTasksClientWrapper();

      await expect(
        client.enqueueSendMailTask('', {
          accountId: 'account-1',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          body: 'Test Body',
        })
      ).rejects.toThrow('uid must be a non-empty string');
    });

    it('accountIdが空の場合はエラーを投げる', async () => {
      const client = new CloudTasksClientWrapper();

      await expect(
        client.enqueueSendMailTask('user-1', {
          accountId: '',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          body: 'Test Body',
        })
      ).rejects.toThrow('accountId is required');
    });

    it('toが空配列の場合はエラーを投げる', async () => {
      const client = new CloudTasksClientWrapper();

      await expect(
        client.enqueueSendMailTask('user-1', {
          accountId: 'account-1',
          to: [],
          subject: 'Test Subject',
          body: 'Test Body',
        })
      ).rejects.toThrow('to is required and must be a non-empty array');
    });

    it('subjectが空の場合はエラーを投げる', async () => {
      const client = new CloudTasksClientWrapper();

      await expect(
        client.enqueueSendMailTask('user-1', {
          accountId: 'account-1',
          to: ['recipient@example.com'],
          subject: '',
          body: 'Test Body',
        })
      ).rejects.toThrow('subject is required');
    });

    it('bodyが空の場合はエラーを投げる', async () => {
      const client = new CloudTasksClientWrapper();

      await expect(
        client.enqueueSendMailTask('user-1', {
          accountId: 'account-1',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          body: '',
        })
      ).rejects.toThrow('body is required');
    });

    it('有効なペイロードでcreateTaskを呼び出す', async () => {
      mockCreateTask.mockResolvedValue([{ name: 'tasks/sendmail-123' }]);
      mockQueuePath.mockReturnValue('projects/test-project/locations/asia-northeast1/queues/sendMailTaskHandler');

      const client = new CloudTasksClientWrapper();

      const result = await client.enqueueSendMailTask('user-1', {
        accountId: 'account-1',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      });

      expect(mockQueuePath).toHaveBeenCalledWith(
        'test-project',
        'asia-northeast1',
        'sendMailTaskHandler'
      );
      expect(mockCreateTask).toHaveBeenCalledTimes(1);

      const request = mockCreateTask.mock.calls[0][0];
      expect(request.parent).toBe('projects/test-project/locations/asia-northeast1/queues/sendMailTaskHandler');
      expect(request.task.httpRequest.url).toBe('https://asia-northeast1-test-project.cloudfunctions.net/sendMailTaskHandler');
      expect(request.task.retryConfig).toBeDefined();
      expect(request.task.retryConfig.maxAttempts).toBe(3);
      expect(request.task.retryConfig.maxRetryDuration.seconds).toBe(3600);
      expect(request.task.retryConfig.maxBackoff.seconds).toBe(300);

      // リクエストボディが { data: { uid, accountId, to, subject, body, taskId } } 形式であることを確認
      const bodyBuffer = Buffer.from(request.task.httpRequest.body, 'base64');
      const bodyJson = JSON.parse(bodyBuffer.toString());
      expect(bodyJson.data.uid).toBe('user-1');
      expect(bodyJson.data.accountId).toBe('account-1');
      expect(bodyJson.data.to).toEqual(['recipient@example.com']);
      expect(bodyJson.data.subject).toBe('Test Subject');
      expect(bodyJson.data.body).toBe('Test Body');
      expect(bodyJson.data.taskId).toBeDefined();
      expect(bodyJson.data.taskId).toMatch(/^sendmail-\d+-[a-z0-9]+$/);

      // OIDCトークンが設定されていることを確認
      expect(request.task.httpRequest.oidcToken).toBeDefined();
      expect(request.task.httpRequest.oidcToken.serviceAccountEmail).toBe('test-project@appspot.gserviceaccount.com');

      expect(result.taskName).toBe('tasks/sendmail-123');
      expect(result.taskId).toBeDefined();
      expect(result.taskId).toMatch(/^sendmail-\d+-[a-z0-9]+$/);
    });

    it('cc、bcc、attachments、threadId、inReplyToMessageIdが含まれる場合も処理できる', async () => {
      mockCreateTask.mockResolvedValue([{ name: 'tasks/sendmail-123' }]);
      mockQueuePath.mockReturnValue('projects/test-project/locations/asia-northeast1/queues/sendMailTaskHandler');

      const client = new CloudTasksClientWrapper();

      const result = await client.enqueueSendMailTask('user-1', {
        accountId: 'account-1',
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('test content').toString('base64'),
            contentType: 'application/pdf',
          },
        ],
        threadId: 'thread-id-123',
        inReplyToMessageId: 'message-id-456',
      });

      const request = mockCreateTask.mock.calls[0][0];
      const bodyBuffer = Buffer.from(request.task.httpRequest.body, 'base64');
      const bodyJson = JSON.parse(bodyBuffer.toString());

      expect(bodyJson.data.cc).toEqual(['cc@example.com']);
      expect(bodyJson.data.bcc).toEqual(['bcc@example.com']);
      expect(bodyJson.data.attachments).toEqual([
        {
          filename: 'test.pdf',
          content: Buffer.from('test content').toString('base64'),
          contentType: 'application/pdf',
        },
      ]);
      expect(bodyJson.data.threadId).toBe('thread-id-123');
      expect(bodyJson.data.inReplyToMessageId).toBe('message-id-456');
      expect(result.taskId).toBeDefined();
    });

    it('タスクIDが一意に生成される', async () => {
      mockCreateTask.mockResolvedValue([{ name: 'tasks/sendmail-123' }]);
      mockQueuePath.mockReturnValue('projects/test-project/locations/asia-northeast1/queues/sendMailTaskHandler');

      const client = new CloudTasksClientWrapper();

      const result1 = await client.enqueueSendMailTask('user-1', {
        accountId: 'account-1',
        to: ['recipient@example.com'],
        subject: 'Test Subject 1',
        body: 'Test Body 1',
      });

      const result2 = await client.enqueueSendMailTask('user-1', {
        accountId: 'account-1',
        to: ['recipient@example.com'],
        subject: 'Test Subject 2',
        body: 'Test Body 2',
      });

      expect(result1.taskId).not.toBe(result2.taskId);
      expect(result1.taskId).toMatch(/^sendmail-\d+-[a-z0-9]+$/);
      expect(result2.taskId).toMatch(/^sendmail-\d+-[a-z0-9]+$/);
    });

    it('createTaskが失敗した場合はエラーをスローする', async () => {
      const mockError = new Error('Failed to create task');
      mockCreateTask.mockRejectedValue(mockError);
      mockQueuePath.mockReturnValue('projects/test-project/locations/asia-northeast1/queues/sendMailTaskHandler');

      const client = new CloudTasksClientWrapper();

      await expect(
        client.enqueueSendMailTask('user-1', {
          accountId: 'account-1',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          body: 'Test Body',
        })
      ).rejects.toThrow('Failed to create task');

      expect(mockCreateTask).toHaveBeenCalledTimes(1);
    });

    it('環境変数でキューネームと関数名をカスタマイズできる', async () => {
      process.env.SEND_MAIL_TASK_QUEUE_NAME = 'custom-send-mail-queue';
      process.env.SEND_MAIL_TASK_HANDLER_NAME = 'customSendMailTaskHandler';
      
      mockCreateTask.mockResolvedValue([{ name: 'tasks/sendmail-123' }]);
      mockQueuePath.mockReturnValue('projects/test-project/locations/asia-northeast1/queues/custom-send-mail-queue');

      const client = new CloudTasksClientWrapper();

      await client.enqueueSendMailTask('user-1', {
        accountId: 'account-1',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      });

      expect(mockQueuePath).toHaveBeenCalledWith(
        'test-project',
        'asia-northeast1',
        'custom-send-mail-queue'
      );

      const request = mockCreateTask.mock.calls[0][0];
      expect(request.task.httpRequest.url).toBe('https://asia-northeast1-test-project.cloudfunctions.net/customSendMailTaskHandler');

      // 環境変数をリセット
      delete process.env.SEND_MAIL_TASK_QUEUE_NAME;
      delete process.env.SEND_MAIL_TASK_HANDLER_NAME;
    });
  });
});


