import { vi } from 'vitest';

// Firebaseのモックを設定
vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
}));

// Vue Routerのモック
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => ({
      params: {},
      query: {},
      path: '/',
    }),
    useRouter: () => ({
      push: () => {},
      replace: () => {},
    }),
  };
});

// CSSインポートのモックはvitest.config.tsで処理
