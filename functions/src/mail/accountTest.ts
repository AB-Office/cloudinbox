/**
 * accountTest - POP3S/SMTP接続テスト
 * 
 * メールアカウント設定時のPOP3S/SMTP接続テスト機能（SSL/TLS必須）
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { decryptPassword } from '../encryption';
import { testPop3Connection } from './pop3Client';
import { testSmtpConnection } from './smtpClient';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * 接続テストリクエストの型定義
 */
interface AccountTestRequest {
  // POP3/SMTP共通
  protocol: 'pop3' | 'smtp';
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
 * POP3S/SMTP接続テストを実行するHTTP Callable Function (Gen2)
 *
 * テストコードから直接呼び出しやすくするため、型はanyとしてエクスポートする
 * 
 * 注意: Direct VPC Egressの設定はコードではなく、デプロイ時にgcloudコマンドで行います
 * 例: --vpc-egress=all-traffic --vpc-network=vpc-cloud-run --vpc-subnet=subnet-cloud-run
 */
export const accountTest: any = onCall(
  { region: 'asia-northeast1' },
  async (request: CallableRequest<AccountTestRequest>): Promise<AccountTestResponse> => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const uid = request.auth.uid;
    const data = request.data;

    // パラメータ検証
    const isValidProtocol = data.protocol === 'pop3' || data.protocol === 'smtp';
    const isValidPort = Number.isInteger(data.port) && data.port > 0 && data.port <= 65535;
    const hasHost = typeof data.host === 'string' && data.host.trim().length > 0;
    const hasUser = typeof data.userName === 'string' && data.userName.trim().length > 0;
    const useSslProvided = data.useSsl === true || data.useSsl === false;

    if (!isValidProtocol || !isValidPort || !hasHost || !hasUser || !useSslProvided) {
      return {
        success: false,
        errorMessage: 'Missing or invalid parameters: protocol, host, port, useSsl, userName',
      };
    }

    // SSL/TLS必須チェック
    if (!data.useSsl) {
      const protocolName = data.protocol.toUpperCase();
      return {
        success: false,
        errorMessage: `SSL/TLS is required for ${protocolName} connections`,
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
      
      // デバッグ: アカウントデータの構造をログ出力
      functions.logger.info('accountTest: account data structure', {
        hasPop3: !!accountData?.pop3,
        hasSmtp: !!accountData?.smtp,
        pop3Keys: accountData?.pop3 ? Object.keys(accountData.pop3) : [],
        smtpKeys: accountData?.smtp ? Object.keys(accountData.smtp) : [],
        hasPop3PasswordEnc: !!accountData?.pop3?.passwordEnc,
        hasSmtpPasswordEnc: !!accountData?.smtp?.passwordEnc,
        protocol: data.protocol,
      });
      
      // プロトコルに応じてパスワードフィールドを選択
      let passwordEnc: any;
      if (data.protocol === 'pop3') {
        passwordEnc = accountData?.pop3?.passwordEnc;
      } else {
        passwordEnc = accountData?.smtp?.passwordEnc;
      }

      if (!passwordEnc) {
        const protocolName = data.protocol.toUpperCase();
        functions.logger.warn(`accountTest: ${protocolName} password not found`, {
          protocol: data.protocol,
          accountId: data.accountId,
          hasPop3: !!accountData?.pop3,
          hasSmtp: !!accountData?.smtp,
        });
        return {
          success: false,
          errorMessage: `${protocolName} password not found in account`,
        };
      }

      // passwordEncが正しい形式（EncryptedData）であることを確認
      if (
        typeof passwordEnc !== 'object' ||
        !passwordEnc.ciphertext ||
        !passwordEnc.nonce ||
        !passwordEnc.tag
      ) {
        const protocolName = data.protocol.toUpperCase();
        functions.logger.warn(`accountTest: Invalid ${protocolName} passwordEnc format`, {
          protocol: data.protocol,
          accountId: data.accountId,
          passwordEncType: typeof passwordEnc,
          passwordEncKeys: passwordEnc && typeof passwordEnc === 'object' ? Object.keys(passwordEnc) : null,
          hasCiphertext: !!passwordEnc?.ciphertext,
          hasNonce: !!passwordEnc?.nonce,
          hasTag: !!passwordEnc?.tag,
        });
        return {
          success: false,
          errorMessage: `Invalid ${protocolName} passwordEnc format: expected {ciphertext, nonce, tag}`,
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

    // プロトコルに応じて接続テストを実行
    try {
      let result: AccountTestResponse;
      
      if (data.protocol === 'pop3') {
    // POP3S接続テストを実行
        result = await testPop3Connection(
          data.host,
          data.port,
          data.useSsl,
          data.userName,
          password
        );
      } else {
        // SMTP接続テストを実行
        result = await testSmtpConnection(
        data.host,
        data.port,
        data.useSsl,
        data.userName,
        password
      );
      }

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

