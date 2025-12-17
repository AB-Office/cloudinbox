/**
 * EncryptionService - 復号処理のテスト
 */

import { decryptForUser } from '../decrypt';
import { encryptForUser } from '../encrypt';
import * as keys from '../keys';

// モック
jest.mock('../keys');
jest.mock('../kms');

describe('decryptForUser', () => {
  const mockUid = 'test-user-123';
  // AES-256-GCMには32バイト（256ビット）の鍵が必要
  const mockDek = Buffer.alloc(32, 0x42); // 32バイトの固定値

  beforeEach(() => {
    jest.clearAllMocks();
    (keys.getDataKey as jest.Mock).mockResolvedValue(mockDek);
  });

  it('暗号化されたデータを復号できる', async () => {
    const plaintext = 'Hello, World!';
    const encrypted = await encryptForUser(mockUid, plaintext);
    const decrypted = await decryptForUser(mockUid, encrypted);

    expect(decrypted.toString('utf-8')).toBe(plaintext);
  });

  it('Bufferデータを復号できる', async () => {
    const plaintext = Buffer.from('Hello, World!', 'utf-8');
    const encrypted = await encryptForUser(mockUid, plaintext);
    const decrypted = await decryptForUser(mockUid, encrypted);

    expect(decrypted).toEqual(plaintext);
  });

  it('異なるnonceで暗号化されたデータも正しく復号できる', async () => {
    const plaintext = 'Same plaintext';
    const encrypted1 = await encryptForUser(mockUid, plaintext);
    const encrypted2 = await encryptForUser(mockUid, plaintext);

    const decrypted1 = await decryptForUser(mockUid, encrypted1);
    const decrypted2 = await decryptForUser(mockUid, encrypted2);

    expect(decrypted1.toString('utf-8')).toBe(plaintext);
    expect(decrypted2.toString('utf-8')).toBe(plaintext);
  });

  it('無効なnonceで復号を試みるとエラーを投げる', async () => {
    const encrypted = {
      ciphertext: 'dGVzdA==',
      nonce: 'invalid-nonce', // 無効なnonce
      tag: 'dGVzdA==',
    };

    await expect(decryptForUser(mockUid, encrypted)).rejects.toThrow();
  });

  it('無効なtagで復号を試みるとエラーを投げる', async () => {
    const plaintext = 'Test data';
    const encrypted = await encryptForUser(mockUid, plaintext);
    encrypted.tag = 'invalid-tag'; // 無効なtag

    await expect(decryptForUser(mockUid, encrypted)).rejects.toThrow();
  });

  it('DEKを取得する', async () => {
    const plaintext = 'Test data';
    const encrypted = await encryptForUser(mockUid, plaintext);
    await decryptForUser(mockUid, encrypted);

    expect(keys.getDataKey).toHaveBeenCalledWith(mockUid);
  });

  it('空の文字列を復号できる', async () => {
    const plaintext = '';
    const encrypted = await encryptForUser(mockUid, plaintext);
    const decrypted = await decryptForUser(mockUid, encrypted);

    expect(decrypted.toString('utf-8')).toBe(plaintext);
  });

  it('大きなデータを復号できる', async () => {
    const plaintext = 'A'.repeat(10000); // 10KBのデータ
    const encrypted = await encryptForUser(mockUid, plaintext);
    const decrypted = await decryptForUser(mockUid, encrypted);

    expect(decrypted.toString('utf-8')).toBe(plaintext);
  });

  it('無効なciphertextで復号を試みるとエラーを投げる', async () => {
    const plaintext = 'Test data';
    const encrypted = await encryptForUser(mockUid, plaintext);
    encrypted.ciphertext = 'invalid-ciphertext'; // 無効なciphertext

    await expect(decryptForUser(mockUid, encrypted)).rejects.toThrow();
  });

  it('nonceが12バイトでない場合はエラーを投げる', async () => {
    const plaintext = 'Test data';
    const encrypted = await encryptForUser(mockUid, plaintext);
    // nonceを11バイトに変更（base64エンコード）
    const invalidNonce = Buffer.alloc(11, 0x42).toString('base64');
    encrypted.nonce = invalidNonce;

    await expect(decryptForUser(mockUid, encrypted)).rejects.toThrow('Invalid nonce size');
  });

  it('異なるユーザーのDEKで復号できない', async () => {
    const plaintext = 'Test data';
    const encrypted = await encryptForUser(mockUid, plaintext);

    // 異なるユーザーのDEKで復号を試みる
    const otherUid = 'other-user-456';
    const otherDek = Buffer.alloc(32, 0x99); // 異なるDEK
    (keys.getDataKey as jest.Mock).mockResolvedValueOnce(otherDek);

    await expect(decryptForUser(otherUid, encrypted)).rejects.toThrow();
  });
});

