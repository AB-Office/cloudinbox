<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { formatFileSize } from '@/plugins/i18n';
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { mdAndUp } = useDisplay();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

// ログイン画面ではナビゲーションを表示しない
const showNavigation = computed(() => {
  return authStore.isAuthenticated && route.name !== 'login';
});

// デスクトップかモバイルかを判定
const isMobile = computed(() => !mdAndUp.value);

// ナビゲーションドロワーの開閉状態
// デフォルト: デスクトップ（2列）は開く、モバイル（1列）は閉じる
const drawer = ref(mdAndUp.value);

// 画面サイズ変更時にデフォルト状態を更新
watch(
  () => mdAndUp.value,
  newValue => {
    // 画面サイズが変わったとき、初期状態にリセット
    // （ユーザーが手動で開閉した場合は保持したいが、簡単のためデフォルトにリセット）
    drawer.value = newValue;
  }
);

// モバイルでは、ルート変更時にドロワーを閉じる
watch(
  () => route.path,
  () => {
    if (isMobile.value) {
      drawer.value = false;
    }
  }
);

// ナビゲーションアイテム
const navItems = [
  {
    title: t('mail.inbox'),
    icon: 'mdi-inbox',
    route: { name: 'mail-list' },
    label: 'inbox',
  },
  {
    title: t('mail.all'),
    icon: 'mdi-email',
    route: { name: 'mail-list', query: { label: 'all' } },
    label: 'all',
  },
  {
    title: t('mail.sent'),
    icon: 'mdi-send',
    route: { name: 'mail-list', query: { label: 'sent' } },
    label: 'sent',
  },
  {
    title: t('mail.trash'),
    icon: 'mdi-delete',
    route: { name: 'mail-list', query: { label: 'trash' } },
    label: 'trash',
  },
  {
    title: t('navigation.settings'),
    icon: 'mdi-cog',
    route: { name: 'settings' },
    label: 'settings',
  },
];

// アクティブなルートかどうかを判定
function isActiveRoute(item: (typeof navItems)[number]): boolean {
  const currentRoute = route.name as string;

  // 設定画面の場合
  if (item.label === 'settings') {
    return currentRoute === 'settings' || currentRoute?.startsWith('account-');
  }

  // メールリスト関連の場合
  if (item.label === 'inbox') {
    // 受信トレイはデフォルトのmail-list（クエリパラメータなし）と一致する場合
    return currentRoute === 'mail-list' && !route.query.label;
  }

  // すべてのメール、送信済み、ゴミ箱の場合
  if (item.label === 'all' || item.label === 'sent' || item.label === 'trash') {
    return currentRoute === 'mail-list' && route.query.label === item.label;
  }

  return false;
}

// ログアウト処理
async function handleLogout() {
  await authStore.signOut();
  router.push('/login');
}

// 容量情報のフォーマット済み表示
const formattedStorageInfo = computed(() => {
  if (!settingsStore.settings) {
    return null;
  }
  const { planLabel, maxStorageBytes, usedStorageBytes } = settingsStore.settings;
  const availableBytes = maxStorageBytes - usedStorageBytes;
  const usagePercent = maxStorageBytes > 0 ? ((usedStorageBytes / maxStorageBytes) * 100).toFixed(1) : '0.0';
  
  return {
    planLabel,
    usedStorage: formatFileSize(usedStorageBytes, t),
    maxStorage: formatFileSize(maxStorageBytes, t),
    availableStorage: formatFileSize(availableBytes, t),
    usagePercent,
  };
});

// 認証状態が変わったときに容量情報の監視を開始/停止
watch(
  () => authStore.isAuthenticated,
  isAuthenticated => {
    settingsStore.stopWatching();
    if (isAuthenticated) {
      settingsStore.startWatching();
    } else {
      settingsStore.settings = null;
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (authStore.isAuthenticated) {
    settingsStore.startWatching();
  }
});

onUnmounted(() => {
  settingsStore.stopWatching();
});
</script>

<template>
  <v-app>
    <!-- ナビゲーションバー（App Bar） -->
    <v-app-bar v-if="showNavigation" color="primary" prominent>
      <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>

      <v-toolbar-title>{{ t('auth.appTitle') }}</v-toolbar-title>

      <v-spacer></v-spacer>

      <v-btn variant="text" @click="handleLogout">
        <v-icon start>mdi-logout</v-icon>
        {{ t('common.logout') }}
      </v-btn>
    </v-app-bar>

    <!-- ナビゲーションドロワー（サイドバー） -->
    <v-navigation-drawer
      v-if="showNavigation"
      v-model="drawer"
      :permanent="!isMobile"
      :temporary="isMobile"
    >
      <v-list nav density="comfortable">
        <v-list-item
          v-for="item in navItems"
          :key="item.title"
          :prepend-icon="item.icon"
          :title="item.title"
          :active="isActiveRoute(item)"
          @click="router.push(item.route)"
        ></v-list-item>
      </v-list>

      <!-- 容量情報表示（ドロワー下部） -->
      <template v-if="formattedStorageInfo" #append>
        <v-divider />
        <div class="pa-4">
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t('settings.plan') }}: {{ formattedStorageInfo.planLabel }}
          </div>
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t('settings.usedStorage') }}: {{ formattedStorageInfo.usedStorage }} / {{ formattedStorageInfo.maxStorage }} ({{ formattedStorageInfo.usagePercent }}%)
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ t('settings.availableStorage') }}: {{ formattedStorageInfo.availableStorage }}
          </div>
        </div>
      </template>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<style scoped>
</style>
