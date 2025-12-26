/**
 * getAttachmentsList - 添付ファイルリスト取得のテスト
 */

// モック
jest.mock('firebase-admin');
jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    https: {
      onCall: jest.fn((handler: any) => handler),
    },
  })),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(public code: string, public message: string) {
        super(message);
        this.name = 'HttpsError';
      }
    },
  },
}));

import { getAttachmentsList, executeGetAttachmentsList } from '../getAttachmentsList';
import * as admin from 'firebase-admin';
import { MailMessageDoc } from '../types';

describe('getAttachmentsList', () => {
  const mockUid = 'test-user-123';

  let mockFirestore: any;
  let mockStorage: any;
  let mockBucket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBucket = {
      getFiles: jest.fn(),
    };

    mockStorage = {
      bucket: jest.fn().mockReturnValue(mockBucket),
    };

    (admin.storage as any) = jest.fn().mockReturnValue(mockStorage);

    mockFirestore = {
      collection: jest.fn(),
    };

    (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestore);
  });

  describe('HTTP Callable Function', () => {
    it('認証されていない場合はunauthenticatedエラーを投げる', async () => {
      const context = {
        auth: null,
      };

      await expect(
        getAttachmentsList({ messageId: 'message-123' }, context as any)
      ).rejects.toThrow('User must be authenticated');
    });

    it('messageIdが提供されていない場合はinvalid-argumentエラーを投げる', async () => {
      const context = {
        auth: { uid: mockUid },
      };

      await expect(
        getAttachmentsList({}, context as any)
      ).rejects.toThrow('messageId is required');
    });

    it('messageIdが空文字列の場合はinvalid-argumentエラーを投げる', async () => {
      const context = {
        auth: { uid: mockUid },
      };

      await expect(
        getAttachmentsList({ messageId: '' }, context as any)
      ).rejects.toThrow('messageId is required');
    });

    // 注: executeGetAttachmentsListの詳細なテストはタスク1.3で実装
    // タスク1.2ではHTTP Callable Functionの基本的な動作（認証、バリデーション、エラーハンドリング）のみをテスト
  });

  describe('HTTP Callable Function Integration Tests', () => {
    it('正常系: エンドツーエンドテスト - 添付ファイルリストを取得できる', async () => {
      const messageId = 'message-123';
      const attachmentsBasePath = `mail-data/${mockUid}/${messageId}/attachments/`;

      const mockMessageDoc = {
        exists: true,
        data: (): MailMessageDoc => ({
          messageId,
          threadId: 'thread-123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: {} as any,
          receivedAt: {} as any,
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: true,
          storage: {
            rawMimePath: `mail-data/${mockUid}/${messageId}/raw.eml.enc`,
            attachmentsBasePath,
          },
          isRead: false,
          labels: ['inbox'],
          deletedAt: null,
          createdAt: {} as any,
          updatedAt: {} as any,
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      // Storageファイルのモック
      const mockFile1 = {
        name: `${attachmentsBasePath}document.pdf.enc`,
        getMetadata: jest.fn().mockResolvedValue([
          {
            size: '2048',
            contentType: 'application/pdf',
          },
        ]),
      };

      const mockFile2 = {
        name: `${attachmentsBasePath}image.jpg.enc`,
        getMetadata: jest.fn().mockResolvedValue([
          {
            size: '4096',
            contentType: 'image/jpeg',
          },
        ]),
      };

      mockBucket.getFiles = jest.fn().mockResolvedValue([[mockFile1, mockFile2]]);

      const context = {
        auth: {
          uid: mockUid,
        },
      } as any;

      const result = await getAttachmentsList({ messageId }, context);

      expect(result).toEqual({
        attachments: [
          {
            filename: 'document.pdf',
            size: 2048,
            contentType: 'application/pdf',
          },
          {
            filename: 'image.jpg',
            size: 4096,
            contentType: 'image/jpeg',
          },
        ],
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockBucket.getFiles).toHaveBeenCalledWith({ prefix: attachmentsBasePath });
    });

    it('正常系: エンドツーエンドテスト - 添付ファイルがない場合は空リストを返す', async () => {
      const messageId = 'message-123';

      const mockMessageDoc = {
        exists: true,
        data: (): MailMessageDoc => ({
          messageId,
          threadId: 'thread-123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: {} as any,
          receivedAt: {} as any,
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: false,
          storage: {
            rawMimePath: `mail-data/${mockUid}/${messageId}/raw.eml.enc`,
          },
          isRead: false,
          labels: ['inbox'],
          deletedAt: null,
          createdAt: {} as any,
          updatedAt: {} as any,
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      const context = {
        auth: {
          uid: mockUid,
        },
      } as any;

      const result = await getAttachmentsList({ messageId }, context);

      expect(result).toEqual({ attachments: [] });
      expect(mockBucket.getFiles).not.toHaveBeenCalled();
    });

    it('異常系: エンドツーエンドテスト - メッセージが存在しない場合はinternalエラーを投げる', async () => {
      const messageId = 'non-existent-message';

      const mockMessageDoc = {
        exists: false,
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      const context = {
        auth: {
          uid: mockUid,
        },
      } as any;

      await expect(
        getAttachmentsList({ messageId }, context)
      ).rejects.toThrow('Failed to get attachments list: Message not found');
    });
  });

  describe('executeGetAttachmentsList', () => {
    it('正常系: 添付ファイルがある場合のリスト取得', async () => {
      const messageId = 'message-123';
      const attachmentsBasePath = `mail-data/${mockUid}/${messageId}/attachments/`;

      const mockMessageDoc = {
        exists: true,
        data: (): MailMessageDoc => ({
          messageId,
          threadId: 'thread-123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: {} as any,
          receivedAt: {} as any,
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: true,
          storage: {
            rawMimePath: `mail-data/${mockUid}/${messageId}/raw.eml.enc`,
            attachmentsBasePath,
          },
          isRead: false,
          labels: ['inbox'],
          deletedAt: null,
          createdAt: {} as any,
          updatedAt: {} as any,
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      // Storageファイルのモック
      const mockFile1 = {
        name: `${attachmentsBasePath}file1.pdf.enc`,
        getMetadata: jest.fn().mockResolvedValue([
          {
            size: '1024',
            contentType: 'application/pdf',
          },
        ]),
      };

      const mockFile2 = {
        name: `${attachmentsBasePath}file2.jpg.enc`,
        getMetadata: jest.fn().mockResolvedValue([
          {
            size: '2048',
            contentType: 'image/jpeg',
          },
        ]),
      };

      mockBucket.getFiles = jest.fn().mockResolvedValue([[mockFile1, mockFile2]]);

      const result = await executeGetAttachmentsList(
        mockUid,
        messageId,
        mockFirestore,
        mockStorage
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockBucket.getFiles).toHaveBeenCalledWith({ prefix: attachmentsBasePath });
      expect(result).toEqual([
        {
          filename: 'file1.pdf',
          size: 1024,
          contentType: 'application/pdf',
        },
        {
          filename: 'file2.jpg',
          size: 2048,
          contentType: 'image/jpeg',
        },
      ]);
    });

    it('正常系: hasAttachmentsがfalseの場合は空リストを返す', async () => {
      const messageId = 'message-123';

      const mockMessageDoc = {
        exists: true,
        data: (): MailMessageDoc => ({
          messageId,
          threadId: 'thread-123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: {} as any,
          receivedAt: {} as any,
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: false,
          storage: {
            rawMimePath: `mail-data/${mockUid}/${messageId}/raw.eml.enc`,
          },
          isRead: false,
          labels: ['inbox'],
          deletedAt: null,
          createdAt: {} as any,
          updatedAt: {} as any,
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      const result = await executeGetAttachmentsList(
        mockUid,
        messageId,
        mockFirestore,
        mockStorage
      );

      expect(result).toEqual([]);
      expect(mockBucket.getFiles).not.toHaveBeenCalled();
    });

    it('正常系: attachmentsBasePathが存在しない場合は空リストを返す', async () => {
      const messageId = 'message-123';

      const mockMessageDoc = {
        exists: true,
        data: (): MailMessageDoc => ({
          messageId,
          threadId: 'thread-123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: {} as any,
          receivedAt: {} as any,
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: true,
          storage: {
            rawMimePath: `mail-data/${mockUid}/${messageId}/raw.eml.enc`,
          },
          isRead: false,
          labels: ['inbox'],
          deletedAt: null,
          createdAt: {} as any,
          updatedAt: {} as any,
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      const result = await executeGetAttachmentsList(
        mockUid,
        messageId,
        mockFirestore,
        mockStorage
      );

      expect(result).toEqual([]);
      expect(mockBucket.getFiles).not.toHaveBeenCalled();
    });

    it('異常系: メッセージが存在しない場合はエラーを投げる', async () => {
      const messageId = 'non-existent-message';

      const mockMessageDoc = {
        exists: false,
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      await expect(
        executeGetAttachmentsList(mockUid, messageId, mockFirestore, mockStorage)
      ).rejects.toThrow('Message not found');
    });

    it('異常系: Storageからファイルリスト取得に失敗した場合はエラーを投げる', async () => {
      const messageId = 'message-123';
      const attachmentsBasePath = `mail-data/${mockUid}/${messageId}/attachments/`;

      const mockMessageDoc = {
        exists: true,
        data: (): MailMessageDoc => ({
          messageId,
          threadId: 'thread-123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: {} as any,
          receivedAt: {} as any,
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: true,
          storage: {
            rawMimePath: `mail-data/${mockUid}/${messageId}/raw.eml.enc`,
            attachmentsBasePath,
          },
          isRead: false,
          labels: ['inbox'],
          deletedAt: null,
          createdAt: {} as any,
          updatedAt: {} as any,
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      mockBucket.getFiles = jest.fn().mockRejectedValue(new Error('Storage error'));

      await expect(
        executeGetAttachmentsList(mockUid, messageId, mockFirestore, mockStorage)
      ).rejects.toThrow('Failed to get attachments list: Storage error');
    });

    it('異常系: ファイルのメタデータ取得に失敗しても続行する', async () => {
      const messageId = 'message-123';
      const attachmentsBasePath = `mail-data/${mockUid}/${messageId}/attachments/`;

      const mockMessageDoc = {
        exists: true,
        data: (): MailMessageDoc => ({
          messageId,
          threadId: 'thread-123',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: {} as any,
          receivedAt: {} as any,
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: true,
          storage: {
            rawMimePath: `mail-data/${mockUid}/${messageId}/raw.eml.enc`,
            attachmentsBasePath,
          },
          isRead: false,
          labels: ['inbox'],
          deletedAt: null,
          createdAt: {} as any,
          updatedAt: {} as any,
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      // 1つ目のファイルは成功、2つ目のファイルはメタデータ取得に失敗
      const mockFile1 = {
        name: `${attachmentsBasePath}file1.pdf.enc`,
        getMetadata: jest.fn().mockResolvedValue([
          {
            size: '1024',
            contentType: 'application/pdf',
          },
        ]),
      };

      const mockFile2 = {
        name: `${attachmentsBasePath}file2.jpg.enc`,
        getMetadata: jest.fn().mockRejectedValue(new Error('Metadata error')),
      };

      mockBucket.getFiles = jest.fn().mockResolvedValue([[mockFile1, mockFile2]]);

      // エラーが発生しても、成功したファイルは含まれる
      const result = await executeGetAttachmentsList(
        mockUid,
        messageId,
        mockFirestore,
        mockStorage
      );

      expect(result).toEqual([
        {
          filename: 'file1.pdf',
          size: 1024,
          contentType: 'application/pdf',
        },
      ]);
    });
  });
});

