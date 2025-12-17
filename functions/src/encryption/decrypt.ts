/**
 * 復号処理モジュール
 * 
 * AES-256-GCMアルゴリズムを使用してデータを復号する
 */

import { createDecipheriv } from 'node:crypto';
import * as keys from './keys';
import { EncryptedData } from './encrypt';

/**
 * ユーザーのDEKを使用してデータを復号する
 * 
 * @param uid - ユーザーID
 * @param encrypted - 暗号化されたデータ（{ciphertext, nonce, tag}）
 * @returns 復号されたデータ（Buffer）
 */
export async function decryptForUser(
  uid: string,
  encrypted: EncryptedData
): Promise<Buffer> {
  // DEKを取得
  const dek = await keys.getDataKey(uid);

  // base64デコード
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const nonce = Buffer.from(encrypted.nonce, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');

  // nonceのサイズを検証（12バイト）
  if (nonce.length !== 12) {
    throw new Error('Invalid nonce size: expected 12 bytes');
  }

  // AES-256-GCMで復号
  const decipher = createDecipheriv('aes-256-gcm', dek, nonce);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext;
}

