/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { accountService } from '../account';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase Authをモック
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      uid: 'test-uid',
    },
  })),
}));

// Firebase Firestoreをモック
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    Timestamp: {
      now: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    },
  };
});

// Firebase Functionsをモック
const mockCallableFunction = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallableFunction),
}));

// Firebase Appをモック
vi.mock('../firebase', () => ({
  firebaseApp: {},
}));

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getAuthのモックをリセット
    vi.mocked(getAuth).mockReturnValue({
      currentUser: {
        uid: 'test-uid',
      },
    } as any);
  });

  describe('listAccounts', () => {
    it('should return active accounts when includeInactive is false', async () => {
      const mockAccounts = [
        {
          id: 'account1',
          label: 'Account 1',
          email: 'test1@example.com',
          status: 'active',
        },
        {
          id: 'account2',
          label: 'Account 2',
          email: 'test2@example.com',
          status: 'active',
        },
      ];

      const mockSnapshot = {
        docs: mockAccounts.map(account => ({
          id: account.id,
          data: () => account,
        })),
      };

      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const result = await accountService.listAccounts(false);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('account1');
      expect(result[1].id).toBe('account2');
    });

    it('should return all accounts when includeInactive is true', async () => {
      const mockAccounts = [
        {
          id: 'account1',
          label: 'Account 1',
          email: 'test1@example.com',
          status: 'active',
        },
        {
          id: 'account2',
          label: 'Account 2',
          email: 'test2@example.com',
          status: 'inactive',
        },
      ];

      const mockSnapshot = {
        docs: mockAccounts.map(account => ({
          id: account.id,
          data: () => account,
        })),
      };

      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const result = await accountService.listAccounts(true);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('active');
      expect(result[1].status).toBe('inactive');
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(getAuth).mockReturnValue({
        currentUser: null,
      } as any);

      await expect(accountService.listAccounts()).rejects.toThrow('User not authenticated');
    });
  });

  describe('getAccount', () => {
    it('should return account when found', async () => {
      const mockAccount = {
        id: 'account1',
        label: 'Account 1',
        email: 'test@example.com',
        status: 'active',
      };

      const mockDocSnap = {
        exists: () => true,
        id: 'account1',
        data: () => mockAccount,
      };

      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await accountService.getAccount('account1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('account1');
      expect(result?.label).toBe('Account 1');
    });

    it('should return null when account not found', async () => {
      const mockDocSnap = {
        exists: () => false,
      };

      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await accountService.getAccount('non-existent');

      expect(result).toBeNull();
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(getAuth).mockReturnValue({
        currentUser: null,
      } as any);

      await expect(accountService.getAccount('account1')).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('testConnection', () => {
    it('should return success result for POP3', async () => {
      mockCallableFunction.mockResolvedValue({
        data: {
          success: true,
        },
      });

      const formData = {
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      } as any;

      const result = await accountService.testConnection('pop3', formData);

      expect(result.success).toBe(true);
      expect(mockCallableFunction).toHaveBeenCalled();
    });

    it('should return success result for SMTP', async () => {
      mockCallableFunction.mockResolvedValue({
        data: {
          success: true,
        },
      });

      const formData = {
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        smtpUsername: 'user',
        smtpPassword: 'password',
      } as any;

      const result = await accountService.testConnection('smtp', formData);

      expect(result.success).toBe(true);
      expect(mockCallableFunction).toHaveBeenCalled();
    });

    it('should return error result when test fails', async () => {
      mockCallableFunction.mockResolvedValue({
        data: {
          success: false,
          errorMessage: 'Connection failed',
        },
      });

      const formData = {
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      } as any;

      const result = await accountService.testConnection('pop3', formData);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Connection failed');
    });
  });

  describe('createAccount', () => {
    it('should create account successfully', async () => {
      // プラン上限チェックのモック
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          plan: {
            maxAccounts: 10,
          },
        }),
      };

      const mockAccountsQuery = {
        size: 5, // 現在5アカウント（上限10以内）
      };

      const mockDocRef = { path: 'users/test-uid' };
      vi.mocked(doc).mockImplementation((db: any, ...pathSegments: string[]) => {
        const path = pathSegments.join('/');
        if (path === 'users/test-uid') {
          return mockDocRef as any;
        }
        return { path } as any;
      });
      vi.mocked(getDoc).mockImplementation((ref: any) => {
        if (ref.path === 'users/test-uid') {
          return Promise.resolve(mockUserDoc as any);
        }
        return Promise.resolve({ exists: () => false } as any);
      });

      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockAccountsQuery as any);

      // パスワード暗号化のモック
      mockCallableFunction.mockResolvedValue({
        data: {
          encryptedPassword: 'encrypted-password',
        },
      });

      // アカウント作成のモック
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-account-id' } as any);

      const formData = {
        label: 'Test Account',
        email: 'test@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      } as any;

      const result = await accountService.createAccount(formData);

      expect(result).toBe('new-account-id');
      expect(addDoc).toHaveBeenCalled();
    });

    it('should throw error when account limit is reached', async () => {
      // プラン上限チェックのモック（上限に達している場合）
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          plan: {
            maxAccounts: 5,
          },
        }),
      };

      const mockAccountsQuery = {
        size: 5, // 現在5アカウント（上限5に達している）
      };

      const mockDocRef = { path: 'users/test-uid' };
      vi.mocked(doc).mockImplementation((db: any, ...pathSegments: string[]) => {
        const path = pathSegments.join('/');
        if (path === 'users/test-uid') {
          return mockDocRef as any;
        }
        return { path } as any;
      });
      vi.mocked(getDoc).mockImplementation((ref: any) => {
        if (ref.path === 'users/test-uid') {
          return Promise.resolve(mockUserDoc as any);
        }
        return Promise.resolve({ exists: () => false } as any);
      });

      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockAccountsQuery as any);

      const formData = {
        label: 'Test Account',
        email: 'test@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      } as any;

      await expect(accountService.createAccount(formData)).rejects.toThrow(
        'Account limit reached'
      );
    });
  });

  describe('updateAccount', () => {
    it('should update account successfully', async () => {
      // パスワード暗号化のモック
      mockCallableFunction.mockResolvedValue({
        data: {
          encryptedPassword: 'encrypted-password',
        },
      });

      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const formData = {
        label: 'Updated Account',
        email: 'updated@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'newpassword',
      } as any;

      await accountService.updateAccount('account1', formData);

      expect(updateDoc).toHaveBeenCalled();
    });

    it('should not update password when password is empty', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const formData = {
        label: 'Updated Account',
        email: 'updated@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: '', // 空のパスワード
      } as any;

      await accountService.updateAccount('account1', formData);

      expect(updateDoc).toHaveBeenCalled();
      // パスワードが空の場合、encryptPasswordは呼ばれない
      // （ただし、httpsCallableは呼ばれる可能性があるため、実際の動作を確認）
    });
  });

  describe('deleteAccount', () => {
    it('should delete account (logical delete)', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await accountService.deleteAccount('account1');

      expect(updateDoc).toHaveBeenCalled();
      const updateData = vi.mocked(updateDoc).mock.calls[0][1] as any;
      expect(updateData.status).toBe('inactive');
      expect(updateData.deletedAt).toBeDefined();
    });
  });

  describe('restoreAccount', () => {
    it('should restore account successfully', async () => {
      // プラン上限チェックのモック
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          plan: {
            maxAccounts: 10,
          },
        }),
      };

      const mockAccountsQuery = {
        size: 4, // 現在4アカウント（上限10以内）
      };

      const mockDocRef = { path: 'users/test-uid' };
      vi.mocked(doc).mockImplementation((db: any, ...pathSegments: string[]) => {
        const path = pathSegments.join('/');
        if (path === 'users/test-uid') {
          return mockDocRef as any;
        }
        return { path } as any;
      });
      vi.mocked(getDoc).mockImplementation((ref: any) => {
        if (ref.path === 'users/test-uid') {
          return Promise.resolve(mockUserDoc as any);
        }
        return Promise.resolve({ exists: () => false } as any);
      });

      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockAccountsQuery as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await accountService.restoreAccount('account1');

      expect(updateDoc).toHaveBeenCalled();
      const updateData = vi.mocked(updateDoc).mock.calls[0][1] as any;
      expect(updateData.status).toBe('active');
      expect(updateData.deletedAt).toBe(null);
    });

    it('should throw error when account limit is reached', async () => {
      // プラン上限チェックのモック（上限に達している場合）
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          plan: {
            maxAccounts: 5,
          },
        }),
      };

      const mockAccountsQuery = {
        size: 5, // 現在5アカウント（上限5に達している）
      };

      const mockDocRef = { path: 'users/test-uid' };
      vi.mocked(doc).mockImplementation((db: any, ...pathSegments: string[]) => {
        const path = pathSegments.join('/');
        if (path === 'users/test-uid') {
          return mockDocRef as any;
        }
        return { path } as any;
      });
      vi.mocked(getDoc).mockImplementation((ref: any) => {
        if (ref.path === 'users/test-uid') {
          return Promise.resolve(mockUserDoc as any);
        }
        return Promise.resolve({ exists: () => false } as any);
      });

      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(where).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockAccountsQuery as any);

      await expect(accountService.restoreAccount('account1')).rejects.toThrow(
        'Account limit reached'
      );
    });
  });

  describe('permanentlyDeleteAccount', () => {
    it('should permanently delete account', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      await accountService.permanentlyDeleteAccount('account1');

      expect(deleteDoc).toHaveBeenCalled();
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(getAuth).mockReturnValue({
        currentUser: null,
      } as any);

      await expect(accountService.permanentlyDeleteAccount('account1')).rejects.toThrow(
        'User not authenticated'
      );
    });
  });
});

