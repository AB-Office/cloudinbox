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
    const result = await accountTest({
      protocol,
      host: protocol === 'pop3' ? formData.pop3Host : formData.smtpHost,
      port: protocol === 'pop3' ? formData.pop3Port : formData.smtpPort,
      useSsl: true,
      userName: protocol === 'pop3' ? formData.pop3Username : formData.smtpUsername,
      password:
        accountId && !(protocol === 'pop3' ? formData.pop3Password : formData.smtpPassword)
          ? undefined
          : protocol === 'pop3'
            ? formData.pop3Password
            : formData.smtpPassword,
      accountId,
    });

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
    let pop3PasswordEnc: string | null = null;
    let smtpPasswordEnc: string | null = null;

    if (formData.pop3Password) {
      const pop3Result = await encryptPassword({ password: formData.pop3Password });
      pop3PasswordEnc = (pop3Result.data as { encryptedPassword: string }).encryptedPassword;
    }

    if (formData.smtpPassword && formData.smtpHost) {
      const smtpResult = await encryptPassword({ password: formData.smtpPassword });
      smtpPasswordEnc = (smtpResult.data as { encryptedPassword: string }).encryptedPassword;
    }

    const accountData = {
      label: formData.label,
      email: formData.email,
      pop3: {
        host: formData.pop3Host,
        port: formData.pop3Port,
        useSsl: true,
        userName: formData.pop3Username,
        passwordEnc: pop3PasswordEnc,
      },
      smtp: formData.smtpHost
        ? {
            host: formData.smtpHost,
            port: formData.smtpPort || 587,
            useSsl: true,
            userName: formData.smtpUsername || formData.pop3Username,
            passwordEnc: smtpPasswordEnc,
          }
        : undefined,
      status: 'active' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

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
    const updateData: Record<string, unknown> = {
      label: formData.label,
      email: formData.email,
      pop3: {
        host: formData.pop3Host,
        port: formData.pop3Port,
        useSsl: true,
        userName: formData.pop3Username,
      },
      updatedAt: Timestamp.now(),
    };

    // POP3パスワードが入力されている場合のみ更新
    if (formData.pop3Password) {
      const encryptPassword = httpsCallable(functions, 'encryptPassword');
      const result = await encryptPassword({ password: formData.pop3Password });
      (updateData.pop3 as Record<string, unknown>).passwordEnc = (
        result.data as { encryptedPassword: string }
      ).encryptedPassword;
    }

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
        smtpData.passwordEnc = (result.data as { encryptedPassword: string }).encryptedPassword;
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
