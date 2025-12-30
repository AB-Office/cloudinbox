import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MailAccount, AccountFormData, AccountTestResult } from '@/types/account';
import { accountService } from '@/services/account';
import { parseError } from '@/utils/errorHandler';

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<MailAccount[]>([]);
  const currentAccount = ref<MailAccount | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const testResult = ref<AccountTestResult | null>(null);
  const isTesting = ref(false);

  /**
   * アカウント一覧を取得する
   * @param includeInactive 非アクティブなアカウントも含めるかどうか
   */
  async function fetchAccounts(includeInactive: boolean = false) {
    isLoading.value = true;
    error.value = null;
    try {
      accounts.value = await accountService.listAccounts(includeInactive);
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * アカウントを取得する
   * @param accountId アカウントID
   */
  async function fetchAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      currentAccount.value = await accountService.getAccount(accountId);
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 接続テストを実行する
   * @param protocol プロトコル（'pop3' または 'smtp'）
   * @param formData フォームデータ
   * @param accountId 既存アカウントID（更新時は指定）
   */
  async function testConnection(
    protocol: 'pop3' | 'smtp',
    formData: AccountFormData,
    accountId?: string
  ) {
    isTesting.value = true;
    testResult.value = null;
    error.value = null;
    try {
      testResult.value = await accountService.testConnection(protocol, formData, accountId);
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
      testResult.value = {
        success: false,
        errorMessage: message,
      };
    } finally {
      isTesting.value = false;
    }
  }

  /**
   * アカウントを作成する
   * @param formData フォームデータ
   */
  async function createAccount(formData: AccountFormData) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.createAccount(formData);
      // 作成後、アカウント一覧を再取得
      await fetchAccounts();
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * アカウントを更新する
   * @param accountId アカウントID
   * @param formData フォームデータ
   */
  async function updateAccount(accountId: string, formData: AccountFormData) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.updateAccount(accountId, formData);
      // 更新後、アカウント一覧を再取得
      await fetchAccounts();
      // 現在のアカウントも更新
      if (currentAccount.value?.id === accountId) {
        await fetchAccount(accountId);
      }
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * アカウントを削除する（論理削除）
   * @param accountId アカウントID
   */
  async function deleteAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.deleteAccount(accountId);
      // 削除後、アカウント一覧を再取得
      await fetchAccounts();
      // 削除したアカウントが現在のアカウントの場合、クリア
      if (currentAccount.value?.id === accountId) {
        currentAccount.value = null;
      }
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * アカウントを復元する
   * @param accountId アカウントID
   */
  async function restoreAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.restoreAccount(accountId);
      // 復元後、アカウント一覧を再取得
      await fetchAccounts();
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * アカウントを完全削除する（物理削除）
   * @param accountId アカウントID
   */
  async function permanentlyDeleteAccount(accountId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await accountService.permanentlyDeleteAccount(accountId);
      // 削除後、アカウント一覧を再取得
      await fetchAccounts();
      // 削除したアカウントが現在のアカウントの場合、クリア
      if (currentAccount.value?.id === accountId) {
        currentAccount.value = null;
      }
    } catch (e: unknown) {
      const { message } = parseError(e);
      error.value = message;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * ストアの状態をリセットする
   */
  function reset() {
    accounts.value = [];
    currentAccount.value = null;
    testResult.value = null;
    error.value = null;
  }

  return {
    // state
    accounts,
    currentAccount,
    isLoading,
    error,
    testResult,
    isTesting,
    // actions
    fetchAccounts,
    fetchAccount,
    testConnection,
    createAccount,
    updateAccount,
    deleteAccount,
    restoreAccount,
    permanentlyDeleteAccount,
    reset,
  };
});
