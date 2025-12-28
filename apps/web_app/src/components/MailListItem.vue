<template>
  <v-list-item :value="thread.threadId" @click="$emit('click', thread.threadId)">
    <template #prepend>
      <v-icon v-if="thread.hasUnread" color="primary" size="small">mdi-circle</v-icon>
      <v-icon v-else color="grey" size="small">mdi-circle-outline</v-icon>
    </template>

    <v-list-item-title>
      <span :class="{ 'font-weight-bold': thread.hasUnread }">{{ thread.subject }}</span>
    </v-list-item-title>

    <v-list-item-subtitle>
      <div class="d-flex align-center">
        <span class="text-truncate">{{ thread.from }}</span>
        <v-spacer></v-spacer>
        <span class="text-caption text-grey">{{ formattedDate }}</span>
      </div>
      <div class="text-caption text-truncate mt-1">{{ thread.preview }}</div>
    </v-list-item-subtitle>

    <template #append>
      <v-chip v-if="thread.labels && thread.labels.length > 0" size="x-small" class="ml-2">
        {{ thread.labels[0] }}
      </v-chip>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Timestamp } from 'firebase/firestore';
import type { MailThread } from '@/types/mail';
import { formatRelativeTime } from '@/plugins/i18n';

interface Props {
  thread: MailThread;
}

const props = defineProps<Props>();

defineEmits<{
  click: [threadId: string];
}>();

const { t } = useI18n();

/**
 * 日付をフォーマットする
 */
const formattedDate = computed(() => {
  if (!props.thread.sentAt) return '';

  // TimestampをDateに変換
  const date =
    props.thread.sentAt instanceof Date
      ? props.thread.sentAt
      : (props.thread.sentAt as Timestamp).toDate();

  // 相対的な日付フォーマットを使用（例: "2時間前"）
  const relativeTime = formatRelativeTime(date, t);
  return relativeTime;
});
</script>

<style scoped>
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
