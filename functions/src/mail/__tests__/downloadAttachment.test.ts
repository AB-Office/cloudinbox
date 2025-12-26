/**
 * downloadAttachment - 添付ファイルダウンロード・復号化のテスト
 */

import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';
import { executeDownloadAttachment, downloadAttachment } from '../downloadAttachment';
import { MailMessageDoc } from '../types';
import { EncryptedData } from '../types';

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');
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

describe('executeDownloadAttachment', () => {
  const mockUid = 'test-user-123';

  let mockFirestore: any;
  let mockStorage: any;
  let mockBucket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBucket = {
      file: jest.fn(),
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

  it('正常系: 添付ファイルをダウンロード・復号化してBase64エンコードして返す', async () => {
    const messageId = 'message-123';
    const filename = 'document.pdf';
    const attachmentPath = `mail-data/${mockUid}/${messageId}/attachments/${filename}.enc`;

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
          attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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
    const encryptedData: EncryptedData = {
      ciphertext: 'encrypted-cipher',
      nonce: 'nonce',
      tag: 'tag',
    };

    const mockFile = {
      exists: jest.fn().mockResolvedValue([true]),
      download: jest.fn().mockResolvedValue([
        Buffer.from(JSON.stringify(encryptedData), 'utf-8'),
      ]),
      getMetadata: jest.fn().mockResolvedValue([
        {
          size: '2048',
          contentType: 'application/pdf',
        },
      ]),
    };

    mockBucket.file = jest.fn(() => mockFile);

    const decryptedBuffer = Buffer.from('PDF file content', 'utf-8');
    (encryption.decryptForUser as jest.Mock).mockResolvedValue(decryptedBuffer);

    const result = await executeDownloadAttachment(
      mockUid,
      messageId,
      filename,
      mockFirestore,
      mockStorage
    );

    expect(mockFirestore.collection).toHaveBeenCalledWith('users');
    expect(mockBucket.file).toHaveBeenCalledWith(attachmentPath);
    expect(mockFile.exists).toHaveBeenCalled();
    expect(mockFile.download).toHaveBeenCalled();
    expect(encryption.decryptForUser).toHaveBeenCalledWith(mockUid, encryptedData);
    expect(mockFile.getMetadata).toHaveBeenCalled();

    expect(result).toEqual({
      content: decryptedBuffer.toString('base64'),
      filename,
      contentType: 'application/pdf',
      size: 2048,
    });
  });

  it('正常系: 異なるcontentType（画像）の添付ファイルをダウンロード・復号化できる', async () => {
    const messageId = 'message-123';
    const filename = 'image.jpg';

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
          attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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

    const encryptedData: EncryptedData = {
      ciphertext: 'encrypted-image',
      nonce: 'nonce',
      tag: 'tag',
    };

    const mockFile = {
      exists: jest.fn().mockResolvedValue([true]),
      download: jest.fn().mockResolvedValue([
        Buffer.from(JSON.stringify(encryptedData), 'utf-8'),
      ]),
      getMetadata: jest.fn().mockResolvedValue([
        {
          size: '4096',
          contentType: 'image/jpeg',
        },
      ]),
    };

    mockBucket.file = jest.fn(() => mockFile);

    const decryptedBuffer = Buffer.from('Image file content', 'utf-8');
    (encryption.decryptForUser as jest.Mock).mockResolvedValue(decryptedBuffer);

    const result = await executeDownloadAttachment(
      mockUid,
      messageId,
      filename,
      mockFirestore,
      mockStorage
    );

    expect(result).toEqual({
      content: decryptedBuffer.toString('base64'),
      filename,
      contentType: 'image/jpeg',
      size: 4096,
    });
  });

  it('正常系: contentTypeが未設定の場合はapplication/octet-streamを返す', async () => {
    const messageId = 'message-123';
    const filename = 'unknown.bin';

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
          attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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

    const encryptedData: EncryptedData = {
      ciphertext: 'encrypted-data',
      nonce: 'nonce',
      tag: 'tag',
    };

    const mockFile = {
      exists: jest.fn().mockResolvedValue([true]),
      download: jest.fn().mockResolvedValue([
        Buffer.from(JSON.stringify(encryptedData), 'utf-8'),
      ]),
      getMetadata: jest.fn().mockResolvedValue([
        {
          size: '1024',
          // contentTypeが未設定
        },
      ]),
    };

    mockBucket.file = jest.fn(() => mockFile);

    const decryptedBuffer = Buffer.from('Binary file content', 'utf-8');
    (encryption.decryptForUser as jest.Mock).mockResolvedValue(decryptedBuffer);

    const result = await executeDownloadAttachment(
      mockUid,
      messageId,
      filename,
      mockFirestore,
      mockStorage
    );

    expect(result.contentType).toBe('application/octet-stream');
    expect(result.size).toBe(1024);
  });

  it('異常系: メッセージが存在しない場合はエラーを投げる', async () => {
    const messageId = 'non-existent-message';
    const filename = 'document.pdf';

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
      executeDownloadAttachment(mockUid, messageId, filename, mockFirestore, mockStorage)
    ).rejects.toThrow('Message not found');
  });

  it('異常系: ファイルが存在しない場合はエラーを投げる', async () => {
    const messageId = 'message-123';
    const filename = 'non-existent.pdf';

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
          attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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

    const mockFile = {
      exists: jest.fn().mockResolvedValue([false]),
    };

    mockBucket.file = jest.fn(() => mockFile);

    await expect(
      executeDownloadAttachment(mockUid, messageId, filename, mockFirestore, mockStorage)
    ).rejects.toThrow('Failed to download attachment');
  });

  it('異常系: 復号化が失敗した場合はエラーを投げる', async () => {
    const messageId = 'message-123';
    const filename = 'document.pdf';

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
          attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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

    const encryptedData: EncryptedData = {
      ciphertext: 'encrypted-cipher',
      nonce: 'nonce',
      tag: 'tag',
    };

    const mockFile = {
      exists: jest.fn().mockResolvedValue([true]),
      download: jest.fn().mockResolvedValue([
        Buffer.from(JSON.stringify(encryptedData), 'utf-8'),
      ]),
      getMetadata: jest.fn().mockResolvedValue([
        {
          size: '2048',
          contentType: 'application/pdf',
        },
      ]),
    };

    mockBucket.file = jest.fn(() => mockFile);

    (encryption.decryptForUser as jest.Mock).mockRejectedValue(new Error('Decryption failed'));

    await expect(
      executeDownloadAttachment(mockUid, messageId, filename, mockFirestore, mockStorage)
    ).rejects.toThrow('Failed to download attachment');
  });

  it('異常系: Storageダウンロードが失敗した場合はエラーを投げる', async () => {
    const messageId = 'message-123';
    const filename = 'document.pdf';

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
          attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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

    const mockFile = {
      exists: jest.fn().mockResolvedValue([true]),
      download: jest.fn().mockRejectedValue(new Error('Storage download failed')),
      getMetadata: jest.fn().mockResolvedValue([
        {
          size: '2048',
          contentType: 'application/pdf',
        },
      ]),
    };

    mockBucket.file = jest.fn(() => mockFile);

    await expect(
      executeDownloadAttachment(mockUid, messageId, filename, mockFirestore, mockStorage)
    ).rejects.toThrow('Failed to download attachment');
  });

  describe('HTTP Callable Function', () => {
    it('認証されていない場合はunauthenticatedエラーを投げる', async () => {
      const context = {
        auth: null,
      };

      await expect(
        downloadAttachment({ messageId: 'message-123', filename: 'file.pdf' }, context as any)
      ).rejects.toThrow('User must be authenticated');
    });

    it('messageIdが提供されていない場合はinvalid-argumentエラーを投げる', async () => {
      const context = {
        auth: { uid: mockUid },
      };

      await expect(
        downloadAttachment({ filename: 'file.pdf' }, context as any)
      ).rejects.toThrow('messageId is required');
    });

    it('filenameが提供されていない場合はinvalid-argumentエラーを投げる', async () => {
      const context = {
        auth: { uid: mockUid },
      };

      await expect(
        downloadAttachment({ messageId: 'message-123' }, context as any)
      ).rejects.toThrow('filename is required');
    });

    it('messageIdが空文字列の場合はinvalid-argumentエラーを投げる', async () => {
      const context = {
        auth: { uid: mockUid },
      };

      await expect(
        downloadAttachment({ messageId: '', filename: 'file.pdf' }, context as any)
      ).rejects.toThrow('messageId is required');
    });

    it('filenameが空文字列の場合はinvalid-argumentエラーを投げる', async () => {
      const context = {
        auth: { uid: mockUid },
      };

      await expect(
        downloadAttachment({ messageId: 'message-123', filename: '' }, context as any)
      ).rejects.toThrow('filename is required');
    });

    // 注: executeDownloadAttachmentの詳細なテストはタスク2.1で実装済み
    // タスク2.2ではHTTP Callable Functionの基本的な動作（認証、バリデーション、エラーハンドリング）のみをテスト
  });

  describe('HTTP Callable Function Integration Tests', () => {
    it('正常系: エンドツーエンドテスト - 添付ファイルをダウンロード・復号化できる', async () => {
      const messageId = 'message-123';
      const filename = 'document.pdf';
      const attachmentPath = `mail-data/${mockUid}/${messageId}/attachments/${filename}.enc`;

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
            attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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

      const encryptedData: EncryptedData = {
        ciphertext: 'encrypted-cipher',
        nonce: 'nonce',
        tag: 'tag',
      };

      const mockFile = {
        exists: jest.fn().mockResolvedValue([true]),
        download: jest.fn().mockResolvedValue([
          Buffer.from(JSON.stringify(encryptedData), 'utf-8'),
        ]),
        getMetadata: jest.fn().mockResolvedValue([
          {
            size: '2048',
            contentType: 'application/pdf',
          },
        ]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      const decryptedBuffer = Buffer.from('PDF file content', 'utf-8');
      (encryption.decryptForUser as jest.Mock).mockResolvedValue(decryptedBuffer);

      const context = {
        auth: {
          uid: mockUid,
        },
      } as any;

      const result = await downloadAttachment({ messageId, filename }, context);

      expect(result).toEqual({
        content: decryptedBuffer.toString('base64'),
        filename,
        contentType: 'application/pdf',
        size: 2048,
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockBucket.file).toHaveBeenCalledWith(attachmentPath);
      expect(mockFile.exists).toHaveBeenCalled();
      expect(mockFile.download).toHaveBeenCalled();
      expect(encryption.decryptForUser).toHaveBeenCalledWith(mockUid, encryptedData);
    });

    it('異常系: エンドツーエンドテスト - メッセージが存在しない場合はinternalエラーを投げる', async () => {
      const messageId = 'non-existent-message';
      const filename = 'document.pdf';

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
        downloadAttachment({ messageId, filename }, context)
      ).rejects.toThrow('Failed to download attachment: Message not found');
    });

    it('異常系: エンドツーエンドテスト - ファイルが存在しない場合はinternalエラーを投げる', async () => {
      const messageId = 'message-123';
      const filename = 'non-existent.pdf';

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
            attachmentsBasePath: `mail-data/${mockUid}/${messageId}/attachments/`,
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

      const mockFile = {
        exists: jest.fn().mockResolvedValue([false]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      const context = {
        auth: {
          uid: mockUid,
        },
      } as any;

      await expect(
        downloadAttachment({ messageId, filename }, context)
      ).rejects.toThrow('Failed to download attachment: Failed to download attachment');
    });
  });
});

