/**
 * EncryptionService - 暗号化基盤
 * 
 * Google Cloud KMSとDEKを使用したデータ暗号化・復号化機能を提供
 */

import { encryptForUser, EncryptedData } from './encrypt';
import { decryptForUser } from './decrypt';
import { createDataKeyForUser, getDataKey, clearCache } from './keys';
import * as kms from './kms';

/**
 * EncryptionServiceの公開API
 */
export {
  // 暗号化・復号化
  encryptForUser,
  decryptForUser,
  EncryptedData,
  
  // DEK管理
  createDataKeyForUser,
  getDataKey,
  clearCache,
  
  // KMS操作（必要に応じて）
  kms,
};

/**
 * パスワードの暗号化（エイリアス）
 */
export async function encryptPassword(
  uid: string,
  plainPassword: string
): Promise<EncryptedData> {
  return encryptForUser(uid, plainPassword);
}

/**
 * パスワードの復号（エイリアス）
 */
export async function decryptPassword(
  uid: string,
  encrypted: EncryptedData
): Promise<string> {
  const decrypted = await decryptForUser(uid, encrypted);
  return decrypted.toString('utf-8');
}

