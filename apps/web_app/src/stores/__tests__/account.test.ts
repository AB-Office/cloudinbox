/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAccountStore } from '../account';
import * as accountService from '@/services/account';
import type { MailAccount, AccountFormData, AccountTestResult } from '@/types/account';

// accountServiceをモック
vi.mock('@/services/account', () => ({
  accountService: {
    listAccounts: vi.fn(),
    getAccount: vi.fn(),
    testConnection: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    restoreAccount: vi.fn(),
    permanentlyDeleteAccount: vi.fn(),
  },
}));

describe('accountStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('fetchAccounts', () => {
    it('should fetch accounts and update store', async () => {
      const store = useAccountStore();
      const mockAccounts: MailAccount[] = [
        {
          id: 'account1',
          label: 'Account 1',
          email: 'test1@example.com',
          status: 'active',
          pop3: {
            host: 'pop.example.com',
            port: 995,
            useSsl: true,
            userName: 'user1',
          },
          createdAt: {} as any,
          updatedAt: {} as any,
        },
        {
          id: 'account2',
          label: 'Account 2',
          email: 'test2@example.com',
          status: 'active',
          pop3: {
            host: 'pop2.example.com',
            port: 995,
            useSsl: true,
            userName: 'user2',
          },
          createdAt: {} as any,
          updatedAt: {} as any,
        },
      ];

      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue(mockAccounts);

      await store.fetchAccounts(false);

      expect(store.accounts).toEqual(mockAccounts);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should set error when fetch fails', async () => {
      const store = useAccountStore();
      const error = new Error('Failed to fetch accounts');

      vi.mocked(accountService.accountService.listAccounts).mockRejectedValue(error);

      await store.fetchAccounts();

      expect(store.accounts).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeTruthy();
    });

    it('should include inactive accounts when includeInactive is true', async () => {
      const store = useAccountStore();
      const mockAccounts: MailAccount[] = [
        {
          id: 'account1',
          label: 'Account 1',
          email: 'test1@example.com',
          status: 'active',
          pop3: {
            host: 'pop.example.com',
            port: 995,
            useSsl: true,
            userName: 'user1',
          },
          createdAt: {} as any,
          updatedAt: {} as any,
        },
        {
          id: 'account2',
          label: 'Account 2',
          email: 'test2@example.com',
          status: 'inactive',
          pop3: {
            host: 'pop2.example.com',
            port: 995,
            useSsl: true,
            userName: 'user2',
          },
          createdAt: {} as any,
          updatedAt: {} as any,
        },
      ];

      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue(mockAccounts);

      await store.fetchAccounts(true);

      expect(accountService.accountService.listAccounts).toHaveBeenCalledWith(true);
      expect(store.accounts).toEqual(mockAccounts);
    });
  });

  describe('fetchAccount', () => {
    it('should fetch account and update store', async () => {
      const store = useAccountStore();
      const mockAccount: MailAccount = {
        id: 'account1',
        label: 'Account 1',
        email: 'test@example.com',
        status: 'active',
        pop3: {
          host: 'pop.example.com',
          port: 995,
          useSsl: true,
          userName: 'user',
        },
        createdAt: {} as any,
        updatedAt: {} as any,
      };

      vi.mocked(accountService.accountService.getAccount).mockResolvedValue(mockAccount);

      await store.fetchAccount('account1');

      expect(store.currentAccount).toEqual(mockAccount);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should set error when fetch fails', async () => {
      const store = useAccountStore();
      const error = new Error('Failed to fetch account');

      vi.mocked(accountService.accountService.getAccount).mockRejectedValue(error);

      await store.fetchAccount('account1');

      expect(store.currentAccount).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeTruthy();
    });
  });

  describe('testConnection', () => {
    it('should test POP3 connection successfully', async () => {
      const store = useAccountStore();
      const mockResult: AccountTestResult = {
        success: true,
      };

      const formData: AccountFormData = {
        label: 'Test',
        email: 'test@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      };

      vi.mocked(accountService.accountService.testConnection).mockResolvedValue(mockResult);

      await store.testConnection('pop3', formData);

      expect(store.testResult).toEqual(mockResult);
      expect(store.isTesting).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should test SMTP connection successfully', async () => {
      const store = useAccountStore();
      const mockResult: AccountTestResult = {
        success: true,
      };

      const formData: AccountFormData = {
        label: 'Test',
        email: 'test@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        smtpUsername: 'user',
        smtpPassword: 'password',
      };

      vi.mocked(accountService.accountService.testConnection).mockResolvedValue(mockResult);

      await store.testConnection('smtp', formData);

      expect(store.testResult).toEqual(mockResult);
      expect(accountService.accountService.testConnection).toHaveBeenCalledWith(
        'smtp',
        formData,
        undefined
      );
    });

    it('should set error when test fails', async () => {
      const store = useAccountStore();
      const error = new Error('Connection failed');

      const formData: AccountFormData = {
        label: 'Test',
        email: 'test@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      };

      vi.mocked(accountService.accountService.testConnection).mockRejectedValue(error);

      await store.testConnection('pop3', formData);

      expect(store.testResult).not.toBeNull();
      expect(store.testResult?.success).toBe(false);
      expect(store.isTesting).toBe(false);
      expect(store.error).toBeTruthy();
    });

    it('should pass accountId when updating existing account', async () => {
      const store = useAccountStore();
      const mockResult: AccountTestResult = {
        success: true,
      };

      const formData: AccountFormData = {
        label: 'Test',
        email: 'test@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      };

      vi.mocked(accountService.accountService.testConnection).mockResolvedValue(mockResult);

      await store.testConnection('pop3', formData, 'account1');

      expect(accountService.accountService.testConnection).toHaveBeenCalledWith(
        'pop3',
        formData,
        'account1'
      );
    });
  });

  describe('createAccount', () => {
    it('should create account and refresh list', async () => {
      const store = useAccountStore();
      const formData: AccountFormData = {
        label: 'New Account',
        email: 'new@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      };

      const mockAccounts: MailAccount[] = [
        {
          id: 'new-account-id',
          label: 'New Account',
          email: 'new@example.com',
          status: 'active',
          pop3: {
            host: 'pop.example.com',
            port: 995,
            useSsl: true,
            userName: 'user',
          },
          createdAt: {} as any,
          updatedAt: {} as any,
        },
      ];

      vi.mocked(accountService.accountService.createAccount).mockResolvedValue('new-account-id');
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue(mockAccounts);

      await store.createAccount(formData);

      expect(accountService.accountService.createAccount).toHaveBeenCalledWith(formData);
      expect(accountService.accountService.listAccounts).toHaveBeenCalled();
      expect(store.accounts).toEqual(mockAccounts);
    });

    it('should set error and throw when create fails', async () => {
      const store = useAccountStore();
      const error = new Error('Failed to create account');
      const formData: AccountFormData = {
        label: 'New Account',
        email: 'new@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      };

      vi.mocked(accountService.accountService.createAccount).mockRejectedValue(error);

      await expect(store.createAccount(formData)).rejects.toThrow('Failed to create account');
      expect(store.error).toBeTruthy();
    });
  });

  describe('updateAccount', () => {
    it('should update account and refresh list and current account', async () => {
      const store = useAccountStore();
      const formData: AccountFormData = {
        label: 'Updated Account',
        email: 'updated@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      };

      const updatedAccount: MailAccount = {
        id: 'account1',
        label: 'Updated Account',
        email: 'updated@example.com',
        status: 'active',
        pop3: {
          host: 'pop.example.com',
          port: 995,
          useSsl: true,
          userName: 'user',
        },
        createdAt: {} as any,
        updatedAt: {} as any,
      };

      store.currentAccount = {
        id: 'account1',
        label: 'Old Account',
        email: 'old@example.com',
        status: 'active',
        pop3: {
          host: 'pop.example.com',
          port: 995,
          useSsl: true,
          userName: 'user',
        },
        createdAt: {} as any,
        updatedAt: {} as any,
      } as MailAccount;

      vi.mocked(accountService.accountService.updateAccount).mockResolvedValue(undefined);
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue([updatedAccount]);
      vi.mocked(accountService.accountService.getAccount).mockResolvedValue(updatedAccount);

      await store.updateAccount('account1', formData);

      expect(accountService.accountService.updateAccount).toHaveBeenCalledWith(
        'account1',
        formData
      );
      expect(accountService.accountService.listAccounts).toHaveBeenCalled();
      expect(accountService.accountService.getAccount).toHaveBeenCalledWith('account1');
      expect(store.currentAccount).toEqual(updatedAccount);
    });

    it('should not fetch current account if it does not match', async () => {
      const store = useAccountStore();
      const formData: AccountFormData = {
        label: 'Updated Account',
        email: 'updated@example.com',
        pop3Host: 'pop.example.com',
        pop3Port: 995,
        pop3Username: 'user',
        pop3Password: 'password',
      };

      store.currentAccount = {
        id: 'account2',
        label: 'Other Account',
        email: 'other@example.com',
        status: 'active',
        pop3: {
          host: 'pop.example.com',
          port: 995,
          useSsl: true,
          userName: 'user',
        },
        createdAt: {} as any,
        updatedAt: {} as any,
      } as MailAccount;

      vi.mocked(accountService.accountService.updateAccount).mockResolvedValue(undefined);
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue([]);

      await store.updateAccount('account1', formData);

      expect(accountService.accountService.getAccount).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('should delete account and refresh list', async () => {
      const store = useAccountStore();
      const mockAccounts: MailAccount[] = [];

      vi.mocked(accountService.accountService.deleteAccount).mockResolvedValue(undefined);
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue(mockAccounts);

      await store.deleteAccount('account1');

      expect(accountService.accountService.deleteAccount).toHaveBeenCalledWith('account1');
      expect(accountService.accountService.listAccounts).toHaveBeenCalled();
      expect(store.accounts).toEqual(mockAccounts);
    });

    it('should clear current account if deleted account matches', async () => {
      const store = useAccountStore();
      store.currentAccount = {
        id: 'account1',
        label: 'Account 1',
        email: 'test@example.com',
        status: 'active',
        pop3: {
          host: 'pop.example.com',
          port: 995,
          useSsl: true,
          userName: 'user',
        },
        createdAt: {} as any,
        updatedAt: {} as any,
      } as MailAccount;

      vi.mocked(accountService.accountService.deleteAccount).mockResolvedValue(undefined);
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue([]);

      await store.deleteAccount('account1');

      expect(store.currentAccount).toBeNull();
    });
  });

  describe('restoreAccount', () => {
    it('should restore account and refresh list', async () => {
      const store = useAccountStore();
      const mockAccounts: MailAccount[] = [
        {
          id: 'account1',
          label: 'Account 1',
          email: 'test@example.com',
          status: 'active',
          pop3: {
            host: 'pop.example.com',
            port: 995,
            useSsl: true,
            userName: 'user',
          },
          createdAt: {} as any,
          updatedAt: {} as any,
        },
      ];

      vi.mocked(accountService.accountService.restoreAccount).mockResolvedValue(undefined);
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue(mockAccounts);

      await store.restoreAccount('account1');

      expect(accountService.accountService.restoreAccount).toHaveBeenCalledWith('account1');
      expect(accountService.accountService.listAccounts).toHaveBeenCalled();
      expect(store.accounts).toEqual(mockAccounts);
    });
  });

  describe('permanentlyDeleteAccount', () => {
    it('should permanently delete account and refresh list', async () => {
      const store = useAccountStore();
      const mockAccounts: MailAccount[] = [];

      vi.mocked(accountService.accountService.permanentlyDeleteAccount).mockResolvedValue(
        undefined
      );
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue(mockAccounts);

      await store.permanentlyDeleteAccount('account1');

      expect(accountService.accountService.permanentlyDeleteAccount).toHaveBeenCalledWith(
        'account1'
      );
      expect(accountService.accountService.listAccounts).toHaveBeenCalled();
      expect(store.accounts).toEqual(mockAccounts);
    });

    it('should clear current account if deleted account matches', async () => {
      const store = useAccountStore();
      store.currentAccount = {
        id: 'account1',
        label: 'Account 1',
        email: 'test@example.com',
        status: 'active',
        pop3: {
          host: 'pop.example.com',
          port: 995,
          useSsl: true,
          userName: 'user',
        },
        createdAt: {} as any,
        updatedAt: {} as any,
      } as MailAccount;

      vi.mocked(accountService.accountService.permanentlyDeleteAccount).mockResolvedValue(
        undefined
      );
      vi.mocked(accountService.accountService.listAccounts).mockResolvedValue([]);

      await store.permanentlyDeleteAccount('account1');

      expect(store.currentAccount).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store state', () => {
      const store = useAccountStore();
      store.accounts = [
        {
          id: 'account1',
          label: 'Account 1',
          email: 'test@example.com',
          status: 'active',
          pop3: {
            host: 'pop.example.com',
            port: 995,
            useSsl: true,
            userName: 'user',
          },
          createdAt: {} as any,
          updatedAt: {} as any,
        },
      ] as MailAccount[];
      store.currentAccount = {} as MailAccount;
      store.error = 'Some error';
      store.testResult = { success: true };

      store.reset();

      expect(store.accounts).toEqual([]);
      expect(store.currentAccount).toBeNull();
      expect(store.error).toBeNull();
      expect(store.testResult).toBeNull();
    });
  });
});
