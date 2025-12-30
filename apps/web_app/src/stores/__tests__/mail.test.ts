import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMailStore } from '../mail';
import * as mailService from '@/services/mail';

// mailServiceをモック
vi.mock('@/services/mail', () => ({
  mailService: {
    fetchThreads: vi.fn(),
    fetchMessage: vi.fn(),
    decryptMailBody: vi.fn(),
    getAttachmentsList: vi.fn(),
    markAsRead: vi.fn(),
    moveToTrash: vi.fn(),
    restoreFromTrash: vi.fn(),
    archive: vi.fn(),
    restoreToInbox: vi.fn(),
    sendMail: vi.fn(),
  },
  calculateItemsPerPage: vi.fn(() => 15),
}));

describe('mailStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('moveToTrash', () => {
    it('should call mailService.moveToTrash and update message', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const mockMessage = {
        messageId,
        threadId: 'test-thread-id',
        subject: 'Test',
      } as any;

      vi.mocked(mailService.mailService.moveToTrash).mockResolvedValue(undefined);
      vi.mocked(mailService.mailService.fetchMessage).mockResolvedValue(mockMessage);

      await store.moveToTrash(messageId);

      expect(mailService.mailService.moveToTrash).toHaveBeenCalledWith(messageId);
      expect(mailService.mailService.fetchMessage).toHaveBeenCalledWith(messageId);
      expect(store.currentMessage).toEqual(mockMessage);
    });

    it('should set error when moveToTrash fails', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const error = new Error('Failed to move to trash');

      vi.mocked(mailService.mailService.moveToTrash).mockRejectedValue(error);

      await expect(store.moveToTrash(messageId)).rejects.toThrow();
      expect(store.error).toBeTruthy();
    });
  });

  describe('restoreFromTrash', () => {
    it('should call mailService.restoreFromTrash and update message', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const mockMessage = {
        messageId,
        threadId: 'test-thread-id',
        subject: 'Test',
      } as any;

      vi.mocked(mailService.mailService.restoreFromTrash).mockResolvedValue(undefined);
      vi.mocked(mailService.mailService.fetchMessage).mockResolvedValue(mockMessage);

      await store.restoreFromTrash(messageId);

      expect(mailService.mailService.restoreFromTrash).toHaveBeenCalledWith(messageId);
      expect(mailService.mailService.fetchMessage).toHaveBeenCalledWith(messageId);
      expect(store.currentMessage).toEqual(mockMessage);
    });
  });

  describe('archive', () => {
    it('should call mailService.archive and update message', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const mockMessage = {
        messageId,
        threadId: 'test-thread-id',
        subject: 'Test',
      } as any;

      vi.mocked(mailService.mailService.archive).mockResolvedValue(undefined);
      vi.mocked(mailService.mailService.fetchMessage).mockResolvedValue(mockMessage);

      await store.archive(messageId);

      expect(mailService.mailService.archive).toHaveBeenCalledWith(messageId);
      expect(mailService.mailService.fetchMessage).toHaveBeenCalledWith(messageId);
      expect(store.currentMessage).toEqual(mockMessage);
    });
  });

  describe('restoreToInbox', () => {
    it('should call mailService.restoreToInbox and update message', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const mockMessage = {
        messageId,
        threadId: 'test-thread-id',
        subject: 'Test',
      } as any;

      vi.mocked(mailService.mailService.restoreToInbox).mockResolvedValue(undefined);
      vi.mocked(mailService.mailService.fetchMessage).mockResolvedValue(mockMessage);

      await store.restoreToInbox(messageId);

      expect(mailService.mailService.restoreToInbox).toHaveBeenCalledWith(messageId);
      expect(mailService.mailService.fetchMessage).toHaveBeenCalledWith(messageId);
      expect(store.currentMessage).toEqual(mockMessage);
    });
  });

  describe('fetchThreads', () => {
    it('should fetch threads and update store', async () => {
      const store = useMailStore();
      // 初期状態ではlastDocumentがnullなので、初期読み込みとして扱われる
      // Piniaストアではrefが自動的にunwrappingされるため、nullまたはundefinedになる可能性がある
      expect(store.lastDocument === null || store.lastDocument === undefined).toBe(true);

      const mockThreads = [
        { threadId: 'thread1', subject: 'Test 1' },
        { threadId: 'thread2', subject: 'Test 2' },
      ] as any;
      const mockLastDoc = { id: 'thread2' } as any;
      const mockResult = {
        threads: mockThreads,
        lastDocument: mockLastDoc,
        hasMore: false,
      };

      vi.mocked(mailService.mailService.fetchThreads).mockResolvedValue(mockResult);

      await store.fetchThreads('inbox');

      // 初期読み込み（lastDocument.value === null）なので、既存のリストを置き換える
      expect(store.threads).toEqual(mockThreads);
      expect(store.threads).toHaveLength(2);
      expect(store.lastDocument).toStrictEqual(mockLastDoc);
      expect(store.hasMore).toBe(false);
      expect(store.isLoading).toBe(false);
    });

    it('should append threads when loading more', async () => {
      const store = useMailStore();
      const existingThread = { threadId: 'thread1' } as any;
      store.threads = [existingThread];
      // lastDocumentが設定されている場合は追加読み込みとして扱われる
      const existingLastDoc = { id: 'thread1' } as any;
      store.lastDocument = existingLastDoc;

      const mockThreads = [{ threadId: 'thread2' } as any];
      const mockLastDoc = { id: 'thread2' } as any;
      const mockResult = {
        threads: mockThreads,
        lastDocument: mockLastDoc,
        hasMore: false,
      };

      // fetchThreadsのモックを設定（lastDocumentが設定されているため、追加読み込みとして処理される）
      vi.mocked(mailService.mailService.fetchThreads).mockResolvedValue(mockResult);

      await store.fetchThreads('inbox');

      // 既存のスレッドに新しいスレッドが追加される（lastDocumentが設定されているため）
      expect(store.threads).toHaveLength(2);
      expect(store.threads[0].threadId).toBe('thread1');
      expect(store.threads[1].threadId).toBe('thread2');
      expect(store.lastDocument).toStrictEqual(mockLastDoc);
    });

    it('should set error when fetchThreads fails', async () => {
      const store = useMailStore();
      const error = new Error('Failed to fetch threads');

      vi.mocked(mailService.mailService.fetchThreads).mockRejectedValue(error);

      await store.fetchThreads('inbox');

      expect(store.error).toBeTruthy();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('loadMore', () => {
    it('should call fetchThreads with current lastDocument', async () => {
      const store = useMailStore();
      const lastDoc = { id: 'thread1' } as any;
      // 既存のスレッドとlastDocumentを設定
      store.threads = [{ threadId: 'thread1' } as any];
      store.lastDocument = lastDoc;
      store.hasMore = true;

      const mockThreads = [{ threadId: 'thread2' } as any];
      const mockLastDoc = { id: 'thread2' } as any;
      const mockResult = {
        threads: mockThreads,
        lastDocument: mockLastDoc,
        hasMore: false,
      };

      // fetchThreadsのモックを設定
      vi.mocked(mailService.mailService.fetchThreads).mockResolvedValue(mockResult);

      await store.loadMore('inbox');

      // fetchThreadsが呼ばれたことを確認
      expect(mailService.mailService.fetchThreads).toHaveBeenCalled();
      // 最後のlastDocumentが渡されたことを確認
      const callArgs = vi.mocked(mailService.mailService.fetchThreads).mock.calls[0];
      expect(callArgs[0]).toBe('inbox');
      expect(callArgs[2]).toStrictEqual(lastDoc);
      // スレッドが追加されたことを確認（lastDocumentが設定されているため追加読み込み）
      expect(store.threads).toHaveLength(2);
      expect(store.lastDocument).toStrictEqual(mockLastDoc);
    });

    it('should not load more if already loading', async () => {
      const store = useMailStore();
      store.isLoading = true;

      await store.loadMore('inbox');

      expect(mailService.mailService.fetchThreads).not.toHaveBeenCalled();
    });

    it('should not load more if hasMore is false', async () => {
      const store = useMailStore();
      store.hasMore = false;

      await store.loadMore('inbox');

      expect(mailService.mailService.fetchThreads).not.toHaveBeenCalled();
    });
  });

  describe('fetchMessage', () => {
    it('should fetch message and update currentMessage', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const mockMessage = {
        messageId,
        threadId: 'thread1',
        subject: 'Test',
      } as any;

      vi.mocked(mailService.mailService.fetchMessage).mockResolvedValue(mockMessage);

      await store.fetchMessage(messageId);

      expect(store.currentMessage).toEqual(mockMessage);
      expect(store.isLoading).toBe(false);
    });

    it('should set error when fetchMessage fails', async () => {
      const store = useMailStore();
      const error = new Error('Failed to fetch message');

      vi.mocked(mailService.mailService.fetchMessage).mockRejectedValue(error);

      await store.fetchMessage('test-id');

      expect(store.error).toBeTruthy();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('decryptMailBody', () => {
    it('should call mailService.decryptMailBody', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const mockBody = {
        bodyText: 'Test body',
        bodyHtml: '<p>Test body</p>',
      };

      vi.mocked(mailService.mailService.decryptMailBody).mockResolvedValue(mockBody);

      const result = await store.decryptMailBody(messageId);

      expect(mailService.mailService.decryptMailBody).toHaveBeenCalledWith(messageId);
      expect(result).toEqual(mockBody);
    });
  });

  describe('getAttachmentsList', () => {
    it('should call mailService.getAttachmentsList', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const mockAttachments = [
        { filename: 'test.pdf', size: 1024, contentType: 'application/pdf' },
      ];

      vi.mocked(mailService.mailService.getAttachmentsList).mockResolvedValue(mockAttachments);

      const result = await store.getAttachmentsList(messageId);

      expect(mailService.mailService.getAttachmentsList).toHaveBeenCalledWith(messageId);
      expect(result).toEqual(mockAttachments);
    });
  });

  describe('markAsRead', () => {
    it('should call mailService.markAsRead and update thread', async () => {
      const store = useMailStore();
      const messageId = 'test-message-id';
      const threadId = 'thread1';
      store.threads = [
        {
          threadId,
          latestMessageId: messageId,
          hasUnread: true,
        } as any,
      ];

      vi.mocked(mailService.mailService.markAsRead).mockResolvedValue(undefined);

      await store.markAsRead(messageId, threadId);

      expect(mailService.mailService.markAsRead).toHaveBeenCalledWith(messageId, threadId);
      expect(store.threads[0].hasUnread).toBe(false);
    });

    it('should not update thread if thread not found', async () => {
      const store = useMailStore();
      store.threads = [];

      vi.mocked(mailService.mailService.markAsRead).mockResolvedValue(undefined);

      await store.markAsRead('message1', 'thread1');

      expect(mailService.mailService.markAsRead).toHaveBeenCalled();
    });
  });

  describe('selectThread', () => {
    it('should set selectedThreadId and fetch message', async () => {
      const store = useMailStore();
      const threadId = 'thread1';
      const mockThread = {
        threadId,
        latestMessageId: 'message1',
      } as any;
      const mockMessage = {
        messageId: 'message1',
        threadId,
        subject: 'Test',
      } as any;

      store.threads = [mockThread];
      vi.mocked(mailService.mailService.fetchMessage).mockResolvedValue(mockMessage);

      store.selectThread(threadId);

      expect(store.selectedThreadId).toBe(threadId);
      await new Promise(resolve => setTimeout(resolve, 0)); // wait for async
      expect(mailService.mailService.fetchMessage).toHaveBeenCalledWith('message1');
    });

    it('should clear selection when threadId is null', () => {
      const store = useMailStore();
      store.selectedThreadId = 'thread1';
      store.currentMessage = { messageId: 'message1' } as any;

      store.selectThread(null);

      expect(store.selectedThreadId).toBeNull();
      expect(store.currentMessage).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const store = useMailStore();
      store.threads = [{ threadId: '1' } as any];
      store.currentMessage = { messageId: '1' } as any;
      store.selectedThreadId = '1';
      store.error = 'Some error';
      store.hasMore = false;

      store.reset();

      expect(store.threads).toEqual([]);
      expect(store.currentMessage).toBeNull();
      expect(store.selectedThreadId).toBeNull();
      expect(store.error).toBeNull();
      expect(store.hasMore).toBe(true);
    });
  });

  describe('sendMail', () => {
    it('should call mailService.sendMail and set isSending to true during execution', async () => {
      const store = useMailStore();
      const request: SendMailRequest = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const mockResponse = {
        success: true,
        messageId: 'test-message-id',
      };

      vi.mocked(mailService.mailService.sendMail).mockResolvedValue(mockResponse);

      const sendPromise = store.sendMail(request);
      expect(store.isSending).toBe(true);
      await sendPromise;

      expect(mailService.mailService.sendMail).toHaveBeenCalledWith(request);
      expect(store.isSending).toBe(false);
      expect(store.sendError).toBeNull();
    });

    it('should set sendError when sendMail fails', async () => {
      const store = useMailStore();
      const request: SendMailRequest = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const error = new Error('Failed to send mail');

      vi.mocked(mailService.mailService.sendMail).mockRejectedValue(error);

      await expect(store.sendMail(request)).rejects.toThrow();
      expect(store.sendError).toBeTruthy();
      expect(store.isSending).toBe(false);
    });

    it('should clear sendError before sending', async () => {
      const store = useMailStore();
      const request: SendMailRequest = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const mockResponse = {
        success: true,
        messageId: 'test-message-id',
      };

      // 最初にエラーを設定
      store.sendError = 'Previous error';
      vi.mocked(mailService.mailService.sendMail).mockResolvedValue(mockResponse);

      await store.sendMail(request);

      expect(store.sendError).toBeNull();
    });

    it('should include optional parameters (cc, bcc, attachments, threadId, inReplyToMessageId)', async () => {
      const store = useMailStore();
      const request: SendMailRequest = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        attachments: [
          {
            filename: 'test.pdf',
            content: 'base64content',
            contentType: 'application/pdf',
          },
        ],
        threadId: 'test-thread-id',
        inReplyToMessageId: 'test-message-id',
      };
      const mockResponse = {
        success: true,
        messageId: 'test-message-id',
      };

      vi.mocked(mailService.mailService.sendMail).mockResolvedValue(mockResponse);

      await store.sendMail(request);

      expect(mailService.mailService.sendMail).toHaveBeenCalledWith(request);
    });
  });

  describe('clearSendError', () => {
    it('should clear sendError', () => {
      const store = useMailStore();
      store.sendError = 'Some error';

      store.clearSendError();

      expect(store.sendError).toBeNull();
    });
  });
});
