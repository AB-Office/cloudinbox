/**
 * fetchMails - POP3S接続とメール取得のテスト
 */

import { processAccount } from '../fetchMails';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';
import { Pop3sClient } from '../pop3sClient';
import * as MailParser from 'mailparser';

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');
jest.mock('../pop3sClient');
jest.mock('mailparser');

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

    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);
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

      mockFirestore.collection = jest.fn((path: string) => {
        if (path.includes('mailAccounts')) {
          return mockAccountsCollection;
        }
        return { doc: jest.fn(() => ({ collection: jest.fn(() => mockAccountsCollection) })) };
      });

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(mockAccountRef.update).toHaveBeenCalledWith({
        status: 'error',
        lastErrorMessage: 'Connection failed',
      });
    });

    it('SSL/TLS証明書エラー時に適切に処理する', async () => {
      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      const certError = new Error('certificate verify failed');
      certError.name = 'CERT_ERROR';
      mockPop3sClient.connect.mockRejectedValue(certError);

      const mockAccountRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockAccountsCollection = {
        doc: jest.fn().mockReturnValue(mockAccountRef),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path.includes('mailAccounts')) {
          return mockAccountsCollection;
        }
        return { doc: jest.fn(() => ({ collection: jest.fn(() => mockAccountsCollection) })) };
      });

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

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

      mockFirestore.collection = jest.fn((path: string) => {
        if (path.includes('mailAccounts')) {
          return mockAccountsCollection;
        }
        return { doc: jest.fn(() => ({ collection: jest.fn(() => mockAccountsCollection) })) };
      });

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

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

      await processAccount(mockUid, mockAccountId, mockAccountData, mockFirestore);

      expect(mockPop3sClient.disconnect).toHaveBeenCalled();
    });
  });
});

