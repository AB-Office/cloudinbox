/**
 * onUserCreate - ユーザー初期化のテスト
 */

import { onUserCreate } from '../onUserCreate';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';

// モック
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  auth: {
    UserRecord: jest.fn(),
  },
}));
jest.mock('../../encryption');
jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    auth: {
      user: jest.fn(() => ({
        onCreate: jest.fn((handler: any) => handler),
      })),
    },
  })),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('onUserCreate', () => {
  const mockUid = 'test-user-123';
  const mockUser = {
    uid: mockUid,
    email: 'test@example.com',
    displayName: 'Test User',
  } as admin.auth.UserRecord;

  let mockFirestore: any;
  let mockTransaction: any;
  let mockTimestamp: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTimestamp = {
      now: jest.fn(() => ({
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: 0,
      })),
    };

    mockTransaction = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockUserRef = {
      doc: jest.fn((uid: string) => ({
        get: jest.fn(),
        set: jest.fn(),
      })),
    };

    mockFirestore = {
      collection: jest.fn((path: string) => ({
        doc: jest.fn((uid: string) => mockUserRef),
      })),
      runTransaction: jest.fn(async (callback: any) => {
        const transaction = {
          get: mockTransaction.get,
          set: mockTransaction.set,
        };
        return await callback(transaction);
      }),
    };

    // admin.firestore()が返すオブジェクトにTimestampを追加
    (admin.firestore as unknown as jest.Mock).mockReturnValue(mockFirestore);
    (admin.firestore as any).Timestamp = mockTimestamp;
    (encryption.createDataKeyForUser as jest.Mock).mockResolvedValue(undefined);
  });

  it('ユーザードキュメントを作成し、Freeプラン設定を注入する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    const mockUserRef = {
      doc: jest.fn(),
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);
    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserRef),
    }));

    await onUserCreate(mockUser);

    expect(mockFirestore.collection).toHaveBeenCalledWith('users');
    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        plan: {
          id: 'free',
          label: 'Free',
          maxStorageBytes: 2147483648,
          maxAccounts: 1,
        },
        usage: {
          storageBytes: 0,
          updatedAt: expect.anything(),
        },
        createdAt: expect.anything(),
        updatedAt: expect.anything(),
      })
    );
    expect(mockFirestore.runTransaction).toHaveBeenCalled();
  });

  it('使用量を0で初期化する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    const mockUserRef = {
      doc: jest.fn(),
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);
    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserRef),
    }));

    await onUserCreate(mockUser);

    const setCall = mockTransaction.set.mock.calls[0];
    const userData = setCall[1];
    expect(userData.usage.storageBytes).toBe(0);
    expect(userData.usage.updatedAt).toBeDefined();
  });

  it('DEKを生成・保存する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    const mockUserRef = {
      doc: jest.fn(),
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);
    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserRef),
    }));

    await onUserCreate(mockUser);

    expect(encryption.createDataKeyForUser).toHaveBeenCalledWith(mockUid);
  });

  it('ユーザーが既に存在する場合はスキップする（冪等性）', async () => {
    const mockUserDoc = {
      exists: true,
    };

    const mockUserRef = {
      doc: jest.fn(),
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);
    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserRef),
    }));

    await onUserCreate(mockUser);

    expect(mockTransaction.set).not.toHaveBeenCalled();
    expect(encryption.createDataKeyForUser).not.toHaveBeenCalled();
  });

  it('uidが存在しない場合はエラーを投げる', async () => {
    const invalidUser = {
      uid: '',
    } as admin.auth.UserRecord;

    await expect(onUserCreate(invalidUser)).rejects.toThrow();
  });

  it('createdAtとupdatedAtを設定する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    const mockUserRef = {
      doc: jest.fn(),
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);
    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserRef),
    }));

    await onUserCreate(mockUser);

    const setCall = mockTransaction.set.mock.calls[0];
    const userData = setCall[1];
    expect(userData.createdAt).toBeDefined();
    expect(userData.updatedAt).toBeDefined();
  });

  it('トランザクションで一貫性を保証する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    const mockUserRef = {
      doc: jest.fn(),
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);
    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserRef),
    }));

    await onUserCreate(mockUser);

    expect(mockFirestore.runTransaction).toHaveBeenCalled();
  });
});

