/**
 * EncryptionService - DEK生成・管理のテスト
 */

/// <reference types="jest" />

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { KeyManagementServiceClient } from '@google-cloud/kms';

// モック
jest.mock('../kms', () => ({
  wrapKey: jest.fn(),
  unwrapKey: jest.fn(),
}));
jest.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: jest.fn(),
}));
jest.mock('@google-cloud/kms', () => ({
  KeyManagementServiceClient: jest.fn(),
}));

describe('keys', () => {
  const mockUid = 'test-user-123';
  const mockProjectId = 'test-project';
  const mockSecretName = `dek-${mockUid}`;
  // AES-256-GCMには32バイト（256ビット）の鍵が必要
  const mockDek = Buffer.alloc(32, 0x42); // 32バイトの固定値
  const mockWrappedDek = Buffer.from('wrapped-dek-data', 'utf-8');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCLOUD_PROJECT = mockProjectId;
  });

  describe('createDataKeyForUser', () => {
    it('DEKを生成してSecret Managerに保存する', async () => {
      const keysModule = await import('../keys');
      const kmsModule = await import('../kms');
      keysModule.resetClient();
      
      const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
      process.env.KMS_KEY_NAME = mockKmsKeyName;

      (kmsModule.wrapKey as jest.Mock).mockResolvedValue(mockWrappedDek);

      const mockSecretClient = {
        getSecret: jest.fn().mockRejectedValue({ code: 5 }), // NOT_FOUND
        createSecret: jest.fn().mockResolvedValue([{ name: mockSecretName }]),
        addSecretVersion: jest.fn().mockResolvedValue([{ name: `${mockSecretName}/versions/1` }]),
      };

      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);

      await keysModule.createDataKeyForUser(mockUid);

      expect(mockSecretClient.getSecret).toHaveBeenCalled();
      expect(kmsModule.wrapKey).toHaveBeenCalled();
      expect(mockSecretClient.createSecret).toHaveBeenCalled();
      expect(mockSecretClient.addSecretVersion).toHaveBeenCalled();
    });

    it('既にDEKが存在する場合はエラーを投げる', async () => {
      const keysModule = await import('../keys');
      keysModule.resetClient();
      
      const mockSecretClient = {
        getSecret: jest.fn().mockResolvedValue([{ name: mockSecretName }]),
      };

      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);

      await expect(keysModule.createDataKeyForUser(mockUid)).rejects.toThrow('Data key already exists');
    });

    it('createSecretが既に存在するエラーを返した場合は無視する', async () => {
      const keysModule = await import('../keys');
      const kmsModule = await import('../kms');
      keysModule.resetClient();
      
      const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
      process.env.KMS_KEY_NAME = mockKmsKeyName;

      (kmsModule.wrapKey as jest.Mock).mockResolvedValue(mockWrappedDek);

      const mockSecretClient = {
        getSecret: jest.fn().mockRejectedValue({ code: 5 }), // NOT_FOUND
        createSecret: jest.fn().mockRejectedValue({ code: 6 }), // ALREADY_EXISTS
        addSecretVersion: jest.fn().mockResolvedValue([{ name: `${mockSecretName}/versions/1` }]),
      };

      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);

      // エラーを投げずに成功する
      await keysModule.createDataKeyForUser(mockUid);

      expect(mockSecretClient.createSecret).toHaveBeenCalled();
      expect(mockSecretClient.addSecretVersion).toHaveBeenCalled();
    });

    it('getSecretがNOT_FOUND以外のエラーを返した場合はエラーを投げる', async () => {
      const keysModule = await import('../keys');
      keysModule.resetClient();
      
      const mockSecretClient = {
        getSecret: jest.fn().mockRejectedValue({ code: 3 }), // INVALID_ARGUMENT
      };

      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);

      await expect(keysModule.createDataKeyForUser(mockUid)).rejects.toHaveProperty('code', 3);
    });
  });

  describe('getDataKey', () => {
    it('Secret ManagerからDEKを取得してKMSでunwrapする', async () => {
      const keysModule = await import('../keys');
      const kmsModule = await import('../kms');
      keysModule.resetClient();
      
      const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
      process.env.KMS_KEY_NAME = mockKmsKeyName;

      (kmsModule.unwrapKey as jest.Mock).mockResolvedValue(mockDek);

      const mockSecretClient = {
        accessSecretVersion: jest.fn().mockResolvedValue([
          {
            payload: {
              data: mockWrappedDek,
            },
          },
        ]),
      };

      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);

      const dek = await keysModule.getDataKey(mockUid);

      expect(dek).toEqual(mockDek);
      expect(mockSecretClient.accessSecretVersion).toHaveBeenCalled();
      expect(kmsModule.unwrapKey).toHaveBeenCalledWith(mockWrappedDek);
    });

    it('DEKが存在しない場合はエラーを投げる', async () => {
      const mockSecretClient = {
        accessSecretVersion: jest.fn().mockRejectedValue(
          Object.assign(new Error('Secret not found'), { code: 5 }) // NOT_FOUND
        ),
      };
      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);
      
      const keysModule = await import('../keys');
      keysModule.resetClient();
      keysModule.clearCache();

      await expect(keysModule.getDataKey(mockUid)).rejects.toThrow();
    });

    it('DEKがキャッシュから取得される', async () => {
      const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
      process.env.KMS_KEY_NAME = mockKmsKeyName;
      
      const mockSecretClient = {
        accessSecretVersion: jest.fn().mockResolvedValue([
          {
            payload: {
              data: mockWrappedDek,
            },
          },
        ]),
      };
      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);
      
      const keysModule = await import('../keys');
      const kmsModule = await import('../kms');
      (kmsModule.unwrapKey as jest.Mock).mockResolvedValue(mockDek);
      
      keysModule.resetClient();
      keysModule.clearCache();

      // 最初の呼び出し
      const dek1 = await keysModule.getDataKey(mockUid);
      expect(dek1).toEqual(mockDek);
      expect(mockSecretClient.accessSecretVersion).toHaveBeenCalledTimes(1);
      expect(kmsModule.unwrapKey).toHaveBeenCalledTimes(1);

      // 2回目の呼び出し（キャッシュから取得）
      const dek2 = await keysModule.getDataKey(mockUid);
      expect(dek2).toEqual(mockDek);
      // キャッシュから取得されるため、Secret ManagerとKMSは呼ばれない
      expect(mockSecretClient.accessSecretVersion).toHaveBeenCalledTimes(1);
      expect(kmsModule.unwrapKey).toHaveBeenCalledTimes(1);
    });

    it('Secret Managerから取得したDEKが空の場合はエラーを投げる', async () => {
      const mockSecretClient = {
        accessSecretVersion: jest.fn().mockResolvedValue([
          {
            payload: {
              data: null, // 空のデータ
            },
          },
        ]),
      };
      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);
      
      const keysModule = await import('../keys');
      keysModule.resetClient();
      keysModule.clearCache();

      await expect(keysModule.getDataKey(mockUid)).rejects.toThrow('Data key not found');
    });

    it('GCLOUD_PROJECTが設定されていない場合はエラーを投げる', async () => {
      const keysModule = await import('../keys');
      keysModule.resetClient();
      delete process.env.GCLOUD_PROJECT;

      await expect(keysModule.createDataKeyForUser(mockUid)).rejects.toThrow('GCLOUD_PROJECT');
    });
  });

  describe('clearCache', () => {
    it('キャッシュをクリアできる', async () => {
      const mockKmsKeyName = 'projects/test-project/locations/global/keyRings/cloudinbox/cryptoKeys/kek';
      process.env.KMS_KEY_NAME = mockKmsKeyName;
      process.env.GCLOUD_PROJECT = mockProjectId;
      
      const mockKmsClient = {
        decrypt: jest.fn().mockResolvedValue([{ plaintext: mockDek }]),
      };
      (KeyManagementServiceClient as unknown as jest.Mock).mockImplementation(() => mockKmsClient);
      
      const mockSecretClient = {
        accessSecretVersion: jest.fn().mockResolvedValue([
          {
            payload: {
              data: mockWrappedDek,
            },
          },
        ]),
      };
      (SecretManagerServiceClient as unknown as jest.Mock).mockImplementation(() => mockSecretClient);
      
      const keysModule = await import('../keys');
      keysModule.resetClient();
      keysModule.clearCache();

      // 最初の呼び出し
      await keysModule.getDataKey(mockUid);
      expect(mockSecretClient.accessSecretVersion).toHaveBeenCalledTimes(1);

      // キャッシュをクリア
      keysModule.clearCache();

      // 再度呼び出し（キャッシュがクリアされているため、Secret Managerが再度呼ばれる）
      await keysModule.getDataKey(mockUid);
      expect(mockSecretClient.accessSecretVersion).toHaveBeenCalledTimes(2);
    });
  });
});

