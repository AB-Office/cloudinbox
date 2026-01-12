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

    // デバッグ: 受信したリクエストデータをログ出力
    functions.logger.info('accountTest: received request data', {
      protocol: data.protocol,
      host: data.host,
      port: data.port,
      useSsl: data.useSsl,
      userName: data.userName,
      hasPassword: !!data.password,
      passwordLength: data.password ? data.password.length : 0,
      accountId: data.accountId,
      dataKeys: Object.keys(data),
    });

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

    // パスワードが送信されている場合はそれを使用（新規アカウント作成前、または既存アカウントでパスワードが入力されている場合）
    if (data.password) {
      password = data.password;
    } else if (data.accountId) {
      // パスワードが送信されていない場合で、accountIdが指定されている場合はFirestoreから取得
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
        // Web側から送信されたデータとFirestoreのデータを比較
        requestHost: data.host,
        requestPort: data.port,
        requestUserName: data.userName,
        pop3Host: accountData?.pop3?.host,
        pop3Port: accountData?.pop3?.port,
        pop3UserName: accountData?.pop3?.userName,
        smtpHost: accountData?.smtp?.host,
        smtpPort: accountData?.smtp?.port,
        smtpUserName: accountData?.smtp?.userName,
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
        const hasPop3 = !!accountData?.pop3;
        const hasSmtp = !!accountData?.smtp;
        const pop3Keys = accountData?.pop3 ? Object.keys(accountData.pop3) : [];
        const smtpKeys = accountData?.smtp ? Object.keys(accountData.smtp) : [];
        
        functions.logger.warn(`accountTest: ${protocolName} password not found`, {
          protocol: data.protocol,
          accountId: data.accountId,
          hasPop3,
          hasSmtp,
          pop3Keys,
          smtpKeys,
          hasPop3PasswordEnc: !!accountData?.pop3?.passwordEnc,
          hasSmtpPasswordEnc: !!accountData?.smtp?.passwordEnc,
        });
        
        // より詳細なエラーメッセージを返す
        if (data.protocol === 'pop3' && !hasPop3) {
          return {
            success: false,
            errorMessage: 'POP3 configuration not found in account. Please update the account settings.',
          };
        } else if (data.protocol === 'pop3' && hasPop3 && !accountData?.pop3?.passwordEnc) {
          return {
            success: false,
            errorMessage: 'POP3 password not found in account. Please update the account with a password.',
          };
        } else if (data.protocol === 'smtp' && !hasSmtp) {
          return {
            success: false,
            errorMessage: 'SMTP configuration not found in account. Please update the account settings.',
          };
        } else if (data.protocol === 'smtp' && hasSmtp && !accountData?.smtp?.passwordEnc) {
          return {
            success: false,
            errorMessage: 'SMTP password not found in account. Please update the account with a password.',
          };
        } else {
          return {
            success: false,
            errorMessage: `${protocolName} password not found in account. Please update the account settings.`,
          };
        }
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
      // パスワードもaccountIdも指定されていない場合はエラー
      return {
        success: false,
        errorMessage: 'Password is required for new account test',
      };
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

