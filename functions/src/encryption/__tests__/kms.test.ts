/**
 * EncryptionService - KMS操作のテスト
 */

/// <reference types="jest" />

import { KeyManagementServiceClient } from '@google-cloud/kms';

// モック
jest.mock('@google-cloud/kms', () => ({
  KeyManagementServiceClient: jest.fn(),
}));

describe('kms', () => {
  const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
  // AES-256-GCMには32バイト（256ビット）の鍵が必要
  const mockDek = Buffer.alloc(32, 0x42); // 32バイトの固定値
  const mockWrappedDek = Buffer.from('wrapped-dek-data', 'utf-8');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.KMS_KEY_NAME = mockKmsKeyName;
  });

  describe('wrapKey', () => {
    it('DEKをKMSでwrapする', async () => {
      const mockKmsClient = {
        encrypt: jest.fn().mockResolvedValue([
          {
            ciphertext: mockWrappedDek,
          },
        ]),
      };

      (KeyManagementServiceClient as unknown as jest.Mock).mockImplementation(() => mockKmsClient);
      
      const kmsModule = await import('../kms');
      kmsModule.resetClient();

      const wrapped = await kmsModule.wrapKey(mockDek);

      expect(wrapped).toEqual(mockWrappedDek);
      expect(mockKmsClient.encrypt).toHaveBeenCalledWith({
        name: mockKmsKeyName,
        plaintext: mockDek,
      });
    });

    it('KMS_KEY_NAMEが設定されていない場合はエラーを投げる', async () => {
      const kmsModule = await import('../kms');
      delete process.env.KMS_KEY_NAME;

      await expect(kmsModule.wrapKey(mockDek)).rejects.toThrow();
    });
  });

  describe('unwrapKey', () => {
    it('wrapされたDEKをKMSでunwrapする', async () => {
      const mockKmsClient = {
        decrypt: jest.fn().mockResolvedValue([
          {
            plaintext: mockDek,
          },
        ]),
      };

      (KeyManagementServiceClient as unknown as jest.Mock).mockImplementation(() => mockKmsClient);
      
      const kmsModule = await import('../kms');
      kmsModule.resetClient();

      const unwrapped = await kmsModule.unwrapKey(mockWrappedDek);

      expect(unwrapped).toEqual(mockDek);
      expect(mockKmsClient.decrypt).toHaveBeenCalledWith({
        name: mockKmsKeyName,
        ciphertext: mockWrappedDek,
      });
    });

    it('KMS_KEY_NAMEが設定されていない場合はエラーを投げる', async () => {
      const kmsModule = await import('../kms');
      delete process.env.KMS_KEY_NAME;

      await expect(kmsModule.unwrapKey(mockWrappedDek)).rejects.toThrow();
    });

    it('KMSのencryptが失敗した場合はエラーを投げる', async () => {
      const mockKmsClient = {
        encrypt: jest.fn().mockRejectedValue(new Error('KMS encrypt failed')),
      };

      (KeyManagementServiceClient as unknown as jest.Mock).mockImplementation(() => mockKmsClient);
      
      const kmsModule = await import('../kms');
      kmsModule.resetClient();

      await expect(kmsModule.wrapKey(mockDek)).rejects.toThrow('KMS encrypt failed');
    });

    it('KMSのdecryptが失敗した場合はエラーを投げる', async () => {
      const mockKmsClient = {
        decrypt: jest.fn().mockRejectedValue(new Error('KMS decrypt failed')),
      };

      (KeyManagementServiceClient as unknown as jest.Mock).mockImplementation(() => mockKmsClient);
      
      const kmsModule = await import('../kms');
      kmsModule.resetClient();

      await expect(kmsModule.unwrapKey(mockWrappedDek)).rejects.toThrow('KMS decrypt failed');
    });

    it('KMSのencryptが空のciphertextを返した場合はエラーを投げる', async () => {
      const mockKmsClient = {
        encrypt: jest.fn().mockResolvedValue([
          {
            ciphertext: null, // 空のciphertext
          },
        ]),
      };

      (KeyManagementServiceClient as unknown as jest.Mock).mockImplementation(() => mockKmsClient);
      
      const kmsModule = await import('../kms');
      kmsModule.resetClient();

      await expect(kmsModule.wrapKey(mockDek)).rejects.toThrow('Failed to wrap key');
    });

    it('KMSのdecryptが空のplaintextを返した場合はエラーを投げる', async () => {
      const mockKmsClient = {
        decrypt: jest.fn().mockResolvedValue([
          {
            plaintext: null, // 空のplaintext
          },
        ]),
      };

      (KeyManagementServiceClient as unknown as jest.Mock).mockImplementation(() => mockKmsClient);
      
      const kmsModule = await import('../kms');
      kmsModule.resetClient();

      await expect(kmsModule.unwrapKey(mockWrappedDek)).rejects.toThrow('Failed to unwrap key');
    });
  });
});

