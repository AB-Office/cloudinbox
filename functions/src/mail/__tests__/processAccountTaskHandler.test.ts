/**
 * processAccountTaskHandler - Cloud Tasksハンドラのテスト
 */

/// <reference types="jest" />

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { handleProcessAccountTask } from '../processAccountTaskHandler';
import { processAccount } from '../processAccount';

jest.mock('firebase-admin');
jest.mock('../processAccount');

describe('processAccountTaskHandler - handleProcessAccountTask', () => {
  let mockFirestore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFirestore = {
      collection: jest.fn(),
    };

    (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);
  });

  it('uidが空の場合はinvalid-argumentエラーを投げる', async () => {
    await expect(
      handleProcessAccountTask({
        uid: '',
        accountId: 'account-1',
      })
    ).rejects.toThrow(functions.https.HttpsError);
  });

  it('accountIdが空の場合はinvalid-argumentエラーを投げる', async () => {
    await expect(
      handleProcessAccountTask({
        uid: 'user-1',
        accountId: '',
      })
    ).rejects.toThrow(functions.https.HttpsError);
  });

  it('指定されたアカウントが存在しない場合はnot-foundエラーを投げる', async () => {
    const mockAccountsCollection = {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
      })),
    };

    const mockUserDocRef = {
      collection: jest.fn(() => mockAccountsCollection),
    };

    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserDocRef),
    }));

    await expect(
      handleProcessAccountTask({
        uid: 'user-1',
        accountId: 'account-1',
      })
    ).rejects.toThrow(functions.https.HttpsError);
  });

  it('有効なペイロードの場合はprocessAccountを呼び出す', async () => {
    const mockAccountData = {
      label: 'Test Account',
    };

    const mockAccountsCollection = {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockAccountData,
        }),
      })),
    };

    const mockUserDocRef = {
      collection: jest.fn(() => mockAccountsCollection),
    };

    mockFirestore.collection = jest.fn(() => ({
      doc: jest.fn(() => mockUserDocRef),
    }));

    (processAccount as jest.Mock).mockResolvedValue(undefined);

    await handleProcessAccountTask({
      uid: 'user-1',
      accountId: 'account-1',
    });

    expect(processAccount).toHaveBeenCalledWith(
      'user-1',
      'account-1',
      mockAccountData,
      mockFirestore
    );
  });
});


