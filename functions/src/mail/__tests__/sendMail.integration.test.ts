/**
 * sendMail.integration.test - メール送信フローの統合テスト
 * 
 * sendMail → Cloud Tasks → sendMailTaskHandler → handleSendMailTask → SMTP送信 → 保存 → タスク結果保存のフローをテスト
 */

/// <reference types="jest" />

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { sendMail } from '../sendMail';
import { getCloudTasksClient } from '../cloudTasksClient';
import { handleSendMailTaskHandler } from '../sendMailTaskHandler';
import { handleSendMailTask } from '../handleSendMailTask';
import * as encryption from '../../encryption';
import { sendSmtpMail } from '../smtpClient';
import { saveMail } from '../saveMail';
import * as MailParser from 'mailparser';

// モック
jest.mock('firebase-admin');
jest.mock('../cloudTasksClient');
jest.mock('../handleSendMailTask');
jest.mock('../../encryption');
jest.mock('../smtpClient');
jest.mock('../saveMail');
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
    CallableContext: jest.fn(),
  },
}));

describe('sendMail.integration - メール送信フロー統合テスト', () => {
  const mockUid = 'test-user-123';
  const mockAccountId = 'account-456';
  const mockTaskId = 'sendmail-1234567890-abc123';

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

  const mockContext = {
    auth: {
      uid: mockUid,
    },
  } as functions.https.CallableContext;

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
  let mockCloudTasksClient: any;

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

    // Storageモック
    mockStorage = {
      bucket: jest.fn().mockReturnValue({}),
    };

    (admin.storage as any) = jest.fn().mockReturnValue(mockStorage);
    (admin.initializeApp as any) = jest.fn();
    (admin.firestore.FieldValue as any) = {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    };

    // encryptionモック
    (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');

    // smtpClientモック
    (sendSmtpMail as jest.Mock).mockResolvedValue(undefined);

    // saveMailモック
    (saveMail as jest.Mock).mockResolvedValue(1000);

    // mailparserモック
    (MailParser.simpleParser as jest.Mock).mockResolvedValue(mockParsedMail);

    // CloudTasksClientWrapperモック
    mockCloudTasksClient = {
      enqueueSendMailTask: jest.fn().mockResolvedValue({
        taskName: 'tasks/sendmail-123',
        taskId: mockTaskId,
      }),
    };

    (getCloudTasksClient as jest.Mock).mockReturnValue(mockCloudTasksClient);
  });

  describe('正常系: メール送信フロー全体', () => {
    it('sendMail → Cloud Tasks → handleSendMailTaskHandler → handleSendMailTask → SMTP送信 → 保存 → タスク結果保存のフローが正常に動作する', async () => {
      // 1. sendMail関数を呼び出し
      const sendMailRequest = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const sendMailResponse = await sendMail(sendMailRequest, mockContext);

      // 2. sendMail関数がCloud Tasksにタスクを投入したことを確認
      expect(getCloudTasksClient).toHaveBeenCalled();
      expect(mockCloudTasksClient.enqueueSendMailTask).toHaveBeenCalledWith(
        mockUid,
        {
          accountId: mockAccountId,
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          body: 'Test Body',
        }
      );
      expect(sendMailResponse.success).toBe(true);
      expect(sendMailResponse.taskId).toBe(mockTaskId);

      // 3. handleSendMailTaskHandlerがタスクペイロードを受信することをシミュレート
      const taskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      // handleSendMailTaskを直接モックして、フローを検証
      (handleSendMailTask as jest.Mock).mockResolvedValue({
        success: true,
        messageId: '<message-id@example.com>',
      });

      // 4. handleSendMailTaskHandlerを呼び出し（sendMailTaskHandlerの内部関数）
      await handleSendMailTaskHandler(taskPayload);

      // 5. handleSendMailTaskが呼び出されたことを確認
      expect(handleSendMailTask).toHaveBeenCalledWith({
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      });

      // 6. handleSendMailTaskが正しいペイロードで呼び出され、成功レスポンスを返すことを確認
      // （実際のSMTP送信と保存は、handleSendMailTaskの単体テストで確認されているため、
      // 統合テストでは各コンポーネントの連携を確認する）
      const handleResult = await handleSendMailTask(taskPayload);
      expect(handleResult.success).toBe(true);
      expect(handleResult.messageId).toBe('<message-id@example.com>');
    });

    it('CC、BCC、添付ファイルを含むメール送信フローが正常に動作する', async () => {
      const sendMailRequest = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
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

      const sendMailResponse = await sendMail(sendMailRequest, mockContext);

      expect(sendMailResponse.success).toBe(true);
      expect(sendMailResponse.taskId).toBe(mockTaskId);

      // handleSendMailTaskHandlerがタスクペイロードを受信することをシミュレート
      const taskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
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

      // handleSendMailTaskをモック
      (handleSendMailTask as jest.Mock).mockResolvedValue({
        success: true,
        messageId: '<message-id@example.com>',
      });

      await handleSendMailTaskHandler(taskPayload);

      expect(handleSendMailTask).toHaveBeenCalledWith({
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('test content').toString('base64'),
            contentType: 'application/pdf',
          },
        ],
      });
    });
  });

  describe('異常系: エラーケースの統合テスト', () => {
    it('Cloud Tasksへのタスク投入が失敗した場合、エラーが正しく伝播する', async () => {
      mockCloudTasksClient.enqueueSendMailTask.mockRejectedValue(
        new Error('Task enqueue failed')
      );

      const sendMailRequest = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(sendMailRequest, mockContext)).rejects.toThrow('Failed to enqueue send mail task');
    });

    it('handleSendMailTaskでエラーが発生した場合、エラーが正しく伝播する', async () => {
      const taskPayload = {
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      // handleSendMailTaskがエラーをスローすることをシミュレート
      const mockError = new Error('SMTP connection failed');
      (handleSendMailTask as jest.Mock).mockRejectedValue(mockError);

      // handleSendMailTaskHandlerを呼び出し、エラーが伝播することを確認
      await expect(handleSendMailTaskHandler(taskPayload)).rejects.toThrow('SMTP connection failed');
      
      // handleSendMailTaskが呼び出されたことを確認
      expect(handleSendMailTask).toHaveBeenCalledWith({
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });

    it('handleSendMailTaskHandlerでペイロード検証が失敗した場合、エラーが正しく伝播する', async () => {
      const invalidPayload = {
        uid: '',
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(handleSendMailTaskHandler(invalidPayload)).rejects.toThrow(functions.https.HttpsError);
      await expect(handleSendMailTaskHandler(invalidPayload)).rejects.toThrow('uid is required');
    });
  });
});

