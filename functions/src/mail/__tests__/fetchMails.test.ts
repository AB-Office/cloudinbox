/**
 * fetchMails - メール自動受信の基本構造のテスト
 */

/// <reference types="jest" />

import { fetchMails } from '../fetchMails';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// モック
jest.mock('firebase-admin');
jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    pubsub: {
      schedule: jest.fn(() => ({
        timeZone: jest.fn(() => ({
          onRun: jest.fn((handler: any) => ({
            run: (data: any, context: any) => handler(context),
          })),
        })),
      })),
    },
  })),
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
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

    mockFirestore = {
      collection: jest.fn(),
    };

    (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);
  });

  it('onSchedule関数として実装されている', () => {
    expect(fetchMails).toBeDefined();
    expect(typeof fetchMails).toBe('function');
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

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return mockUsersCollection;
      }
      if (path.includes('mailAccounts')) {
        return mockMailAccountsCollection;
      }
      return mockUsersCollection;
    });

    // onSchedule関数を呼び出す
    await fetchMails.run({} as functions.pubsub.Message, mockContext);

    expect(mockFirestore.collection).toHaveBeenCalledWith('users');
    expect(mockMailAccountsCollection.where).toHaveBeenCalledWith('status', '==', 'active');
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
      }),
    };

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return mockUsersCollection;
      }
      if (path.includes('mailAccounts')) {
        return mockMailAccountsCollection;
      }
      return mockUsersCollection;
    });

    await fetchMails.run({} as functions.pubsub.Message, mockContext);

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

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return mockUsersCollection;
      }
      if (path.includes('mailAccounts')) {
        return mockMailAccountsCollection;
      }
      return mockUsersCollection;
    });

    await fetchMails.run({} as functions.pubsub.Message, mockContext);

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
        docs: [
          {
            id: 'account-1',
            data: () => ({
              status: 'error', // activeではない
            }),
          },
        ],
      }),
    };

    mockFirestore.collection = jest.fn((path: string) => {
      if (path === 'users') {
        return mockUsersCollection;
      }
      if (path.includes('mailAccounts')) {
        return mockMailAccountsCollection;
      }
      return mockUsersCollection;
    });

    await fetchMails.run({} as functions.pubsub.Message, mockContext);

    // where('status', '==', 'active')でフィルタリングされるため、
    // errorステータスのアカウントは取得されない
    expect(mockMailAccountsCollection.where).toHaveBeenCalledWith('status', '==', 'active');
  });
});

