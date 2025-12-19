/**
 * encryptPassword - パスワード暗号化
 * 
 * アカウント作成時にパスワードを暗号化するFunction
 */

import * as functions from 'firebase-functions';
import { encryptPassword } from '../encryption';

/**
 * パスワード暗号化リクエストの型定義
 */
interface EncryptPasswordRequest {
  password: string; // 平文パスワード
}

/**
 * パスワード暗号化結果の型定義
 */
interface EncryptPasswordResponse {
  passwordEnc: {
    ciphertext: string;
    nonce: string;
    tag: string;
  };
}

/**
 * パスワードを暗号化するHTTP Callable Function
 */
export const encryptPasswordFunction: any = functions.region('asia-northeast1').https.onCall(
  async (data: EncryptPasswordRequest, context: functions.https.CallableContext): Promise<EncryptPasswordResponse> => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const uid = context.auth.uid;

    // パラメータ検証
    if (!data.password) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Password is required'
      );
    }

    try {
      // パスワードを暗号化
      const passwordEnc = await encryptPassword(uid, data.password);

      return {
        passwordEnc: {
          ciphertext: passwordEnc.ciphertext,
          nonce: passwordEnc.nonce,
          tag: passwordEnc.tag,
        },
      };
    } catch (error: any) {
      functions.logger.error('Error encrypting password:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to encrypt password: ${error.message}`
      );
    }
  }
);

