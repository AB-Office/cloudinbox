<template>
  <v-card class="fill-height d-flex flex-column position-relative" flat>
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
    <v-card-text
      v-else-if="message"
      class="flex-grow-1 overflow-y-auto"
      style="padding-bottom: 80px"
    >
      <!-- メールヘッダー（タイトルとケバブメニュー付き） -->
      <mail-header :message="message" :attachments="attachments">
        <template #title-append>
          <!-- ケバブメニュー（返信・転送） -->
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn icon variant="text" v-bind="menuProps" size="small" class="ml-2">
                <v-icon>mdi-dots-vertical</v-icon>
              </v-btn>
            </template>
            <v-list>
              <v-list-item @click="handleReply">
                <template #prepend>
                  <v-icon>mdi-reply</v-icon>
                </template>
                <v-list-item-title>{{ t('mail.reply') }}</v-list-item-title>
              </v-list-item>
              <v-list-item @click="handleReplyAll">
                <template #prepend>
                  <v-icon>mdi-reply-all</v-icon>
                </template>
                <v-list-item-title>{{ t('mail.replyAll') }}</v-list-item-title>
              </v-list-item>
              <v-list-item @click="handleForward">
                <template #prepend>
                  <v-icon>mdi-forward</v-icon>
                </template>
                <v-list-item-title>{{ t('mail.forward') }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </mail-header>

      <!-- メール本文 -->
      <mail-body :decrypted-body="decryptedBody" />
    </v-card-text>

    <!-- ボトムナビゲーションバー（アイコンボタン） -->
    <v-bottom-navigation
      v-if="message"
      color="primary"
      height="64"
      class="mail-detail-actions"
      :fixed="false"
    >
      <!-- ゴミ箱・アーカイブボタン -->
      <v-btn @click="handleMoveToTrash">
        <v-icon>mdi-delete</v-icon>
        <span class="text-caption">{{ t('mail.moveToTrash') }}</span>
      </v-btn>
      <v-btn v-if="!isTrash" @click="handleArchive">
        <v-icon>mdi-archive</v-icon>
        <span class="text-caption">{{ t('mail.archive') }}</span>
      </v-btn>
      <v-btn v-if="isAllMail && !isTrash" @click="handleUnarchive">
        <v-icon>mdi-inbox</v-icon>
        <span class="text-caption">{{ t('mail.restoreToInbox') }}</span>
      </v-btn>
      <v-btn v-if="isTrash" @click="handleRestoreFromTrash">
        <v-icon>mdi-restore</v-icon>
        <span class="text-caption">{{ t('mail.restoreFromTrash') }}</span>
      </v-btn>
    </v-bottom-navigation>

    <!-- スナックバー（エラー表示用） -->
    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="5000" location="bottom">
      {{ snackbarText }}
      <template #actions>
        <v-btn variant="text" @click="snackbar = false">{{ t('common.close') }}</v-btn>
      </template>
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MailMessage, DecryptedMailBody, AttachmentListItem } from '@/types/mail';
import { useMailStore } from '@/stores/mail';
import MailHeader from './MailHeader.vue';
import MailBody from './MailBody.vue';
import { useSnackbar } from '@/composables/useSnackbar';

interface Props {
  message: MailMessage | null;
  isLoading: boolean;
  error: string | null;
  label?: string; // 現在のラベル（'inbox', 'trash', 'all'）
}

const props = defineProps<Props>();

const { t } = useI18n();
const mailStore = useMailStore();
const { snackbar, snackbarText, snackbarColor, showError } = useSnackbar();

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

/**
 * 返信ボタンのハンドラ
 */
function handleReply() {
  // TODO: 返信機能を実装
  console.log('Reply:', props.message?.messageId);
}

/**
 * 全員に返信ボタンのハンドラ
 */
function handleReplyAll() {
  // TODO: 全員に返信機能を実装
  console.log('Reply All:', props.message?.messageId);
}

/**
 * 転送ボタンのハンドラ
 */
function handleForward() {
  // TODO: 転送機能を実装
  console.log('Forward:', props.message?.messageId);
}

/**
 * ゴミ箱に移動ボタンのハンドラ
 */
async function handleMoveToTrash() {
  if (!props.message) return;

  try {
    await mailStore.moveToTrash(props.message.messageId);
  } catch (e: unknown) {
    showError(e);
  }
}

/**
 * アーカイブボタンのハンドラ
 */
async function handleArchive() {
  if (!props.message) return;

  try {
    await mailStore.archive(props.message.messageId);
  } catch (e: unknown) {
    showError(e);
  }
}

/**
 * 受信箱に戻すボタンのハンドラ
 */
async function handleUnarchive() {
  if (!props.message) return;

  try {
    await mailStore.restoreToInbox(props.message.messageId);
  } catch (e: unknown) {
    showError(e);
  }
}

/**
 * ゴミ箱から復元ボタンのハンドラ
 */
async function handleRestoreFromTrash() {
  if (!props.message) return;

  try {
    await mailStore.restoreFromTrash(props.message.messageId);
  } catch (e: unknown) {
    showError(e);
  }
}

/**
 * ゴミ箱かどうかを判定
 */
const isTrash = computed(() => {
  return props.message?.labels?.includes('trash') ?? false;
});

/**
 * すべてのメール一覧を表示中かどうかを判定
 */
const isAllMail = computed(() => props.label === 'all');
</script>

<style scoped>
.fill-height {
  height: 100%;
}

.mail-detail-actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
  background-color: rgb(var(--v-theme-surface));
}
</style>
