/**
 * onUserCreate - ユーザー初期化トリガー
 * 
 * Firebase Authでユーザーが作成された際に、Firestoreにユーザードキュメントを作成し、
 * Freeプラン設定とDEKを自動生成する
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { createDataKeyForUser } from '../encryption';

/**
 * ユーザードキュメントの型定義
 */
interface UserDoc {
  plan: {
    id: string;
    label: string;
    maxStorageBytes: number;
    maxAccounts: number;
  };
  usage: {
    storageBytes: number;
    updatedAt: admin.firestore.Timestamp;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * ユーザー作成時の初期化処理
 * 
 * @param user - Firebase Authのユーザーレコード
 */
async function initializeUser(user: admin.auth.UserRecord): Promise<void> {
  const uid = user.uid;
  
  if (!uid) {
    throw new Error('User UID is required');
  }

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  let userExists = false;

  // トランザクションで一貫性を保証
  await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await transaction.get(userRef);

    // 既にユーザードキュメントが存在する場合はスキップ（冪等性）
    if (userDoc.exists) {
      userExists = true;
      return;
    }

    // Freeプラン設定
    const userData: UserDoc = {
      plan: {
        id: 'free',
        label: 'Free',
        maxStorageBytes: 2147483648, // 2GB
        maxAccounts: 1,
      },
      usage: {
        storageBytes: 0,
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    // ユーザードキュメントを作成
    transaction.set(userRef, userData);
  });

  // ユーザーが既に存在する場合はDEK生成もスキップ（冪等性）
  if (userExists) {
    return;
  }

  // DEKを生成・保存（トランザクション外で実行、Secret Managerへの保存）
  await createDataKeyForUser(uid);
}

/**
 * Firebase Authトリガー: ユーザー作成時
 */
export const onUserCreate = functions.region('asia-northeast1').auth.user().onCreate(async (user) => {
  try {
    await initializeUser(user);
    functions.logger.info(`User initialized: ${user.uid}`);
  } catch (error) {
    functions.logger.error(`Failed to initialize user ${user.uid}:`, error);
    throw error;
  }
});

