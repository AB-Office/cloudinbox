/**
 * handleSendMailTask - メール送信タスク処理のテスト
 */

/// <reference types="jest" />

import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';
import { sendSmtpMail } from '../smtpClient';
import { saveMail } from '../saveMail';
import { generateThreadId } from '../mailProcessing';
import * as MailParser from 'mailparser';
import { handleSendMailTask, SendMailTaskPayload } from '../handleSendMailTask';

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');
jest.mock('../smtpClient');
jest.mock('../saveMail');
jest.mock('../mailProcessing');
jest.mock('mailparser');
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('handleSendMailTask', () => {
  const mockUid = 'test-user-123';
  const mockAccountId = 'account-456';
  const mockTaskId = 'task-789';

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
  let mockTaskResultRef: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Firestoreモック
    const mockAccountRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockAccountData,
      }),
    };

    mockTaskResultRef = {
      set: jest.fn().mockResolvedValue(undefined),
    };

    const mockMailTaskResultsCollection = {
      doc: jest.fn(() => mockTaskResultRef),
    };

    const mockMailAccountsCollection = {
      doc: jest.fn(() => mockAccountRef),
    };

    const mockUserDocRef = {
      collection: jest.fn((collectionName: string) => {
        if (collectionName === 'mailTaskResults') {
          return mockMailTaskResultsCollection;
        }
        if (collectionName === 'mailAccounts') {
          return mockMailAccountsCollection;
        }
        return {
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => mockAccountRef),
            })),
          })),
        };
      }),
    };

    mockFirestore = {
      collection: jest.fn((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: jest.fn(() => mockUserDocRef),
          };
        }
        return {
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => mockAccountRef),
            })),
          })),
        };
      }),
    };

    (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestore);
    (admin.initializeApp as any) = jest.fn();
    (admin.firestore.FieldValue as any) = {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    };

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

  describe('パラメータ検証', () => {
    it('uidが空の場合はエラーを投げる', async () => {
      const payload: SendMailTaskPayload = {
        uid: '',
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow();
    });

    it('accountIdが空の場合はエラーを投げる', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: '',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow();
    });

    it('toが空配列の場合はエラーを投げる', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: [],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow();
    });

    it('subjectが空の場合はエラーを投げる', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: '',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow();
    });

    it('bodyが空の場合はエラーを投げる', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: '',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow();
    });
  });

  describe('アカウント検証', () => {
    it('指定されたアカウントが存在しない場合はエラーを投げる', async () => {
      const mockAccountRef = {
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => mockAccountRef),
          })),
        })),
      }));

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow('Account not found');
    });

    it('SMTP設定が存在しない場合はエラーを投げる', async () => {
      const mockAccountDataWithoutSmtp = {
        email: 'sender@example.com',
      };

      const mockAccountRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockAccountDataWithoutSmtp,
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => mockAccountRef),
          })),
        })),
      }));

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow('SMTP configuration is required');
    });

    it('SMTPパスワードが存在しない場合はエラーを投げる', async () => {
      const mockAccountDataWithoutPassword = {
        email: 'sender@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          useSsl: true,
          userName: 'user@example.com',
        },
      };

      const mockAccountRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockAccountDataWithoutPassword,
        }),
      };

      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => mockAccountRef),
          })),
        })),
      }));

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow('SMTP password not found');
    });
  });

  describe('正常系', () => {
    it('有効なペイロードの場合はメールを送信し、保存する', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await handleSendMailTask(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      // アカウント情報取得が呼ばれたか確認
      expect(mockFirestore.collection).toHaveBeenCalledWith('users');

      // パスワード復号化が呼ばれたか確認
      expect(encryption.decryptPassword).toHaveBeenCalledWith(
        mockUid,
        mockAccountData.smtp.passwordEnc
      );

      // SMTP送信が呼ばれたか確認
      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.objectContaining({
          host: mockAccountData.smtp.host,
          port: mockAccountData.smtp.port,
          useSsl: true,
          userName: mockAccountData.smtp.userName,
          password: 'decrypted-password',
        }),
        'sender@example.com',
        ['recipient@example.com'],
        undefined,
        undefined,
        'Test Subject',
        'Test Body',
        undefined,
        undefined
      );

      // saveMailが呼ばれたか確認
      expect(saveMail).toHaveBeenCalledWith(
        mockUid,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        mockParsedMail,
        mockFirestore,
        mockStorage,
        true // isSentMail = true
      );
    });

    it('cc、bccが指定されている場合は、それらを含めて送信する', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await handleSendMailTask(payload);

      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.any(Object),
        'sender@example.com',
        ['recipient@example.com'],
        ['cc@example.com'],
        ['bcc@example.com'],
        'Test Subject',
        'Test Body',
        undefined,
        undefined
      );
    });

    it('添付ファイルが指定されている場合は、それらを含めて送信する', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('test content').toString('base64'),
            contentType: 'application/pdf',
          },
        ],
      };

      await handleSendMailTask(payload);

      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.any(Object),
        'sender@example.com',
        ['recipient@example.com'],
        undefined,
        undefined,
        'Test Subject',
        'Test Body',
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'test.pdf',
            contentType: 'application/pdf',
          }),
        ]),
        undefined
      );
    });

    it('threadIdが指定されている場合は、そのthreadIdを使用する', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        threadId: 'existing-thread-id',
      };

      await handleSendMailTask(payload);

      // saveMailが既存のthreadIdで呼ばれたか確認
      expect(saveMail).toHaveBeenCalledWith(
        mockUid,
        expect.any(String),
        'existing-thread-id',
        expect.any(String),
        mockParsedMail,
        mockFirestore,
        mockStorage,
        true
      );
    });

    it('inReplyToMessageIdが指定されている場合は、In-Reply-Toヘッダーを追加する', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        inReplyToMessageId: 'original-message-id',
      };

      await handleSendMailTask(payload);

      expect(sendSmtpMail).toHaveBeenCalledWith(
        expect.any(Object),
        'sender@example.com',
        ['recipient@example.com'],
        undefined,
        undefined,
        'Test Subject',
        'Test Body',
        undefined,
        expect.objectContaining({
          'In-Reply-To': expect.stringContaining('original-message-id'),
          'References': expect.stringContaining('original-message-id'),
        })
      );
    });
  });

  describe('タスク結果のFirestore保存', () => {
    beforeEach(() => {
      // タスク結果用のモックを再設定
      mockTaskResultRef = {
        set: jest.fn().mockResolvedValue(undefined),
      };

      const mockMailTaskResultsCollection = {
        doc: jest.fn(() => mockTaskResultRef),
      };

      const mockMailAccountsCollection = {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockAccountData,
          }),
        })),
      };

      const mockUserDocRef = {
        collection: jest.fn((collectionName: string) => {
          if (collectionName === 'mailTaskResults') {
            return mockMailTaskResultsCollection;
          }
          if (collectionName === 'mailAccounts') {
            return mockMailAccountsCollection;
          }
          return {
            doc: jest.fn(() => ({
              collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                  get: jest.fn().mockResolvedValue({
                    exists: true,
                    data: () => mockAccountData,
                  }),
                })),
              })),
            })),
          };
        }),
      };

      mockFirestore.collection = jest.fn((collectionName: string) => {
        if (collectionName === 'users') {
          return {
            doc: jest.fn(() => mockUserDocRef),
          };
        }
        return {
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => mockAccountData,
                }),
              })),
            })),
          })),
        };
      });
    });

    it('メール送信成功時、タスク結果をFirestoreに保存する', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await handleSendMailTask(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      // タスク結果がFirestoreに保存されたか確認
      expect(mockTaskResultRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          messageId: expect.any(String),
          taskId: mockTaskId,
          accountId: mockAccountId,
          subject: 'Test Subject',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
        { merge: false }
      );
    });

    it('メール送信失敗時、タスク結果をFirestoreに保存する', async () => {
      const smtpError = new Error('SMTP connection failed');
      (sendSmtpMail as jest.Mock).mockRejectedValue(smtpError);

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow('SMTP connection failed');

      // タスク結果がFirestoreに保存されたか確認
      expect(mockTaskResultRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorMessage: expect.stringContaining('SMTP connection failed'),
          taskId: mockTaskId,
          accountId: mockAccountId,
          subject: 'Test Subject',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
        { merge: false }
      );
    });

    it('タスク結果保存が失敗しても、メール送信処理のエラーとは扱わない（成功時）', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      // タスク結果保存を失敗させる
      const saveTaskResultError = new Error('Failed to save task result');
      mockTaskResultRef.set.mockRejectedValue(saveTaskResultError);

      // メール送信は成功しているので、エラーをスローしない
      const result = await handleSendMailTask(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      // タスク結果保存のエラーはログ出力されるが、メール送信処理のエラーとは扱わない
      expect(mockTaskResultRef.set).toHaveBeenCalled();
    });

    it('タスク結果保存が失敗しても、メール送信処理のエラーとは扱わない（失敗時）', async () => {
      const smtpError = new Error('SMTP connection failed');
      (sendSmtpMail as jest.Mock).mockRejectedValue(smtpError);

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      // タスク結果保存を失敗させる
      const saveTaskResultError = new Error('Failed to save task result');
      mockTaskResultRef.set.mockRejectedValue(saveTaskResultError);

      // メール送信失敗のエラーはスローされる（タスク結果保存失敗は影響しない）
      await expect(handleSendMailTask(payload)).rejects.toThrow('SMTP connection failed');

      // タスク結果保存のエラーはログ出力されるが、メール送信処理のエラーとは扱わない
      expect(mockTaskResultRef.set).toHaveBeenCalled();
    });

    it('taskIdが指定されていない場合、タスク結果は保存しない', async () => {
      const payload: SendMailTaskPayload = {
        uid: mockUid,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await handleSendMailTask(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      // タスク結果は保存されない（taskIdがないため）
      expect(mockTaskResultRef.set).not.toHaveBeenCalled();
    });
  });

  describe('異常系', () => {
    it('SMTP送信が失敗した場合はエラーをスローする', async () => {
      const smtpError = new Error('SMTP connection failed');
      (sendSmtpMail as jest.Mock).mockRejectedValue(smtpError);

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow('SMTP connection failed');
    });

    it('パスワード復号化が失敗した場合はエラーをスローする', async () => {
      const decryptError = new Error('Decryption failed');
      (encryption.decryptPassword as jest.Mock).mockRejectedValue(decryptError);

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow('Decryption failed');
    });

    it('送信済みメールの保存が失敗した場合はエラーをスローする', async () => {
      const saveError = new Error('Save failed');
      (saveMail as jest.Mock).mockRejectedValue(saveError);

      const payload: SendMailTaskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTask(payload)).rejects.toThrow('Save failed');
    });
  });
});

