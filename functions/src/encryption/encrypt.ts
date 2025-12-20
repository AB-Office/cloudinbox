/**
 * 暗号化処理モジュール
 * 
 * AES-256-GCMアルゴリズムを使用してデータを暗号化する
 */

import { createCipheriv, randomBytes } from 'node:crypto';
import * as keys from './keys';

/**
 * 暗号化されたデータの形式
 */
export interface EncryptedData {
  ciphertext: string; // base64エンコードされた暗号文
  nonce: string;      // base64エンコードされたnonce（12バイト）
  tag: string;        // base64エンコードされた認証タグ
}

/**
 * ユーザーのDEKを使用してデータを暗号化する
 * 
 * @param uid - ユーザーID
 * @param data - 暗号化するデータ（文字列またはBuffer）
 * @returns 暗号化されたデータ（{ciphertext, nonce, tag}）
 */
export async function encryptForUser(
  uid: string,
  data: string | Buffer
): Promise<EncryptedData> {
  // DEKを取得
  const dek = await keys.getDataKey(uid);

  // データをBufferに変換
  const plaintext = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

  // 12バイトのnonceを生成
  const nonce = randomBytes(12);

  // AES-256-GCMで暗号化
  const cipher = createCipheriv('aes-256-gcm', dek, nonce);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // base64エンコードして返す
  return {
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    tag: tag.toString('base64'),
  };
}

