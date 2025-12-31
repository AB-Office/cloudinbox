/**
 * 型定義のテストファイル
 *
 * このファイルは型の整合性を確認するためのテストです。
 * TypeScriptコンパイラが型エラーを検出することで、型定義が正しいことを確認します。
 */

import type { SendMailRequest, SendMailResponse, ComposeAttachment } from '../mail';

/**
 * SendMailRequestの型定義が正しいことを確認するテスト
 *
 * 以下のテストケースは、TypeScriptコンパイラが型エラーを検出することを確認するためのものです。
 * これらの変数は実際には使用されませんが、型チェックの実行により型定義の整合性を確認します。
 */

// これらのテストは、型エラーが発生することを期待していますが、
// 型定義が正しい場合、これらのエラーが発生することで型安全性が確認されます。

// 注意: 実際のテストでは、これらの変数は使用されないため、
// 型エラーが発生することを確認するために、TypeScriptコンパイラを実行します。

// 正しい型のリクエスト（型エラーが発生しないことを確認）
const validRequest1: SendMailRequest = {
  accountId: 'account1',
  to: ['test@example.com'],
  subject: 'Test',
  body: 'Test body',
};

// オプショナルフィールドを含む正しい型のリクエスト
const validRequest2: SendMailRequest = {
  accountId: 'account1',
  to: ['test@example.com'],
  cc: ['cc@example.com'],
  bcc: ['bcc@example.com'],
  subject: 'Test',
  body: 'Test body',
  attachments: [
    {
      filename: 'test.pdf',
      content: 'base64content',
      contentType: 'application/pdf',
    },
  ],
  threadId: 'thread1',
  inReplyToMessageId: 'msg1',
};

// attachmentsの型が正しいことを確認
const validRequest3: SendMailRequest = {
  accountId: 'account1',
  to: ['test@example.com'],
  subject: 'Test',
  body: 'Test body',
  attachments: [
    {
      filename: 'test.pdf',
      content: 'base64content',
      contentType: 'application/pdf',
    },
    {
      filename: 'test.jpg',
      content: 'base64content2',
      // contentTypeはオプショナル
    },
  ],
};

/**
 * SendMailResponseの型定義が正しいことを確認するテスト
 */
// 正しい型のレスポンス（成功）
const validResponse1: SendMailResponse = {
  success: true,
  messageId: 'message-id-123',
};

// 正しい型のレスポンス（失敗）
const validResponse2: SendMailResponse = {
  success: false,
  errorMessage: 'Error message',
};

// successとerrorMessageの組み合わせ（どちらも存在可能）
const validResponse3: SendMailResponse = {
  success: false,
  messageId: 'message-id-123', // successがfalseでもmessageIdは存在可能
  errorMessage: 'Error message',
};

/**
 * ComposeAttachmentの型定義が正しいことを確認するテスト
 */

// 正しい型の添付ファイル
const validAttachment1: ComposeAttachment = {
  file: new File(['content'], 'test.pdf', { type: 'application/pdf' }),
  filename: 'test.pdf',
  contentType: 'application/pdf',
  content: '', // Base64エンコードは送信時に生成
};

// contentが文字列であることを確認
const validAttachment2: ComposeAttachment = {
  file: new File(['content'], 'test.pdf'),
  filename: 'test.pdf',
  contentType: 'application/pdf',
  content: 'base64encodedcontent',
};

/**
 * バックエンドAPIとの整合性を確認するテスト
 *
 * フロントエンドのSendMailRequestがバックエンドのSendMailRequestと
 * 互換性があることを確認します。
 */
function testBackendCompatibility(): void {
  // フロントエンドのリクエストをバックエンドの型として扱えることを確認
  const frontendRequest: SendMailRequest = {
    accountId: 'account1',
    to: ['test@example.com'],
    subject: 'Test',
    body: 'Test body',
    cc: ['cc@example.com'],
    bcc: ['bcc@example.com'],
    attachments: [
      {
        filename: 'test.pdf',
        content: 'base64content',
        contentType: 'application/pdf',
      },
    ],
    threadId: 'thread1',
    inReplyToMessageId: 'msg1',
  };

  // バックエンドの関数シグネチャを模擬（実際の関数は呼び出さない）
  // バックエンドの型定義と一致していることを確認
  type BackendSendMailRequest = {
    accountId: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    attachments?: Array<{
      filename: string;
      content: string; // Base64 encoded
      contentType?: string;
    }>;
    threadId?: string;
    inReplyToMessageId?: string;
  };

  // フロントエンドのリクエストをバックエンドの型に代入できることを確認
  // 型エラーが発生しないことを確認（型の整合性が保たれている）
  const backendRequest: BackendSendMailRequest = frontendRequest;

  // 使用されていない変数であることをTypeScriptに伝える
  void backendRequest;
}

// このファイルが正しくコンパイルされることを確認（型エラーがないことを期待）
// 型定義の整合性を確認するためのエクスポート
export {
  validRequest1,
  validRequest2,
  validRequest3,
  validResponse1,
  validResponse2,
  validResponse3,
  validAttachment1,
  validAttachment2,
  testBackendCompatibility,
};
