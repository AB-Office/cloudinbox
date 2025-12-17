/**
 * decryptMail - メール本文復号のテスト
 */

import { executeDecryptMail } from '../decryptMail';
import * as admin from 'firebase-admin';
import * as encryption from '../../encryption';
import { EncryptedData } from '../../mail/types';

// モック
jest.mock('firebase-admin');
jest.mock('../../encryption');

describe('decryptMail', () => {
  const mockUid = 'test-user-123';

  let mockFirestore: any;
  let mockStorage: any;
  let mockBucket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBucket = {
      file: jest.fn(),
    };

    mockStorage = {
      bucket: jest.fn().mockReturnValue(mockBucket),
    };

    (admin.storage as any) = jest.fn().mockReturnValue(mockStorage);

    mockFirestore = {
      collection: jest.fn(),
    };

    (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestore);
  });

  describe('小さい本文（hasLargeBody: false）の復号', () => {
    it('FirestoreのbodyTextEncryptedを復号してbodyTextとして返す', async () => {
      const messageId = 'message-123';

      const encryptedBody: EncryptedData = {
        ciphertext: 'cipher',
        nonce: 'nonce',
        tag: 'tag',
      };

      const mockMessageDoc = {
        exists: true,
        data: () => ({
          messageId,
          hasLargeBody: false,
          bodyTextEncrypted: encryptedBody,
          storage: {
            rawMimePath: 'mail-data/user/message/raw.eml.enc',
          },
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      (encryption.decryptForUser as jest.Mock).mockResolvedValue(
        Buffer.from('Decrypted body text', 'utf-8')
      );

      const result = await executeDecryptMail(
        mockUid,
        messageId,
        mockFirestore,
        mockStorage
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(encryption.decryptForUser).toHaveBeenCalledWith(
        mockUid,
        encryptedBody
      );
      expect(result).toEqual({
        bodyText: 'Decrypted body text',
      });
    });
  });

  describe('大きい本文（hasLargeBody: true）の復号', () => {
    it('Storageのbody.html.encを復号してbodyHtmlとして返す', async () => {
      const messageId = 'message-456';

      const encryptedBody: EncryptedData = {
        ciphertext: 'cipher2',
        nonce: 'nonce2',
        tag: 'tag2',
      };

      const mockMessageDoc = {
        exists: true,
        data: () => ({
          messageId,
          hasLargeBody: true,
          storage: {
            rawMimePath: 'mail-data/user/message/raw.eml.enc',
            largeBodyPath: 'mail-data/user/message/body.html.enc',
          },
        }),
      };

      const mockMessageRef = {
        get: jest.fn().mockResolvedValue(mockMessageDoc),
      };

      const mockUserCollection = {
        doc: jest.fn(() => ({
          collection: jest.fn((subPath: string) => {
            if (subPath === 'mailMessages') {
              return {
                doc: jest.fn(() => mockMessageRef),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return mockUserCollection;
        }
        return { doc: jest.fn() };
      });

      const mockFile = {
        download: jest
          .fn()
          .mockResolvedValue([
            Buffer.from(JSON.stringify(encryptedBody), 'utf-8'),
          ]),
      };

      mockBucket.file = jest.fn(() => mockFile);

      (encryption.decryptForUser as jest.Mock).mockResolvedValue(
        Buffer.from('<p>Decrypted HTML</p>', 'utf-8')
      );

      const result = await executeDecryptMail(
        mockUid,
        messageId,
        mockFirestore,
        mockStorage
      );

      expect(mockBucket.file).toHaveBeenCalledWith(
        'mail-data/user/message/body.html.enc'
      );
      expect(encryption.decryptForUser).toHaveBeenCalledWith(
        mockUid,
        encryptedBody
      );
      expect(result).toEqual({
        bodyHtml: '<p>Decrypted HTML</p>',
      });
    });
  });

  // 認証チェックはCloud Functionsラッパー側（decryptMail）で実施する
});
