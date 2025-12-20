/**
 * saveMail - メール暗号化保存
 * 
 * メールを暗号化してFirestore/Storageに保存し、mailThreads/mailMessagesを更新する
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as MailParser from 'mailparser';
import { encryptForUser } from '../encryption';
import { canStoreMail } from '../shared/planValidator';
import {
  getRawMimePath,
  getBodyHtmlPath,
  getAttachmentPath,
} from './storagePaths';
import { MailMessageDoc, MailThreadDoc, StoragePaths } from './types';
import { generateBodyPreview } from './mailProcessing';

/**
 * メールを保存する
 * 
 * @param uid - ユーザーID
 * @param messageId - メッセージID
 * @param threadId - スレッドID
 * @param rawMessage - 生のMIMEメッセージ
 * @param parsed - パースされたメール
 * @param db - Firestoreインスタンス
 * @param storage - Storageインスタンス
 * @param isSentMail - 送信済みメールの場合true（デフォルト: false）
 * @returns 保存されたファイルサイズの合計（バイト）
 */
export async function saveMail(
  uid: string,
  messageId: string,
  threadId: string,
  rawMessage: string,
  parsed: MailParser.ParsedMail,
  db: admin.firestore.Firestore,
  storage: admin.storage.Storage,
  isSentMail: boolean = false
): Promise<number> {
  // メールサイズを推定（暗号化後のサイズを考慮）
  const rawMessageSize = Buffer.byteLength(rawMessage, 'utf8');
  
  // mailparserの結果を詳細にログ出力
  functions.logger.info(`Parsed mail properties for message: ${messageId}, text=${!!parsed.text}, html=${!!parsed.html}, textAsHtml=${!!parsed.textAsHtml}`);
  
  // 本文を取得（text優先、なければhtml、それもなければhtmlからテキストを抽出）
  let bodyText = '';
  if (parsed.text) {
    bodyText = parsed.text;
  } else if (parsed.html) {
    // HTMLからテキストを抽出（簡易版）
    bodyText = parsed.html
      .replace(/<[^>]+>/g, '')  // HTMLタグを削除
      .replace(/&nbsp;/g, ' ')   // &nbsp;をスペースに
      .replace(/&[a-z]+;/gi, '') // その他のエンティティを削除
      .trim();
  } else if (parsed.textAsHtml) {
    // textAsHtmlからテキストを抽出
    bodyText = parsed.textAsHtml
      .replace(/<[^>]+>/g, '')  // HTMLタグを削除
      .replace(/&nbsp;/g, ' ')   // &nbsp;をスペースに
      .replace(/&[a-z]+;/gi, '') // その他のエンティティを削除
      .trim();
  }
  
  // bodyTextが空の場合は警告を出す（StorageにMIME原本が保存されているので、decryptMail.tsで再パース可能）
  if (bodyText.length === 0) {
    functions.logger.warn(`WARNING: bodyText is empty for message: ${messageId}. parsed.text=${!!parsed.text}, parsed.html=${!!parsed.html}, rawMessage length=${rawMessage.length}. MIME original will be saved to Storage and can be re-parsed in decryptMail.`);
  }
  
  const bodySize = Buffer.byteLength(bodyText, 'utf8');
  
  const parsedTextLength = typeof parsed.text === 'string' ? parsed.text.length : 0;
  const parsedHtmlLength = typeof parsed.html === 'string' ? parsed.html.length : 0;
  functions.logger.info(`Saving mail: messageId=${messageId}, parsed.text length=${parsedTextLength}, parsed.html length=${parsedHtmlLength}, bodyText length=${bodyText.length}, bodySize=${bodySize} bytes, hasLargeBody=${bodySize >= 1024 * 1024}`);
  
  // bodyTextが空の場合は警告を出す
  if (bodyText.length === 0) {
    functions.logger.warn(`WARNING: bodyText is still empty for message: ${messageId}. parsed.text=${!!parsed.text}, parsed.html=${!!parsed.html}, rawMessage length=${rawMessage.length}`);
  }
  
  // 暗号化によるオーバーヘッドを考慮（約33%増加: nonce + tag）
  const estimatedSize = Math.ceil(rawMessageSize * 1.33) + Math.ceil(bodySize * 1.33);

  // 容量チェック
  const canStore = await canStoreMail(uid, estimatedSize);
  if (!canStore) {
    throw new Error('Storage limit exceeded');
  }

  const now = admin.firestore.Timestamp.now();
  let totalSavedSize = 0;

  // MIME原本を暗号化してStorageに保存
  const rawMimePath = getRawMimePath(uid, messageId);
  const rawMimeEncrypted = await encryptForUser(uid, Buffer.from(rawMessage, 'utf8'));
  const rawMimeBuffer = Buffer.from(
    JSON.stringify(rawMimeEncrypted),
    'utf8'
  );
  
  const bucket = storage.bucket();
  const rawMimeFile = bucket.file(rawMimePath);
  await rawMimeFile.save(rawMimeBuffer, {
    metadata: {
      contentType: 'application/json',
    },
  });
  
  totalSavedSize += rawMimeBuffer.length;

  // 本文サイズ判定
  const hasLargeBody = bodySize >= 1024 * 1024; // 1MiB

  let bodyTextEncrypted: { ciphertext: string; nonce: string; tag: string } | undefined;
  let largeBodyPath: string | undefined;

  if (hasLargeBody) {
    // 大きい本文を暗号化してStorageに保存
    largeBodyPath = getBodyHtmlPath(uid, messageId);
    functions.logger.info(`Saving large body to Storage: path=${largeBodyPath}, bodySize=${bodySize} bytes for message: ${messageId}`);
    
    const bodyEncrypted = await encryptForUser(uid, Buffer.from(bodyText, 'utf8'));
    const bodyBuffer = Buffer.from(JSON.stringify(bodyEncrypted), 'utf8');
    
    const bodyFile = bucket.file(largeBodyPath);
    await bodyFile.save(bodyBuffer, {
      metadata: {
        contentType: 'application/json',
      },
    });
    
    functions.logger.info(`Saved large body to Storage: path=${largeBodyPath}, bufferSize=${bodyBuffer.length} bytes for message: ${messageId}`);
    totalSavedSize += bodyBuffer.length;
  } else {
    // 小さい本文を暗号化してFirestoreに保存
    functions.logger.info(`Saving small body to Firestore: bodySize=${bodySize} bytes for message: ${messageId}`);
    bodyTextEncrypted = await encryptForUser(uid, Buffer.from(bodyText, 'utf8'));
    // Firestoreに保存するサイズを計算（JSON形式）
    const bodyJsonSize = Buffer.byteLength(
      JSON.stringify(bodyTextEncrypted),
      'utf8'
    );
    functions.logger.info(`Saved small body to Firestore: encryptedSize=${bodyJsonSize} bytes for message: ${messageId}`);
    totalSavedSize += bodyJsonSize;
  }

  // 添付ファイルを暗号化してStorageに保存
  const attachmentsBasePath = parsed.attachments && parsed.attachments.length > 0
    ? `mail-data/${uid}/${messageId}/attachments/`
    : undefined;

  if (parsed.attachments && parsed.attachments.length > 0) {
    for (const attachment of parsed.attachments) {
      const attachmentPath = getAttachmentPath(uid, messageId, attachment.filename || 'attachment');
      const attachmentContent = attachment.content || Buffer.alloc(0);
      const attachmentEncrypted = await encryptForUser(uid, attachmentContent);
      const attachmentBuffer = Buffer.from(JSON.stringify(attachmentEncrypted), 'utf8');
      
      const attachmentFile = bucket.file(attachmentPath);
      await attachmentFile.save(attachmentBuffer, {
        metadata: {
          contentType: attachment.contentType || 'application/octet-stream',
        },
      });
      
      totalSavedSize += attachmentBuffer.length;
    }
  }

  // bodyPreview生成
  const bodyPreview = generateBodyPreview(parsed);

  // 送信者・受信者情報を取得
  const extractFrom = (fromObj: MailParser.AddressObject | MailParser.AddressObject[] | undefined): string => {
    if (!fromObj) return '';
    if (typeof fromObj === 'string') return fromObj;
    const addrObjs = Array.isArray(fromObj) ? fromObj : [fromObj];
    return addrObjs[0]?.text || addrObjs[0]?.value?.[0]?.address || '';
  };
  
  const extractAddresses = (addrObj: MailParser.AddressObject | MailParser.AddressObject[] | undefined): string[] => {
    if (!addrObj) return [];
    if (typeof addrObj === 'string') return [addrObj];
    const addrObjs = Array.isArray(addrObj) ? addrObj : [addrObj];
    return addrObjs.flatMap((obj) => obj.value?.map((email) => email.address || '') || []).filter(Boolean);
  };
  
  const from = extractFrom(parsed.from);
  const to = extractAddresses(parsed.to);
  const cc = parsed.cc ? extractAddresses(parsed.cc) : [];
  const bcc = parsed.bcc ? extractAddresses(parsed.bcc) : [];

  // 日時情報を取得
  const sentAt = parsed.date ? admin.firestore.Timestamp.fromDate(parsed.date) : now;
  const receivedAt = now;

  // mailThreadsの作成・更新
  const threadRef = db
    .collection('users')
    .doc(uid)
    .collection('mailThreads')
    .doc(threadId);

  const threadDoc = await threadRef.get();

  // ラベルを決定（送信済みメールの場合は'sent'、受信メールの場合は'inbox'）
  const initialLabels = isSentMail ? ['sent'] : ['inbox'];

  if (threadDoc.exists) {
    // 既存スレッドを更新
    const updateData: any = {
      latestMessageId: messageId,
      preview: bodyPreview,
      hasUnread: true,
      lastMessageAt: receivedAt,
      sentAt: sentAt, // 最新メッセージの送信日時を更新
      updatedAt: now,
    };

    // ラベルを決定
    const existingLabels = threadDoc.data()?.labels || [];
    let newLabels: string[];
    if (isSentMail) {
      // 送信済みメールの場合、inboxラベルを削除してsentラベルを追加
      newLabels = existingLabels.filter((label: string) => label !== 'inbox');
      if (!newLabels.includes('sent')) {
        newLabels.push('sent');
      }
    } else {
      // 受信メールの場合、既存ラベルにinboxを追加（重複を避ける）
      newLabels = Array.from(new Set([...existingLabels, 'inbox']));
    }
    updateData.labels = newLabels;

    await threadRef.update(updateData);
  } else {
    // 新規スレッドを作成
    const threadData: MailThreadDoc = {
      threadId,
      latestMessageId: messageId,
      subject: parsed.subject || '',
      from,
      to,
      preview: bodyPreview,
      hasUnread: true,
      labels: initialLabels,
      lastMessageAt: receivedAt,
      sentAt: sentAt, // 最新メッセージの送信日時
      createdAt: now,
      updatedAt: now,
    };

    await threadRef.set(threadData);
  }

  // mailMessagesの作成
  const messageRef = db
    .collection('users')
    .doc(uid)
    .collection('mailMessages')
    .doc(messageId);

  // storageオブジェクトを作成（undefinedのフィールドは除外）
  // スプレッド演算子を使って、undefined/null/空文字列の場合はプロパティを追加しない
  const storageData: StoragePaths = {
    rawMimePath,
    ...(largeBodyPath !== undefined && largeBodyPath !== null && largeBodyPath !== '' ? { largeBodyPath } : {}),
    ...(attachmentsBasePath !== undefined && attachmentsBasePath !== null && attachmentsBasePath !== '' ? { attachmentsBasePath } : {}),
  };
  
  // デバッグ: storageDataの内容を確認
  functions.logger.debug(`storageData keys: ${Object.keys(storageData).join(', ')}, hasLargeBody: ${hasLargeBody}, largeBodyPath type: ${typeof largeBodyPath}, largeBodyPath value: ${largeBodyPath}`);

  // messageDataを作成（undefinedのフィールドは除外）
  const messageData: Partial<MailMessageDoc> & {
    messageId: string;
    threadId: string;
    from: string;
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    sentAt: admin.firestore.Timestamp;
    receivedAt: admin.firestore.Timestamp;
    bodyPreview: string;
    hasLargeBody: boolean;
    hasAttachments: boolean;
    storage: StoragePaths;
    isRead: boolean;
    labels: string[];
    deletedAt: admin.firestore.Timestamp | null;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
  } = {
    messageId,
    threadId,
    from,
    to,
    cc,
    bcc,
    subject: parsed.subject || '',
    sentAt,
    receivedAt,
    bodyPreview,
    hasLargeBody,
    hasAttachments: parsed.attachments && parsed.attachments.length > 0,
    storage: storageData,
    isRead: false,
    labels: initialLabels,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  
  // bodyTextEncryptedが存在する場合のみ追加
  if (bodyTextEncrypted !== undefined) {
    messageData.bodyTextEncrypted = bodyTextEncrypted;
  }

  await messageRef.set(messageData);

  // 使用量を更新
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (userDoc.exists) {
    await userRef.update({
      'usage.storageBytes': admin.firestore.FieldValue.increment(totalSavedSize),
      'usage.updatedAt': now,
    });
  }

  // 暗号化前データは関数終了時にガベージコレクションされる

  return totalSavedSize;
}

