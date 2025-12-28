/**
 * saveMail - メール暗号化保存のテスト
 */

import { saveMail } from '../saveMail';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';
import { canStoreMail } from '../../shared/planValidator';
import * as MailParser from 'mailparser';

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');
jest.mock('../../shared/planValidator');

describe('saveMail', () => {
  const mockUid = 'test-user-123';
  const mockMessageId = 'message-456';
  const mockThreadId = 'thread-789';
  const mockRawMessage = 'Raw MIME message';
  const mockParsed = {
    messageId: '<message-id@example.com>',
    subject: 'Test Subject',
    from: { text: 'sender@example.com' },
    to: [{ address: 'recipient@example.com' }],
    text: 'Email body text',
    html: '<p>Email body HTML</p>',
    attachments: [
      {
        filename: 'document.pdf',
        content: Buffer.from('PDF content'),
      },
    ],
    date: new Date('2024-01-01T00:00:00Z'),
    headers: new Map(),
    headerLines: [],
  } as unknown as MailParser.ParsedMail;

  let mockFirestore: any;
  let mockStorage: any;
  let mockBucket: any;
  let mockFile: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFile = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockBucket = {
      file: jest.fn().mockReturnValue(mockFile),
    };

    mockStorage = {
      bucket: jest.fn().mockReturnValue(mockBucket),
    };

    (admin.storage as any) = jest.fn().mockReturnValue(mockStorage);

    mockFirestore = {
      collection: jest.fn(),
    };

    (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestore);
    (admin.firestore.Timestamp as any) = {
      now: jest.fn().mockReturnValue({ seconds: 1234567890, nanoseconds: 0 }),
      fromDate: jest.fn().mockReturnValue({ seconds: 1234567890, nanoseconds: 0 }),
    };
    (admin.firestore.FieldValue as any) = {
      increment: jest.fn((value: number) => ({ _increment: value })),
    };
  });

  describe('容量チェック', () => {
    it('PlanValidatorを使用して容量チェックを実行する', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn((uid: string) => {
              if (uid === mockUid) {
                return {
                  get: mockUserRef.get,
                  update: mockUserRef.update,
                  collection: jest.fn((subPath: string) => {
                    if (subPath === 'mailThreads') {
                      return { doc: jest.fn(() => mockThreadRef) };
                    }
                    if (subPath === 'mailMessages') {
                      return { doc: jest.fn(() => mockMessageRef) };
                    }
                    return { doc: jest.fn() };
                  }),
                };
              }
              return { doc: jest.fn() };
            }),
          };
        }
        return { doc: jest.fn() };
      });

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        mockParsed,
        mockFirestore,
        mockStorage
      );

      expect(canStoreMail).toHaveBeenCalled();
    });

    it('容量超過時はエラーを投げる', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(false);

      await expect(
        saveMail(
          mockUid,
          mockMessageId,
          mockThreadId,
          mockRawMessage,
          mockParsed,
          mockFirestore,
          mockStorage
        )
      ).rejects.toThrow();
    });
  });

  describe('暗号化保存', () => {
    it('MIME原本を暗号化してStorageに保存する', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        mockParsed,
        mockFirestore,
        mockStorage
      );

      expect(encryption.encryptForUser).toHaveBeenCalledWith(
        mockUid,
        expect.any(Buffer)
      );
      expect(mockFile.save).toHaveBeenCalled();
      expect(mockBucket.file).toHaveBeenCalledWith(expect.stringContaining('raw.eml.enc'));
    });

    it('小さい本文を暗号化してFirestoreに保存する', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const smallParsed = {
        ...mockParsed,
        text: 'a'.repeat(100), // 小さい本文
      };

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        smallParsed,
        mockFirestore,
        mockStorage
      );

      const setCall = mockMessageRef.set.mock.calls[0];
      const messageData = setCall[0];
      expect(messageData.bodyTextEncrypted).toBeDefined();
      expect(messageData.hasLargeBody).toBe(false);
    });

    it('大きい本文を暗号化してStorageに保存する', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const largeParsed = {
        ...mockParsed,
        text: 'a'.repeat(2 * 1024 * 1024), // 2MB（大きい本文）
      };

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        largeParsed,
        mockFirestore,
        mockStorage
      );

      const setCall = mockMessageRef.set.mock.calls[0];
      const messageData = setCall[0];
      expect(messageData.bodyTextEncrypted).toBeUndefined();
      expect(messageData.hasLargeBody).toBe(true);
      expect(mockFile.save).toHaveBeenCalled(); // Storageに保存
      expect(mockBucket.file).toHaveBeenCalledWith(expect.stringContaining('body.html.enc'));
    });
  });

  describe('mailThreads/mailMessages更新', () => {
    it('mailThreadsを作成する', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        mockParsed,
        mockFirestore,
        mockStorage
      );

      expect(mockThreadRef.set).toHaveBeenCalled();
      const setCall = mockThreadRef.set.mock.calls[0];
      const threadData = setCall[0];
      expect(threadData.threadId).toBe(mockThreadId);
      expect(threadData.latestMessageId).toBe(mockMessageId);
      expect(threadData.hasUnread).toBe(true);
      expect(threadData.labels).toContain('inbox');
    });

    it('mailMessagesを作成する', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        mockParsed,
        mockFirestore,
        mockStorage
      );

      expect(mockMessageRef.set).toHaveBeenCalled();
      const setCall = mockMessageRef.set.mock.calls[0];
      const messageData = setCall[0];
      expect(messageData.messageId).toBe(mockMessageId);
      expect(messageData.threadId).toBe(mockThreadId);
      expect(messageData.isRead).toBe(false);
      expect(messageData.labels).toContain('inbox');
    });

    it('送信済みメール（isSentMail=true）の場合はisReadがtrueで保存される', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        mockParsed,
        mockFirestore,
        mockStorage,
        true // isSentMail=true
      );

      expect(mockMessageRef.set).toHaveBeenCalled();
      const setCall = mockMessageRef.set.mock.calls[0];
      const messageData = setCall[0];
      expect(messageData.messageId).toBe(mockMessageId);
      expect(messageData.threadId).toBe(mockThreadId);
      expect(messageData.isRead).toBe(true); // 送信済みメールは既読
      expect(messageData.labels).toContain('sent');
      expect(messageData.labels).not.toContain('inbox');
    });

    it('送信済みメール（isSentMail=true）の場合、スレッドのhasUnreadがfalseになる', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: { maxStorageBytes: 2147483648 },
            usage: { storageBytes: 0 },
          }),
        }),
        update: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn((subPath: string) => {
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        mockParsed,
        mockFirestore,
        mockStorage,
        true // isSentMail=true
      );

      expect(mockThreadRef.set).toHaveBeenCalled();
      const setCall = mockThreadRef.set.mock.calls[0];
      const threadData = setCall[0];
      expect(threadData.hasUnread).toBe(false); // 送信済みメールのスレッドは未読フラグがfalse
    });
  });

  describe('使用量更新', () => {
    it('保存されたファイルサイズを計算して使用量を更新する', async () => {
      (canStoreMail as jest.Mock).mockResolvedValue(true);
      (encryption.encryptForUser as jest.Mock).mockResolvedValue({
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      });

      const mockThreadRef = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessageRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

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
          if (subPath === 'mailThreads') {
            return { doc: jest.fn(() => mockThreadRef) };
          }
          if (subPath === 'mailMessages') {
            return { doc: jest.fn(() => mockMessageRef) };
          }
          return { doc: jest.fn() };
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserRef),
      }));

      await saveMail(
        mockUid,
        mockMessageId,
        mockThreadId,
        mockRawMessage,
        mockParsed,
        mockFirestore,
        mockStorage
      );

      expect(mockUserRef.update).toHaveBeenCalled();
      const updateCall = mockUserRef.update.mock.calls[0];
      const updateData = updateCall[0];
      const storageBytesValue = updateData['usage.storageBytes'];
      expect(storageBytesValue).toBeDefined();
      // FieldValue.incrementはオブジェクトを返す
      if (typeof storageBytesValue === 'object' && storageBytesValue._increment) {
        expect(storageBytesValue._increment).toBeGreaterThan(0);
      } else {
        expect(storageBytesValue).toBeGreaterThan(1000);
      }
    });
  });
});

