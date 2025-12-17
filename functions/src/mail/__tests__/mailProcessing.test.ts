/**
 * mailProcessing - MIMEパースと保存ロジックのテスト
 */

import {
  generateBodyPreview,
  generateThreadId,
  shouldStoreBodyInStorage,
} from '../mailProcessing';
import * as MailParser from 'mailparser';

// モック
jest.mock('mailparser', () => ({
  simpleParser: jest.fn(),
}));

describe('mailProcessing', () => {
  describe('generateBodyPreview', () => {
    it('テキスト本文からプレビューを生成する', () => {
      const parsed = {
        text: 'This is a long email body that should be truncated for preview purposes.',
      } as MailParser.ParsedMail;

      const preview = generateBodyPreview(parsed);
      expect(preview.length).toBeLessThanOrEqual(200);
      expect(preview).toContain('This is a long email body');
    });

    it('HTML本文からテキストを抽出してプレビューを生成する', () => {
      const parsed = {
        text: undefined,
        html: '<p>This is HTML content</p>',
      } as MailParser.ParsedMail;

      const preview = generateBodyPreview(parsed);
      expect(preview.length).toBeLessThanOrEqual(200);
    });

    it('本文が200文字未満の場合は全文を返す', () => {
      const parsed = {
        text: 'Short message',
      } as MailParser.ParsedMail;

      const preview = generateBodyPreview(parsed);
      expect(preview).toBe('Short message');
    });

    it('本文が200文字を超える場合は200文字で切り詰める', () => {
      const longText = 'a'.repeat(300);
      const parsed = {
        text: longText,
      } as MailParser.ParsedMail;

      const preview = generateBodyPreview(parsed);
      expect(preview.length).toBe(200);
      expect(preview).toBe(longText.substring(0, 200));
    });

    it('本文がない場合は空文字を返す', () => {
      const parsed = {
        text: undefined,
        html: undefined,
      } as MailParser.ParsedMail;

      const preview = generateBodyPreview(parsed);
      expect(preview).toBe('');
    });
  });

  describe('generateThreadId', () => {
    it('Message-IDからスレッドIDを生成する', () => {
      const parsed = {
        messageId: '<message-id-123@example.com>',
      } as MailParser.ParsedMail;

      const threadId = generateThreadId(parsed);
      expect(threadId).toBeDefined();
      expect(threadId).toBeTruthy();
    });

    it('In-Reply-Toヘッダーがある場合は親メッセージのMessage-IDを使用する', () => {
      const parsed = {
        messageId: '<reply-message-id@example.com>',
        inReplyTo: '<original-message-id@example.com>',
      } as MailParser.ParsedMail;

      const threadId = generateThreadId(parsed);
      expect(threadId).toBeDefined();
    });

    it('Referencesヘッダーがある場合は最初のMessage-IDを使用する', () => {
      const parsed = {
        messageId: '<reply-message-id@example.com>',
        references: '<original-message-id@example.com> <another-message-id@example.com>',
      } as MailParser.ParsedMail;

      const threadId = generateThreadId(parsed);
      expect(threadId).toBeDefined();
    });

    it('Message-IDがない場合は件名と送信者から生成する', () => {
      const parsed = {
        messageId: undefined,
        subject: 'Test Subject',
        from: {
          text: 'sender@example.com',
        },
      } as MailParser.ParsedMail;

      const threadId = generateThreadId(parsed);
      expect(threadId).toBeDefined();
      expect(threadId).toBeTruthy();
    });
  });

  describe('shouldStoreBodyInStorage', () => {
    it('本文サイズが1MiB未満の場合はfalseを返す（Firestoreに保存）', () => {
      const bodySize = 500 * 1024; // 500KB
      const result = shouldStoreBodyInStorage(bodySize);
      expect(result).toBe(false);
    });

    it('本文サイズが1MiB以上の場合はtrueを返す（Storageに保存）', () => {
      const bodySize = 2 * 1024 * 1024; // 2MB
      const result = shouldStoreBodyInStorage(bodySize);
      expect(result).toBe(true);
    });

    it('本文サイズがちょうど1MiBの場合はtrueを返す（Storageに保存）', () => {
      const bodySize = 1024 * 1024; // 1MB
      const result = shouldStoreBodyInStorage(bodySize);
      expect(result).toBe(true);
    });
  });
});

