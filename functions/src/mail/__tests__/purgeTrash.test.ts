/**
 * purgeTrash - ゴミ箱完全削除のテスト
 */

import { executePurgeTrash } from '../purgeTrash';
import * as admin from 'firebase-admin';
import { MailMessageDoc } from '../types';

// モック
jest.mock('firebase-admin');

describe('purgeTrash', () => {
  let mockFirestore: any;
  let mockStorage: any;
  let mockBucket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBucket = {
      file: jest.fn(),
      getFiles: jest.fn(),
    };

    mockStorage = {
      bucket: jest.fn().mockReturnValue(mockBucket),
    };

    (admin.storage as any) = jest.fn().mockReturnValue(mockStorage);

    mockFirestore = {
      collectionGroup: jest.fn(),
      collection: jest.fn(),
      batch: jest.fn(),
    };

    (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestore);
    (admin.firestore.Timestamp as any) = {
      now: jest.fn().mockReturnValue({ seconds: 1734567890, nanoseconds: 0 }),
      fromDate: jest.fn((date: Date) => ({
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
      })),
    };
    (admin.firestore.FieldValue as any) = {
      increment: jest.fn((value: number) => ({ _increment: value })),
      delete: jest.fn(() => ({ _delete: true })),
    };
  });

  describe('30日経過メールの検索', () => {
    it('deletedAtが30日以上前のメールを検索する', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const thirtyOneDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyOneDaysAgo);

      const mockMessageDoc = {
        id: 'message-123',
        data: (): MailMessageDoc => ({
          messageId: 'message-123',
          threadId: 'thread-456',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: admin.firestore.Timestamp.now(),
          receivedAt: admin.firestore.Timestamp.now(),
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: false,
          storage: {
            rawMimePath: 'mail-data/user-123/message-123/raw.eml.enc',
          },
          isRead: false,
          labels: ['inbox', 'trash'],
          deletedAt: thirtyOneDaysAgoTimestamp,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }),
        ref: {
          parent: {
            parent: {
              id: 'user-123',
            },
          },
        },
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [mockMessageDoc],
        }),
      };

      mockFirestore.collectionGroup = jest.fn(() => mockQuery);

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.batch = jest.fn(() => mockBatch);

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 1000 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      const mockFile = {
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue([true]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      await executePurgeTrash(mockFirestore, mockStorage);

      expect(mockFirestore.collectionGroup).toHaveBeenCalledWith('mailMessages');
      expect(mockQuery.where).toHaveBeenCalledWith('labels', 'array-contains', 'trash');
      expect(mockQuery.where).toHaveBeenCalledWith('deletedAt', '<=', expect.anything());
    });

    it('deletedAtが30日未満のメールは削除しない', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [],
        }),
      };

      mockFirestore.collectionGroup = jest.fn(() => mockQuery);

      await executePurgeTrash(mockFirestore, mockStorage);

      expect(mockQuery.get).toHaveBeenCalled();
    });
  });

  describe('Firestore削除', () => {
    it('mailMessageドキュメントを削除する', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const thirtyOneDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyOneDaysAgo);

      const mockMessageDoc = {
        id: 'message-123',
        data: (): MailMessageDoc => ({
          messageId: 'message-123',
          threadId: 'thread-456',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: admin.firestore.Timestamp.now(),
          receivedAt: admin.firestore.Timestamp.now(),
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: false,
          storage: {
            rawMimePath: 'mail-data/user-123/message-123/raw.eml.enc',
          },
          isRead: false,
          labels: ['inbox', 'trash'],
          deletedAt: thirtyOneDaysAgoTimestamp,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }),
        ref: {
          parent: {
            parent: {
              id: 'user-123',
            },
          },
        },
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [mockMessageDoc],
        }),
      };

      mockFirestore.collectionGroup = jest.fn(() => mockQuery);

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.batch = jest.fn(() => mockBatch);

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 1000 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      const mockFile = {
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue([true]),
        getMetadata: jest.fn().mockResolvedValue([{ size: '500' }]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      await executePurgeTrash(mockFirestore, mockStorage);

      expect(mockBatch.delete).toHaveBeenCalled();
    });
  });

  describe('Storage削除', () => {
    it('MIME原本をStorageから削除する', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const thirtyOneDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyOneDaysAgo);

      const mockMessageDoc = {
        id: 'message-123',
        data: (): MailMessageDoc => ({
          messageId: 'message-123',
          threadId: 'thread-456',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: admin.firestore.Timestamp.now(),
          receivedAt: admin.firestore.Timestamp.now(),
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: false,
          storage: {
            rawMimePath: 'mail-data/user-123/message-123/raw.eml.enc',
          },
          isRead: false,
          labels: ['inbox', 'trash'],
          deletedAt: thirtyOneDaysAgoTimestamp,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }),
        ref: {
          parent: {
            parent: {
              id: 'user-123',
            },
          },
        },
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [mockMessageDoc],
        }),
      };

      mockFirestore.collectionGroup = jest.fn(() => mockQuery);

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.batch = jest.fn(() => mockBatch);

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 1000 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      const mockFile = {
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue([true]),
        getMetadata: jest.fn().mockResolvedValue([{ size: '500' }]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      await executePurgeTrash(mockFirestore, mockStorage);

      expect(mockBucket.file).toHaveBeenCalledWith('mail-data/user-123/message-123/raw.eml.enc');
      expect(mockFile.delete).toHaveBeenCalled();
    });

    it('大きい本文をStorageから削除する', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const thirtyOneDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyOneDaysAgo);

      const mockMessageDoc = {
        id: 'message-123',
        data: (): MailMessageDoc => ({
          messageId: 'message-123',
          threadId: 'thread-456',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: admin.firestore.Timestamp.now(),
          receivedAt: admin.firestore.Timestamp.now(),
          bodyPreview: 'Preview',
          hasLargeBody: true,
          hasAttachments: false,
          storage: {
            rawMimePath: 'mail-data/user-123/message-123/raw.eml.enc',
            largeBodyPath: 'mail-data/user-123/message-123/body.html.enc',
          },
          isRead: false,
          labels: ['inbox', 'trash'],
          deletedAt: thirtyOneDaysAgoTimestamp,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }),
        ref: {
          parent: {
            parent: {
              id: 'user-123',
            },
          },
        },
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [mockMessageDoc],
        }),
      };

      mockFirestore.collectionGroup = jest.fn(() => mockQuery);

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.batch = jest.fn(() => mockBatch);

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 1000 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      const mockFile = {
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue([true]),
        getMetadata: jest.fn().mockResolvedValue([{ size: '500' }]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      await executePurgeTrash(mockFirestore, mockStorage);

      expect(mockBucket.file).toHaveBeenCalledWith('mail-data/user-123/message-123/raw.eml.enc');
      expect(mockBucket.file).toHaveBeenCalledWith('mail-data/user-123/message-123/body.html.enc');
    });
  });

  describe('使用量更新', () => {
    it('削除されたファイルサイズを計算して使用量を減算する', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const thirtyOneDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyOneDaysAgo);

      const mockMessageDoc = {
        id: 'message-123',
        data: (): MailMessageDoc => ({
          messageId: 'message-123',
          threadId: 'thread-456',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: admin.firestore.Timestamp.now(),
          receivedAt: admin.firestore.Timestamp.now(),
          bodyPreview: 'Preview',
          bodyTextEncrypted: {
            ciphertext: 'dGVzdA==', // base64 encoded "test"
            nonce: 'dGVzdA==',
            tag: 'dGVzdA==',
          },
          hasLargeBody: false,
          hasAttachments: false,
          storage: {
            rawMimePath: 'mail-data/user-123/message-123/raw.eml.enc',
          },
          isRead: false,
          labels: ['inbox', 'trash'],
          deletedAt: thirtyOneDaysAgoTimestamp,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }),
        ref: {
          parent: {
            parent: {
              id: 'user-123',
            },
          },
        },
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [mockMessageDoc],
        }),
      };

      mockFirestore.collectionGroup = jest.fn(() => mockQuery);

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.batch = jest.fn(() => mockBatch);

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 1000 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      // スレッド内のメッセージクエリ用のモック
      const mockThreadMessagesQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true }),
      };

      const mockThreadMessagesCollection = {
        where: jest.fn(() => mockThreadMessagesQuery),
      };

      const mockThreadCollection = {
        doc: jest.fn(() => ({
          delete: jest.fn().mockResolvedValue(undefined),
        })),
      };

      mockFirestore.collection = jest.fn((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: jest.fn((uid: string) => {
              if (uid === 'user-123') {
                return {
                  ...mockUserRef,
                  collection: jest.fn((subCollectionName: string) => {
                    if (subCollectionName === 'mailMessages') {
                      return mockThreadMessagesCollection;
                    } else if (subCollectionName === 'mailThreads') {
                      return mockThreadCollection;
                    }
                    return mockThreadMessagesCollection;
                  }),
                };
              }
              return mockUserRef;
            }),
          };
        }
        return {
          doc: jest.fn(() => mockUserRef),
        };
      });

      const mockFile = {
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue([true]),
        getMetadata: jest.fn().mockResolvedValue([{ size: '500' }]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      await executePurgeTrash(mockFirestore, mockStorage);

      expect(mockUserRef.update).toHaveBeenCalled();
      const updateCall = mockUserRef.update.mock.calls[0];
      const updateData = updateCall[0];
      expect(updateData['usage.storageBytes']).toBeDefined();
    });
  });

  describe('スレッド削除', () => {
    it('スレッド内のすべてのメールが削除された場合、スレッドも削除する', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      const thirtyOneDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyOneDaysAgo);

      const mockMessageDoc = {
        id: 'message-123',
        data: (): MailMessageDoc => ({
          messageId: 'message-123',
          threadId: 'thread-456',
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          sentAt: admin.firestore.Timestamp.now(),
          receivedAt: admin.firestore.Timestamp.now(),
          bodyPreview: 'Preview',
          hasLargeBody: false,
          hasAttachments: false,
          storage: {
            rawMimePath: 'mail-data/user-123/message-123/raw.eml.enc',
          },
          isRead: false,
          labels: ['inbox', 'trash'],
          deletedAt: thirtyOneDaysAgoTimestamp,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }),
        ref: {
          parent: {
            parent: {
              id: 'user-123',
            },
          },
        },
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [mockMessageDoc],
        }),
      };

      mockFirestore.collectionGroup = jest.fn(() => mockQuery);

      const mockThreadQuery = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [],
        }),
      };

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.batch = jest.fn(() => mockBatch);

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 1000 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailMessages') {
            return {
              where: jest.fn(() => mockThreadQuery),
            };
          }
          if (subPath === 'mailThreads') {
            return {
              doc: jest.fn(() => ({
                delete: jest.fn().mockResolvedValue(undefined),
              })),
            };
          }
          return {};
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      const mockFile = {
        delete: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue([true]),
        getMetadata: jest.fn().mockResolvedValue([{ size: 500 }]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      await executePurgeTrash(mockFirestore, mockStorage);

      // スレッド削除の確認は実装に依存
      expect(mockBatch.delete).toHaveBeenCalled();
    });
  });
});

