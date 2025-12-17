/**
 * EncryptionService - KMS操作のテスト
 */

import * as kms from '../kms';
import { KeyManagementServiceClient } from '@google-cloud/kms';

// モック
jest.mock('@google-cloud/kms');

describe('kms', () => {
  const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
  const mockDek = Buffer.from('test-dek-key-32-bytes-long-enough!!', 'utf-8');
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

      (KeyManagementServiceClient as jest.Mock).mockImplementation(() => mockKmsClient);

      const wrapped = await kms.wrapKey(mockDek);

      expect(wrapped).toEqual(mockWrappedDek);
      expect(mockKmsClient.encrypt).toHaveBeenCalledWith({
        name: mockKmsKeyName,
        plaintext: mockDek,
      });
    });

    it('KMS_KEY_NAMEが設定されていない場合はエラーを投げる', async () => {
      delete process.env.KMS_KEY_NAME;

      await expect(kms.wrapKey(mockDek)).rejects.toThrow();
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

      (KeyManagementServiceClient as jest.Mock).mockImplementation(() => mockKmsClient);

      const unwrapped = await kms.unwrapKey(mockWrappedDek);

      expect(unwrapped).toEqual(mockDek);
      expect(mockKmsClient.decrypt).toHaveBeenCalledWith({
        name: mockKmsKeyName,
        ciphertext: mockWrappedDek,
      });
    });

    it('KMS_KEY_NAMEが設定されていない場合はエラーを投げる', async () => {
      delete process.env.KMS_KEY_NAME;

      await expect(kms.unwrapKey(mockWrappedDek)).rejects.toThrow();
    });
  });
});

