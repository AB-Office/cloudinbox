/**
 * onUserCreate - ユーザー初期化のテスト
 */

import { onUserCreate } from '../onUserCreate';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');

describe('onUserCreate', () => {
  const mockUid = 'test-user-123';
  const mockUser = {
    uid: mockUid,
    email: 'test@example.com',
    displayName: 'Test User',
  };

  let mockFirestore: any;
  let mockTransaction: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTransaction = {
      get: jest.fn(),
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    mockFirestore = {
      collection: jest.fn(),
      runTransaction: jest.fn((callback: any) => callback(mockTransaction)),
    };

    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);
    (encryption.createDataKeyForUser as jest.Mock).mockResolvedValue(undefined);
  });

  it('ユーザードキュメントを作成し、Freeプラン設定を注入する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);

    // onUserCreateはFirebase Functionsのトリガー関数を返す
    // テストでは内部のinitializeUser関数を直接テストするか、
    // トリガー関数を呼び出す必要がある
    // ここではトリガー関数を呼び出す方法でテスト
    const trigger = onUserCreate;
    await trigger(mockUser as admin.auth.UserRecord);

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
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('使用量を0で初期化する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);

    // onUserCreateはFirebase Functionsのトリガー関数を返す
    // テストでは内部のinitializeUser関数を直接テストするか、
    // トリガー関数を呼び出す必要がある
    // ここではトリガー関数を呼び出す方法でテスト
    const trigger = onUserCreate;
    await trigger(mockUser as admin.auth.UserRecord);

    const setCall = mockTransaction.set.mock.calls[0];
    const userData = setCall[1];
    expect(userData.usage.storageBytes).toBe(0);
    expect(userData.usage.updatedAt).toBeDefined();
  });

  it('DEKを生成・保存する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);

    // onUserCreateはFirebase Functionsのトリガー関数を返す
    // テストでは内部のinitializeUser関数を直接テストするか、
    // トリガー関数を呼び出す必要がある
    // ここではトリガー関数を呼び出す方法でテスト
    const trigger = onUserCreate;
    await trigger(mockUser as admin.auth.UserRecord);

    expect(encryption.createDataKeyForUser).toHaveBeenCalledWith(mockUid);
  });

  it('ユーザーが既に存在する場合はスキップする（冪等性）', async () => {
    const mockUserDoc = {
      exists: true,
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);

    // onUserCreateはFirebase Functionsのトリガー関数を返す
    // テストでは内部のinitializeUser関数を直接テストするか、
    // トリガー関数を呼び出す必要がある
    // ここではトリガー関数を呼び出す方法でテスト
    const trigger = onUserCreate;
    await trigger(mockUser as admin.auth.UserRecord);

    expect(mockTransaction.set).not.toHaveBeenCalled();
    expect(encryption.createDataKeyForUser).not.toHaveBeenCalled();
  });

  it('uidが存在しない場合はエラーを投げる', async () => {
    const invalidUser = {
      uid: '',
    } as admin.auth.UserRecord;

    const handler = onUserCreate();
    await expect(handler(invalidUser)).rejects.toThrow();
  });

  it('createdAtとupdatedAtを設定する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);

    // onUserCreateはFirebase Functionsのトリガー関数を返す
    // テストでは内部のinitializeUser関数を直接テストするか、
    // トリガー関数を呼び出す必要がある
    // ここではトリガー関数を呼び出す方法でテスト
    const trigger = onUserCreate;
    await trigger(mockUser as admin.auth.UserRecord);

    const setCall = mockTransaction.set.mock.calls[0];
    const userData = setCall[1];
    expect(userData.createdAt).toBeDefined();
    expect(userData.updatedAt).toBeDefined();
  });

  it('トランザクションで一貫性を保証する', async () => {
    const mockUserDoc = {
      exists: false,
    };

    mockTransaction.get.mockResolvedValue(mockUserDoc);

    // onUserCreateはFirebase Functionsのトリガー関数を返す
    // テストでは内部のinitializeUser関数を直接テストするか、
    // トリガー関数を呼び出す必要がある
    // ここではトリガー関数を呼び出す方法でテスト
    const trigger = onUserCreate;
    await trigger(mockUser as admin.auth.UserRecord);

    expect(mockFirestore.runTransaction).toHaveBeenCalled();
    expect(mockTransaction.commit).toHaveBeenCalled();
  });
});

