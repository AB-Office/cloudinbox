/**
 * EncryptionService - 暗号化処理のテスト
 */

import { encryptForUser } from '../encrypt';
import * as keys from '../keys';

// モック
jest.mock('../keys');
jest.mock('../kms');

describe('encryptForUser', () => {
  const mockUid = 'test-user-123';
  // AES-256-GCMには32バイト（256ビット）の鍵が必要
  const mockDek = Buffer.alloc(32, 0x42); // 32バイトの固定値

  beforeEach(() => {
    jest.clearAllMocks();
    (keys.getDataKey as jest.Mock).mockResolvedValue(mockDek);
  });

  it('文字列データを暗号化できる', async () => {
    const plaintext = 'Hello, World!';
    const result = await encryptForUser(mockUid, plaintext);

    expect(result).toHaveProperty('ciphertext');
    expect(result).toHaveProperty('nonce');
    expect(result).toHaveProperty('tag');
    expect(result.ciphertext).toBeTruthy();
    expect(result.nonce).toBeTruthy();
    expect(result.tag).toBeTruthy();
    expect(result.ciphertext).not.toBe(plaintext);
  });

  it('Bufferデータを暗号化できる', async () => {
    const plaintext = Buffer.from('Hello, World!', 'utf-8');
    const result = await encryptForUser(mockUid, plaintext);

    expect(result).toHaveProperty('ciphertext');
    expect(result).toHaveProperty('nonce');
    expect(result).toHaveProperty('tag');
    expect(result.ciphertext).toBeTruthy();
    expect(result.nonce).toBeTruthy();
    expect(result.tag).toBeTruthy();
  });

  it('nonceは12バイトである', async () => {
    const plaintext = 'Test data';
    const result = await encryptForUser(mockUid, plaintext);

    const nonceBuffer = Buffer.from(result.nonce, 'base64');
    expect(nonceBuffer.length).toBe(12);
  });

  it('異なるnonceで暗号化される（ランダム性）', async () => {
    const plaintext = 'Same plaintext';
    const result1 = await encryptForUser(mockUid, plaintext);
    const result2 = await encryptForUser(mockUid, plaintext);

    // 同じ平文でも異なるnonceで暗号化されるため、ciphertextは異なる
    expect(result1.ciphertext).not.toBe(result2.ciphertext);
    expect(result1.nonce).not.toBe(result2.nonce);
  });

  it('DEKを取得する', async () => {
    const plaintext = 'Test data';
    await encryptForUser(mockUid, plaintext);

    expect(keys.getDataKey).toHaveBeenCalledWith(mockUid);
  });

  it('空の文字列を暗号化できる', async () => {
    const plaintext = '';
    const result = await encryptForUser(mockUid, plaintext);

    expect(result).toHaveProperty('ciphertext');
    expect(result).toHaveProperty('nonce');
    expect(result).toHaveProperty('tag');
  });

  it('大きなデータを暗号化できる', async () => {
    const plaintext = 'A'.repeat(10000); // 10KBのデータ
    const result = await encryptForUser(mockUid, plaintext);

    expect(result).toHaveProperty('ciphertext');
    expect(result).toHaveProperty('nonce');
    expect(result).toHaveProperty('tag');
    expect(result.ciphertext.length).toBeGreaterThan(0);
  });

  it('tagはbase64エンコードされている', async () => {
    const plaintext = 'Test data';
    const result = await encryptForUser(mockUid, plaintext);

    // base64文字列の検証（英数字、+、/、=のみ）
    expect(result.tag).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('ciphertextはbase64エンコードされている', async () => {
    const plaintext = 'Test data';
    const result = await encryptForUser(mockUid, plaintext);

    // base64文字列の検証（英数字、+、/、=のみ）
    expect(result.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

