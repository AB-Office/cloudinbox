/**
 * PlanSelectionView.vueのテスト
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import PlanSelectionView from '../PlanSelectionView.vue';
import { useSettingsStore } from '@/stores/settings';
import { createCheckoutSession } from '@/services/subscription';
import { useSnackbar } from '@/composables/useSnackbar';

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

// Firebase Firestoreのモック
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

// Firebase Appのモック
vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
}));

// モック
vi.mock('@/services/subscription', () => ({
  createCheckoutSession: vi.fn(),
}));

const mockSnackbar = ref(false);
const mockSnackbarText = ref('');
const mockSnackbarColor = ref<'success' | 'error' | 'info' | 'warning'>('error');
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

// Vuetifyとi18nのセットアップ
const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  messages: {
    ja: {
      plan: {
        title: 'プラン選択',
        free: 'Free',
        standard: 'Standard',
        currentPlan: '現在のプラン',
        changePlan: 'このプランに変更',
        upgradeNow: '今すぐアップグレード',
        upgradeRequired: 'アップグレードが必要です',
        upgradeMessage: '現在のプランでは上限に達しています。Standardプランにアップグレードしてください。',
        success: 'プラン変更が完了しました',
        canceled: 'プラン変更がキャンセルされました',
        back: '戻る',
      },
    },
    en: {
      plan: {
        title: 'Plan Selection',
        free: 'Free',
        standard: 'Standard',
        currentPlan: 'Current Plan',
        changePlan: 'Change to this plan',
        upgradeNow: 'Upgrade Now',
        upgradeRequired: 'Upgrade Required',
        upgradeMessage: 'You have reached the limit of your current plan. Please upgrade to Standard plan.',
        success: 'Plan change completed',
        canceled: 'Plan change canceled',
        back: 'Back',
      },
    },
  },
});

describe('PlanSelectionView', () => {
  let router: ReturnType<typeof createRouter>;
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;
  let settingsStore: ReturnType<typeof useSettingsStore>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    mockShowError.mockClear();
    mockShowSuccess.mockClear();
    mockShowInfo.mockClear();
    mockShowWarning.mockClear();

    settingsStore = useSettingsStore();
    settingsStore.settings = {
      planLabel: 'Free',
      maxStorageBytes: 2147483648,
      usedStorageBytes: 0,
      maxAccounts: 1,
    };

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        { path: '/settings/plan', name: 'plan-selection', component: PlanSelectionView },
        { path: '/settings', name: 'settings', component: { template: '<div>Settings</div>' } },
      ],
    });
  });

  const createWrapper = async (routeQuery: Record<string, string> = {}) => {
    await router.push({ path: '/settings/plan', query: routeQuery });
    wrapper = mount(PlanSelectionView, {
      global: {
        plugins: [vuetify, i18n, pinia, router],
        mocks: {
          $route: router.currentRoute.value,
          $router: router,
        },
      },
    });
    await wrapper.vm.$nextTick();
    // onMountedの非同期処理を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();
    return wrapper;
  };

  describe('基本的なレンダリング', () => {
    it('プラン選択画面が表示される', async () => {
      const wrapper = await createWrapper();
      expect(wrapper.text()).toContain('プラン選択');
    });

    it('FreeプランとStandardプランが表示される', async () => {
      const wrapper = await createWrapper();
      expect(wrapper.text()).toContain('Free');
      expect(wrapper.text()).toContain('Standard');
    });
  });

  describe('現在のプランの表示', () => {
    it('現在のプランに「現在のプラン」バッジが表示される', async () => {
      settingsStore.settings = {
        planLabel: 'Free',
        maxStorageBytes: 2147483648,
        usedStorageBytes: 0,
        maxAccounts: 1,
      };

      const wrapper = await createWrapper();
      const freePlanCard = wrapper.find('[data-testid="plan-free"]');
      expect(freePlanCard.exists()).toBe(true);
      expect(freePlanCard.text()).toContain('現在のプラン');
    });
  });

  describe('アップグレード促進バナー', () => {
    it('?upgrade=trueクエリパラメータがある場合、アップグレード促進バナーが表示される', async () => {
      const wrapper = await createWrapper({ upgrade: 'true' });
      expect(wrapper.text()).toContain('アップグレードが必要です');
    });

    it('アップグレード促進バナーに現在のプラン情報が表示される', async () => {
      settingsStore.settings = {
        planLabel: 'Free',
        maxStorageBytes: 2147483648,
        usedStorageBytes: 0,
        maxAccounts: 1,
      };

      const wrapper = await createWrapper({ upgrade: 'true' });
      expect(wrapper.text()).toContain('Free');
      expect(wrapper.text()).toContain('1アカウント');
    });
  });

  describe('プラン変更処理', () => {
    it('「このプランに変更」ボタンをクリックするとcreateCheckoutSessionが呼ばれる', async () => {
      vi.mocked(createCheckoutSession).mockResolvedValue();

      const wrapper = await createWrapper();
      const changeButton = wrapper.find('[data-testid="change-plan-standard"]');
      expect(changeButton.exists()).toBe(true);

      await changeButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(createCheckoutSession).toHaveBeenCalledWith('standard', 'ja');
    });

    it('アップグレード促進時、Standardプランのボタンが「今すぐアップグレード」と表示される', async () => {
      settingsStore.settings = {
        planLabel: 'Free',
        maxStorageBytes: 2147483648,
        usedStorageBytes: 0,
        maxAccounts: 1,
      };

      const wrapper = await createWrapper({ upgrade: 'true' });
      const upgradeButton = wrapper.find('[data-testid="change-plan-standard"]');
      expect(upgradeButton.exists()).toBe(true);
      expect(upgradeButton.text()).toContain('今すぐアップグレード');
    });

    it('プラン変更中はローディング状態が表示される', async () => {
      vi.mocked(createCheckoutSession).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const wrapper = await createWrapper();
      const changeButton = wrapper.find('[data-testid="change-plan-standard"]');
      await changeButton.trigger('click');
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 50));

      // ローディング表示を確認（v-overlayが表示されているか）
      const overlay = wrapper.findComponent({ name: 'VOverlay' });
      expect(overlay.exists()).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('プラン変更に失敗した場合、エラーメッセージがスナックバーで表示される', async () => {
      const mockShowError = vi.fn();
      vi.mocked(useSnackbar).mockReturnValue({
        snackbar: ref(false),
        snackbarText: ref(''),
        snackbarColor: ref<'success' | 'error' | 'info' | 'warning'>('error'),
        showError: mockShowError,
        showSuccess: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn(),
      });

      const error = new Error('Network error');
      vi.mocked(createCheckoutSession).mockRejectedValue(error);

      const wrapper = await createWrapper();
      const changeButton = wrapper.find('[data-testid="change-plan-standard"]');
      await changeButton.trigger('click');
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockShowError).toHaveBeenCalledWith(error);
    });
  });

  describe('成功/キャンセルメッセージ', () => {
    it('?success=trueクエリパラメータがある場合、成功メッセージが表示される', async () => {
      await createWrapper({ success: 'true' });
      await wrapper.vm.$nextTick();
      // onMountedの非同期処理を待つ
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(mockShowSuccess).toHaveBeenCalled();
    });

    it('?canceled=trueクエリパラメータがある場合、キャンセルメッセージが表示される', async () => {
      await createWrapper({ canceled: 'true' });
      await wrapper.vm.$nextTick();
      // onMountedの非同期処理を待つ
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(mockShowInfo).toHaveBeenCalled();
    });
  });

  describe('戻るボタン', () => {
    it('戻るボタンをクリックすると設定画面に戻る', async () => {
      const wrapper = await createWrapper();
      const backButton = wrapper.find('[data-testid="back-button"]');
      expect(backButton.exists()).toBe(true);

      const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined as any);
      
      // handleBackを直接呼び出す
      (wrapper.vm as any).handleBack();
      
      // 非同期処理を待つ
      await wrapper.vm.$nextTick();

      expect(pushSpy).toHaveBeenCalledWith('/settings');
      pushSpy.mockRestore();
    });
  });
});

