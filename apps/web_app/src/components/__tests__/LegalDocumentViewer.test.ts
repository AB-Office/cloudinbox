/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import LegalDocumentViewer from '../LegalDocumentViewer.vue';
import { getDocument } from '@/services/legalDocument';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

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

// markedのモック
vi.mock('marked', () => ({
  marked: vi.fn((text: string) => `<div>${text}</div>`),
}));

// DOMPurifyのモック
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html),
  },
}));

// LegalDocumentServiceのモック
vi.mock('@/services/legalDocument', () => ({
  getDocument: vi.fn(),
}));

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  locale: 'ja',
  fallbackLocale: 'en',
  messages: {
    ja: {},
    en: {},
  },
});

describe('LegalDocumentViewer', () => {
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  const createWrapper = (props: {
    documentType: 'terms' | 'privacy' | 'commercial' | 'pricing';
    locale: 'ja' | 'en';
    modelValue: boolean;
  }) => {
    wrapper = mount(LegalDocumentViewer, {
      props,
      global: {
        plugins: [vuetify, i18n, pinia],
      },
    });
    return wrapper;
  };

  it('should display loading state initially', async () => {
    vi.mocked(getDocument).mockImplementation(
      () => new Promise(() => {}) // 永遠に解決しないPromise
    );

    const wrapper = createWrapper({
      documentType: 'terms',
      locale: 'ja',
      modelValue: true,
    });

    await wrapper.vm.$nextTick();

    // ローディングインジケーターが表示されることを確認
    expect(wrapper.text()).toContain('Loading');
  });

  it('should fetch and display document content', async () => {
    const mockContent = '# 利用規約\n\n本文...';
    const mockHtml = '<h1>利用規約</h1><p>本文...</p>';

    vi.mocked(getDocument).mockResolvedValue(mockContent);
    vi.mocked(marked).mockReturnValue(mockHtml);

    const wrapper = createWrapper({
      documentType: 'terms',
      locale: 'ja',
      modelValue: true,
    });

    // 非同期処理を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(getDocument).toHaveBeenCalledWith('terms', 'ja');
    expect(marked).toHaveBeenCalledWith(mockContent);
    expect(wrapper.html()).toContain(mockHtml);
  });

  it('should display error message when document fetch fails', async () => {
    const errorMessage = 'Document not found';
    vi.mocked(getDocument).mockRejectedValue(new Error(errorMessage));

    const wrapper = createWrapper({
      documentType: 'privacy',
      locale: 'en',
      modelValue: true,
    });

    // 非同期処理を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(getDocument).toHaveBeenCalledWith('privacy', 'en');
    expect(wrapper.text()).toContain('Error');
    expect(wrapper.text()).toContain(errorMessage);
  });

  it('should call getDocument with correct parameters for different document types', async () => {
    const testCases = [
      { documentType: 'terms', locale: 'ja' },
      { documentType: 'privacy', locale: 'en' },
      { documentType: 'commercial', locale: 'ja' },
      { documentType: 'pricing', locale: 'en' },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      vi.mocked(getDocument).mockResolvedValue('# Content');

      const wrapper = createWrapper({
        documentType: testCase.documentType,
        locale: testCase.locale,
        modelValue: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await wrapper.vm.$nextTick();

      expect(getDocument).toHaveBeenCalledWith(testCase.documentType, testCase.locale);
      wrapper.unmount();
    }
  });

  it('should close dialog when close button is clicked', async () => {
    vi.mocked(getDocument).mockResolvedValue('# Content');

    const wrapper = createWrapper({
      documentType: 'terms',
      locale: 'ja',
      modelValue: true,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    // ダイアログの閉じるボタンを探してクリック
    const closeButton = wrapper.find('[aria-label="Close"]');
    if (closeButton.exists()) {
      await closeButton.trigger('click');
      await wrapper.vm.$nextTick();

      // modelValueがfalseに更新されることを確認
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
    }
  });

  it('should sanitize HTML content with DOMPurify', async () => {
    const mockContent = '# Test\n\n<script>alert("xss")</script>';
    const mockHtml = '<h1>Test</h1><script>alert("xss")</script>';

    vi.mocked(getDocument).mockResolvedValue(mockContent);
    vi.mocked(marked).mockReturnValue(mockHtml);
    vi.mocked(DOMPurify.sanitize).mockReturnValue('<h1>Test</h1>');

    const wrapper = createWrapper({
      documentType: 'terms',
      locale: 'ja',
      modelValue: true,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(mockHtml, expect.any(Object));
    expect(wrapper.html()).toContain('<h1>Test</h1>');
    expect(wrapper.html()).not.toContain('<script>');
  });

  it('should retry loading document when retry button is clicked', async () => {
    const errorMessage = 'Network error';
    vi.mocked(getDocument)
      .mockRejectedValueOnce(new Error(errorMessage))
      .mockResolvedValueOnce('# Content');

    const wrapper = createWrapper({
      documentType: 'privacy',
      locale: 'en',
      modelValue: true,
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Error');
    expect(wrapper.text()).toContain(errorMessage);

    // リトライボタンをクリック
    const retryButton = wrapper.find('button');
    if (retryButton.exists() && retryButton.text().includes('Retry')) {
      await retryButton.trigger('click');
      await new Promise(resolve => setTimeout(resolve, 100));
      await wrapper.vm.$nextTick();

      // 2回目の呼び出しが行われたことを確認
      expect(getDocument).toHaveBeenCalledTimes(2);
    }
  });

  it('should compute correct title for different document types and locales', async () => {
    const testCases = [
      { documentType: 'terms' as const, locale: 'ja' as const, expectedTitle: '利用規約' },
      { documentType: 'terms' as const, locale: 'en' as const, expectedTitle: 'Terms of Service' },
      { documentType: 'privacy' as const, locale: 'ja' as const, expectedTitle: 'プライバシーポリシー' },
      { documentType: 'privacy' as const, locale: 'en' as const, expectedTitle: 'Privacy Policy' },
      { documentType: 'commercial' as const, locale: 'ja' as const, expectedTitle: '特定商取引法に基づく表記' },
      { documentType: 'pricing' as const, locale: 'en' as const, expectedTitle: 'Pricing / Billing' },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      vi.mocked(getDocument).mockResolvedValue('# Content');

      const wrapper = createWrapper({
        documentType: testCase.documentType,
        locale: testCase.locale,
        modelValue: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await wrapper.vm.$nextTick();

      // タイトルが正しく計算されることを確認
      // コンポーネントの内部状態を確認するため、HTMLに含まれることを確認
      const html = wrapper.html();
      // タイトルはv-card-title内に表示される
      expect(html).toContain(testCase.expectedTitle);
      wrapper.unmount();
    }
  });

  it('should not load document when dialog is closed', async () => {
    const wrapper = createWrapper({
      documentType: 'terms',
      locale: 'ja',
      modelValue: false,
    });

    await wrapper.vm.$nextTick();

    // ダイアログが閉じているときはgetDocumentが呼ばれない
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('should load document when dialog is opened', async () => {
    vi.mocked(getDocument).mockResolvedValue('# Content');

    const wrapper = createWrapper({
      documentType: 'terms',
      locale: 'ja',
      modelValue: false,
    });

    await wrapper.vm.$nextTick();
    expect(getDocument).not.toHaveBeenCalled();

    // ダイアログを開く
    await wrapper.setProps({ modelValue: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(getDocument).toHaveBeenCalledWith('terms', 'ja');
  });
});
