/**
 * AccountFormView.vueのテスト
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import AccountFormView from '../AccountFormView.vue';
import { useAccountStore } from '@/stores/account';
import { useSettingsStore } from '@/stores/settings';
import { parseError } from '@/utils/errorHandler';
import ja from '@/locales/ja.json';
import en from '@/locales/en.json';

// visualViewportのモック
beforeAll(() => {
  Object.defineProperty(window, 'visualViewport', {
    value: {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Firebase mocks
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-uid' },
  })),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
}));

const mockSnackbar = { value: false };
const mockSnackbarText = { value: '' };
const mockSnackbarColor = { value: 'error' as const };
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowInfo = vi.fn();
const mockShowWarning = vi.fn();

vi.mock('@/composables/useSnackbar', () => ({
  useSnackbar: vi.fn(() => ({
    snackbar: mockSnackbar,
    snackbarText: mockSnackbarText,
    snackbarColor: mockSnackbarColor,
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showInfo: mockShowInfo,
    showWarning: mockShowWarning,
  })),
}));

// Router mock
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/settings/accounts', component: { template: '<div>Account List</div>' } },
    { path: '/settings/plan', component: { template: '<div>Plan Selection</div>' } },
    { path: '/settings/accounts/:accountId?', component: AccountFormView },
  ],
});

// i18n
const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  messages: {
    ja,
    en,
  },
});

// Vuetify
const vuetify = createVuetify({
  components,
  directives,
});

describe('AccountFormView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let accountStore: ReturnType<typeof useAccountStore>;
  let settingsStore: ReturnType<typeof useSettingsStore>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    accountStore = useAccountStore();
    settingsStore = useSettingsStore();

    // Settings storeのモック
    settingsStore.settings = {
      planLabel: 'Free',
      maxStorageBytes: 2147483648,
      usedStorageBytes: 0,
      maxAccounts: 1,
    };
  });

  const createWrapper = (routeParams = {}) => {
    router.currentRoute.value.params = routeParams;
    return mount(AccountFormView, {
      global: {
        plugins: [router, vuetify, pinia, i18n],
        stubs: {
          'v-container': true,
          'v-row': true,
          'v-col': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-icon': true,
          'v-form': true,
          'v-text-field': true,
          'v-divider': true,
          'v-alert': true,
          'v-snackbar': true,
          'v-dialog': true,
        },
      },
    });
  };

  describe('Account limit reached error handling', () => {
    it('should display error dialog with upgrade button when Account limit reached error occurs', async () => {
      const error = new Error('Account limit reached');
      accountStore.createAccount = vi.fn().mockRejectedValue(error);

      const wrapper = createWrapper();

      // フォームのバリデーションをスキップしてエラーを発生させる
      (wrapper.vm as any).formRef = {
        validate: vi.fn().mockResolvedValue({ valid: true }),
      };

      // コンポーネントのhandleSaveメソッドを直接呼び出す
      await (wrapper.vm as any).handleSave();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      // upgradeErrorDialogがtrueになっていることを確認
      expect((wrapper.vm as any).upgradeErrorDialog).toBe(true);

      // エラーダイアログが表示されることを確認
      const errorDialog = wrapper.find('[data-testid="upgrade-error-dialog"]');
      expect(errorDialog.exists()).toBe(true);

      // アップグレードボタンが表示されることを確認
      const upgradeButton = wrapper.find('[data-testid="upgrade-button"]');
      expect(upgradeButton.exists()).toBe(true);
    });

    it('should navigate to plan selection page when upgrade button is clicked', async () => {
      const error = new Error('Account limit reached');
      accountStore.createAccount = vi.fn().mockRejectedValue(error);

      const wrapper = createWrapper();
      const routerPushSpy = vi.spyOn(router, 'push');

      // フォームのバリデーションをスキップしてエラーを発生させる
      (wrapper.vm as any).formRef = {
        validate: vi.fn().mockResolvedValue({ valid: true }),
      };

      // エラーを発生させる
      await (wrapper.vm as any).handleSave();
      await wrapper.vm.$nextTick();

      // アップグレードボタンをクリック
      const upgradeButton = wrapper.find('[data-testid="upgrade-button"]');
      expect(upgradeButton.exists()).toBe(true);
      await upgradeButton.trigger('click');
      await wrapper.vm.$nextTick();

      // プラン選択ページに遷移することを確認
      expect(routerPushSpy).toHaveBeenCalledWith('/settings/plan?upgrade=true');
    });

    it('should display error message in dialog when Account limit reached error occurs', async () => {
      const error = new Error('Account limit reached');
      const errorResult = parseError(error, undefined, settingsStore.settings || undefined);

      accountStore.createAccount = vi.fn().mockRejectedValue(error);

      const wrapper = createWrapper();

      // フォームのバリデーションをスキップしてエラーを発生させる
      (wrapper.vm as any).formRef = {
        validate: vi.fn().mockResolvedValue({ valid: true }),
      };

      // エラーを発生させる
      await (wrapper.vm as any).handleSave();
      await wrapper.vm.$nextTick();
      await wrapper.vm.$nextTick();

      // upgradeErrorDialogがtrueになっていることを確認
      expect((wrapper.vm as any).upgradeErrorDialog).toBe(true);

      // エラーダイアログにエラーメッセージが表示されることを確認
      const errorDialog = wrapper.find('[data-testid="upgrade-error-dialog"]');
      expect(errorDialog.exists()).toBe(true);
      expect(errorDialog.text()).toContain(errorResult.message);
    });
  });
});

