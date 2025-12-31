<template>
  <div class="mail-list-panel">
    <v-list v-if="threads.length > 0" class="pa-0">
      <template v-for="(thread, index) in threads" :key="thread.threadId">
        <mail-list-item
          :thread="thread"
          :class="{ 'mail-item-selected': thread.threadId === selectedThreadId }"
          @click="handleThreadClick"
        />
        <v-divider v-if="index < threads.length - 1" />
      </template>
    </v-list>

    <!-- ローディングインジケーター -->
    <div v-if="isLoading" class="d-flex justify-center pa-4">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <!-- すべてのメールを読み込みましたメッセージ -->
    <div
      v-if="!hasMore && !isLoading && threads.length > 0"
      class="text-center pa-4 text-caption text-grey"
    >
      {{ t('mail.allMailLoaded') }}
    </div>

    <!-- 無限スクロール用のトリガー要素 -->
    <div ref="scrollTrigger" class="scroll-trigger"></div>

    <!-- エラーメッセージ -->
    <v-alert v-if="error" type="error" variant="tonal" class="ma-2">
      {{ error }}
    </v-alert>

    <!-- 空の状態 -->
    <div
      v-if="!isLoading && threads.length === 0 && !error"
      class="d-flex align-center justify-center pa-8"
    >
      <div class="text-center text-grey">
        <v-icon size="large" class="mb-2">mdi-email-outline</v-icon>
        <p>{{ t('mail.inbox') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMailStore } from '@/stores/mail';
import MailListItem from './MailListItem.vue';

interface Props {
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: 'inbox',
});

const emit = defineEmits<{
  'select-thread': [threadId: string];
}>();

const { t } = useI18n();
const mailStore = useMailStore();

const scrollTrigger = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

// ストアから状態を取得
const threads = computed(() => mailStore.threads);
const selectedThreadId = computed(() => mailStore.selectedThreadId);
const isLoading = computed(() => mailStore.isLoading);
const error = computed(() => mailStore.error);
const hasMore = computed(() => mailStore.hasMore);

/**
 * スレッドクリック時の処理
 */
function handleThreadClick(threadId: string) {
  emit('select-thread', threadId);
}

/**
 * Intersection Observerを設定
 */
function setupIntersectionObserver() {
  if (typeof window === 'undefined' || !scrollTrigger.value) return;

  observer = new IntersectionObserver(
    entries => {
      const entry = entries[0];
      if (entry.isIntersecting && hasMore.value && !isLoading.value) {
        // 追加読み込みを実行
        mailStore.loadMore(props.label);
      }
    },
    {
      root: null,
      rootMargin: '200px', // 画面下端から200px手前でトリガー
      threshold: 0.1,
    }
  );

  observer.observe(scrollTrigger.value);
}

/**
 * Intersection Observerをクリーンアップ
 */
function cleanupIntersectionObserver() {
  if (observer && scrollTrigger.value) {
    observer.unobserve(scrollTrigger.value);
    observer.disconnect();
    observer = null;
  }
}

// スクロールトリガー要素が変更されたときにObserverを再設定
watch(scrollTrigger, newVal => {
  if (newVal) {
    cleanupIntersectionObserver();
    setupIntersectionObserver();
  }
});

onMounted(() => {
  setupIntersectionObserver();
});

onUnmounted(() => {
  cleanupIntersectionObserver();
});
</script>

<style scoped>
.mail-list-panel {
  height: 100%;
  overflow-y: auto;
  padding-top: 8px;
}

.mail-item-selected {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.scroll-trigger {
  height: 1px;
  width: 100%;
}
</style>
