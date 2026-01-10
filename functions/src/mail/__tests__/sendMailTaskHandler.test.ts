/**
 * sendMailTaskHandler - Cloud Tasksハンドラのテスト
 */

/// <reference types="jest" />

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { handleSendMailTask } from '../handleSendMailTask';
import { handleSendMailTaskHandler } from '../sendMailTaskHandler';

jest.mock('firebase-admin');
jest.mock('../handleSendMailTask');

describe('sendMailTaskHandler - handleSendMailTaskHandler', () => {
  const mockUid = 'test-user-123';
  const mockAccountId = 'account-456';
  const mockTaskId = 'task-789';

  const mockPayload = {
    uid: mockUid,
    taskId: mockTaskId,
    accountId: mockAccountId,
    to: ['recipient@example.com'],
    subject: 'Test Subject',
    body: 'Test Body',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (admin.firestore as unknown as jest.Mock) = jest.fn(() => ({}));
    (admin.initializeApp as any) = jest.fn();
  });

  describe('ペイロード検証', () => {
    it('uidが空の場合はinvalid-argumentエラーを投げる', async () => {
      await expect(
        handleSendMailTaskHandler({
          ...mockPayload,
          uid: '',
        })
      ).rejects.toThrow(functions.https.HttpsError);
    });

    it('accountIdが空の場合はinvalid-argumentエラーを投げる', async () => {
      await expect(
        handleSendMailTaskHandler({
          ...mockPayload,
          accountId: '',
        })
      ).rejects.toThrow(functions.https.HttpsError);
    });

    it('toが空配列の場合はinvalid-argumentエラーを投げる', async () => {
      await expect(
        handleSendMailTaskHandler({
          ...mockPayload,
          to: [],
        })
      ).rejects.toThrow(functions.https.HttpsError);
    });

    it('subjectが空の場合はinvalid-argumentエラーを投げる', async () => {
      await expect(
        handleSendMailTaskHandler({
          ...mockPayload,
          subject: '',
        })
      ).rejects.toThrow(functions.https.HttpsError);
    });

    it('bodyが空の場合はinvalid-argumentエラーを投げる', async () => {
      await expect(
        handleSendMailTaskHandler({
          ...mockPayload,
          body: '',
        })
      ).rejects.toThrow(functions.https.HttpsError);
    });
  });

  describe('正常系', () => {
    it('有効なペイロードの場合はhandleSendMailTaskを呼び出す', async () => {
      const mockResult = {
        success: true,
        messageId: 'message-id-123',
      };

      (handleSendMailTask as jest.Mock).mockResolvedValue(mockResult);

      await handleSendMailTaskHandler(mockPayload);

      expect(handleSendMailTask).toHaveBeenCalledWith({
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      });
      expect(handleSendMailTask).toHaveBeenCalledTimes(1);
    });

    it('cc、bcc、attachments、threadId、inReplyToMessageIdが含まれる場合も処理できる', async () => {
      const extendedPayload = {
        ...mockPayload,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('test').toString('base64'),
            contentType: 'application/pdf',
          },
        ],
        threadId: 'thread-id-123',
        inReplyToMessageId: 'message-id-456',
      };

      (handleSendMailTask as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'message-id-123',
      });

      await handleSendMailTaskHandler(extendedPayload);

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
            content: Buffer.from('test').toString('base64'),
            contentType: 'application/pdf',
          },
        ],
        threadId: 'thread-id-123',
        inReplyToMessageId: 'message-id-456',
      });
    });
  });

  describe('異常系', () => {
    it('handleSendMailTaskがエラーをスローした場合はエラーを再スローする', async () => {
      const mockError = new Error('SMTP connection failed');
      (handleSendMailTask as jest.Mock).mockRejectedValue(mockError);

      await expect(
        handleSendMailTaskHandler(mockPayload)
      ).rejects.toThrow('SMTP connection failed');

      expect(handleSendMailTask).toHaveBeenCalledWith({
        uid: mockUid,
        taskId: mockTaskId,
        accountId: mockAccountId,
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });
  });
});

