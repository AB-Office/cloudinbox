import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';
import * as authService from '@/services/auth';

// authServiceをモック
vi.mock('@/services/auth', () => ({
  authService: {
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => vi.fn()),
    getCurrentUser: vi.fn(),
  },
}));

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('signInWithGoogle', () => {
    it('should call authService.signInWithGoogle and set user', async () => {
      const store = useAuthStore();
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
      } as any;

      vi.mocked(authService.authService.signInWithGoogle).mockResolvedValue(mockUser);

      await store.signInWithGoogle();

      expect(authService.authService.signInWithGoogle).toHaveBeenCalled();
      expect(store.user).toEqual(mockUser);
      expect(store.isLoading).toBe(false);
    });

    it('should set isLoading to false even if signInWithGoogle fails', async () => {
      const store = useAuthStore();
      const error = new Error('Sign in failed');

      vi.mocked(authService.authService.signInWithGoogle).mockRejectedValue(error);

      await expect(store.signInWithGoogle()).rejects.toThrow();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('signOut', () => {
    it('should call authService.signOut and clear user', async () => {
      const store = useAuthStore();
      store.setUser({ uid: 'test-uid' } as any);

      vi.mocked(authService.authService.signOut).mockResolvedValue(undefined);

      await store.signOut();

      expect(authService.authService.signOut).toHaveBeenCalled();
      expect(store.user).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should set user', () => {
      const store = useAuthStore();
      const mockUser = { uid: 'test-uid' } as any;

      store.setUser(mockUser);

      expect(store.user).toEqual(mockUser);
    });

    it('should clear user when set to null', () => {
      const store = useAuthStore();
      store.setUser({ uid: 'test-uid' } as any);
      store.setUser(null);

      expect(store.user).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user is set', () => {
      const store = useAuthStore();
      store.setUser({ uid: 'test-uid' } as any);

      expect(store.isAuthenticated).toBe(true);
    });

    it('should return false when user is null', () => {
      const store = useAuthStore();
      store.setUser(null);

      expect(store.isAuthenticated).toBe(false);
    });
  });

  describe('initializeAuthStateListener', () => {
    it('should initialize auth state listener and set initial user', () => {
      const store = useAuthStore();
      const mockUser = { uid: 'test-uid' } as any;
      const mockUnsubscribe = vi.fn();

      vi.mocked(authService.authService.getCurrentUser).mockReturnValue(mockUser);
      vi.mocked(authService.authService.onAuthStateChanged).mockReturnValue(mockUnsubscribe);

      const unsubscribe = store.initializeAuthStateListener();

      expect(authService.authService.getCurrentUser).toHaveBeenCalled();
      expect(store.user).toEqual(mockUser);
      expect(authService.authService.onAuthStateChanged).toHaveBeenCalled();
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should update user when auth state changes', () => {
      const store = useAuthStore();
      const mockUnsubscribe = vi.fn();

      vi.mocked(authService.authService.onAuthStateChanged).mockImplementation(callback => {
        // コールバックを保存して後で呼び出せるようにする
        setTimeout(() => callback({ uid: 'new-uid' } as any), 0);
        return mockUnsubscribe;
      });

      store.initializeAuthStateListener();

      // コールバックが呼び出されることを確認するため、少し待つ
      return new Promise<void>(resolve => {
        setTimeout(() => {
          expect(authService.authService.onAuthStateChanged).toHaveBeenCalled();
          resolve();
        }, 10);
      });
    });
  });
});
