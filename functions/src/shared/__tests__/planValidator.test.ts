/**
 * PlanValidator - プラン制限チェックのテスト
 */

import { canAddAccount, canStoreMail } from '../planValidator';

// Firebase Admin SDKのモック
const mockFirestore = {
  collection: jest.fn(),
};

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => mockFirestore),
}));

describe('PlanValidator', () => {
  const mockUid = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canAddAccount', () => {
    it('アカウント数が上限未満の場合はtrueを返す', async () => {
      const mockUserDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: {
              id: 'free',
              maxAccounts: 1,
            },
          }),
        }),
      };

      const mockUsersCollection = {
        doc: jest.fn().mockReturnValue(mockUserDoc),
      };

      // mailAccountsコレクションのモック（0件）
      const mockMailAccountsCollection = {
        get: jest.fn().mockResolvedValue({
          size: 0,
        }),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockMailAccountsCollection),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn((uid: string) => {
              if (uid === mockUid) {
                return {
                  get: mockUserDoc.get,
                  collection: mockUserDocRef.collection,
                };
              }
              return mockUserDoc;
            }),
          };
        }
        return mockUsersCollection;
      });

      const result = await canAddAccount(mockUid);
      expect(result).toBe(true);
    });

    it('アカウント数が上限に達している場合はfalseを返す', async () => {
      const mockUserDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: {
              id: 'free',
              maxAccounts: 1,
            },
          }),
        }),
      };

      // mailAccountsコレクションのモック（1件 = 上限）
      const mockMailAccountsCollection = {
        get: jest.fn().mockResolvedValue({
          size: 1,
        }),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockMailAccountsCollection),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn((uid: string) => {
              if (uid === mockUid) {
                return {
                  get: mockUserDoc.get,
                  collection: mockUserDocRef.collection,
                };
              }
              return mockUserDoc;
            }),
          };
        }
        return { doc: jest.fn(() => mockUserDoc) };
      });

      const result = await canAddAccount(mockUid);
      expect(result).toBe(false);
    });

    it('ユーザーが存在しない場合はエラーを投げる', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockDoc),
      }));

      await expect(canAddAccount(mockUid)).rejects.toThrow();
    });

    it('プラン情報が存在しない場合はエラーを投げる', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({}), // plan情報なし
        }),
      };

      const mockMailAccountsCollection = {
        get: jest.fn().mockResolvedValue({
          size: 0,
        }),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockMailAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          get: mockDoc.get,
          collection: mockUserDocRef.collection,
        })),
      }));

      await expect(canAddAccount(mockUid)).rejects.toThrow();
    });
  });

  describe('canStoreMail', () => {
    it('使用量とメールサイズの合計が上限未満の場合はtrueを返す', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: {
              id: 'free',
              maxStorageBytes: 2147483648, // 2GB
            },
            usage: {
              storageBytes: 1000000, // 1MB
            },
          }),
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockDoc),
      }));

      const mailSize = 500000; // 500KB
      const result = await canStoreMail(mockUid, mailSize);
      expect(result).toBe(true);
    });

    it('使用量とメールサイズの合計が上限を超える場合はfalseを返す', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: {
              id: 'free',
              maxStorageBytes: 2147483648, // 2GB
            },
            usage: {
              storageBytes: 2147483647, // 上限近く
            },
          }),
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockDoc),
      }));

      const mailSize = 1000000; // 1MB
      const result = await canStoreMail(mockUid, mailSize);
      expect(result).toBe(false);
    });

    it('使用量とメールサイズの合計が上限と等しい場合はfalseを返す', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: {
              id: 'free',
              maxStorageBytes: 2147483648, // 2GB
            },
            usage: {
              storageBytes: 2147483648, // 上限
            },
          }),
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockDoc),
      }));

      const mailSize = 1;
      const result = await canStoreMail(mockUid, mailSize);
      expect(result).toBe(false);
    });

    it('ユーザーが存在しない場合はエラーを投げる', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockDoc),
      }));

      await expect(canStoreMail(mockUid, 1000)).rejects.toThrow();
    });

    it('プラン情報が存在しない場合はエラーを投げる', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            usage: {
              storageBytes: 0,
            },
          }), // plan情報なし
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockDoc),
      }));

      await expect(canStoreMail(mockUid, 1000)).rejects.toThrow();
    });

    it('使用量情報が存在しない場合は0として扱う', async () => {
      const mockDoc = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: {
              id: 'free',
              maxStorageBytes: 2147483648, // 2GB
            },
            // usage情報なし
          }),
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockDoc),
      }));

      const mailSize = 1000000; // 1MB
      const result = await canStoreMail(mockUid, mailSize);
      expect(result).toBe(true);
    });
  });
});

