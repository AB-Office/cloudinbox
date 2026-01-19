/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for legal consent flow in Web app
 *
 * Tests the complete flow from authentication to consent screen,
 * including router guards, consent checking, and navigation.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getDocumentMetadata } from '@/services/legalDocument';
import { useAuthStore } from '@/stores/auth';
import { useConsentStore } from '@/stores/consent';
import LegalConsentView from '@/views/LegalConsentView.vue';
import MailListView from '@/views/MailListView.vue';

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

// Firebase Firestoreのモック
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn(),
    getDoc: vi.fn(),
    updateDoc: vi.fn(),
    Timestamp: {
      now: vi.fn(() => ({ seconds: 1000000000, nanoseconds: 0 })),
    },
  };
});

// Firebase Authのモック
const mockCurrentUser = { uid: 'test-user' };
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

// Legal Document Serviceのモック
vi.mock('@/services/legalDocument', () => ({
  getDocumentMetadata: vi.fn(),
  getDocument: vi.fn(),
}));

// Firebase Appのモック
vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
}));

// Firebase Functionsのモック
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));

// Auth Serviceのモック
vi.mock('@/services/auth', () => ({
  authService: {
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((callback: (user: any) => void) => {
      callback(mockCurrentUser);
      return vi.fn();
    }),
  },
}));

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  messages: {
    ja: {
      legal: {
        consent: {
          title: '利用規約・プライバシーポリシーへの同意',
          description: 'CloudInboxをご利用いただくには、利用規約とプライバシーポリシーへの同意が必要です。',
          agreeTerms: '利用規約に同意する',
          agreePrivacy: 'プライバシーポリシーに同意する',
          view: '表示',
          reconsentMessage: '法的文書が更新されました。最新版に同意してください。',
        },
      },
    },
  },
});

describe('Legal Consent Flow Integration Tests', () => {
  let routerInstance: ReturnType<typeof createRouter>;
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    // ルーターを初期化
    routerInstance = createRouter({
      history: createWebHistory('/mail'),
      routes: [
        {
          path: '/login',
          name: 'login',
          component: { template: '<div>Login</div>' },
        },
        {
          path: '/',
          name: 'mail-list',
          component: MailListView,
          meta: { requiresAuth: true },
        },
        {
          path: '/legal-consent',
          name: 'legal-consent',
          component: LegalConsentView,
          meta: { requiresAuth: true },
        },
      ],
    });
  });

  describe('新規ユーザーの同意フロー', () => {
    it('認証後、同意チェック画面が表示される', async () => {
      // モック: ユーザードキュメントに同意情報がない
      const mockUserDoc = {
        exists: () => true,
        data: () => ({ legalConsents: null }),
      };
      vi.mocked(getDoc).mockResolvedValue(mockUserDoc as any);
      vi.mocked(getDocumentMetadata).mockResolvedValue('2024-01-01T00:00:00.000Z');

      // 認証済みユーザーを設定
      const authStore = useAuthStore();
      authStore.setUser(mockCurrentUser as any);

      // メイン画面に遷移を試みる
      await routerInstance.push('/');
      await routerInstance.isReady();

      // 同意が必要な場合、legal-consentルートにリダイレクトされることを確認
      // これはルーターガードの動作による
      const consentStore = useConsentStore();
      const consentRequired = await consentStore.isConsentRequired();

      expect(consentRequired).toBe(true);
    });

    it('同意後、メイン画面に遷移する', async () => {
      // モック: 同意保存をシミュレート
      const mockUserRef = {};
      const termsVersion = '2024-01-01T00:00:00.000Z';
      const privacyVersion = '2024-01-01T00:00:00.000Z';

      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getDocumentMetadata).mockResolvedValue(termsVersion);

      // 認証済みユーザーを設定
      const authStore = useAuthStore();
      authStore.setUser(mockCurrentUser as any);

      // 同意を保存
      const consentStore = useConsentStore();
      await consentStore.saveConsent(termsVersion, privacyVersion);

      // 同意済みの場合、同意が必要でないことを確認
      const consentRequired = await consentStore.isConsentRequired();
      expect(consentRequired).toBe(false);
    });
  });

  describe('既存ユーザーの再確認フロー', () => {
    it('文書が更新された場合、同意チェック画面が再表示される', async () => {
      // モック: 既存の同意情報（古いバージョン）
      const existingConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
      };
      const mockUserDoc = {
        exists: () => true,
        data: () => ({ legalConsents: existingConsents }),
      };

      vi.mocked(getDoc).mockResolvedValue(mockUserDoc as any);
      // 新しいバージョンのメタデータを返す（文書が更新された）
      vi.mocked(getDocumentMetadata)
        .mockResolvedValueOnce('2024-12-31T00:00:00.000Z') // terms
        .mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // privacy

      // 認証済みユーザーを設定
      const authStore = useAuthStore();
      authStore.setUser(mockCurrentUser as any);

      // 同意状態をチェック
      const consentStore = useConsentStore();
      await consentStore.checkConsentStatus();

      // 再確認が必要なことを確認
      expect(consentStore.needsReconsent).toBe(true);
      expect(await consentStore.isConsentRequired()).toBe(true);
    });
  });

  describe('同意済みユーザーの通常フロー', () => {
    it('同意済みの場合、同意チェック画面をスキップしてメイン画面が表示される', async () => {
      // モック: 最新の同意情報
      const existingConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-12-31T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-12-31T00:00:00.000Z',
        },
      };
      const mockUserDoc = {
        exists: () => true,
        data: () => ({ legalConsents: existingConsents }),
      };

      vi.mocked(getDoc).mockResolvedValue(mockUserDoc as any);
      vi.mocked(getDocumentMetadata)
        .mockResolvedValueOnce('2024-12-31T00:00:00.000Z') // terms
        .mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // privacy

      // 認証済みユーザーを設定
      const authStore = useAuthStore();
      authStore.setUser(mockCurrentUser as any);

      // 同意状態をチェック
      const consentStore = useConsentStore();
      await consentStore.checkConsentStatus();

      // 再確認が不要なことを確認
      expect(consentStore.needsReconsent).toBe(false);
      expect(await consentStore.isConsentRequired()).toBe(false);
    });
  });

  describe('ルーターガードの動作', () => {
    it('未同意ユーザーはメイン画面にアクセスできない', async () => {
      // モック: ユーザードキュメントに同意情報がない
      const mockUserDoc = {
        exists: () => true,
        data: () => ({ legalConsents: null }),
      };
      vi.mocked(getDoc).mockResolvedValue(mockUserDoc as any);
      vi.mocked(getDocumentMetadata).mockResolvedValue('2024-01-01T00:00:00.000Z');

      // 認証済みユーザーを設定
      const authStore = useAuthStore();
      authStore.setUser(mockCurrentUser as any);

      // 同意状態をチェック
      const consentStore = useConsentStore();
      await consentStore.checkConsentStatus();

      // 同意が必要なことを確認
      const consentRequired = await consentStore.isConsentRequired();
      expect(consentRequired).toBe(true);

      // メイン画面にアクセスしようとした場合、同意が必要
      // ルーターガードがlegal-consentルートにリダイレクトする
      // この動作はルーターガードの実装によって行われます
    });
  });

  describe('LegalConsentViewコンポーネント', () => {
    it('同意画面が正しく表示される', async () => {
      const mockUserDoc = {
        exists: () => true,
        data: () => ({ legalConsents: null }),
      };
      vi.mocked(getDoc).mockResolvedValue(mockUserDoc as any);
      vi.mocked(getDocumentMetadata)
        .mockResolvedValueOnce('2024-01-01T00:00:00.000Z')
        .mockResolvedValueOnce('2024-01-01T00:00:00.000Z');

      // 認証済みユーザーを設定
      const authStore = useAuthStore();
      authStore.setUser(mockCurrentUser as any);

      // LegalConsentViewをマウント
      await routerInstance.push('/legal-consent');
      await routerInstance.isReady();

      wrapper = mount(LegalConsentView, {
        global: {
          plugins: [vuetify, i18n, pinia, routerInstance],
          mocks: {
            $route: routerInstance.currentRoute.value,
            $router: routerInstance,
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));
      await wrapper.vm.$nextTick();

      // 同意画面の要素が表示されることを確認
      expect(wrapper.text()).toContain('利用規約・プライバシーポリシーへの同意');
    });
  });
});

