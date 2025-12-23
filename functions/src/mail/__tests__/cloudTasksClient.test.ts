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
      CLOUD_RUN_JOB_URL: 'https://example.com/tasks/processAccount',
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
    expect(request.task.httpRequest.url).toBe('https://example.com/tasks/processAccount');
    expect(request.task.retryConfig).toBeDefined();
    expect(taskName).toBe('tasks/123');
  });
});


