/**
 * fetchMails - メール自動受信の基本構造のテスト
 */

import { fetchMails } from '../fetchMails';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// モック
jest.mock('firebase-admin');
jest.mock('../pop3Client');

describe('fetchMails', () => {
  let mockFirestore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFirestore = {
      collection: jest.fn(),
    };

    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);
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
    await fetchMails.run({} as functions.pubsub.Message);

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

    await fetchMails.run({} as functions.pubsub.Message);

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

    await fetchMails.run({} as functions.pubsub.Message);

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

    await fetchMails.run({} as functions.pubsub.Message);

    // where('status', '==', 'active')でフィルタリングされるため、
    // errorステータスのアカウントは取得されない
    expect(mockMailAccountsCollection.where).toHaveBeenCalledWith('status', '==', 'active');
  });
});

