/**
 * メール処理ユーティリティ
 * 
 * MIMEパース後のメールデータ処理（bodyPreview生成、スレッドID生成、サイズ判定等）
 */

import * as MailParser from 'mailparser';
import * as crypto from 'crypto';

/**
 * 本文プレビューを生成する（最初の200文字程度）
 * 
 * @param parsed - パースされたメール
 * @returns プレビューテキスト（最大200文字）
 */
export function generateBodyPreview(parsed: MailParser.ParsedMail): string {
  let text = '';
  
  // テキスト本文を優先、なければHTMLから抽出
  if (parsed.text) {
    text = parsed.text;
  } else if (parsed.html) {
    // HTMLからテキストを抽出（簡易版）
    text = parsed.html
      .replace(/<[^>]+>/g, '')  // HTMLタグを削除
      .replace(/&nbsp;/g, ' ')   // &nbsp;をスペースに
      .replace(/&[a-z]+;/gi, '') // その他のエンティティを削除
      .trim();
  }

  // 200文字で切り詰め
  if (text.length > 200) {
    return text.substring(0, 200);
  }

  return text;
}

/**
 * スレッドIDを生成する
 * 
 * スレッドIDの生成ロジック：
 * 1. In-Reply-Toヘッダーがある場合、親メッセージのMessage-IDを使用
 * 2. Referencesヘッダーがある場合、最初のMessage-IDを使用
 * 3. それ以外の場合、現在のMessage-IDを使用
 * 4. Message-IDがない場合、件名と送信者からハッシュを生成
 * 
 * @param parsed - パースされたメール
 * @returns スレッドID
 */
export function generateThreadId(parsed: MailParser.ParsedMail): string {
  // In-Reply-Toヘッダーを優先
  if (parsed.inReplyTo) {
    const messageId = Array.isArray(parsed.inReplyTo)
      ? parsed.inReplyTo[0]
      : parsed.inReplyTo;
    return hashMessageId(messageId);
  }

  // Referencesヘッダーから最初のMessage-IDを取得
  if (parsed.references) {
    const references = Array.isArray(parsed.references)
      ? parsed.references
      : [parsed.references];
    
    if (references.length > 0) {
      return hashMessageId(references[0]);
    }
  }

  // 現在のMessage-IDを使用
  if (parsed.messageId) {
    return hashMessageId(parsed.messageId);
  }

  // Message-IDがない場合、件名と送信者からハッシュを生成
  const subject = parsed.subject || '';
  const from = parsed.from?.text || parsed.from?.value?.[0]?.address || '';
  const combined = `${subject}:${from}`;
  
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);
}

/**
 * Message-IDをハッシュ化する
 * 
 * @param messageId - Message-ID
 * @returns ハッシュ化されたID
 */
function hashMessageId(messageId: string): string {
  // Message-IDから<>を削除してハッシュ化
  const cleanId = messageId.replace(/[<>]/g, '');
  return crypto.createHash('sha256').update(cleanId).digest('hex').substring(0, 32);
}

/**
 * 本文をStorageに保存すべきか判定する
 * 
 * Firestoreの1MiB制限を考慮し、本文サイズが1MiB以上の場合はStorageに保存
 * 
 * @param bodySize - 本文サイズ（バイト）
 * @returns Storageに保存すべき場合はtrue、Firestoreに保存すべき場合はfalse
 */
export function shouldStoreBodyInStorage(bodySize: number): boolean {
  const firestoreLimit = 1024 * 1024; // 1MiB
  return bodySize >= firestoreLimit;
}

