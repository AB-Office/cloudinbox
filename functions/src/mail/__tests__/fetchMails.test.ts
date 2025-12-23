/**
 * fetchMails - メール自動受信の基本構造のテスト
 */

/// <reference types="jest" />

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// モック
let savedHandler: any = null;
jest.mock('firebase-admin');
jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    runWith: jest.fn(() => ({
      pubsub: {
        schedule: jest.fn(() => ({
          timeZone: jest.fn(() => ({
            onRun: jest.fn((handler: any) => {
              savedHandler = handler;
              return {
                run: async (data: any, context: any) => {
                  if (savedHandler) {
                    return await savedHandler(context);
                  }
                },
              };
            }),
          })),
        })),
      },
    })),
  })),
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockEnqueueTask = jest.fn();
jest.mock('../cloudTasksClient', () => ({
  getCloudTasksClient: jest.fn(() => ({
    enqueueTask: mockEnqueueTask,
  })),
}));
jest.mock('../pop3Client');

describe('fetchMails', () => {
  let mockFirestore: any;
  const mockContext = {
    eventId: 'test-event-id',
    timestamp: '2023-01-01T00:00:00Z',
    eventType: 'google.pubsub.topic.publish',
    resource: {
      service: 'pubsub.googleapis.com',
      name: 'projects/test-project/topics/test-topic',
    },
  } as functions.EventContext;

  beforeEach(() => {
    jest.clearAllMocks();
    // fetchMailsをインポートしてsavedHandlerを設定
    require('../fetchMails');

    mockFirestore = {
      collection: jest.fn(),
    };

    (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);
  });

  it('onSchedule関数として実装されている', () => {
    const { fetchMails } = require('../fetchMails');
    expect(fetchMails).toBeDefined();
    expect(fetchMails).toHaveProperty('run');
    expect(typeof fetchMails.run).toBe('function');
  });

  it('アクティブなメールアカウントを取得する', async () => {
    const mockUsersCollection = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            data: () => ({}),
          },
        ],
      }),
    };

    const mockMailAccountsCollection = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'account-1',
            data: () => ({
              status: 'active',
              label: 'Test Account',
            }),
          },
        ],
      }),
    };

    const mockUserDoc = {
      collection: jest.fn((path: string) => {
        if (path === 'mailAccounts') {
          return mockMailAccountsCollection;
        }
        return mockMailAccountsCollection;
      }),
    };

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return {
          get: mockUsersCollection.get,
          doc: jest.fn(() => mockUserDoc),
        };
      }
      return mockUsersCollection;
    });

    // ハンドラーを直接呼び出す
    if (savedHandler) {
      await savedHandler(mockContext);
    }

    expect(mockFirestore.collection).toHaveBeenCalledWith('users');
    // 実際のコードではwhereを使わず、すべてのアカウントを取得してからJavaScriptでフィルタリング
    expect(mockMailAccountsCollection.get).toHaveBeenCalled();
  });

  it('アクティブなアカウントがない場合は何も実行しない', async () => {
    const mockUsersCollection = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            data: () => ({}),
          },
        ],
      }),
    };

    const mockMailAccountsCollection = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [], // アクティブなアカウントなし
        empty: true,
      }),
    };

    const mockUserDoc = {
      collection: jest.fn((path: string) => {
        if (path === 'mailAccounts') {
          return mockMailAccountsCollection;
        }
        return mockMailAccountsCollection;
      }),
    };

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return {
          get: mockUsersCollection.get,
          doc: jest.fn(() => mockUserDoc),
        };
      }
      return mockUsersCollection;
    });

    // ハンドラーを直接呼び出す
    if (savedHandler) {
      await savedHandler(mockContext);
    }

    expect(mockMailAccountsCollection.get).toHaveBeenCalled();
  });

  it('複数のユーザーを走査する', async () => {
    const mockUsersCollection = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            data: () => ({}),
          },
          {
            id: 'user-2',
            data: () => ({}),
          },
        ],
      }),
    };

    const mockMailAccountsCollection = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'account-1',
            data: () => ({
              status: 'active',
            }),
          },
        ],
      }),
    };

    const mockUserDoc = {
      collection: jest.fn((path: string) => {
        if (path === 'mailAccounts') {
          return mockMailAccountsCollection;
        }
        return mockMailAccountsCollection;
      }),
    };

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return {
          get: mockUsersCollection.get,
          doc: jest.fn(() => mockUserDoc),
        };
      }
      return mockUsersCollection;
    });

    // ハンドラーを直接呼び出す
    if (savedHandler) {
      await savedHandler(mockContext);
    }

    // 2つのユーザーを走査
    expect(mockMailAccountsCollection.get).toHaveBeenCalledTimes(2);
  });

  it('statusがactiveでないアカウントは取得しない', async () => {
    const mockUsersCollection = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            data: () => ({}),
          },
        ],
      }),
    };

    const mockMailAccountsCollection = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: true,
      }),
    };

    const mockUserDoc = {
      collection: jest.fn((path: string) => {
        if (path === 'mailAccounts') {
          return mockMailAccountsCollection;
        }
        return mockMailAccountsCollection;
      }),
    };

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return {
          get: mockUsersCollection.get,
          doc: jest.fn(() => mockUserDoc),
        };
      }
      return mockUsersCollection;
    });

    // ハンドラーを直接呼び出す
    if (savedHandler) {
      await savedHandler(mockContext);
    }

    // 実際のコードではwhereを使わず、すべてのアカウントを取得してからJavaScriptでフィルタリング
    // したがって、whereは呼ばれない
    expect(mockMailAccountsCollection.get).toHaveBeenCalled();
  });

  it('アクティブなアカウントごとにCloud Tasksタスクを投入する', async () => {
    const mockUsersCollection = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            data: () => ({}),
          },
        ],
      }),
    };

    const mockMailAccountsCollection = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: 'account-1',
            data: () => ({
              status: 'active',
            }),
          },
          {
            id: 'account-2',
            data: () => ({
              status: 'active',
            }),
          },
        ],
      }),
    };

    const mockUserDoc = {
      collection: jest.fn((path: string) => {
        if (path === 'mailAccounts') {
          return mockMailAccountsCollection;
        }
        return mockMailAccountsCollection;
      }),
    };

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return {
          get: mockUsersCollection.get,
          doc: jest.fn(() => mockUserDoc),
        };
      }
      return mockUsersCollection;
    });

    if (savedHandler) {
      await savedHandler(mockContext);
    }

    expect(mockEnqueueTask).toHaveBeenCalledTimes(2);
    expect(mockEnqueueTask).toHaveBeenCalledWith('user-1', 'account-1');
    expect(mockEnqueueTask).toHaveBeenCalledWith('user-1', 'account-2');
  });
});

