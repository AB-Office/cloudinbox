/**
 * sendMail - メール送信機能のテスト
 */

/// <reference types="jest" />

import { sendMail } from '../sendMail';
import * as admin from 'firebase-admin';
import { getCloudTasksClient } from '../cloudTasksClient';

// モック
jest.mock('firebase-admin');
jest.mock('../cloudTasksClient');
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

  let mockFirestore: any;
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

    // CloudTasksClientWrapperモック
    mockCloudTasksClient = {
      enqueueSendMailTask: jest.fn().mockResolvedValue({
        taskName: 'tasks/sendmail-123',
        taskId: 'sendmail-1234567890-abc123',
      }),
    };

    (getCloudTasksClient as jest.Mock).mockReturnValue(mockCloudTasksClient);
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
  });

  describe('タスク投入の成功ケース', () => {
    it('基本的なメール送信タスクが投入される', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await sendMail(data, mockContext);

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
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('sendmail-1234567890-abc123');
    });

    it('CCとBCCを含むメール送信タスクが投入される', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await sendMail(data, mockContext);

      expect(mockCloudTasksClient.enqueueSendMailTask).toHaveBeenCalledWith(
        mockUid,
        {
          accountId: mockAccountId,
          to: ['recipient@example.com'],
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
          subject: 'Test Subject',
          body: 'Test Body',
        }
      );
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    it('添付ファイルを含むメール送信タスクが投入される', async () => {
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

      expect(mockCloudTasksClient.enqueueSendMailTask).toHaveBeenCalledWith(
        mockUid,
        {
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
        }
      );
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    it('threadIdとinReplyToMessageIdを含むメール送信タスクが投入される', async () => {
      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Re: Test Subject',
        body: 'Test Body',
        threadId: 'existing-thread-id',
        inReplyToMessageId: 'original-message-id',
      };

      const result = await sendMail(data, mockContext);

      expect(mockCloudTasksClient.enqueueSendMailTask).toHaveBeenCalledWith(
        mockUid,
        {
          accountId: mockAccountId,
          to: ['recipient@example.com'],
          subject: 'Re: Test Subject',
          body: 'Test Body',
          threadId: 'existing-thread-id',
          inReplyToMessageId: 'original-message-id',
        }
      );
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    it('タスク投入に失敗した場合、エラーを投げる', async () => {
      mockCloudTasksClient.enqueueSendMailTask.mockRejectedValue(
        new Error('Task enqueue failed')
      );

      const data = {
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      await expect(sendMail(data, mockContext)).rejects.toThrow('Failed to enqueue send mail task');
    });
  });
});
