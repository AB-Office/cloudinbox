<template>
  <v-card class="fill-height d-flex flex-column" flat>
    <!-- プレースホルダー: メールが選択されていない場合 -->
    <div
      v-if="!message && !isLoading && !error"
      class="fill-height d-flex align-center justify-center"
    >
      <div class="text-center pa-8">
        <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-email-outline</v-icon>
        <p class="text-h6 text-grey">{{ t('mail.selectMessage') }}</p>
      </div>
    </div>

    <!-- ローディング状態 -->
    <div
      v-else-if="isLoading || isDecrypting"
      class="fill-height d-flex align-center justify-center"
    >
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <!-- エラーメッセージ -->
    <div v-else-if="error || decryptError" class="pa-4">
      <v-alert type="error" variant="tonal" :text="error || decryptError || ''"></v-alert>
    </div>

    <!-- メール詳細: メールが選択されている場合 -->
    <v-card-text v-else-if="message" class="flex-grow-1 overflow-y-auto">
      <!-- メールヘッダー -->
      <mail-header :message="message" :attachments="attachments" />

      <!-- メール本文 -->
      <mail-body :decrypted-body="decryptedBody" />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MailMessage, DecryptedMailBody, AttachmentListItem } from '@/types/mail';
import { useMailStore } from '@/stores/mail';
import MailHeader from './MailHeader.vue';
import MailBody from './MailBody.vue';

interface Props {
  message: MailMessage | null;
  isLoading: boolean;
  error: string | null;
}

const props = defineProps<Props>();

const { t } = useI18n();
const mailStore = useMailStore();

// 復号化されたメール本文（キャッシュしない - 表示用の一時的な状態のみ）
const decryptedBody = ref<DecryptedMailBody | null>(null);
const isDecrypting = ref(false);
const decryptError = ref<string | null>(null);
const attachments = ref<AttachmentListItem[]>([]);

/**
 * メール本文を復号化する
 */
async function decryptBody(messageId: string) {
  // 前回の復号化結果をクリア（キャッシュしない）
  decryptedBody.value = null;
  decryptError.value = null;
  isDecrypting.value = true;

  try {
    // 本文を復号化
    const body = await mailStore.decryptMailBody(messageId);
    decryptedBody.value = body;

    // 添付ファイル一覧を取得
    const attachmentList = await mailStore.getAttachmentsList(messageId);
    attachments.value = attachmentList;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    decryptError.value = errorMessage;
    console.error('Failed to decrypt mail body:', e);
  } finally {
    isDecrypting.value = false;
  }
}

/**
 * メールが変更されたときに復号化を実行
 */
watch(
  () => props.message?.messageId,
  async (newMessageId, oldMessageId) => {
    // メッセージIDが変更された場合のみ復号化を実行
    if (newMessageId && newMessageId !== oldMessageId) {
      // メールを既読にする
      if (props.message) {
        await mailStore.markAsRead(props.message.messageId, props.message.threadId);
      }
      // 本文を復号化
      await decryptBody(newMessageId);
    } else if (!newMessageId) {
      // メッセージが選択されていない場合は復号化結果をクリア
      decryptedBody.value = null;
      decryptError.value = null;
      attachments.value = [];
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.fill-height {
  height: 100%;
}
</style>
