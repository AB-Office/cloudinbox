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
import { useAccountStore } from '@/stores/account';
import { mailService } from '@/services/mail';
import type {
  SendMailResponse,
  MailMessage,
  DecryptedMailBody,
  AttachmentListItem,
} from '@/types/mail';

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

describe('返信・転送フロー統合テスト', () => {
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

  const createWrapper = async (mode?: string, messageId?: string) => {
    const query: Record<string, string> = {};
    if (mode) query.mode = mode;
    if (messageId) query.messageId = messageId;

    await router.push({ path: '/compose', query });
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
    // onMountedの非同期処理（initializeCompose含む）を待つ
    await new Promise(resolve => setTimeout(resolve, 300));
    await wrapper.vm.$nextTick();
    return wrapper;
  };

  describe('返信フロー', () => {
    it('元のメール取得からメール送信までをテストする', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: false,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      // モック設定
      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);
      const mockSendMailResponse: SendMailResponse = {
        success: true,
        messageId: 'reply-message-id',
      };
      vi.mocked(mailService.sendMail).mockResolvedValue(mockSendMailResponse);

      const wrapper = await createWrapper('reply', 'msg1');
      const vm = wrapper.vm as any;

      // フォームが正しく初期化されていることを確認
      expect(vm.to).toBe('sender@example.com');
      expect(vm.subject).toContain('Re:');
      expect(vm.subject).toContain('Original Subject');

      // threadIdとmessageIdが保存されていることを確認
      expect(vm.originalThreadId).toBe('thread1');
      expect(vm.originalMessageId).toBe('msg1');

      // 本文を追加して送信
      vm.body = 'Reply body text';
      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        await new Promise(resolve => setTimeout(resolve, 200));
        await wrapper.vm.$nextTick();

        // mailService.sendMailが正しいパラメータで呼ばれたことを確認
        expect(mailService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'account1',
            to: ['sender@example.com'],
            subject: expect.stringContaining('Re:'),
            body: 'Reply body text',
            threadId: 'thread1',
            inReplyToMessageId: 'msg1',
          })
        );

        // 送信成功が確認される
        expect(mockShowSuccess).toHaveBeenCalled();
      }
    });

    it('返信時にmailService.fetchMessageが呼ばれる', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: false,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);

      await createWrapper('reply', 'msg1');

      // mailService.fetchMessageが正しいmessageIdで呼ばれたことを確認
      expect(mailService.fetchMessage).toHaveBeenCalledWith('msg1');
    });
  });

  describe('全員に返信フロー', () => {
    it('元のメール取得からメール送信までをテストする', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        cc: ['cc1@example.com', 'cc2@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: false,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      // モック設定
      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);
      const mockSendMailResponse: SendMailResponse = {
        success: true,
        messageId: 'reply-all-message-id',
      };
      vi.mocked(mailService.sendMail).mockResolvedValue(mockSendMailResponse);

      const wrapper = await createWrapper('replyAll', 'msg1');
      const vm = wrapper.vm as any;

      // フォームが正しく初期化されていることを確認
      expect(vm.to).toContain('sender@example.com');
      expect(vm.to).toContain('cc1@example.com');
      expect(vm.to).toContain('cc2@example.com');
      expect(vm.cc).toContain('cc1@example.com');
      expect(vm.cc).toContain('cc2@example.com');
      expect(vm.subject).toContain('Re:');
      expect(vm.showCcBcc).toBe(true);

      // 本文を追加して送信
      vm.body = 'Reply all body text';
      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        await new Promise(resolve => setTimeout(resolve, 200));
        await wrapper.vm.$nextTick();

        // mailService.sendMailが正しいパラメータで呼ばれたことを確認
        expect(mailService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'account1',
            to: expect.arrayContaining([
              'sender@example.com',
              'cc1@example.com',
              'cc2@example.com',
            ]),
            cc: expect.arrayContaining(['cc1@example.com', 'cc2@example.com']),
            subject: expect.stringContaining('Re:'),
            body: 'Reply all body text',
            threadId: 'thread1',
            inReplyToMessageId: 'msg1',
          })
        );
      }
    });
  });

  describe('転送フロー', () => {
    it('元のメール取得、添付ファイル取得、メール送信までをテストする', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: true,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      const decryptedBody: DecryptedMailBody = {
        bodyText: 'Original body text',
      };

      const attachmentList: AttachmentListItem[] = [
        { filename: 'test.pdf', size: 1024, contentType: 'application/pdf' },
        { filename: 'test.jpg', size: 2048, contentType: 'image/jpeg' },
      ];

      const downloadedAttachment1 = {
        content: 'base64content1',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
      };

      const downloadedAttachment2 = {
        content: 'base64content2',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        size: 2048,
      };

      // モック設定
      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);
      vi.mocked(mailService.decryptMailBody).mockResolvedValue(decryptedBody);
      vi.mocked(mailService.getAttachmentsList).mockResolvedValue(attachmentList);
      vi.mocked(mailService.downloadAttachment)
        .mockResolvedValueOnce(downloadedAttachment1)
        .mockResolvedValueOnce(downloadedAttachment2);

      const mockSendMailResponse: SendMailResponse = {
        success: true,
        messageId: 'forward-message-id',
      };
      vi.mocked(mailService.sendMail).mockResolvedValue(mockSendMailResponse);

      const wrapper = await createWrapper('forward', 'msg1');
      const vm = wrapper.vm as any;

      // フォームが正しく初期化されていることを確認
      expect(vm.subject).toContain('Fw:');
      expect(vm.subject).toContain('Original Subject');
      expect(vm.body).toContain('Original body text');
      // モバイルアプリ版と同じ引用形式を確認 (YYYY/MM/DD HH:MM <email@example.com>)
      expect(vm.body).toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} <sender@example\.com>/);
      expect(vm.body).toContain('> Original body text');

      // 添付ファイルが正しく追加されていることを確認
      expect(vm.attachments.length).toBe(2);
      expect(vm.attachments[0].filename).toBe('test.pdf');
      expect(vm.attachments[1].filename).toBe('test.jpg');

      // 宛先を追加
      vm.to = 'forward-to@example.com';
      await wrapper.vm.$nextTick();

      // 送信ボタンをクリック
      const sendButton = wrapper.find('button[color="primary"]');
      if (sendButton.exists()) {
        await sendButton.trigger('click');
        await wrapper.vm.$nextTick();
        // 添付ファイルのBase64エンコードを待つ
        await new Promise(resolve => setTimeout(resolve, 200));
        await wrapper.vm.$nextTick();

        // mailService.sendMailが正しいパラメータで呼ばれたことを確認
        expect(mailService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'account1',
            to: ['forward-to@example.com'],
            subject: expect.stringContaining('Fw:'),
            body: expect.stringContaining('Original body text'),
            attachments: expect.arrayContaining([
              expect.objectContaining({
                filename: 'test.pdf',
                contentType: 'application/pdf',
              }),
              expect.objectContaining({
                filename: 'test.jpg',
                contentType: 'image/jpeg',
              }),
            ]),
            threadId: 'thread1',
            inReplyToMessageId: 'msg1',
          })
        );
      }
    });

    it('downloadAttachment Cloud Functionの呼び出しをモックする', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: true,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      const decryptedBody: DecryptedMailBody = {
        bodyText: 'Original body text',
      };

      const attachmentList: AttachmentListItem[] = [
        { filename: 'test.pdf', size: 1024, contentType: 'application/pdf' },
      ];

      const downloadedAttachment = {
        content: 'base64content',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
      };

      // モック設定
      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);
      vi.mocked(mailService.decryptMailBody).mockResolvedValue(decryptedBody);
      vi.mocked(mailService.getAttachmentsList).mockResolvedValue(attachmentList);
      vi.mocked(mailService.downloadAttachment).mockResolvedValue(downloadedAttachment);

      await createWrapper('forward', 'msg1');

      // downloadAttachmentが正しいパラメータで呼ばれたことを確認
      expect(mailService.downloadAttachment).toHaveBeenCalledWith('msg1', 'test.pdf');
    });

    it('転送時にgetAttachmentsListが呼ばれる', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: true,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      const decryptedBody: DecryptedMailBody = {
        bodyText: 'Original body text',
      };

      const attachmentList: AttachmentListItem[] = [
        { filename: 'test.pdf', size: 1024, contentType: 'application/pdf' },
      ];

      // モック設定
      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);
      vi.mocked(mailService.decryptMailBody).mockResolvedValue(decryptedBody);
      vi.mocked(mailService.getAttachmentsList).mockResolvedValue(attachmentList);
      vi.mocked(mailService.downloadAttachment).mockResolvedValue({
        content: 'base64content',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
      });

      await createWrapper('forward', 'msg1');

      // getAttachmentsListが正しいmessageIdで呼ばれたことを確認
      expect(mailService.getAttachmentsList).toHaveBeenCalledWith('msg1');
    });

    it('転送時にdecryptMailBodyが呼ばれる', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: false,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      const decryptedBody: DecryptedMailBody = {
        bodyText: 'Original body text',
      };

      // モック設定
      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);
      vi.mocked(mailService.decryptMailBody).mockResolvedValue(decryptedBody);

      await createWrapper('forward', 'msg1');

      // decryptMailBodyが正しいmessageIdで呼ばれたことを確認
      expect(mailService.decryptMailBody).toHaveBeenCalledWith('msg1');
    });

    it('転送時に添付ファイルがない場合は添付ファイル取得処理がスキップされる', async () => {
      const originalMessage: MailMessage = {
        messageId: 'msg1',
        threadId: 'thread1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Original Subject',
        sentAt: new Date() as any,
        receivedAt: new Date() as any,
        bodyPreview: 'Preview',
        hasLargeBody: false,
        hasAttachments: false,
        isRead: false,
        labels: ['inbox'],
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      const decryptedBody: DecryptedMailBody = {
        bodyText: 'Original body text',
      };

      // モック設定
      vi.mocked(mailService.fetchMessage).mockResolvedValue(originalMessage);
      vi.mocked(mailService.decryptMailBody).mockResolvedValue(decryptedBody);

      const wrapper = await createWrapper('forward', 'msg1');
      const vm = wrapper.vm as any;

      // 添付ファイルが追加されていないことを確認
      expect(vm.attachments.length).toBe(0);

      // getAttachmentsListとdownloadAttachmentが呼ばれていないことを確認
      expect(mailService.getAttachmentsList).not.toHaveBeenCalled();
      expect(mailService.downloadAttachment).not.toHaveBeenCalled();
    });
  });
});
