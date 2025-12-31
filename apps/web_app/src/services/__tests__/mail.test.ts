/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mailService } from '../mail';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import type { SendMailRequest } from '@/types/mail';

// Firebase Authをモック
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
    getFirestore: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    writeBatch: vi.fn(),
    serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
    arrayUnion: vi.fn((...items) => ({ type: 'arrayUnion', items })),
    arrayRemove: vi.fn((...items) => ({ type: 'arrayRemove', items })),
    collection: vi.fn(),
    query: vi.fn((...args) => args[args.length - 1]), // 最後の引数を返す
    where: vi.fn(q => q),
    orderBy: vi.fn(q => q),
    limit: vi.fn(q => q),
    startAfter: vi.fn(q => q),
    getDocs: vi.fn(),
    onSnapshot: vi.fn(),
  };
});

vi.mock('firebase/functions', () => {
  const mockFunctions = {};
  return {
    getFunctions: vi.fn(() => mockFunctions),
    httpsCallable: vi.fn(() => vi.fn()),
  };
});

vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
}));

import { getDocs, startAfter } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

describe('mailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchThreads', () => {
    it('should fetch threads with inbox label', async () => {
      const mockDocs = [
        {
          id: 'thread1',
          data: () => ({
            threadId: 'thread1',
            labels: ['inbox'],
            lastMessageAt: { toDate: () => new Date() },
          }),
        },
        {
          id: 'thread2',
          data: () => ({
            threadId: 'thread2',
            labels: ['inbox', 'trash'],
            lastMessageAt: { toDate: () => new Date() },
          }),
        },
      ];
      const mockSnapshot = {
        docs: mockDocs,
      };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const result = await mailService.fetchThreads('inbox', 10, null);

      expect(result.threads).toHaveLength(1); // trashを含むものは除外される
      expect(result.threads[0].threadId).toBe('thread1');
    });

    it('should fetch all threads when label is "all"', async () => {
      const mockDocs = [
        {
          id: 'thread1',
          data: () => ({ threadId: 'thread1', labels: ['inbox'] }),
        },
      ];
      const mockSnapshot = { docs: mockDocs };

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      const result = await mailService.fetchThreads('all', 10, null);

      expect(result.threads).toHaveLength(1);
    });

    it('should handle pagination with lastDoc', async () => {
      const mockDocs = [
        {
          id: 'thread2',
          data: () => ({ threadId: 'thread2', labels: ['inbox'] }),
        },
      ];
      const mockSnapshot = { docs: mockDocs };
      const mockLastDoc = { id: 'thread1' } as any;

      vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

      await mailService.fetchThreads('inbox', 10, mockLastDoc);

      expect(startAfter).toHaveBeenCalled();
    });

    it('should throw error if user is not authenticated', async () => {
      vi.mocked(getAuth).mockReturnValueOnce({
        currentUser: null,
      } as any);

      await expect(mailService.fetchThreads('inbox', 10, null)).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('fetchMessage', () => {
    it('should fetch message by messageId', async () => {
      const messageId = 'test-message-id';
      const mockMessageData = {
        messageId,
        threadId: 'thread1',
        subject: 'Test Subject',
        from: 'test@example.com',
      };
      const mockDoc = {
        exists: () => true,
        id: messageId,
        data: () => mockMessageData,
      };

      vi.mocked(getDoc).mockResolvedValue(mockDoc as any);

      const result = await mailService.fetchMessage(messageId);

      expect(result.messageId).toBe(messageId);
      expect(result.subject).toBe('Test Subject');
    });

    it('should throw error if message not found', async () => {
      const mockDoc = {
        exists: () => false,
      };

      vi.mocked(getDoc).mockResolvedValue(mockDoc as any);

      await expect(mailService.fetchMessage('non-existent')).rejects.toThrow('Message not found');
    });
  });

  describe('decryptMailBody', () => {
    it('should call decryptMail Cloud Function', async () => {
      const messageId = 'test-message-id';
      const mockResult = {
        data: {
          bodyText: 'Test body',
          bodyHtml: '<p>Test body</p>',
        },
      };

      const mockDecryptMail = vi.fn().mockResolvedValue(mockResult);
      vi.mocked(httpsCallable).mockReturnValue(mockDecryptMail);

      const result = await mailService.decryptMailBody(messageId);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'decryptMail');
      expect(mockDecryptMail).toHaveBeenCalledWith({ messageId });
      expect(result.bodyText).toBe('Test body');
      expect(result.bodyHtml).toBe('<p>Test body</p>');
    });
  });

  describe('getAttachmentsList', () => {
    it('should call getAttachmentsList Cloud Function', async () => {
      const messageId = 'test-message-id';
      const mockResult = {
        data: {
          attachments: [{ filename: 'test.pdf', size: 1024 }],
        },
      };

      const mockGetAttachmentsList = vi.fn().mockResolvedValue(mockResult);
      vi.mocked(httpsCallable).mockReturnValue(mockGetAttachmentsList);

      const result = await mailService.getAttachmentsList(messageId);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'getAttachmentsList');
      expect(mockGetAttachmentsList).toHaveBeenCalledWith({ messageId });
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('test.pdf');
    });
  });

  describe('markAsRead', () => {
    it('should call markAsRead Cloud Function', async () => {
      const messageId = 'test-message-id';
      const threadId = 'test-thread-id';
      const mockMarkAsRead = vi.fn().mockResolvedValue({});

      vi.mocked(httpsCallable).mockReturnValue(mockMarkAsRead);

      await mailService.markAsRead(messageId, threadId);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'markAsRead');
      expect(mockMarkAsRead).toHaveBeenCalledWith({ messageId, threadId });
    });

    it('should not throw error on CORS error in development', async () => {
      const messageId = 'test-message-id';
      const threadId = 'test-thread-id';
      const mockMarkAsRead = vi.fn().mockRejectedValue(new Error('CORS policy'));

      vi.mocked(httpsCallable).mockReturnValue(mockMarkAsRead);

      await expect(mailService.markAsRead(messageId, threadId)).resolves.not.toThrow();
    });
  });

  describe('sendMail', () => {
    it('should call sendMail Cloud Function with correct parameters', async () => {
      const request = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const mockResponse = {
        data: {
          success: true,
          messageId: 'test-message-id',
        },
      };
      const mockSendMail = vi.fn().mockResolvedValue(mockResponse);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      const result = await mailService.sendMail(request);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'sendMail');
      expect(mockSendMail).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockResponse.data);
    });

    it('should include optional parameters (cc, bcc, attachments, threadId, inReplyToMessageId)', async () => {
      const request = {
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
        data: {
          success: true,
          messageId: 'test-message-id',
        },
      };
      const mockSendMail = vi.fn().mockResolvedValue(mockResponse);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      const result = await mailService.sendMail(request);

      expect(mockSendMail).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle errors and throw with error message', async () => {
      const request = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const error = new Error('Network error');
      const mockSendMail = vi.fn().mockRejectedValue(error);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      await expect(mailService.sendMail(request)).rejects.toThrow('Network error');
    });

    it('should handle authentication errors', async () => {
      const request = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const authError = {
        code: 'unauthenticated',
        message: 'User not authenticated',
      };
      const mockSendMail = vi.fn().mockRejectedValue(authError);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      await expect(mailService.sendMail(request)).rejects.toEqual(authError);
    });

    it('should handle parameter validation errors', async () => {
      const request = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const validationError = {
        code: 'invalid-argument',
        message: 'Invalid email address',
      };
      const mockSendMail = vi.fn().mockRejectedValue(validationError);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      await expect(mailService.sendMail(request)).rejects.toEqual(validationError);
    });

    it('should handle SMTP connection errors', async () => {
      const request = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const smtpError = {
        code: 'unavailable',
        message: 'SMTP server connection failed',
      };
      const mockSendMail = vi.fn().mockRejectedValue(smtpError);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      await expect(mailService.sendMail(request)).rejects.toEqual(smtpError);
    });

    it('should handle mail sending with attachments correctly', async () => {
      const request: SendMailRequest = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        attachments: [
          {
            filename: 'document.pdf',
            content: 'base64encodedcontent',
            contentType: 'application/pdf',
          },
          {
            filename: 'image.jpg',
            content: 'base64encodedimage',
            contentType: 'image/jpeg',
          },
        ],
      };
      const mockResponse = {
        data: {
          success: true,
          messageId: 'test-message-id',
        },
      };
      const mockSendMail = vi.fn().mockResolvedValue(mockResponse);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      const result = await mailService.sendMail(request);

      expect(mockSendMail).toHaveBeenCalledWith(request);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(request.attachments).toHaveLength(2);
      expect(request.attachments?.[0].filename).toBe('document.pdf');
      expect(request.attachments?.[1].filename).toBe('image.jpg');
    });

    it('should handle reply with threadId and inReplyToMessageId', async () => {
      const request: SendMailRequest = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Re: Test Subject',
        body: 'Reply body',
        threadId: 'existing-thread-id',
        inReplyToMessageId: 'original-message-id',
      };
      const mockResponse = {
        data: {
          success: true,
          messageId: 'reply-message-id',
        },
      };
      const mockSendMail = vi.fn().mockResolvedValue(mockResponse);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      const result = await mailService.sendMail(request);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'existing-thread-id',
          inReplyToMessageId: 'original-message-id',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle forward with threadId and inReplyToMessageId', async () => {
      const request: SendMailRequest = {
        accountId: 'test-account-id',
        to: ['new-recipient@example.com'],
        subject: 'Fw: Test Subject',
        body: 'Forward body',
        threadId: 'original-thread-id',
        inReplyToMessageId: 'original-message-id',
      };
      const mockResponse = {
        data: {
          success: true,
          messageId: 'forward-message-id',
        },
      };
      const mockSendMail = vi.fn().mockResolvedValue(mockResponse);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      const result = await mailService.sendMail(request);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'original-thread-id',
          inReplyToMessageId: 'original-message-id',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle response with error message in success=false case', async () => {
      const request = {
        accountId: 'test-account-id',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };
      const mockResponse = {
        data: {
          success: false,
          errorMessage: 'SMTP authentication failed',
        },
      };
      const mockSendMail = vi.fn().mockResolvedValue(mockResponse);

      vi.mocked(httpsCallable).mockReturnValue(mockSendMail);

      const result = await mailService.sendMail(request);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('SMTP authentication failed');
    });
  });

  describe('moveToTrash', () => {
    it('should add trash label to message and thread, and set deletedAt', async () => {
      const messageId = 'test-message-id';
      const threadId = 'test-thread-id';

      const mockMessageRef = {};
      const mockThreadRef = {};
      const mockMessageDoc = {
        exists: () => true,
        data: () => ({ threadId }),
      };

      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(doc)
        .mockReturnValueOnce(mockMessageRef as any)
        .mockReturnValueOnce(mockThreadRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockMessageDoc as any);
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await mailService.moveToTrash(messageId);

      expect(mockBatch.update).toHaveBeenCalledWith(
        mockMessageRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayUnion' }),
          deletedAt: expect.anything(),
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockThreadRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayUnion' }),
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should throw error if user is not authenticated', async () => {
      vi.mocked(getAuth).mockReturnValueOnce({
        currentUser: null,
      } as unknown as ReturnType<typeof getAuth>);

      await expect(mailService.moveToTrash('test-id')).rejects.toThrow('User not authenticated');
    });

    it('should throw error if message not found', async () => {
      const mockMessageDoc = {
        exists: () => false,
      };

      vi.mocked(getDoc).mockResolvedValue(mockMessageDoc as any);

      await expect(mailService.moveToTrash('test-id')).rejects.toThrow('Message not found');
    });
  });

  describe('restoreFromTrash', () => {
    it('should remove trash label from message and thread, set deletedAt to null', async () => {
      const messageId = 'test-message-id';
      const threadId = 'test-thread-id';

      const mockMessageRef = {};
      const mockThreadRef = {};
      const mockMessageDoc = {
        exists: () => true,
        data: () => ({ threadId }),
      };

      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(doc)
        .mockReturnValueOnce(mockMessageRef as any)
        .mockReturnValueOnce(mockThreadRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockMessageDoc as any);
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await mailService.restoreFromTrash(messageId);

      expect(mockBatch.update).toHaveBeenCalledWith(
        mockMessageRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayRemove' }),
          deletedAt: null,
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockThreadRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayRemove' }),
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should remove inbox label from message and thread', async () => {
      const messageId = 'test-message-id';
      const threadId = 'test-thread-id';

      const mockMessageRef = {};
      const mockThreadRef = {};
      const mockMessageDoc = {
        exists: () => true,
        data: () => ({ threadId }),
      };

      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(doc)
        .mockReturnValueOnce(mockMessageRef as any)
        .mockReturnValueOnce(mockThreadRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockMessageDoc as any);
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await mailService.archive(messageId);

      expect(mockBatch.update).toHaveBeenCalledWith(
        mockMessageRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayRemove' }),
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockThreadRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayRemove' }),
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('restoreToInbox', () => {
    it('should add inbox label to message and thread', async () => {
      const messageId = 'test-message-id';
      const threadId = 'test-thread-id';

      const mockMessageRef = {};
      const mockThreadRef = {};
      const mockMessageDoc = {
        exists: () => true,
        data: () => ({ threadId }),
      };

      const mockBatch = {
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(doc)
        .mockReturnValueOnce(mockMessageRef as any)
        .mockReturnValueOnce(mockThreadRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockMessageDoc as any);
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      await mailService.restoreToInbox(messageId);

      expect(mockBatch.update).toHaveBeenCalledWith(
        mockMessageRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayUnion' }),
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.update).toHaveBeenCalledWith(
        mockThreadRef,
        expect.objectContaining({
          labels: expect.objectContaining({ type: 'arrayUnion' }),
          updatedAt: expect.anything(),
        })
      );
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});
