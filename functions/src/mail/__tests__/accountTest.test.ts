/**
 * accountTest - POP3S接続テストのテスト
 */

import { accountTest } from '../accountTest';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';

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
jest.mock('../pop3Client', () => ({
  testPop3Connection: jest.fn(),
}));

import * as functions from 'firebase-functions';
import { testPop3Connection } from '../pop3Client';

describe('accountTest', () => {
  const mockUid = 'test-user-123';
  const mockContext = {
    auth: {
      uid: mockUid,
    },
  } as functions.https.CallableContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('アカウント作成前の接続テスト', () => {
    it('useSslがtrueの場合、接続テストを実行する', async () => {
      (testPop3Connection as jest.Mock).mockResolvedValue({ success: true });

      const data = {
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const result = await accountTest(data, mockContext);

      expect(result).toEqual({ success: true });
      expect(testPop3Connection).toHaveBeenCalledWith(
        'pop.example.com',
        995,
        true,
        'user@example.com',
        'plaintext-password'
      );
    });

    it('useSslがfalseの場合、エラーを返す', async () => {
      const data = {
        host: 'pop.example.com',
        port: 110,
        useSsl: false,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const result = await accountTest(data, mockContext);

      expect(result).toEqual({
        success: false,
        errorMessage: 'SSL/TLS is required for POP3 connections',
      });
      expect(testPop3Connection).not.toHaveBeenCalled();
    });

    it('接続テストが成功した場合、success: trueを返す', async () => {
      (testPop3Connection as jest.Mock).mockResolvedValue({ success: true });

      const data = {
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'plaintext-password',
      };

      const result = await accountTest(data, mockContext);

      expect(result).toEqual({ success: true });
    });

    it('接続テストが失敗した場合、success: falseとエラーメッセージを返す', async () => {
      (testPop3Connection as jest.Mock).mockResolvedValue({
        success: false,
        errorMessage: 'Authentication failed',
      });

      const data = {
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'wrong-password',
      };

      const result = await accountTest(data, mockContext);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Authentication failed',
      });
    });
  });

  describe('既存アカウントの接続テスト', () => {
    it('accountIdが提供された場合、暗号化パスワードを復号化して接続テストを実行する', async () => {
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
        accountId: mockAccountId,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
      };

      const result = await accountTest(data, mockContext);

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
        accountId: mockAccountId,
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
      };

      const result = await accountTest(data, mockContext);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Account not found',
      });
    });
  });

  describe('認証チェック', () => {
    it('認証されていない場合はエラーを投げる', async () => {
      const unauthenticatedContext = {
        auth: undefined,
      } as functions.https.CallableContext;

      const data = {
        host: 'pop.example.com',
        port: 995,
        useSsl: true,
        userName: 'user@example.com',
        password: 'password',
      };

      await expect(accountTest(data, unauthenticatedContext)).rejects.toThrow();
    });
  });

  describe('パラメータ検証', () => {
    it('必須パラメータが不足している場合、エラーを返す', async () => {
      const data = {
        host: 'pop.example.com',
        // port, useSsl, userName, passwordが不足
      };

      const result = await accountTest(data, mockContext);

      expect(result).toEqual({
        success: false,
        errorMessage: 'Missing or invalid parameters: host, port, useSsl, userName',
      });
    });
  });
});

