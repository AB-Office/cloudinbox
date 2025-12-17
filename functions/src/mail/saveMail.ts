/**
 * saveMail - メール暗号化保存
 * 
 * メールを暗号化してFirestore/Storageに保存し、mailThreads/mailMessagesを更新する
 */

import * as admin from 'firebase-admin';
import * as MailParser from 'mailparser';
import { encryptForUser } from '../encryption';
import { canStoreMail } from '../shared/planValidator';
import {
  getRawMimePath,
  getBodyHtmlPath,
  getAttachmentPath,
} from './storagePaths';
import { MailMessageDoc, MailThreadDoc } from './types';
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
 * @returns 保存されたファイルサイズの合計（バイト）
 */
export async function saveMail(
  uid: string,
  messageId: string,
  threadId: string,
  rawMessage: string,
  parsed: MailParser.ParsedMail,
  db: admin.firestore.Firestore,
  storage: admin.storage.Storage
): Promise<number> {
  // メールサイズを推定（暗号化後のサイズを考慮）
  const rawMessageSize = Buffer.byteLength(rawMessage, 'utf8');
  const bodyText = parsed.text || parsed.html || '';
  const bodySize = Buffer.byteLength(bodyText, 'utf8');
  
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
    const bodyEncrypted = await encryptForUser(uid, Buffer.from(bodyText, 'utf8'));
    const bodyBuffer = Buffer.from(JSON.stringify(bodyEncrypted), 'utf8');
    
    const bodyFile = bucket.file(largeBodyPath);
    await bodyFile.save(bodyBuffer, {
      metadata: {
        contentType: 'application/json',
      },
    });
    
    totalSavedSize += bodyBuffer.length;
  } else {
    // 小さい本文を暗号化してFirestoreに保存
    bodyTextEncrypted = await encryptForUser(uid, bodyText);
    // Firestoreに保存するサイズを計算（JSON形式）
    const bodyJsonSize = Buffer.byteLength(
      JSON.stringify(bodyTextEncrypted),
      'utf8'
    );
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
  const cc = parsed.cc ? extractAddresses(parsed.cc) : undefined;
  const bcc = parsed.bcc ? extractAddresses(parsed.bcc) : undefined;

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

  if (threadDoc.exists) {
    // 既存スレッドを更新
    await threadRef.update({
      latestMessageId: messageId,
      preview: bodyPreview,
      hasUnread: true,
      lastMessageAt: receivedAt,
      updatedAt: now,
    });
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
      labels: ['inbox'],
      lastMessageAt: receivedAt,
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

  const messageData: MailMessageDoc = {
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
    bodyTextEncrypted,
    hasLargeBody,
    hasAttachments: parsed.attachments && parsed.attachments.length > 0,
    storage: {
      rawMimePath,
      largeBodyPath,
      attachmentsBasePath,
    },
    isRead: false,
    labels: ['inbox'],
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

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

