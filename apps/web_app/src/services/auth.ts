import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { firebaseApp } from './firebase';

const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

export const authService = {
  /**
   * Googleアカウントでログインする
   * @returns 認証されたユーザー
   * @throws ログインがキャンセルされた場合やエラーが発生した場合
   */
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: unknown) {
      // ログインキャンセル時のエラーは静かに処理
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as any).code === 'auth/popup-closed-by-user'
      ) {
        const e = new Error('Login cancelled');
        (e as any).code = 'auth/popup-closed-by-user';
        throw e;
      }
      throw error;
    }
  },

  /**
   * ログアウトする
   */
  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  /**
   * 認証状態の変更を監視する
   * @param callback 認証状態が変更されたときに呼び出されるコールバック関数
   * @returns 監視を停止する関数
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * 現在のユーザーを取得する
   * @returns 現在ログインしているユーザー、またはnull
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  },
};
