/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import SettingsView from '../SettingsView.vue';
import LegalDocumentViewer from '@/components/LegalDocumentViewer.vue';

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
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

// LegalDocumentViewerのモック
vi.mock('@/components/LegalDocumentViewer.vue', () => ({
  default: {
    name: 'LegalDocumentViewer',
    template: '<div class="legal-document-viewer">Legal Document Viewer</div>',
    props: ['documentType', 'locale', 'modelValue'],
    emits: ['update:modelValue'],
  },
}));

describe('SettingsView', () => {
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
    return wrapper;
  };

  it('should display legal document links', async () => {
    const wrapper = await createWrapper();
    expect(wrapper.text()).toContain('プライバシーポリシー');
    expect(wrapper.text()).toContain('利用規約');
  });

  it('should open LegalDocumentViewer when privacy policy link is clicked', async () => {
    const wrapper = await createWrapper();
    const privacyLink = wrapper.find('[title*="プライバシーポリシー"]');
    expect(privacyLink.exists()).toBe(true);

    await privacyLink.trigger('click');
    await wrapper.vm.$nextTick();

    const viewer = wrapper.findComponent(LegalDocumentViewer);
    expect(viewer.exists()).toBe(true);
    expect(viewer.props('documentType')).toBe('privacy');
    expect(viewer.props('locale')).toBe('ja');
  });

  it('should open LegalDocumentViewer when terms of service link is clicked', async () => {
    const wrapper = await createWrapper();
    const termsLink = wrapper.find('[title*="利用規約"]');
    expect(termsLink.exists()).toBe(true);

    await termsLink.trigger('click');
    await wrapper.vm.$nextTick();

    const viewer = wrapper.findComponent(LegalDocumentViewer);
    expect(viewer.exists()).toBe(true);
    expect(viewer.props('documentType')).toBe('terms');
    expect(viewer.props('locale')).toBe('ja');
  });

  it('should open LegalDocumentViewer with commercial document for Japanese locale', async () => {
    const wrapper = await createWrapper('ja');
    const commercialLink = wrapper.find('[title*="特定商取引法"]');
    expect(commercialLink.exists()).toBe(true);

    await commercialLink.trigger('click');
    await wrapper.vm.$nextTick();

    const viewer = wrapper.findComponent(LegalDocumentViewer);
    expect(viewer.exists()).toBe(true);
    expect(viewer.props('documentType')).toBe('commercial');
    expect(viewer.props('locale')).toBe('ja');
  });

  it('should open LegalDocumentViewer with pricing document for English locale', async () => {
    const wrapper = await createWrapper('en');
    const pricingLink = wrapper.find('[title*="Pricing"]');
    expect(pricingLink.exists()).toBe(true);

    await pricingLink.trigger('click');
    await wrapper.vm.$nextTick();

    const viewer = wrapper.findComponent(LegalDocumentViewer);
    expect(viewer.exists()).toBe(true);
    expect(viewer.props('documentType')).toBe('pricing');
    expect(viewer.props('locale')).toBe('en');
  });

  it('should not call window.open when legal document link is clicked', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = await createWrapper();
    const privacyLink = wrapper.find('[title*="プライバシーポリシー"]');

    await privacyLink.trigger('click');
    await wrapper.vm.$nextTick();

    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it('should close LegalDocumentViewer when modelValue is set to false', async () => {
    const wrapper = await createWrapper();
    const privacyLink = wrapper.find('[title*="プライバシーポリシー"]');

    await privacyLink.trigger('click');
    await wrapper.vm.$nextTick();

    let viewer = wrapper.findComponent(LegalDocumentViewer);
    expect(viewer.exists()).toBe(true);
    expect(viewer.props('modelValue')).toBe(true);

    // ダイアログを閉じる
    viewer.vm.$emit('update:modelValue', false);
    await wrapper.vm.$nextTick();

    viewer = wrapper.findComponent(LegalDocumentViewer);
    if (viewer.exists()) {
      expect(viewer.props('modelValue')).toBe(false);
    }
  });
});

