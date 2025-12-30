<template>
  <v-container fluid class="pa-0 fill-height">
    <v-row no-gutters class="fill-height">
      <!-- メール一覧パネル -->
      <v-col :cols="isDesktop ? 4 : 12" :md="isDesktop ? 4 : 12" :lg="isDesktop ? 4 : 12">
        <mail-list-panel :label="currentLabel" @select-thread="handleSelectThread" />
      </v-col>

      <!-- メール詳細パネル（デスクトップのみ表示） -->
      <v-col v-if="isDesktop" cols="8" md="8" lg="8" class="fill-height">
        <mail-detail-panel
          :message="currentMessage"
          :is-loading="mailStore.isLoading"
          :error="mailStore.error"
          :label="currentLabel"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useMailStore } from '@/stores/mail';
import MailListPanel from '@/components/MailListPanel.vue';
import MailDetailPanel from '@/components/MailDetailPanel.vue';

const route = useRoute();
const router = useRouter();
const { mdAndUp } = useDisplay();
const mailStore = useMailStore();

const isDesktop = computed(() => mdAndUp.value);
const currentMessage = computed(() => mailStore.currentMessage);

// ルートのクエリパラメータからラベルを取得（デフォルトは'inbox'）
const currentLabel = computed(() => {
  const label = route.query.label as string;
  if (label === 'trash' || label === 'all') {
    return label;
  }
  return 'inbox';
});

/**
 * メールスレッド選択時の処理
 */
function handleSelectThread(threadId: string) {
  if (isDesktop.value) {
    // デスクトップ: 2列レイアウト - 同一画面内で更新
    mailStore.selectThread(threadId);
  } else {
    // モバイル・タブレット: 1列レイアウト - 画面遷移
    router.push(`/${threadId}`);
  }
}

/**
 * 初期データの読み込み
 */
async function loadInitialData() {
  // ラベルが変更された場合は、ストアをリセットしてから新しいデータを読み込む
  await mailStore.reset();
  await mailStore.fetchThreads(currentLabel.value);
}

// ラベルが変更されたときにデータを再読み込み
watch(currentLabel, () => {
  loadInitialData();
});

onMounted(() => {
  loadInitialData();
});
</script>

<style scoped>
.fill-height {
  height: 100%;
}
</style>
