/**
 * storagePaths - Storageパスユーティリティのテスト
 */

import {
  getRawMimePath,
  getBodyHtmlPath,
  getAttachmentsBasePath,
  getAttachmentPath,
} from '../storagePaths';

describe('storagePaths', () => {
  const mockUid = 'test-user-123';
  const mockMessageId = 'message-456';

  describe('getRawMimePath', () => {
    it('MIME原本のパスを生成する', () => {
      const path = getRawMimePath(mockUid, mockMessageId);
      expect(path).toBe(`mail-data/${mockUid}/${mockMessageId}/raw.eml.enc`);
    });
  });

  describe('getBodyHtmlPath', () => {
    it('大きいHTML本文のパスを生成する', () => {
      const path = getBodyHtmlPath(mockUid, mockMessageId);
      expect(path).toBe(`mail-data/${mockUid}/${mockMessageId}/body.html.enc`);
    });
  });

  describe('getAttachmentsBasePath', () => {
    it('添付ファイルのベースパスを生成する', () => {
      const path = getAttachmentsBasePath(mockUid, mockMessageId);
      expect(path).toBe(`mail-data/${mockUid}/${mockMessageId}/attachments/`);
    });
  });

  describe('getAttachmentPath', () => {
    it('添付ファイルのパスを生成する', () => {
      const filename = 'document.pdf';
      const path = getAttachmentPath(mockUid, mockMessageId, filename);
      expect(path).toBe(`mail-data/${mockUid}/${mockMessageId}/attachments/${filename}.enc`);
    });
  });
});

