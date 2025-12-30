<template>
  <v-container fluid class="pa-0 fill-height">
    <!-- ヘッダー（戻るボタン付き） -->
    <v-app-bar color="primary" prominent>
      <v-btn icon variant="text" @click="handleBack">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <v-toolbar-title>{{ message?.subject || t('mail.detail') }}</v-toolbar-title>
    </v-app-bar>

    <!-- メール詳細コンテンツ -->
    <div class="fill-height overflow-y-auto">
      <!-- ローディング状態 -->
      <div v-if="isLoading || isDecrypting" class="fill-height d-flex align-center justify-center">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      </div>

      <!-- エラーメッセージ -->
      <div v-else-if="error || decryptError" class="pa-4">
        <v-alert type="error" variant="tonal" :text="error || decryptError || ''">
          <template #append>
            <v-btn variant="text" @click="handleBack">{{ t('common.back') }}</v-btn>
          </template>
        </v-alert>
      </div>

      <!-- メール詳細: メールが取得できた場合 -->
      <div v-else-if="message" class="pa-4">
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
      </div>

      <!-- メッセージが見つからない場合 -->
      <div v-else class="fill-height d-flex align-center justify-center">
        <div class="text-center pa-8">
          <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-email-off-outline</v-icon>
          <p class="text-h6 text-grey mb-4">{{ t('errors.mail.notFound') }}</p>
          <v-btn color="primary" @click="handleBack">{{ t('common.back') }}</v-btn>
        </div>
      </div>
    </div>

    <!-- ボトムナビゲーションバー（アイコンボタン） -->
    <v-bottom-navigation v-if="message" color="primary" height="64">
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
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { MailMessage, DecryptedMailBody, AttachmentListItem } from '@/types/mail';
import { useMailStore } from '@/stores/mail';
import MailHeader from '@/components/MailHeader.vue';
import MailBody from '@/components/MailBody.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const mailStore = useMailStore();

// メールメッセージの状態
const message = ref<MailMessage | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// 復号化されたメール本文（キャッシュしない - 表示用の一時的な状態のみ）
const decryptedBody = ref<DecryptedMailBody | null>(null);
const isDecrypting = ref(false);
const decryptError = ref<string | null>(null);
const attachments = ref<AttachmentListItem[]>([]);

/**
 * メールメッセージを取得する
 */
async function loadMessage(threadId: string) {
  isLoading.value = true;
  error.value = null;
  decryptedBody.value = null;
  decryptError.value = null;
  attachments.value = [];

  try {
    // スレッドから最新メッセージIDを取得
    const thread = mailStore.threads.find(t => t.threadId === threadId);
    if (!thread) {
      // スレッドが見つからない場合は、ストアからメッセージを直接取得を試みる
      // （メール一覧から遷移していない場合に備える）
      throw new Error('Thread not found');
    }

    const messageId = thread.latestMessageId;

    // メールメッセージを取得
    await mailStore.fetchMessage(messageId);

    // メールを既読にする
    await mailStore.markAsRead(messageId, threadId);

    // ストアからメッセージを取得
    message.value = mailStore.currentMessage;

    // 本文を復号化
    await decryptBody(messageId);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    error.value = errorMessage;
    console.error('Failed to load message:', e);
  } finally {
    isLoading.value = false;
  }
}

/**
 * メール本文を復号化する
 */
async function decryptBody(messageId: string) {
  isDecrypting.value = true;
  decryptError.value = null;

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
 * 戻るボタンのハンドラ
 */
function handleBack() {
  router.push('/');
}

/**
 * 返信ボタンのハンドラ
 */
function handleReply() {
  // TODO: 返信機能を実装
  console.log('Reply:', message.value?.messageId);
}

/**
 * 全員に返信ボタンのハンドラ
 */
function handleReplyAll() {
  // TODO: 全員に返信機能を実装
  console.log('Reply All:', message.value?.messageId);
}

/**
 * 転送ボタンのハンドラ
 */
function handleForward() {
  // TODO: 転送機能を実装
  console.log('Forward:', message.value?.messageId);
}

/**
 * ゴミ箱に移動ボタンのハンドラ
 */
async function handleMoveToTrash() {
  if (!message.value) return;

  try {
    await mailStore.moveToTrash(message.value.messageId);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('Failed to move message to trash:', errorMessage);
    // TODO: エラーメッセージをユーザーに表示
  }
}

/**
 * アーカイブボタンのハンドラ
 */
async function handleArchive() {
  if (!message.value) return;

  try {
    await mailStore.archive(message.value.messageId);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('Failed to archive message:', errorMessage);
    // TODO: エラーメッセージをユーザーに表示
  }
}

/**
 * 受信箱に戻すボタンのハンドラ
 */
async function handleUnarchive() {
  if (!message.value) return;

  try {
    await mailStore.restoreToInbox(message.value.messageId);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('Failed to restore message to inbox:', errorMessage);
    // TODO: エラーメッセージをユーザーに表示
  }
}

/**
 * ゴミ箱から復元ボタンのハンドラ
 */
async function handleRestoreFromTrash() {
  if (!message.value) return;

  try {
    await mailStore.restoreFromTrash(message.value.messageId);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('Failed to restore message from trash:', errorMessage);
    // TODO: エラーメッセージをユーザーに表示
  }
}

/**
 * ゴミ箱かどうかを判定
 */
const isTrash = computed(() => {
  return message.value?.labels?.includes('trash') ?? false;
});

// ルートのクエリパラメータからラベルを取得（デフォルトは'inbox'）
const currentLabel = computed(() => {
  const label = route.query.label as string;
  if (label === 'trash' || label === 'all') {
    return label;
  }
  return 'inbox';
});

const isAllMail = computed(() => currentLabel.value === 'all');

/**
 * ルートパラメータのthreadIdを監視してメッセージを読み込む
 */
watch(
  () => route.params.threadId,
  async newThreadId => {
    if (typeof newThreadId === 'string' && newThreadId) {
      await loadMessage(newThreadId);
    }
  },
  { immediate: true }
);

/**
 * コンポーネントマウント時にも読み込み（watchが発火しない場合に備える）
 */
onMounted(() => {
  const threadId = route.params.threadId;
  if (typeof threadId === 'string' && threadId && !message.value) {
    loadMessage(threadId);
  }
});
</script>

<style scoped>
.fill-height {
  height: 100%;
  min-height: calc(100vh - 64px); /* アプリバーの高さを考慮 */
}
</style>
