/**
 * smtpClient - SMTP接続・メール送信のテスト
 */

/// <reference types="jest" />

import { testSmtpConnection, sendSmtpMail, SmtpConfig } from '../smtpClient';
import nodemailer from 'nodemailer';

// nodemailerのモック
jest.mock('nodemailer');
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('smtpClient', () => {
  const mockHost = 'smtp.example.com';
  const mockPort = 587;
  const mockUserName = 'user@example.com';
  const mockPassword = 'password123';
  const mockFrom = 'from@example.com';
  const mockTo = ['to@example.com'];
  const mockSubject = 'Test Subject';
  const mockBody = 'Test Body';

  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // モックトランスポートオブジェクトを作成
    mockTransporter = {
      verify: jest.fn(),
      sendMail: jest.fn(),
      close: jest.fn(),
    };

    // nodemailer.createTransportをモック
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
  });

  describe('testSmtpConnection', () => {
    it('SMTP接続テストが成功する', async () => {
      mockTransporter.verify.mockResolvedValue(undefined);

      const result = await testSmtpConnection(
        mockHost,
        mockPort,
        true, // useSsl = true
        mockUserName,
        mockPassword
      );

      expect(result.success).toBe(true);
      expect(result.errorMessage).toBeUndefined();
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: mockHost,
          port: mockPort,
          secure: false, // ポート587の場合はsecure: false（starttlsを使用）
          auth: {
            user: mockUserName,
            pass: mockPassword,
          },
          tls: {
            rejectUnauthorized: true,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
        })
      );
      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(mockTransporter.close).toHaveBeenCalled();
    });

    it('ポート465の場合はsecure: trueになる', async () => {
      mockTransporter.verify.mockResolvedValue(undefined);

      await testSmtpConnection(
        mockHost,
        465,
        true, // useSsl = true
        mockUserName,
        mockPassword
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true, // ポート465の場合はsecure: true
        })
      );
    });

    it('useSslがfalseの場合はエラーを返す', async () => {
      const result = await testSmtpConnection(
        mockHost,
        mockPort,
        false, // useSsl = false
        mockUserName,
        mockPassword
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('SSL/TLS is required for SMTP connections');
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('認証エラー時に適切なエラーメッセージを返す', async () => {
      const authError = new Error('Invalid credentials');
      (authError as any).code = 'EAUTH';
      mockTransporter.verify.mockRejectedValue(authError);

      const result = await testSmtpConnection(
        mockHost,
        mockPort,
        true,
        mockUserName,
        mockPassword
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Authentication failed');
      expect(mockTransporter.close).not.toHaveBeenCalled();
    });

    it('接続タイムアウトエラー時に適切なエラーメッセージを返す', async () => {
      const timeoutError = new Error('Connection timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockTransporter.verify.mockRejectedValue(timeoutError);

      const result = await testSmtpConnection(
        mockHost,
        mockPort,
        true,
        mockUserName,
        mockPassword
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Cannot connect to SMTP server');
      expect(mockTransporter.close).not.toHaveBeenCalled();
    });

    it('接続拒否エラー時に適切なエラーメッセージを返す', async () => {
      const connectionError = new Error('Connection refused');
      (connectionError as any).code = 'ECONNREFUSED';
      mockTransporter.verify.mockRejectedValue(connectionError);

      const result = await testSmtpConnection(
        mockHost,
        mockPort,
        true,
        mockUserName,
        mockPassword
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Cannot connect to SMTP server');
    });

    it('その他のエラー時にエラーメッセージを返す', async () => {
      const genericError = new Error('Generic error message');
      mockTransporter.verify.mockRejectedValue(genericError);

      const result = await testSmtpConnection(
        mockHost,
        mockPort,
        true,
        mockUserName,
        mockPassword
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Generic error message');
    });

    it('エラーメッセージがない場合はデフォルトメッセージを返す', async () => {
      const errorWithoutMessage = { code: 'UNKNOWN' };
      mockTransporter.verify.mockRejectedValue(errorWithoutMessage);

      const result = await testSmtpConnection(
        mockHost,
        mockPort,
        true,
        mockUserName,
        mockPassword
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Connection or authentication failed');
    });
  });

  describe('sendSmtpMail', () => {
    const mockConfig: SmtpConfig = {
      host: mockHost,
      port: mockPort,
      useSsl: true,
      userName: mockUserName,
      password: mockPassword,
    };

    it('メール送信が成功する', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test-message-id>',
      });

      await sendSmtpMail(
        mockConfig,
        mockFrom,
        mockTo,
        undefined, // cc
        undefined, // bcc
        mockSubject,
        mockBody
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: mockHost,
          port: mockPort,
          secure: false,
          auth: {
            user: mockUserName,
            pass: mockPassword,
          },
          tls: {
            rejectUnauthorized: true,
          },
          connectionTimeout: 30000,
          greetingTimeout: 30000,
        })
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: mockFrom,
          to: mockTo.join(', '),
          subject: mockSubject,
          text: mockBody,
        })
      );
      expect(mockTransporter.close).toHaveBeenCalled();
    });

    it('ポート465の場合はsecure: trueになる', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test-message-id>',
      });

      const config465: SmtpConfig = {
        ...mockConfig,
        port: 465,
      };

      await sendSmtpMail(
        config465,
        mockFrom,
        mockTo,
        undefined,
        undefined,
        mockSubject,
        mockBody
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true, // ポート465の場合はsecure: true
        })
      );
    });

    it('CCとBCCを含むメール送信が成功する', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test-message-id>',
      });

      const cc = ['cc1@example.com', 'cc2@example.com'];
      const bcc = ['bcc1@example.com'];

      await sendSmtpMail(
        mockConfig,
        mockFrom,
        mockTo,
        cc,
        bcc,
        mockSubject,
        mockBody
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: cc.join(', '),
          bcc: bcc.join(', '),
        })
      );
    });

    it('添付ファイルを含むメール送信が成功する', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test-message-id>',
      });

      const attachments = [
        {
          filename: 'test.txt',
          content: Buffer.from('test content'),
          contentType: 'text/plain',
        },
      ];

      await sendSmtpMail(
        mockConfig,
        mockFrom,
        mockTo,
        undefined,
        undefined,
        mockSubject,
        mockBody,
        attachments
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'test.txt',
              content: Buffer.from('test content'),
              contentType: 'text/plain',
            },
          ],
        })
      );
    });

    it('useSslがfalseの場合はエラーを投げる', async () => {
      const configWithoutSsl: SmtpConfig = {
        ...mockConfig,
        useSsl: false,
      };

      await expect(
        sendSmtpMail(
          configWithoutSsl,
          mockFrom,
          mockTo,
          undefined,
          undefined,
          mockSubject,
          mockBody
        )
      ).rejects.toThrow('SSL/TLS is required for SMTP connections');

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('認証エラー時にエラーを投げる', async () => {
      const authError = new Error('Invalid credentials');
      (authError as any).code = 'EAUTH';
      mockTransporter.sendMail.mockRejectedValue(authError);

      await expect(
        sendSmtpMail(
          mockConfig,
          mockFrom,
          mockTo,
          undefined,
          undefined,
          mockSubject,
          mockBody
        )
      ).rejects.toThrow('Authentication failed');

      expect(mockTransporter.close).not.toHaveBeenCalled();
    });

    it('接続タイムアウトエラー時にエラーを投げる', async () => {
      const timeoutError = new Error('Connection timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockTransporter.sendMail.mockRejectedValue(timeoutError);

      await expect(
        sendSmtpMail(
          mockConfig,
          mockFrom,
          mockTo,
          undefined,
          undefined,
          mockSubject,
          mockBody
        )
      ).rejects.toThrow('Cannot connect to SMTP server');
    });

    it('接続拒否エラー時にエラーを投げる', async () => {
      const connectionError = new Error('Connection refused');
      (connectionError as any).code = 'ECONNREFUSED';
      mockTransporter.sendMail.mockRejectedValue(connectionError);

      await expect(
        sendSmtpMail(
          mockConfig,
          mockFrom,
          mockTo,
          undefined,
          undefined,
          mockSubject,
          mockBody
        )
      ).rejects.toThrow('Cannot connect to SMTP server');
    });

    it('メール配信エラー（550）時にエラーを投げる', async () => {
      const deliveryError = new Error('Mailbox unavailable');
      (deliveryError as any).responseCode = 550;
      (deliveryError as any).response = '5.1.1 Mailbox unavailable';
      mockTransporter.sendMail.mockRejectedValue(deliveryError);

      await expect(
        sendSmtpMail(
          mockConfig,
          mockFrom,
          mockTo,
          undefined,
          undefined,
          mockSubject,
          mockBody
        )
      ).rejects.toThrow('Mail delivery failed');
    });

    it('その他のエラー時にエラーを投げる', async () => {
      const genericError = new Error('Generic error message');
      mockTransporter.sendMail.mockRejectedValue(genericError);

      await expect(
        sendSmtpMail(
          mockConfig,
          mockFrom,
          mockTo,
          undefined,
          undefined,
          mockSubject,
          mockBody
        )
      ).rejects.toThrow('Generic error message');
    });

    it('件名と本文が空の場合も送信できる', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test-message-id>',
      });

      await sendSmtpMail(
        mockConfig,
        mockFrom,
        mockTo,
        undefined,
        undefined,
        undefined, // subject
        undefined // body
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '',
          text: '',
        })
      );
    });
  });
});

