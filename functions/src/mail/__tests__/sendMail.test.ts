/**
 * sendMail - メール送信機能のテスト
 */

/// <reference types="jest" />

import { sendMail } from '../sendMail';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';
import { sendSmtpMail } from '../smtpClient';
import { saveMail } from '../saveMail';
import { generateThreadId } from '../mailProcessing';
import * as MailParser from 'mailparser';
// mailbuildは使用していないため、モックは不要
// import mailbuild = require('mailbuild');

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');
jest.mock('../smtpClient');
jest.mock('../saveMail');
jest.mock('../mailProcessing');
jest.mock('mailparser');
jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    runWith: jest.fn(() => ({
      https: {
        onCall: jest.fn((handler: any) => handler),
      },
    })),
  })),
  logger: {
    info: jest.fn(),
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

import * as functions from 'firebase-functions';

describe('sendMail', () => {
  const mockUid = 'test-user-123';
  const mockAccountId = 'account-456';
  const mockContext = {
    auth: {
      uid: mockUid,
    },
  } as functions.https.CallableContext;

  const mockAccountData = {
    email: 'sender@example.com',
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      useSsl: true,
      userName: 'user@example.com',
      passwordEnc: {
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      },
    },
  };

  const mockSmtpConfig = {
    host: 'smtp.example.com',
    port: 587,
    useSsl: true,
    userName: 'user@example.com',
    password: 'decrypted-password',
  };

  const mockParsedMail = {
    messageId: '<message-id@example.com>',
    subject: 'Test Subject',
    from: { text: 'sender@example.com' },
    to: [{ address: 'recipient@example.com' }],
    text: 'Test Body',
    html: false,
    attachments: [],
    date: new Date('2024-01-01T00:00:00Z'),
    headers: new Map(),
    headerLines: [],
  } as unknown as MailParser.ParsedMail;

  let mockFirestore: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Firestoreモック
    const mockAccountRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockAccountData,
      }),
    };

    mockFirestore = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => mockAccountRef),
          })),
        })),
      })),
    };

    (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestore);

    // Storageモック
    mockStorage = {
      bucket: jest.fn().mockReturnValue({}),
    };

    (admin.storage as any) = jest.fn().mockReturnValue(mockStorage);

    // encryptionモック
    (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');

    // smtpClientモック
    (sendSmtpMail as jest.Mock).mockResolvedValue(undefined);

    // saveMailモック
    (saveMail as jest.Mock).mockResolvedValue(1000);

    // mailProcessingモック
    (generateThreadId as jest.Mock).mockReturnValue('generated-thread-id');

    // mailparserモック
    (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsedMail);
  });

  describe('認証チェック', () => {
    it('認証されていない場合はエラーを投げる', async () => {
      const unauthenticatedContext = {
        auth: undefined,
      } as functions.https.CallableContext;

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, unauthenticatedContext)).rejects.toThrow(
        'User must be authenticated'
      );
    });
  });

  describe('パラメータ検証', () => {
    it('accountIdが不足している場合、エラーを投げる', async () => {
      const data = {
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      } as any;

      await expect(sendMail(data, mockContext)).rejects.toThrow('accountId is required');
    });

    it('toが不足している場合、エラーを投げる', async () => {
      const data = {
        accountId: mockAccountId,
        subject: 'Test Subject',
        body: 'Test Body',
      } as any;

      await expect(sendMail(data, mockContext)).rejects.toThrow(
        'to is required and must be a non-empty array'
      );
    });

    it('toが空配列の場合、エラーを投げる', async () => {
      const data = {
        accountId: mockAccountId,
        to: [],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow(
        'to is required and must be a non-empty array'
      );
    });

    it('subjectが不足している場合、エラーを投げる', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        body: 'Test Body',
      } as any;

      await expect(sendMail(data, mockContext)).rejects.toThrow('subject is required');
    });

    it('bodyが不足している場合、エラーを投げる', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
      } as any;

      await expect(sendMail(data, mockContext)).rejects.toThrow('body is required');
    });

    it('無効なメールアドレス（to）の場合、エラーを投げる', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['invalid-email'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Invalid email address: invalid-email');
    });

    it('無効なメールアドレス（cc）の場合、エラーを投げる', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['invalid-email'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Invalid email address: invalid-email');
    });

    it('無効なメールアドレス（bcc）の場合、エラーを投げる', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        bcc: ['invalid-email'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Invalid email address: invalid-email');
    });
  });

  describe('アカウント取得', () => {
    it('アカウントが存在しない場合、エラーを投げる', async () => {
      const mockAccountRefNotExist = {
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
      };

      const mockFirestoreNotExist = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => mockAccountRefNotExist),
            })),
          })),
        })),
      };

      (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestoreNotExist);

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Account not found');
    });

    it('SMTP設定が存在しない場合、エラーを投げる', async () => {
      const mockAccountRefNoSmtp = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            email: 'sender@example.com',
            // smtpが存在しない
          }),
        }),
      };

      const mockFirestoreNoSmtp = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => mockAccountRefNoSmtp),
            })),
          })),
        })),
      };

      (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestoreNoSmtp);

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow(
        'SMTP configuration is required for sending mail'
      );
    });

    it('SMTPパスワードが存在しない場合、エラーを投げる', async () => {
      const mockAccountRefNoPassword = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            email: 'sender@example.com',
            smtp: {
              host: 'smtp.example.com',
              port: 587,
              useSsl: true,
              userName: 'user@example.com',
              // passwordEncが存在しない
            },
          }),
        }),
      };

      const mockFirestoreNoPassword = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => mockAccountRefNoPassword),
            })),
          })),
        })),
      };

      (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestoreNoPassword);

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('SMTP password not found in account');
    });
  });

  describe('メール送信の成功ケース', () => {
    it('基本的なメール送信が成功する', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await sendMail(data, mockContext);

      expect(encryption.decryptPassword).toHaveBeenCalledWith(mockUid, mockAccountData.smtp.passwordEnc);
      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.objectContaining({
          host: mockSmtpConfig.host,
          port: mockSmtpConfig.port,
          useSsl: mockSmtpConfig.useSsl,
          userName: mockSmtpConfig.userName,
          password: 'decrypted-password',
        }),
        mockAccountData.email,
        data.to,
        undefined,
        undefined,
        data.subject,
        data.body,
        undefined,
        undefined // headers parameter
      );
      expect(saveMail).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('CCとBCCを含むメール送信が成功する', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await sendMail(data, mockContext);

      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.anything(),
        mockAccountData.email,
        data.to,
        data.cc,
        data.bcc,
        data.subject,
        data.body,
        undefined,
        undefined // headers parameter
      );
      expect(result.success).toBe(true);
    });

    it('添付ファイルを含むメール送信が成功する', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        attachments: [
          {
            filename: 'test.txt',
            content: Buffer.from('test content').toString('base64'),
            contentType: 'text/plain',
          },
        ],
      };

      const result = await sendMail(data, mockContext);

      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.anything(),
        mockAccountData.email,
        data.to,
        undefined,
        undefined,
        data.subject,
        data.body,
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'test.txt',
            content: Buffer.from('test content'),
            contentType: 'text/plain',
          }),
        ]),
        undefined // headers parameter
      );
      expect(result.success).toBe(true);
    });

    it('threadIdが提供された場合、そのthreadIdを使用する', async () => {
      const threadId = 'existing-thread-id';
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        threadId,
      };

      const result = await sendMail(data, mockContext);

      expect(generateThreadId).not.toHaveBeenCalled();
      expect(saveMail).toHaveBeenCalledWith(
        mockUid,
        expect.anything(),
        threadId,
        expect.anything(),
        expect.anything(),
        mockFirestore,
        mockStorage,
        true
      );
      expect(result.success).toBe(true);
    });

    it('threadIdが提供されていない場合、generateThreadIdを使用する', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await sendMail(data, mockContext);

      expect(generateThreadId).toHaveBeenCalledWith(mockParsedMail);
      expect(saveMail).toHaveBeenCalledWith(
        mockUid,
        expect.anything(),
        'generated-thread-id',
        expect.anything(),
        expect.anything(),
        mockFirestore,
        mockStorage,
        true
      );
      expect(result.success).toBe(true);
    });

    it('送信済みメールはisSentMail=trueで保存される', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await sendMail(data, mockContext);

      expect(saveMail).toHaveBeenCalledWith(
        mockUid,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        mockFirestore,
        mockStorage,
        true // isSentMail=true
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('パスワード復号化に失敗した場合、エラーを投げる', async () => {
      (encryption.decryptPassword as jest.Mock).mockRejectedValue(new Error('Decryption failed'));

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Failed to decrypt SMTP password');
    });

    it('SMTP送信に失敗した場合、エラーを投げる', async () => {
      (sendSmtpMail as jest.Mock).mockRejectedValue(new Error('SMTP connection failed'));

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Failed to send mail');
    });

    it('その他のエラーが発生した場合、エラーを投げる', async () => {
      (MailParser.simpleParser as jest.Mock).mockRejectedValue(new Error('Parsing failed'));

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Failed to send mail');
    });
  });

  describe('MIMEメール構築', () => {
    it('手動でMIMEメールを構築してmailparserで解析する', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await sendMail(data, mockContext);

      // MailParser.simpleParserが呼ばれていることを確認
      expect(MailParser.simpleParser).toHaveBeenCalled();
      const mimeMessage = (MailParser.simpleParser as jest.Mock).mock.calls[0][0];
      expect(mimeMessage).toBeTruthy();
      expect(typeof mimeMessage).toBe('string');
      // MIMEメッセージに基本的なヘッダーが含まれていることを確認
      expect(mimeMessage).toContain('From:');
      expect(mimeMessage).toContain('To:');
      expect(mimeMessage).toContain('Subject:');
      expect(mimeMessage).toContain('Test Body');
    });

    it('CCがある場合、MIMEメッセージにCcヘッダーが含まれる', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await sendMail(data, mockContext);

      // MailParser.simpleParserが呼ばれていることを確認
      expect(MailParser.simpleParser).toHaveBeenCalled();
      const mimeMessage = (MailParser.simpleParser as jest.Mock).mock.calls[0][0];
      expect(mimeMessage).toContain('Cc: cc@example.com');
    });

    it('BCCがある場合、MIMEメッセージは構築される（BCCはヘッダーに含まれない）', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await sendMail(data, mockContext);

      // MailParser.simpleParserが呼ばれていることを確認
      expect(MailParser.simpleParser).toHaveBeenCalled();
      const mimeMessage = (MailParser.simpleParser as jest.Mock).mock.calls[0][0];
      expect(mimeMessage).toBeTruthy();
      // BCCはMIMEヘッダーには含まれない（RFC 2822準拠）
      expect(mimeMessage).not.toContain('Bcc:');
    });

    it('inReplyToMessageIdが指定された場合、In-Reply-Toヘッダーが追加される', async () => {
      const originalMessageId = 'original-message-id-123@example.com';
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Re: Test Subject',
        body: 'Test Body',
        inReplyToMessageId: originalMessageId,
      };

      await sendMail(data, mockContext);

      // MailParser.simpleParserが呼ばれていることを確認
      expect(MailParser.simpleParser).toHaveBeenCalled();
      const mimeMessage = (MailParser.simpleParser as jest.Mock).mock.calls[0][0];
      expect(mimeMessage).toContain(`In-Reply-To: <${originalMessageId}>`);
    });

    it('inReplyToMessageIdが指定されていない場合、In-Reply-Toヘッダーが含まれない', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await sendMail(data, mockContext);

      // MailParser.simpleParserが呼ばれていることを確認
      expect(MailParser.simpleParser).toHaveBeenCalled();
      const mimeMessage = (MailParser.simpleParser as jest.Mock).mock.calls[0][0];
      expect(mimeMessage).not.toContain('In-Reply-To:');
    });

    it('添付ファイルがある場合、マルチパートMIMEメッセージが構築される', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        attachments: [
          {
            filename: 'test.txt',
            content: Buffer.from('test content').toString('base64'),
            contentType: 'text/plain',
          },
        ],
      };

      await sendMail(data, mockContext);

      // MailParser.simpleParserが呼ばれていることを確認
      expect(MailParser.simpleParser).toHaveBeenCalled();
      const mimeMessage = (MailParser.simpleParser as jest.Mock).mock.calls[0][0];
      expect(mimeMessage).toContain('multipart/mixed');
      expect(mimeMessage).toContain('Content-Disposition: attachment');
      expect(mimeMessage).toContain('filename=');
    });
  });
});

