/**
 * EncryptionService - DEK生成・管理のテスト
 */

import * as keys from '../keys';
import * as kms from '../kms';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// モック
jest.mock('../kms');
jest.mock('@google-cloud/secret-manager');

describe('keys', () => {
  const mockUid = 'test-user-123';
  const mockProjectId = 'test-project';
  const mockSecretName = `dek-${mockUid}`;
  const mockDek = Buffer.from('test-dek-key-32-bytes-long-enough!!', 'utf-8');
  const mockWrappedDek = Buffer.from('wrapped-dek-data', 'utf-8');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCLOUD_PROJECT = mockProjectId;
  });

  describe('createDataKeyForUser', () => {
    it('DEKを生成してSecret Managerに保存する', async () => {
      const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
      process.env.KMS_KEY_NAME = mockKmsKeyName;

      (kms.wrapKey as jest.Mock).mockResolvedValue(mockWrappedDek);

      const mockSecretClient = {
        createSecret: jest.fn().mockResolvedValue([{ name: mockSecretName }]),
        addSecretVersion: jest.fn().mockResolvedValue([{ name: `${mockSecretName}/versions/1` }]),
      };

      (SecretManagerServiceClient as jest.Mock).mockImplementation(() => mockSecretClient);

      await keys.createDataKeyForUser(mockUid);

      expect(kms.wrapKey).toHaveBeenCalled();
      expect(mockSecretClient.createSecret).toHaveBeenCalled();
      expect(mockSecretClient.addSecretVersion).toHaveBeenCalled();
    });

    it('既にDEKが存在する場合はエラーを投げる', async () => {
      const mockSecretClient = {
        getSecret: jest.fn().mockResolvedValue([{ name: mockSecretName }]),
      };

      (SecretManagerServiceClient as jest.Mock).mockImplementation(() => mockSecretClient);

      await expect(keys.createDataKeyForUser(mockUid)).rejects.toThrow();
    });
  });

  describe('getDataKey', () => {
    it('Secret ManagerからDEKを取得してKMSでunwrapする', async () => {
      const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
      process.env.KMS_KEY_NAME = mockKmsKeyName;

      (kms.unwrapKey as jest.Mock).mockResolvedValue(mockDek);

      const mockSecretClient = {
        accessSecretVersion: jest.fn().mockResolvedValue([
          {
            payload: {
              data: mockWrappedDek,
            },
          },
        ]),
      };

      (SecretManagerServiceClient as jest.Mock).mockImplementation(() => mockSecretClient);

      const dek = await keys.getDataKey(mockUid);

      expect(dek).toEqual(mockDek);
      expect(mockSecretClient.accessSecretVersion).toHaveBeenCalled();
      expect(kms.unwrapKey).toHaveBeenCalledWith(mockWrappedDek);
    });

    it('DEKが存在しない場合はエラーを投げる', async () => {
      const mockSecretClient = {
        accessSecretVersion: jest.fn().mockRejectedValue(new Error('Secret not found')),
      };

      (SecretManagerServiceClient as jest.Mock).mockImplementation(() => mockSecretClient);

      await expect(keys.getDataKey(mockUid)).rejects.toThrow();
    });
  });
});

