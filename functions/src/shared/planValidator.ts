/**
 * PlanValidator - プラン制限チェックサービス
 * 
 * ユーザーのプラン制限（アカウント数、ストレージ容量）をチェックする
 */

import * as admin from 'firebase-admin';

/**
 * ユーザードキュメントの型定義
 */
interface UserDoc {
  plan?: {
    id: string;
    maxStorageBytes?: number;
    maxAccounts?: number;
  };
  usage?: {
    storageBytes?: number;
  };
}

/**
 * アカウント追加が可能かどうかをチェックする
 * 
 * @param uid - ユーザーID
 * @returns アカウント追加可能な場合はtrue、上限に達している場合はfalse
 * @throws ユーザーが存在しない場合、プラン情報が存在しない場合
 */
export async function canAddAccount(uid: string): Promise<boolean> {
  const db = admin.firestore();
  
  // ユーザードキュメントを取得
  const userDoc = await db.collection('users').doc(uid).get();
  
  if (!userDoc.exists) {
    throw new Error(`User not found: ${uid}`);
  }
  
  const userData = userDoc.data() as UserDoc;
  
  if (!userData.plan || userData.plan.maxAccounts === undefined) {
    throw new Error(`Plan information not found for user: ${uid}`);
  }
  
  const maxAccounts = userData.plan.maxAccounts;
  
  // 現在のアカウント数を取得
  const accountsSnapshot = await db
    .collection('users')
    .doc(uid)
    .collection('mailAccounts')
    .get();
  
  const currentAccountCount = accountsSnapshot.size;
  
  return currentAccountCount < maxAccounts;
}

/**
 * メール保存が可能かどうかをチェックする（容量チェック）
 * 
 * @param uid - ユーザーID
 * @param mailSize - 保存しようとするメールのサイズ（バイト）
 * @returns メール保存可能な場合はtrue、容量上限を超える場合はfalse
 * @throws ユーザーが存在しない場合、プラン情報が存在しない場合
 */
export async function canStoreMail(uid: string, mailSize: number): Promise<boolean> {
  const db = admin.firestore();
  
  // ユーザードキュメントを取得
  const userDoc = await db.collection('users').doc(uid).get();
  
  if (!userDoc.exists) {
    throw new Error(`User not found: ${uid}`);
  }
  
  const userData = userDoc.data() as UserDoc;
  
  if (!userData.plan || userData.plan.maxStorageBytes === undefined) {
    throw new Error(`Plan information not found for user: ${uid}`);
  }
  
  const maxStorageBytes = userData.plan.maxStorageBytes;
  const currentStorageBytes = userData.usage?.storageBytes ?? 0;
  
  // 使用量とメールサイズの合計が上限を超えないかチェック
  return (currentStorageBytes + mailSize) <= maxStorageBytes;
}

