import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useConsentStore } from '@/stores/consent';
import { authService } from '@/services/auth';

const router = createRouter({
  history: createWebHistory('/mail'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/',
      name: 'mail-list',
      component: () => import('@/views/MailListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/compose',
      name: 'compose',
      component: () => import('@/views/ComposeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:threadId',
      name: 'mail-detail',
      component: () => import('@/views/MailDetailView.vue'),
      meta: { requiresAuth: true },
      // モバイル・タブレット専用（1列レイアウト時のみ使用）
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/plan',
      name: 'plan-selection',
      component: () => import('@/views/PlanSelectionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/accounts',
      name: 'account-list',
      component: () => import('@/views/AccountListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/accounts/new',
      name: 'account-new',
      component: () => import('@/views/AccountFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/accounts/:accountId',
      name: 'account-edit',
      component: () => import('@/views/AccountFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/legal-consent',
      name: 'legal-consent',
      component: () => import('@/views/LegalConsentView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  const consentStore = useConsentStore();

  // ログインページはスキップ
  if (to.path === '/login') {
    if (authStore.isAuthenticated) {
      return next({ name: 'mail-list' });
    }
    return next();
  }

  // 認証状態の初期化待ち（未確定時のみ）
  if (to.meta.requiresAuth && authStore.user === null) {
    await new Promise<void>(resolve => {
      const unsub = authService.onAuthStateChanged(user => {
        authStore.setUser(user);
        unsub();
        resolve();
      });
    });
  }

  // 認証チェック
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' });
    return;
  }

  // 同意チェック（認証済みの場合のみ）
  if (to.meta.requiresAuth && authStore.isAuthenticated) {
    const consentRequired = await consentStore.isConsentRequired();
    if (consentRequired && to.name !== 'legal-consent') {
      next({ name: 'legal-consent' });
      return;
    }
  }

  next();
});

export default router;
