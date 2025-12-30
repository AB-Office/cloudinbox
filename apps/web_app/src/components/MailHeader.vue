<template>
  <v-card class="mail-header" variant="outlined">
    <v-card-title class="text-h6 pb-2 d-flex align-center">
      <span class="flex-grow-1 text-truncate">{{ message.subject }}</span>
      <slot name="title-append"></slot>
    </v-card-title>

    <v-card-text>
      <div class="mb-3">
        <div class="d-flex align-center mb-1">
          <span class="text-caption text-grey mr-2">{{ t('mail.from') }}:</span>
          <span>{{ message.from }}</span>
        </div>

        <div v-if="message.to && message.to.length > 0" class="d-flex align-center mb-1">
          <span class="text-caption text-grey mr-2">{{ t('mail.to') }}:</span>
          <span>{{ message.to.join(', ') }}</span>
        </div>

        <div v-if="message.cc && message.cc.length > 0" class="d-flex align-center mb-1">
          <span class="text-caption text-grey mr-2">{{ t('mail.cc') }}:</span>
          <span>{{ message.cc.join(', ') }}</span>
        </div>

        <div v-if="message.bcc && message.bcc.length > 0" class="d-flex align-center mb-1">
          <span class="text-caption text-grey mr-2">{{ t('mail.bcc') }}:</span>
          <span>{{ message.bcc.join(', ') }}</span>
        </div>

        <div class="d-flex align-center mb-1">
          <span class="text-caption text-grey mr-2">{{ t('mail.sentAt') }}:</span>
          <span>{{ formattedDate }}</span>
        </div>
      </div>

      <!-- 添付ファイル情報 -->
      <div v-if="attachments && attachments.length > 0">
        <div class="text-caption text-grey mb-2">{{ t('mail.attachments') }}:</div>
        <div class="d-flex flex-wrap gap-2">
          <v-chip
            v-for="attachment in attachments"
            :key="attachment.filename"
            size="small"
            variant="outlined"
            prepend-icon="mdi-paperclip"
            :disabled="isDownloading"
            :loading="downloadingFiles.includes(attachment.filename)"
            style="cursor: pointer"
            @click="handleAttachmentClick(attachment)"
          >
            {{ attachment.filename }}
            <span class="ml-1 text-caption">({{ formatFileSize(attachment.size, t) }})</span>
          </v-chip>
        </div>
      </div>
      <div v-else-if="message.hasAttachments" class="text-caption text-grey">
        {{ t('mail.noAttachments') }}
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Timestamp } from 'firebase/firestore';
import type { MailMessage, AttachmentListItem } from '@/types/mail';
import { formatFileSize } from '@/plugins/i18n';
import { useMailStore } from '@/stores/mail';
import { useSnackbar } from '@/composables/useSnackbar';

interface Props {
  message: MailMessage;
  attachments?: AttachmentListItem[];
}

const props = defineProps<Props>();

const { t, d } = useI18n();
const mailStore = useMailStore();
const { showError } = useSnackbar();

const downloadingFiles = ref<string[]>([]);
const isDownloading = computed(() => downloadingFiles.value.length > 0);

/**
 * 日付をフォーマットする
 */
const formattedDate = computed(() => {
  if (!props.message.sentAt) return '';

  // TimestampをDateに変換
  const date =
    props.message.sentAt instanceof Date
      ? props.message.sentAt
      : (props.message.sentAt as Timestamp).toDate();

  // ロケールに応じた日時フォーマット
  return d(date, 'long');
});

/**
 * 添付ファイルをクリックした時の処理
 */
async function handleAttachmentClick(attachment: AttachmentListItem) {
  if (downloadingFiles.value.includes(attachment.filename)) return;

  downloadingFiles.value.push(attachment.filename);
  try {
    await mailStore.downloadAttachment(props.message.messageId, attachment.filename);
  } catch (e) {
    showError(e);
  } finally {
    const index = downloadingFiles.value.indexOf(attachment.filename);
    if (index > -1) {
      downloadingFiles.value.splice(index, 1);
    }
  }
}
</script>

<style scoped>
.mail-header {
  margin-bottom: 16px;
}
</style>
