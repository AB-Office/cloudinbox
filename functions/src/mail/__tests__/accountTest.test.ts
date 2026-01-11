/**
 * accountTest - POP3S接続テストのテスト
 */

import { accountTest } from '../accountTest';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');
jest.mock('firebase-functions/v2/https', () => ({
  onCall: jest.fn((options: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, public message: string) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));
jest.mock('../pop3Client', () => ({
  testPop3Connection: jest.fn(),
}));
jest.mock('../smtpClient', () => ({
  testSmtpConnection: jest.fn(),
}));

import { testPop3Connection } from '../pop3Client';
import { testSmtpConnection } from '../smtpClient';

describe('accountTest', () => {
  const mockUid = 'test-user-123';
  
  // Gen2のCallableRequest形式のモック
  const createMockRequest = (data: any) => ({
    data,
    auth: {
      uid: mockUid,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('アカウント作成前の接続テスト', () => {
    it('POP3プロトコルでuseSslがtrueの場合、接続テストを実行する', async () => {
      (testPop3Connection as jest.Mock).mockResolvedValue({ success: true });

      const data = {
        protocol: 'pop3' as const,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({ success: true });
      expect(testPop3Connection).toHaveBeenCalledWith(
        'pop.example.com',
        995,
        true,
        'user@example.com',
        'plaintext-password'
      );
      expect(testSmtpConnection).not.toHaveBeenCalled();
    });

    it('SMTPプロトコルでuseSslがtrueの場合、接続テストを実行する', async () => {
      (testSmtpConnection as jest.Mock).mockResolvedValue({ success: true });

      const data = {
        protocol: 'smtp' as const,
        host: 'smtp.example.com',
        port: 587,
        useSsl: true,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({ success: true });
      expect(testSmtpConnection).toHaveBeenCalledWith(
        'smtp.example.com',
        587,
        true,
        'user@example.com',
        'plaintext-password'
      );
      expect(testPop3Connection).not.toHaveBeenCalled();
    });

    it('POP3プロトコルでuseSslがfalseの場合、エラーを返す', async () => {
      const data = {
        protocol: 'pop3' as const,
        host: 'pop.example.com',
        port: 110,
        useSsl: false,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'SSL/TLS is required for POP3 connections',
      });
      expect(testPop3Connection).not.toHaveBeenCalled();
      expect(testSmtpConnection).not.toHaveBeenCalled();
    });

    it('SMTPプロトコルでuseSslがfalseの場合、エラーを返す', async () => {
      const data = {
        protocol: 'smtp' as const,
        host: 'smtp.example.com',
        port: 25,
        useSsl: false,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'SSL/TLS is required for SMTP connections',
      });
      expect(testSmtpConnection).not.toHaveBeenCalled();
      expect(testPop3Connection).not.toHaveBeenCalled();
    });

    it('POP3接続テストが成功した場合、success: trueを返す', async () => {
      (testPop3Connection as jest.Mock).mockResolvedValue({ success: true });

      const data = {
        protocol: 'pop3' as const,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({ success: true });
    });

    it('SMTP接続テストが成功した場合、success: trueを返す', async () => {
      (testSmtpConnection as jest.Mock).mockResolvedValue({ success: true });

      const data = {
        protocol: 'smtp' as const,
        host: 'smtp.example.com',
        port: 587,
        useSsl: true,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({ success: true });
    });

    it('POP3接続テストが失敗した場合、success: falseとエラーメッセージを返す', async () => {
      (testPop3Connection as jest.Mock).mockResolvedValue({
        success: false,
        errorMessage: 'Authentication failed',
      });

      const data = {
        protocol: 'pop3' as const,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'wrong-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Authentication failed',
      });
    });

    it('SMTP接続テストが失敗した場合、success: falseとエラーメッセージを返す', async () => {
      (testSmtpConnection as jest.Mock).mockResolvedValue({
        success: false,
        errorMessage: 'Authentication failed',
      });

      const data = {
        protocol: 'smtp' as const,
        host: 'smtp.example.com',
        port: 587,
        useSsl: true,
        userName: 'user@example.com',
        password: 'wrong-password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Authentication failed',
      });
    });
  });

  describe('既存アカウントの接続テスト', () => {
    it('POP3プロトコルでaccountIdが提供された場合、暗号化パスワードを復号化して接続テストを実行する', async () => {
      const mockAccountId = 'account-123';
      const mockPasswordEnc = {
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      };

      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (testPop3Connection as jest.Mock).mockResolvedValue({ success: true });

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    pop3: {
                      passwordEnc: mockPasswordEnc,
                    },
                  }),
                }),
              })),
            })),
          })),
        })),
      };

      (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);

      const data = {
        protocol: 'pop3' as const,
        accountId: mockAccountId,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(encryption.decryptPassword).toHaveBeenCalledWith(mockUid, mockPasswordEnc);
      expect(testPop3Connection).toHaveBeenCalledWith(
        'pop.example.com',
        995,
        true,
        'user@example.com',
        'decrypted-password'
      );
      expect(testSmtpConnection).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('SMTPプロトコルでaccountIdが提供された場合、暗号化パスワードを復号化して接続テストを実行する', async () => {
      const mockAccountId = 'account-123';
      const mockPasswordEnc = {
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      };

      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (testSmtpConnection as jest.Mock).mockResolvedValue({ success: true });

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    smtp: {
                      passwordEnc: mockPasswordEnc,
                    },
                  }),
                }),
              })),
            })),
          })),
        })),
      };

      (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);

      const data = {
        protocol: 'smtp' as const,
        accountId: mockAccountId,
        host: 'smtp.example.com',
        port: 587,
        useSsl: true,
        userName: 'user@example.com',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(encryption.decryptPassword).toHaveBeenCalledWith(mockUid, mockPasswordEnc);
      expect(testSmtpConnection).toHaveBeenCalledWith(
        'smtp.example.com',
        587,
        true,
        'user@example.com',
        'decrypted-password'
      );
      expect(testPop3Connection).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('SMTPプロトコルで既存アカウントのパスワードが見つからない場合、エラーを返す', async () => {
      const mockAccountId = 'account-123';

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    // smtpフィールドが存在しない、またはpasswordEncがない
                  }),
                }),
              })),
            })),
          })),
        })),
      };

      (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);

      const data = {
        protocol: 'smtp' as const,
        accountId: mockAccountId,
        host: 'smtp.example.com',
        port: 587,
        useSsl: true,
        userName: 'user@example.com',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'SMTP password not found in account',
      });
      expect(testSmtpConnection).not.toHaveBeenCalled();
    });

    it('アカウントが存在しない場合、エラーを返す', async () => {
      const mockAccountId = 'non-existent-account';

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: false,
                }),
              })),
            })),
          })),
        })),
      };

      (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);

      const data = {
        protocol: 'pop3' as const,
        accountId: mockAccountId,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Account not found',
      });
    });
  });

  describe('認証チェック', () => {
    it('認証されていない場合はエラーを投げる', async () => {
      const data = {
        protocol: 'pop3' as const,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'password',
      };

      const unauthenticatedRequest = { data, auth: undefined };
      await expect(accountTest(unauthenticatedRequest)).rejects.toThrow();
    });
  });

  describe('パラメータ検証', () => {
    it('protocolパラメータが不足している場合、エラーを返す', async () => {
      const data = {
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'password',
        // protocolが不足
      } as any;

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Missing or invalid parameters: protocol, host, port, useSsl, userName',
      });
    });

    it('無効なprotocolパラメータの場合、エラーを返す', async () => {
      const data = {
        protocol: 'invalid' as any,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'password',
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Missing or invalid parameters: protocol, host, port, useSsl, userName',
      });
    });

    it('必須パラメータが不足している場合、エラーを返す', async () => {
      const data = {
        protocol: 'pop3' as const,
        host: 'pop.example.com',
        // port, useSsl, userName, passwordが不足
      } as any;

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Missing or invalid parameters: protocol, host, port, useSsl, userName',
      });
    });

    it('既存アカウントでパスワードが提供されていない場合、アカウントからパスワードを取得する', async () => {
      const mockAccountId = 'account-123';
      const mockPasswordEnc = {
        ciphertext: 'encrypted',
        nonce: 'nonce',
        tag: 'tag',
      };

      (encryption.decryptPassword as jest.Mock).mockResolvedValue('decrypted-password');
      (testPop3Connection as jest.Mock).mockResolvedValue({ success: true });

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    pop3: {
                      passwordEnc: mockPasswordEnc,
                    },
                  }),
                }),
              })),
            })),
          })),
        })),
      };

      (admin.firestore as unknown as jest.Mock) = jest.fn(() => mockFirestore);

      const data = {
        protocol: 'pop3' as const,
        accountId: mockAccountId,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        // passwordは提供されていない
      };

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(encryption.decryptPassword).toHaveBeenCalledWith(mockUid, mockPasswordEnc);
      expect(testPop3Connection).toHaveBeenCalledWith(
        'pop.example.com',
        995,
        true,
        'user@example.com',
        'decrypted-password'
      );
      expect(result).toEqual({ success: true });
    });

    it('新規アカウントでパスワードが提供されていない場合、エラーを返す', async () => {
      const data = {
        protocol: 'pop3' as const,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        // passwordが不足
      } as any;

      const mockRequest = createMockRequest(data);
      const result = await accountTest(mockRequest);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Password is required for new account test',
      });
    });
  });
});
