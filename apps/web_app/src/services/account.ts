import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebase';
import type { MailAccount, AccountFormData, AccountTestResult } from '@/types/account';

const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, 'asia-northeast1');

/**
 * プラン上限チェック
 * 現在のアカウント数とプランの上限を比較する
 */
async function checkPlanLimit(): Promise<void> {
  const auth = getAuth(firebaseApp);
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User not authenticated');

  // ユーザーのプラン情報を取得
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error('User document not found');
  }

  const userData = userSnap.data();
  const plan = userData.plan;
  if (!plan || !plan.maxAccounts) {
    throw new Error('Plan information not found');
  }

  // アクティブなアカウント数を取得
  const accountsQuery = query(
    collection(db, 'users', uid, 'mailAccounts'),
    where('status', '==', 'active')
  );
  const accountsSnapshot = await getDocs(accountsQuery);
  const currentAccountCount = accountsSnapshot.size;

  // 上限チェック
  if (currentAccountCount >= plan.maxAccounts) {
    throw new Error(`Account limit reached. Maximum ${plan.maxAccounts} accounts allowed.`);
  }
}

export const accountService = {
  /**
   * アカウント一覧を取得する
   * @param includeInactive 非アクティブなアカウントも含めるかどうか
   * @returns アカウント一覧
   */
  async listAccounts(includeInactive: boolean = false): Promise<MailAccount[]> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    let q = query(collection(db, 'users', uid, 'mailAccounts'));
    if (!includeInactive) {
      q = query(q, where('status', '==', 'active'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as MailAccount[];
  },

  /**
   * アカウントを取得する
   * @param accountId アカウントID
   * @returns アカウント情報、見つからない場合はnull
   */
  async getAccount(accountId: string): Promise<MailAccount | null> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const docRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as MailAccount;
  },

  /**
   * 接続テストを実行する
   * @param protocol プロトコル（'pop3' または 'smtp'）
   * @param formData フォームデータ
   * @param accountId 既存アカウントID（更新時は指定）
   * @returns テスト結果
   */
  async testConnection(
    protocol: 'pop3' | 'smtp',
    formData: AccountFormData,
    accountId?: string
  ): Promise<AccountTestResult> {
    const accountTest = httpsCallable(functions, 'accountTest');
    
    // デバッグ: 送信するデータを確認
    const password = accountId && !(protocol === 'pop3' ? formData.pop3Password : formData.smtpPassword)
      ? undefined
      : protocol === 'pop3'
        ? formData.pop3Password
        : formData.smtpPassword;
    
    const requestData = {
      protocol,
      host: protocol === 'pop3' ? formData.pop3Host : formData.smtpHost,
      port: protocol === 'pop3' ? formData.pop3Port : formData.smtpPort,
      useSsl: true,
      userName: protocol === 'pop3' ? formData.pop3Username : formData.smtpUsername,
      password,
      accountId,
    };
    
    // デバッグログ（パスワードの長さのみ表示）
    console.log('accountService.testConnection: sending request', {
      protocol,
      host: requestData.host,
      port: requestData.port,
      userName: requestData.userName,
      hasPassword: !!requestData.password,
      passwordLength: requestData.password ? requestData.password.length : 0,
      accountId: requestData.accountId,
      formDataPop3Password: formData.pop3Password ? `[${formData.pop3Password.length} chars]` : 'empty',
      formDataSmtpPassword: formData.smtpPassword ? `[${formData.smtpPassword.length} chars]` : 'empty',
    });
    
    const result = await accountTest(requestData);

    const data = result.data as { success: boolean; errorMessage?: string };
    return {
      success: data.success,
      errorMessage: data.errorMessage,
    };
  },

  /**
   * アカウントを作成する
   * @param formData フォームデータ
   * @returns 作成されたアカウントID
   */
  async createAccount(formData: AccountFormData): Promise<string> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // プラン上限チェック
    await checkPlanLimit();

    // パスワードの暗号化はCloud Functionsで実行する
    // クライアント側ではプレーンテキストで送信し、Cloud Functionsで暗号化される
    const encryptPassword = httpsCallable(functions, 'encryptPassword');
    let pop3PasswordEnc: { ciphertext: string; nonce: string; tag: string } | null = null;
    let smtpPasswordEnc: { ciphertext: string; nonce: string; tag: string } | null = null;

    // POP3パスワードは必須
    if (!formData.pop3Password) {
      throw new Error('POP3 password is required');
    }

    const pop3Result = await encryptPassword({ password: formData.pop3Password });
    const pop3Data = pop3Result.data as
      | { passwordEnc: { ciphertext: string; nonce: string; tag: string } }
      | null
      | undefined;
    if (!pop3Data?.passwordEnc) {
      throw new Error('Failed to encrypt POP3 password');
    }
    pop3PasswordEnc = pop3Data.passwordEnc;

    if (formData.smtpPassword && formData.smtpHost) {
      const smtpResult = await encryptPassword({ password: formData.smtpPassword });
      const smtpData = smtpResult.data as
        | { passwordEnc: { ciphertext: string; nonce: string; tag: string } }
        | null
        | undefined;
      if (smtpData?.passwordEnc) {
        smtpPasswordEnc = smtpData.passwordEnc;
      }
    }

    const pop3DataObj: Record<string, unknown> = {
      host: formData.pop3Host,
      port: formData.pop3Port,
      useSsl: true,
      userName: formData.pop3Username,
      passwordEnc: pop3PasswordEnc,
    };

    const accountData: Record<string, unknown> = {
      label: formData.label,
      email: formData.email,
      pop3: pop3DataObj,
      status: 'active' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // SMTP設定が存在する場合のみ追加
    if (formData.smtpHost) {
      const smtpData: Record<string, unknown> = {
        host: formData.smtpHost,
        port: formData.smtpPort || 587,
        useSsl: true,
        userName: formData.smtpUsername || formData.pop3Username,
      };

      // passwordEncが存在する場合のみ追加
      if (smtpPasswordEnc) {
        smtpData.passwordEnc = smtpPasswordEnc;
      }

      accountData.smtp = smtpData;
    }

    const docRef = await addDoc(collection(db, 'users', uid, 'mailAccounts'), accountData);
    return docRef.id;
  },

  /**
   * アカウントを更新する
   * @param accountId アカウントID
   * @param formData フォームデータ
   */
  async updateAccount(accountId: string, formData: AccountFormData): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    
    // 既存のアカウントデータを取得（passwordEncを保持するため）
    const accountSnap = await getDoc(accountRef);
    const existingData = accountSnap.data();
    const existingPop3PasswordEnc = existingData?.pop3?.passwordEnc;

    const updateData: Record<string, unknown> = {
      label: formData.label,
      email: formData.email,
      updatedAt: Timestamp.now(),
    };

    // POP3設定を更新
    const pop3Data: Record<string, unknown> = {
      host: formData.pop3Host,
      port: formData.pop3Port,
      useSsl: true,
      userName: formData.pop3Username,
    };

    // POP3パスワードが入力されている場合は暗号化して更新、そうでない場合は既存の値を保持
    if (formData.pop3Password) {
      const encryptPassword = httpsCallable(functions, 'encryptPassword');
      const result = await encryptPassword({ password: formData.pop3Password });
      const resultData = result.data as
        | { passwordEnc: { ciphertext: string; nonce: string; tag: string } }
        | null
        | undefined;
      if (resultData?.passwordEnc) {
        pop3Data.passwordEnc = resultData.passwordEnc;
      } else {
        throw new Error('Failed to encrypt POP3 password');
      }
    } else if (existingPop3PasswordEnc) {
      // パスワードが入力されていない場合は既存のpasswordEncを保持
      pop3Data.passwordEnc = existingPop3PasswordEnc;
    } else {
      // 既存のpasswordEncも存在しない場合はエラー
      throw new Error('POP3 password is required');
    }

    updateData.pop3 = pop3Data;

    // SMTP設定
    if (formData.smtpHost) {
      const smtpData: Record<string, unknown> = {
        host: formData.smtpHost,
        port: formData.smtpPort || 587,
        useSsl: true,
        userName: formData.smtpUsername || formData.pop3Username,
      };

      // SMTPパスワードが入力されている場合のみ更新
      if (formData.smtpPassword) {
        const encryptPassword = httpsCallable(functions, 'encryptPassword');
        const result = await encryptPassword({ password: formData.smtpPassword });
        const resultData = result.data as
          | { passwordEnc: { ciphertext: string; nonce: string; tag: string } }
          | null
          | undefined;
        if (resultData?.passwordEnc) {
          smtpData.passwordEnc = resultData.passwordEnc;
        }
      }

      updateData.smtp = smtpData;
    }

    await updateDoc(accountRef, updateData);
  },

  /**
   * アカウントを削除する（論理削除）
   * @param accountId アカウントID
   */
  async deleteAccount(accountId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    await updateDoc(accountRef, {
      status: 'inactive',
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * アカウントを復元する
   * @param accountId アカウントID
   */
  async restoreAccount(accountId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // プラン上限チェック（復元時も必要）
    await checkPlanLimit();

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    await updateDoc(accountRef, {
      status: 'active',
      deletedAt: null,
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * アカウントを完全削除する（物理削除）
   * @param accountId アカウントID
   */
  async permanentlyDeleteAccount(accountId: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const accountRef = doc(db, 'users', uid, 'mailAccounts', accountId);
    await deleteDoc(accountRef);
  },
};
