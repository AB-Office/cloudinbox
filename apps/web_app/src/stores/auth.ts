import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { type User } from 'firebase/auth';
import { authService } from '@/services/auth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(false);

  const isAuthenticated = computed(() => user.value !== null);

  /**
   * Googleアカウントでログインする
   */
  async function signInWithGoogle() {
    isLoading.value = true;
    try {
      user.value = await authService.signInWithGoogle();
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * ログアウトする
   */
  async function signOut() {
    await authService.signOut();
    user.value = null;
  }

  /**
   * ユーザーを設定する（認証状態監視から呼び出される）
   */
  function setUser(newUser: User | null) {
    user.value = newUser;
  }

  /**
   * 認証状態の監視を初期化する
   */
  function initializeAuthStateListener() {
    // 初期状態を設定
    user.value = authService.getCurrentUser();

    // 認証状態の変更を監視
    const unsubscribe = authService.onAuthStateChanged(firebaseUser => {
      setUser(firebaseUser);
    });

    return unsubscribe;
  }

  // ストアが初期化されたときに認証状態の監視を開始
  // 注意: PiniaストアではonMountedが使えないため、明示的に呼び出す必要がある
  // または、main.tsでストアを初期化した後に呼び出す

  return {
    user,
    isLoading,
    isAuthenticated,
    signInWithGoogle,
    signOut,
    setUser,
    initializeAuthStateListener,
  };
});
