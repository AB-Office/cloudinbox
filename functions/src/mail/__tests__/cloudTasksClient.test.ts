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
});


