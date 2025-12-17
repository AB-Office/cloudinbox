/**
 * Google Cloud KMS操作モジュール
 * 
 * KEK（Key Encryption Key）を使用してDEKをwrap/unwrapする
 */

import { KeyManagementServiceClient } from '@google-cloud/kms';

/**
 * KMSクライアントのシングルトンインスタンス
 */
let kmsClient: KeyManagementServiceClient | null = null;

/**
 * KMSクライアントを取得する
 */
function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) {
    kmsClient = new KeyManagementServiceClient();
  }
  return kmsClient;
}

/**
 * KMSクライアントをリセットする（テスト用）
 */
export function resetClient(): void {
  kmsClient = null;
}

/**
 * KMS鍵名を取得する
 */
function getKmsKeyName(): string {
  const keyName = process.env.KMS_KEY_NAME;
  if (!keyName) {
    throw new Error('KMS_KEY_NAME environment variable is not set');
  }
  return keyName;
}

/**
 * DEKをKMSのKEKでwrapする
 * 
 * @param dek - 暗号化するDEK（Data Encryption Key）
 * @returns wrapされたDEK（Buffer）
 */
export async function wrapKey(dek: Buffer): Promise<Buffer> {
  const client = getKmsClient();
  const keyName = getKmsKeyName();

  const [result] = await client.encrypt({
    name: keyName,
    plaintext: dek,
  });

  if (!result.ciphertext) {
    throw new Error('Failed to wrap key: ciphertext is empty');
  }

  return Buffer.from(result.ciphertext);
}

/**
 * wrapされたDEKをKMSのKEKでunwrapする
 * 
 * @param wrappedDek - wrapされたDEK（Buffer）
 * @returns unwrapされたDEK（Buffer）
 */
export async function unwrapKey(wrappedDek: Buffer): Promise<Buffer> {
  const client = getKmsClient();
  const keyName = getKmsKeyName();

  const [result] = await client.decrypt({
    name: keyName,
    ciphertext: wrappedDek,
  });

  if (!result.plaintext) {
    throw new Error('Failed to unwrap key: plaintext is empty');
  }

  return Buffer.from(result.plaintext);
}

