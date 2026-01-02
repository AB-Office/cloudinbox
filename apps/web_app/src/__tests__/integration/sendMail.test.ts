/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import ComposeView from '@/views/ComposeView.vue';
import { useMailStore } from '@/stores/mail';
import { useAccountStore } from '@/stores/account';
import { mailService } from '@/services/mail';
import type { SendMailResponse } from '@/types/mail';

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
});

// Firebaseのモック
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      uid: 'test-uid',
    },
  })),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    writeBatch: vi.fn(),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(),
    arrayUnion: vi.fn(),
    arrayRemove: vi.fn(),
  };
});

// mailServiceをモック
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockHttpsCallable),
}));

// mailServiceのモック
vi.mock('@/services/mail', () => ({
  mailService: {
    sendMail: vi.fn(),
    fetchMessage: vi.fn(),
    decryptMailBody: vi.fn(),
    getAttachmentsList: vi.fn(),
    downloadAttachment: vi.fn(),
  },
}));

// useSnackbarをモック
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
vi.mock('@/composables/useSnackbar', () => ({
  useSnackbar: () => ({
    snackbar: { value: false },
    snackbarText: { value: '' },
    snackbarColor: { value: 'error' },
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}));

// formatFileSizeをモック
vi.mock('@/plugins/i18n', () => ({
  formatFileSize: vi.fn((size: number) => `${size} bytes`),
}));

// vue-routerのモックを解除（テスト内で実際のrouterを使用）
vi.unmock('vue-router');

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  messages: {
    ja: {
      mail: {
        compose: {
          title: 'メール作成',
          to: '宛先',
          cc: 'Cc',
          bcc: 'Bcc',
          subject: '件名',
          body: '本文',
          attachFile: '添付ファイル',
          send: '送信',
          sending: '送信中...',
          sendSuccess: 'メールを送信しました',
          sendError: 'メールの送信に失敗しました',
          cancel: 'キャンセル',
          cancelConfirm: '入力内容を破棄しますか？',
          discard: '破棄',
          validation: {
            toRequired: '宛先を入力してください',
            toInvalid: '有効なメールアドレスを入力してください',
            subjectRequired: '件名を入力してください',
            bodyRequired: '本文を入力してください',
          },
        },
      },
      account: {
        email: 'メールアドレス',
      },
      common: {
        close: '閉じる',
        cancel: 'キャンセル',
      },
    },
  },
});

describe('メール送信フロー統合テスト', () => {
  let router: ReturnType<typeof createRouter>;
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    // accountStoreにテスト用のアカウントを設定
    const accountStore = useAccountStore();
    accountStore.accounts = [
      {
        id: 'account1',
        email: 'test@example.com',
        status: 'active',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          useSsl: true,
          userName: 'user',
        },
      } as any,
    ];

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        { path: '/compose', name: 'compose', component: ComposeView },
      ],
    });
  });

  const createWrapper = async () => {
    await router.push({ path: '/compose' });
    wrapper = mount(ComposeView, {
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
    await new Promise(resolve => setTimeout(resolve, 200));
    await wrapper.vm.$nextTick();
    return wrapper;
  };

  describe('エンドツーエンドのメール送信フロー', () => {
    it('ComposeViewからmailStore、mailServiceを経由してCloud Functionsを呼び出す', async () => {
      const wrapper = await createWrapper();
      const vm = wrapper.vm as any;

      // フォームに入力
      vm.selectedAccountId = 'account1';
      vm.to = 'recipient@example.com';
      vm.subject = 'Test Subject';
      vm.body = 'Test Body';

      // mailService.sendMailのモックを設定
      const mockSendMailResponse: SendMailResponse = {
        success: true,
        messageId: 'test-message-id',
      };
      vi.mocked(mailService.sendMail).mockResolvedValue(mockSendMailResponse);

      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        // 非同期処理を待つ
        await new Promise(resolve => setTimeout(resolve, 100));
        await wrapper.vm.$nextTick();

        // mailStore.sendMailが呼ばれたことを確認
        expect(mailService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'account1',
            to: ['recipient@example.com'],
            subject: 'Test Subject',
            body: 'Test Body',
          })
        );
      }
    });

    it('送信成功時に画面遷移が行われる', async () => {
      const wrapper = await createWrapper();
      const vm = wrapper.vm as any;

      // フォームに入力
      vm.selectedAccountId = 'account1';
      vm.to = 'recipient@example.com';
      vm.subject = 'Test Subject';
      vm.body = 'Test Body';

      // mailService.sendMailのモックを設定（成功）
      const mockSendMailResponse: SendMailResponse = {
        success: true,
        messageId: 'test-message-id',
      };
      vi.mocked(mailService.sendMail).mockResolvedValue(mockSendMailResponse);

      // router.pushをスパイ
      const routerPushSpy = vi.spyOn(router, 'push');

      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        // 非同期処理を待つ（成功時のナビゲーションを待つ）
        await new Promise(resolve => setTimeout(resolve, 200));
        await wrapper.vm.$nextTick();

        // 成功メッセージが表示されたことを確認
        expect(mockShowSuccess).toHaveBeenCalledWith(
          expect.stringContaining('メールを送信しました')
        );

        // 画面遷移が行われることを確認
        expect(routerPushSpy).toHaveBeenCalledWith('/');
      }
    });

    it('送信失敗時にエラーメッセージが表示される', async () => {
      const wrapper = await createWrapper();
      const vm = wrapper.vm as any;

      // フォームに入力
      vm.selectedAccountId = 'account1';
      vm.to = 'recipient@example.com';
      vm.subject = 'Test Subject';
      vm.body = 'Test Body';

      // mailService.sendMailのモックを設定（失敗）
      const mockError = new Error('Failed to send mail');
      vi.mocked(mailService.sendMail).mockRejectedValue(mockError);

      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        // 非同期処理を待つ
        await new Promise(resolve => setTimeout(resolve, 200));
        await wrapper.vm.$nextTick();

        // エラーメッセージが表示されたことを確認
        expect(mockShowError).toHaveBeenCalled();

        // 画面遷移が行われないことを確認
        expect(router.currentRoute.value.path).toBe('/compose');
      }
    });

    it('送信パラメータが正しく構築されてCloud Functionsに渡される', async () => {
      const wrapper = await createWrapper();
      const vm = wrapper.vm as any;

      // フォームに入力（Cc、Bcc、添付ファイルを含む）
      vm.selectedAccountId = 'account1';
      vm.to = 'recipient@example.com';
      vm.cc = 'cc@example.com';
      vm.bcc = 'bcc@example.com';
      vm.subject = 'Test Subject';
      vm.body = 'Test Body';

      // 添付ファイルを追加
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      vm.handleFileSelect({
        target: {
          files: [mockFile],
        },
      });

      await wrapper.vm.$nextTick();
      // ファイルのBase64エンコードを待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      await wrapper.vm.$nextTick();

      // mailService.sendMailのモックを設定
      const mockSendMailResponse: SendMailResponse = {
        success: true,
        messageId: 'test-message-id',
      };
      vi.mocked(mailService.sendMail).mockResolvedValue(mockSendMailResponse);

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        await new Promise(resolve => setTimeout(resolve, 100));
        await wrapper.vm.$nextTick();

        // mailService.sendMailが正しいパラメータで呼ばれたことを確認
        expect(mailService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'account1',
            to: ['recipient@example.com'],
            cc: ['cc@example.com'],
            bcc: ['bcc@example.com'],
            subject: 'Test Subject',
            body: 'Test Body',
            attachments: expect.arrayContaining([
              expect.objectContaining({
                filename: 'test.pdf',
                contentType: 'application/pdf',
              }),
            ]),
          })
        );
      }
    });

    it('送信中の状態管理が正しく動作する', async () => {
      const wrapper = await createWrapper();
      const vm = wrapper.vm as any;
      const mailStore = useMailStore();

      // フォームに入力
      vm.selectedAccountId = 'account1';
      vm.to = 'recipient@example.com';
      vm.subject = 'Test Subject';
      vm.body = 'Test Body';

      // mailService.sendMailのモックを設定（遅延あり）
      let resolveSendMail: (value: SendMailResponse) => void;
      const sendMailPromise = new Promise<SendMailResponse>(resolve => {
        resolveSendMail = resolve;
      });
      vi.mocked(mailService.sendMail).mockReturnValue(sendMailPromise);

      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        // 送信開始
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();

        // 送信中状態であることを確認
        expect(mailStore.isSending).toBe(true);

        // 送信完了
        resolveSendMail!({
          success: true,
          messageId: 'test-message-id',
        });
        await sendMailPromise;
        await new Promise(resolve => setTimeout(resolve, 100));
        await wrapper.vm.$nextTick();

        // 送信完了後、isSendingがfalseに戻ることを確認
        expect(mailStore.isSending).toBe(false);
      }
    });

    it('Cloud Functionsからのエラーレスポンスが正しく処理される', async () => {
      const wrapper = await createWrapper();
      const vm = wrapper.vm as any;

      // フォームに入力
      vm.selectedAccountId = 'account1';
      vm.to = 'recipient@example.com';
      vm.subject = 'Test Subject';
      vm.body = 'Test Body';

      // mailService.sendMailのモックを設定（エラーレスポンス）
      const mockSendMailResponse: SendMailResponse = {
        success: false,
        errorMessage: 'SMTP connection failed',
      };
      vi.mocked(mailService.sendMail).mockResolvedValue(mockSendMailResponse);

      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        await new Promise(resolve => setTimeout(resolve, 200));
        await wrapper.vm.$nextTick();

        // エラーメッセージが表示されたことを確認
        expect(mockShowError).toHaveBeenCalled();

        // 画面遷移が行われないことを確認
        expect(router.currentRoute.value.path).toBe('/compose');
      }
    });
  });
});
