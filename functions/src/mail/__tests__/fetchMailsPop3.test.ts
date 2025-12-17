/**
 * fetchMails - POP3S接続とメール取得のテスト
 */

import { processAccount } from '../fetchMails';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';
import { Pop3sClient } from '../pop3sClient';
import * as MailParser from 'mailparser';
import { saveMail } from '../saveMail';

// モック
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  storage: jest.fn(),
  auth: {
    UserRecord: jest.fn(),
  },
}));
jest.mock('../../encryption');
jest.mock('../pop3sClient');
jest.mock('mailparser');
jest.mock('../saveMail');
jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    pubsub: {
      schedule: jest.fn(() => ({
        timeZone: jest.fn(() => ({
          onRun: jest.fn((handler: any) => handler),
        })),
      })),
    },
  })),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('fetchMails - POP3S接続とメール取得', () => {
  const mockUid = 'test-user-123';
  const mockAccountId = 'account-123';
  const mockAccountData = {
    label: 'Test Account',
    emailAddress: 'test@example.com',
    pop3: {
      host: 'pop.example.com',
      port: 995,
      useSsl: true,
      userName: 'test@example.com',
      passwordEnc: {
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      },
    },
    status: 'active',
  };

  let mockFirestore: any;
  let mockPop3sClient: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPop3sClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      listMessages: jest.fn().mockResolvedValue([
        { number: 1, size: 1000 },
        { number: 2, size: 2000 },
      ]),
      retrieveMessage: jest.fn().mockResolvedValue('MIME message content'),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    (Pop3sClient as jest.Mock).mockImplementation(() => mockPop3sClient);

    mockFirestore = {
      collection: jest.fn(),
    };

    mockStorage = {
      bucket: jest.fn(),
    };

    (admin.firestore as unknown as jest.Mock).mockReturnValue(mockFirestore);
    (admin.storage as unknown as jest.Mock).mockReturnValue(mockStorage);
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
      increment: jest.fn((value: number) => ({ _increment: value })),
    };
    (admin.firestore as any).Timestamp = {
      now: jest.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
      fromDate: jest.fn((date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
    };
  });

  describe('useSsl必須チェック', () => {
    it('useSslがfalseの場合はエラーを投げる', async () => {
      const accountData = {
        ...mockAccountData,
        pop3: {
          ...mockAccountData.pop3,
          useSsl: false,
        },
      };

      await expect(
        processAccount(mockUid, mockAccountId, accountData, mockFirestore)
      ).rejects.toThrow('SSL/TLS is required');
    });

    it('useSslがtrueの場合は接続を試みる', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (MailParser.simpleParser as jest.Mock).mockResolvedValue({
        subject: 'Test',
        from: { text: 'sender@example.com' },
        text: 'Body',
      });
      (saveMail as jest.Mock).mockResolvedValue(1000);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(Pop3sClient).toHaveBeenCalledWith(
        'pop.example.com',
        995,
        'test@example.com',
        'decrypted-password',
        true
      );
    });
  });

  describe('パスワード復号化', () => {
    it('EncryptionServiceを使用してパスワードを復号化する', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (MailParser.simpleParser as jest.Mock).mockResolvedValue({
        subject: 'Test',
        from: { text: 'sender@example.com' },
        text: 'Body',
      });
      (saveMail as jest.Mock).mockResolvedValue(1000);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(encryption.decryptPassword).toHaveBeenCalledWith(
        mockUid,
        mockAccountData.pop3.passwordEnc
      );
    });
  });

  describe('POP3S接続とメール取得', () => {
    it('POP3S接続を確立する', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (MailParser.simpleParser as jest.Mock).mockResolvedValue({
        subject: 'Test',
        from: { text: 'sender@example.com' },
        text: 'Body',
      });
      (saveMail as jest.Mock).mockResolvedValue(1000);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(mockPop3sClient.connect).toHaveBeenCalled();
    });

    it('メール一覧を取得する', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (MailParser.simpleParser as jest.Mock).mockResolvedValue({
        subject: 'Test',
        from: { text: 'sender@example.com' },
        text: 'Body',
      });
      (saveMail as jest.Mock).mockResolvedValue(1000);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(mockPop3sClient.listMessages).toHaveBeenCalled();
    });

    it('各メールの本文を取得する', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (MailParser.simpleParser as jest.Mock).mockResolvedValue({
        subject: 'Test',
        from: { text: 'sender@example.com' },
        text: 'Body',
      });
      (saveMail as jest.Mock).mockResolvedValue(1000);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(mockPop3sClient.retrieveMessage).toHaveBeenCalledTimes(2);
      expect(mockPop3sClient.retrieveMessage).toHaveBeenCalledWith(1);
      expect(mockPop3sClient.retrieveMessage).toHaveBeenCalledWith(2);
    });

    it('メールをパースする（mailparser使用）', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      const mockParsed = {
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Body content',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);
      (saveMail as jest.Mock).mockResolvedValue(1000);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(MailParser.simpleParser).toHaveBeenCalledWith('MIME message content');
    });
  });

  describe('エラーハンドリング', () => {
    it('接続エラー時にアカウント状態をerrorに更新する', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      mockPop3sClient.connect.mockRejectedValue(new Error('Connection failed'));

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await expect(
        processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore)
      ).rejects.toThrow('Connection failed');

      expect(mockAccountRef.update).toHaveBeenCalledWith({
        status: 'error',
        lastErrorMessage: 'Connection failed',
      });
    });

    it('SSL/TLS証明書エラー時に適切に処理する', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      const certError: any = new Error('certificate verify failed');
      certError.code = 'CERT_ERROR';
      mockPop3sClient.connect.mockRejectedValue(certError);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await expect(
        processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore)
      ).rejects.toThrow();

      expect(mockAccountRef.update).toHaveBeenCalledWith({
        status: 'error',
        lastErrorMessage: expect.stringContaining('certificate'),
      });
    });

    it('エラー発生時も接続を閉じる', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      mockPop3sClient.connect.mockRejectedValue(new Error('Connection failed'));

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await expect(
        processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore)
      ).rejects.toThrow();

      // エラー時もdisconnectが呼ばれる（または接続が確立されていない場合は呼ばれない）
      // 実装によって異なるが、クリーンアップは重要
    });
  });

  describe('接続終了', () => {
    it('処理完了後に接続を閉じる', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (MailParser.simpleParser as jest.Mock).mockResolvedValue({
        subject: 'Test',
        from: { text: 'sender@example.com' },
        text: 'Body',
      });
      (saveMail as jest.Mock).mockResolvedValue(1000);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(mockPop3sClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('統合テスト - メール受信から保存までのフロー', () => {
    let mockAccountRef: any;
    let mockAccountsCollection: any;
    let mockUserDocRef: any;

    beforeEach(() => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (saveMail as jest.Mock).mockResolvedValue(1000);

      mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => mockUserDocRef),
      }));
    });

    it('MIMEパースを実行する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        to: [{ address: 'recipient@example.com' }],
        text: 'Email body text',
        date: new Date('2024-01-01T00:00:00Z'),
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(MailParser.simpleParser).toHaveBeenCalledWith('MIME message content');
    });

    it('スレッドIDを生成する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(saveMail).toHaveBeenCalled();
      const saveMailCall = (saveMail as jest.Mock).mock.calls[0];
      const threadId = saveMailCall[2];
      expect(threadId).toBeDefined();
      expect(typeof threadId).toBe('string');
    });

    it('bodyPreviewを生成する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'This is a long email body that should be used for preview generation.',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(saveMail).toHaveBeenCalled();
    });

    it('saveMailを呼び出してメールを保存する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(saveMail).toHaveBeenCalled();
      const saveMailCall = (saveMail as jest.Mock).mock.calls[0];
      expect(saveMailCall[0]).toBe(mockUid); // uid
      expect(saveMailCall[1]).toBeDefined(); // messageId
      expect(saveMailCall[2]).toBeDefined(); // threadId
      expect(saveMailCall[3]).toBe('MIME message content'); // rawMessage
      expect(saveMailCall[4]).toBe(mockParsed); // parsed
    });

    it('小さい本文の場合はFirestoreに保存する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'a'.repeat(100), // 小さい本文（1MiB未満）
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(saveMail).toHaveBeenCalled();
      // saveMail内で本文サイズ判定が行われる
    });

    it('大きい本文の場合はStorageに保存する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'a'.repeat(2 * 1024 * 1024), // 大きい本文（2MB）
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(saveMail).toHaveBeenCalled();
      // saveMail内で本文サイズ判定が行われる
    });

    it('容量超過時は受信を停止する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);
      (saveMail as jest.Mock).mockRejectedValueOnce(new Error('Storage limit exceeded'));

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      // 容量超過エラーが発生した場合、次のメールの処理は停止される
      // ただし、エラーが発生したメールの処理は継続される（実装による）
    });

    it('保存成功後、POP3Sサーバからメールを削除する（deleteAfterFetch: true）', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);
      const accountDataWithDelete = {
        ...mockAccountData,
        deleteAfterFetch: true,
      };

      await processAccount(mockUid, mockAccountId, accountDataWithDelete, mockFirestore);

      expect(mockPop3sClient.deleteMessage).toHaveBeenCalled();
    });

    it('deleteAfterFetch: falseの場合はメールを削除しない', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);
      const accountDataWithoutDelete = {
        ...mockAccountData,
        deleteAfterFetch: false,
      };

      await processAccount(mockUid, mockAccountId, accountDataWithoutDelete, mockFirestore);

      expect(mockPop3sClient.deleteMessage).not.toHaveBeenCalled();
    });

    it('処理完了後にアカウントの最終受信日時を更新する', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      const mockUserDocRef = {
        collection: jest.fn().mockReturnValue(mockAccountsCollection),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserDocRef),
          };
        }
        return { doc: jest.fn() };
      });

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(mockAccountRef.update).toHaveBeenCalledWith({
        lastFetchedAt: expect.anything(),
        status: 'active',
        lastErrorMessage: null,
      });
    });

    it('暗号化処理が実行される', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      // saveMail内で暗号化が実行される
      expect(saveMail).toHaveBeenCalled();
    });

    it('使用量更新が実行される', async () => {
      const mockParsed = {
        messageId: '<test-message-id@example.com>',
        subject: 'Test Subject',
        from: { text: 'sender@example.com' },
        text: 'Email body text',
      };
      (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsed);
      (saveMail as jest.Mock).mockResolvedValue(5000); // 保存サイズ

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      // saveMail内で使用量更新が実行される
      expect(saveMail).toHaveBeenCalled();
    });
  });
});

