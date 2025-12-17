/**
 * accountTest - POP3S接続テスト
 * 
 * メールアカウント設定時のPOP3S接続テスト機能（SSL/TLS必須）
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { decryptPassword } from '../encryption';
import { testPop3Connection } from './pop3Client';

/**
 * 接続テストリクエストの型定義
 */
interface AccountTestRequest {
  // アカウント作成前の接続テスト用
  host: string;
  port: number;
  useSsl: boolean;
  userName: string;
  password?: string; // 平文パスワード（アカウント作成前）

  // 既存アカウントの接続テスト用
  accountId?: string;
}

/**
 * 接続テスト結果の型定義
 */
interface AccountTestResponse {
  success: boolean;
  errorMessage?: string;
}

/**
 * POP3S接続テストを実行するHTTP Callable Function
 *
 * テストコードから直接呼び出しやすくするため、型はanyとしてエクスポートする
 */
export const accountTest: any = functions.region('asia-northeast1').https.onCall(
  async (data: AccountTestRequest, context: functions.https.CallableContext): Promise<AccountTestResponse> => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const uid = context.auth.uid;

    // パラメータ検証
    if (!data.host || !data.port || data.useSsl === undefined || !data.userName) {
      return {
        success: false,
        errorMessage: 'Missing required parameters: host, port, useSsl, userName',
      };
    }

    // SSL/TLS必須チェック
    if (!data.useSsl) {
      return {
        success: false,
        errorMessage: 'SSL/TLS is required for POP3 connections',
      };
    }

    let password: string;

    // 既存アカウントの接続テスト
    if (data.accountId) {
      const db = admin.firestore();
      const accountRef = db
        .collection('users')
        .doc(uid)
        .collection('mailAccounts')
        .doc(data.accountId);

      const accountDoc = await accountRef.get();

      if (!accountDoc.exists) {
        return {
          success: false,
          errorMessage: 'Account not found',
        };
      }

      const accountData = accountDoc.data();
      const passwordEnc = accountData?.pop3?.passwordEnc;

      if (!passwordEnc) {
        return {
          success: false,
          errorMessage: 'Password not found in account',
        };
      }

      // 暗号化パスワードを復号化
      try {
        password = await decryptPassword(uid, passwordEnc);
      } catch (error: any) {
        return {
          success: false,
          errorMessage: `Failed to decrypt password: ${error.message}`,
        };
      }
    } else {
      // アカウント作成前の接続テスト（平文パスワード）
      if (!data.password) {
        return {
          success: false,
          errorMessage: 'Password is required for new account test',
        };
      }
      password = data.password;
    }

    // POP3S接続テストを実行
    try {
      const result = await testPop3Connection(
        data.host,
        data.port,
        data.useSsl,
        data.userName,
        password
      );

      // セキュリティ: 平文パスワードを即座に破棄
      password = '';

      return result;
    } catch (error: any) {
      // セキュリティ: エラー時も平文パスワードを破棄
      password = '';

      return {
        success: false,
        errorMessage: error.message || 'Connection test failed',
      };
    }
  }
);

