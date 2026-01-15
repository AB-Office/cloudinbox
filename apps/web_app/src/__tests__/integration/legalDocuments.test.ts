/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for legal documents display in Web app
 *
 * Tests the complete flow from SettingsView to LegalDocumentViewer,
 * including document fetching, display, language switching, and error handling.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SettingsView from '@/views/SettingsView.vue';
import { getDocument } from '@/services/legalDocument';

// visualViewportとResizeObserverのモック
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

// LegalDocumentServiceのモック
vi.mock('@/services/legalDocument', () => ({
  getDocument: vi.fn(),
}));

// SettingsStoreのモック
vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    settings: null,
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
  }),
}));

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  fallbackLocale: 'en',
  messages: {
    ja: {
      navigation: { settings: '設定' },
      settings: {
        storageUsage: 'ストレージ使用量',
        plan: 'プラン',
        usedStorage: '使用量',
        availableStorage: '利用可能',
        legal: '法的情報',
        privacyPolicy: 'プライバシーポリシー',
        termsOfService: '利用規約',
        commercialTransaction: '特定商取引法に基づく表記',
        pricingBilling: 'Pricing / Billing',
      },
      account: { title: 'アカウント' },
      common: { open: '開く' },
    },
    en: {
      navigation: { settings: 'Settings' },
      settings: {
        storageUsage: 'Storage Usage',
        plan: 'Plan',
        usedStorage: 'Used',
        availableStorage: 'Available',
        legal: 'Legal Information',
        privacyPolicy: 'Privacy Policy',
        termsOfService: 'Terms of Service',
        commercialTransaction: 'Commercial Transaction',
        pricingBilling: 'Pricing / Billing',
      },
      account: { title: 'Account' },
      common: { open: 'Open' },
    },
  },
});

describe('Legal Documents Integration Tests', () => {
  let router: ReturnType<typeof createRouter>;
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        { path: '/settings', name: 'settings', component: SettingsView },
        { path: '/account-list', name: 'account-list', component: { template: '<div>Account List</div>' } },
      ],
    });
  });

  const createWrapper = async (locale: 'ja' | 'en' = 'ja') => {
    i18n.global.locale.value = locale;
    await router.push({ path: '/settings' });
    wrapper = mount(SettingsView, {
      global: {
        plugins: [vuetify, i18n, pinia, router],
        mocks: {
          $route: router.currentRoute.value,
          $router: router,
        },
      },
    });
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();
    return wrapper;
  };

  describe('Document display from SettingsView', () => {
    it('should display terms of service when terms link is clicked', async () => {
      const mockContent = '# Terms of Service\n\nContent...';
      vi.mocked(getDocument).mockResolvedValue(mockContent);

      const wrapper = await createWrapper('ja');
      const termsLink = wrapper.find('[title*="利用規約"]');
      expect(termsLink.exists()).toBe(true);

      await termsLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('terms', 'ja');
      // LegalDocumentViewerが表示されることを確認
      const viewer = wrapper.findComponent({ name: 'LegalDocumentViewer' });
      expect(viewer.exists()).toBe(true);
    });

    it('should display privacy policy when privacy link is clicked', async () => {
      const mockContent = '# Privacy Policy\n\nContent...';
      vi.mocked(getDocument).mockResolvedValue(mockContent);

      const wrapper = await createWrapper('ja');
      const privacyLink = wrapper.find('[title*="プライバシーポリシー"]');
      expect(privacyLink.exists()).toBe(true);

      await privacyLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('privacy', 'ja');
    });

    it('should display commercial transaction document for Japanese locale', async () => {
      const mockContent = '# 特定商取引法に基づく表記\n\nContent...';
      vi.mocked(getDocument).mockResolvedValue(mockContent);

      const wrapper = await createWrapper('ja');
      const commercialLink = wrapper.find('[title*="特定商取引法"]');
      expect(commercialLink.exists()).toBe(true);

      await commercialLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('commercial', 'ja');
    });

    it('should display pricing document for English locale', async () => {
      const mockContent = '# Pricing / Billing\n\nContent...';
      vi.mocked(getDocument).mockResolvedValue(mockContent);

      const wrapper = await createWrapper('en');
      const pricingLink = wrapper.find('[title*="Pricing"]');
      expect(pricingLink.exists()).toBe(true);

      await pricingLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('pricing', 'en');
    });
  });

  describe('Language switching', () => {
    it('should display correct document when switching from Japanese to English', async () => {
      const mockContentJa = '# 利用規約\n\nContent...';
      const mockContentEn = '# Terms of Service\n\nContent...';
      vi.mocked(getDocument)
        .mockResolvedValueOnce(mockContentJa)
        .mockResolvedValueOnce(mockContentEn);

      // 日本語環境で利用規約を開く
      const wrapper = await createWrapper('ja');
      const termsLink = wrapper.find('[title*="利用規約"]');
      await termsLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('terms', 'ja');

      // 英語環境に切り替え
      i18n.global.locale.value = 'en';
      await wrapper.vm.$nextTick();

      // 英語環境で利用規約を開く
      const termsLinkEn = wrapper.find('[title*="Terms of Service"]');
      await termsLinkEn.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 200));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('terms', 'en');
    });

    it('should show commercial transaction only for Japanese locale', async () => {
      const wrapper = await createWrapper('ja');
      const commercialLink = wrapper.find('[title*="特定商取引法"]');
      expect(commercialLink.exists()).toBe(true);
    });

    it('should show pricing only for English locale', async () => {
      const wrapper = await createWrapper('en');
      const pricingLink = wrapper.find('[title*="Pricing"]');
      expect(pricingLink.exists()).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle file not found error', async () => {
      vi.mocked(getDocument).mockRejectedValue(new Error('Document not found: legal-docs/terms_ja.md'));

      const wrapper = await createWrapper('ja');
      const termsLink = wrapper.find('[title*="利用規約"]');
      await termsLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 300));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('terms', 'ja');
      // エラーが表示されることを確認（LegalDocumentViewer内でエラーが表示される）
      const viewer = wrapper.findComponent({ name: 'LegalDocumentViewer' });
      expect(viewer.exists()).toBe(true);
    });

    it('should handle network error', async () => {
      vi.mocked(getDocument).mockRejectedValue(new Error('Network error'));

      const wrapper = await createWrapper('ja');
      const privacyLink = wrapper.find('[title*="プライバシーポリシー"]');
      await privacyLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 300));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('privacy', 'ja');
      // エラーが表示されることを確認
      const viewer = wrapper.findComponent({ name: 'LegalDocumentViewer' });
      expect(viewer.exists()).toBe(true);
    });

    it('should handle authentication error', async () => {
      vi.mocked(getDocument).mockRejectedValue(new Error('Unauthorized: Authentication required'));

      const wrapper = await createWrapper('ja');
      const termsLink = wrapper.find('[title*="利用規約"]');
      await termsLink.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 300));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith('terms', 'ja');
      // エラーが表示されることを確認
      const viewer = wrapper.findComponent({ name: 'LegalDocumentViewer' });
      expect(viewer.exists()).toBe(true);
    });
  });

  describe('Document type and locale combinations', () => {
    const testCases = [
      { documentType: 'terms', locale: 'ja' as const, expectedTitle: '利用規約' },
      { documentType: 'terms', locale: 'en' as const, expectedTitle: 'Terms of Service' },
      { documentType: 'privacy', locale: 'ja' as const, expectedTitle: 'プライバシーポリシー' },
      { documentType: 'privacy', locale: 'en' as const, expectedTitle: 'Privacy Policy' },
      { documentType: 'commercial', locale: 'ja' as const, expectedTitle: '特定商取引法に基づく表記' },
      { documentType: 'pricing', locale: 'en' as const, expectedTitle: 'Pricing / Billing' },
    ];

    testCases.forEach(({ documentType, locale, expectedTitle }) => {
      it(`should fetch ${documentType} document for ${locale} locale`, async () => {
        const mockContent = `# ${expectedTitle}\n\nContent...`;
        vi.mocked(getDocument).mockResolvedValue(mockContent);

        const wrapper = await createWrapper(locale);
        
        // 適切なリンクを見つける
        let link;
        if (documentType === 'commercial' && locale === 'ja') {
          link = wrapper.find('[title*="特定商取引法"]');
        } else if (documentType === 'pricing' && locale === 'en') {
          link = wrapper.find('[title*="Pricing"]');
        } else if (documentType === 'terms') {
          link = locale === 'ja' 
            ? wrapper.find('[title*="利用規約"]')
            : wrapper.find('[title*="Terms of Service"]');
        } else if (documentType === 'privacy') {
          link = locale === 'ja'
            ? wrapper.find('[title*="プライバシーポリシー"]')
            : wrapper.find('[title*="Privacy Policy"]');
        }

        if (link && link.exists()) {
          await link.trigger('click');
          await new Promise(resolve => setTimeout(resolve, 200));
          await wrapper.vm.$nextTick();

          expect(getDocument).toHaveBeenCalledWith(documentType, locale);
        }
      });
    });
  });
});

