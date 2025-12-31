<template>
  <div class="compose-view-wrapper">
    <v-container fluid class="fill-height pa-0">
      <v-row no-gutters class="fill-height">
        <v-col cols="12">
          <v-card class="fill-height d-flex flex-column">
            <v-card-title class="d-flex align-center pa-4">
              <v-btn icon variant="text" @click="handleCancel">
                <v-icon>mdi-close</v-icon>
              </v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                :loading="mailStore.isSending"
                :disabled="mailStore.isSending"
                @click="handleSend"
              >
                {{ t('mail.compose.send') }}
              </v-btn>
            </v-card-title>
            <v-card-text class="flex-grow-1 overflow-y-auto">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <!-- 送信元アカウント選択 -->
                    <v-select
                      v-model="selectedAccountId"
                      :items="accountItems"
                      :label="t('account.email')"
                      item-title="label"
                      item-value="id"
                      variant="outlined"
                      dense
                    />
                  </v-col>
                  <v-col cols="12">
                    <!-- 宛先入力 -->
                    <v-text-field
                      v-model="to"
                      :label="t('mail.compose.to')"
                      :rules="[
                        rules.required(t('mail.compose.validation.toRequired')),
                        rules.emailList(t('mail.compose.validation.toInvalid')),
                      ]"
                      variant="outlined"
                      dense
                    />
                  </v-col>
                  <v-col cols="12">
                    <!-- Cc/Bcc展開ボタン -->
                    <v-btn variant="text" size="small" @click="showCcBcc = !showCcBcc">
                      {{ t('mail.compose.cc') }} / {{ t('mail.compose.bcc') }}
                      <v-icon>{{ showCcBcc ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col v-if="showCcBcc" cols="12">
                    <!-- Cc入力 -->
                    <v-text-field
                      v-model="cc"
                      :label="t('mail.compose.cc')"
                      :rules="[rules.emailList(t('mail.compose.validation.toInvalid'))]"
                      variant="outlined"
                      dense
                    />
                  </v-col>
                  <v-col v-if="showCcBcc" cols="12">
                    <!-- Bcc入力 -->
                    <v-text-field
                      v-model="bcc"
                      :label="t('mail.compose.bcc')"
                      :rules="[rules.emailList(t('mail.compose.validation.toInvalid'))]"
                      variant="outlined"
                      dense
                    />
                  </v-col>
                  <v-col cols="12">
                    <!-- 件名入力 -->
                    <v-text-field
                      v-model="subject"
                      :label="t('mail.compose.subject')"
                      :rules="[rules.required(t('mail.compose.validation.subjectRequired'))]"
                      variant="outlined"
                      dense
                    />
                  </v-col>
                  <v-col cols="12">
                    <!-- 本文入力 -->
                    <v-textarea
                      ref="bodyTextareaRef"
                      v-model="body"
                      :label="t('mail.compose.body')"
                      :rules="[rules.required(t('mail.compose.validation.bodyRequired'))]"
                      variant="outlined"
                      rows="15"
                    />
                  </v-col>
                  <v-col cols="12">
                    <!-- 添付ファイル一覧 -->
                    <v-list v-if="attachments.length > 0" variant="outlined" density="compact">
                      <v-list-item
                        v-for="(attachment, index) in attachments"
                        :key="index"
                        class="px-2"
                      >
                        <template #prepend>
                          <v-icon>mdi-paperclip</v-icon>
                        </template>
                        <v-list-item-title>{{ attachment.filename }}</v-list-item-title>
                        <v-list-item-subtitle>
                          {{ formatFileSize(attachment.file.size, t) }}
                        </v-list-item-subtitle>
                        <template #append>
                          <v-btn icon variant="text" size="small" @click="removeAttachment(index)">
                            <v-icon>mdi-close</v-icon>
                          </v-btn>
                        </template>
                      </v-list-item>
                    </v-list>
                    <!-- ファイル選択入力（非表示） -->
                    <input
                      ref="fileInputRef"
                      type="file"
                      multiple
                      style="display: none"
                      @change="handleFileSelect"
                    />
                    <!-- 添付ファイル追加ボタン -->
                    <v-btn
                      variant="outlined"
                      size="small"
                      prepend-icon="mdi-paperclip"
                      @click="triggerFileSelect"
                    >
                      {{ t('mail.compose.attachFile') }}
                    </v-btn>
                  </v-col>
                </v-row>
              </v-container>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- キャンセル確認ダイアログ -->
      <v-dialog v-model="cancelDialog" max-width="500">
        <v-card>
          <v-card-title>{{ t('mail.compose.cancel') }}</v-card-title>
          <v-card-text>{{ t('mail.compose.cancelConfirm') }}</v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="cancelDialog = false">{{ t('common.cancel') }}</v-btn>
            <v-btn color="error" @click="confirmCancel">{{ t('mail.compose.discard') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- スナックバー（成功・エラー表示用） -->
      <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="5000" location="bottom">
        {{ snackbarText }}
        <template #actions>
          <v-btn variant="text" @click="snackbar = false">{{ t('common.close') }}</v-btn>
        </template>
      </v-snackbar>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMailStore } from '@/stores/mail';
import { useAccountStore } from '@/stores/account';
import type { ComposeAttachment, SendMailRequest, MailMessage } from '@/types/mail';
import { formatFileSize } from '@/plugins/i18n';
import { useSnackbar } from '@/composables/useSnackbar';
import { mailService } from '@/services/mail';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const mailStore = useMailStore();
const accountStore = useAccountStore();
const { snackbar, snackbarText, snackbarColor, showError, showSuccess } = useSnackbar();

// フォームデータ
const selectedAccountId = ref<string>('');
const to = ref<string>('');
const cc = ref<string>('');
const bcc = ref<string>('');
const subject = ref<string>('');
const body = ref<string>('');
const showCcBcc = ref<boolean>(false);
const attachments = ref<ComposeAttachment[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const bodyTextareaRef = ref<{ $el: HTMLTextAreaElement } | null>(null);
const cancelDialog = ref<boolean>(false);
const originalThreadId = ref<string | undefined>(undefined);
const originalMessageId = ref<string | undefined>(undefined);

// バリデーションルール
const rules = {
  required: (message: string) => (v: unknown) => !!v || message,
  email: (message: string) => (v: string) => {
    if (!v) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(v) || message;
  },
  emailList: (message: string) => (v: string) => {
    if (!v) return true;
    const emails = v
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allValid = emails.every(email => emailRegex.test(email));
    return allValid || message;
  },
};

// SMTP設定があるアクティブなアカウントのみをフィルタリング
const accountItems = computed(() => {
  return accountStore.accounts
    .filter(account => account.status === 'active' && account.smtp)
    .map(account => ({
      id: account.id || '',
      label: account.label || account.email,
      email: account.email,
    }));
});

/**
 * メールアドレス配列をカンマ区切りの文字列に変換
 */
function formatEmailList(emails: string[]): string {
  return emails.join(', ');
}

/**
 * 件名にプレフィックスを追加（既にプレフィックスがある場合は追加しない）
 */
function addSubjectPrefix(subject: string, prefix: string): string {
  if (subject.toLowerCase().startsWith(prefix.toLowerCase())) {
    return subject;
  }
  return `${prefix} ${subject}`;
}

/**
 * メールアドレスから表示名を除去してアドレスのみを取得
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<(.+)>/);
  return match ? match[1] : from;
}

/**
 * 日時を引用形式用にフォーマット (YYYY/MM/DD HH:MM)
 */
function formatDateTimeForQuote(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

/**
 * 元のメール本文を引用形式に変換（モバイルアプリ版と同じ形式）
 */
function formatQuotedBody(from: string, bodyText: string, sentAt: Date): string {
  const emailAddress = extractEmailAddress(from);
  const quotedBody = bodyText
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  const dateTimeStr = formatDateTimeForQuote(sentAt);
  return `\n${dateTimeStr} <${emailAddress}>\n${quotedBody}`;
}

/**
 * 転送時の本文をフォーマット（モバイルアプリ版と同じ形式）
 */
function formatForwardBody(
  originalMessage: MailMessage,
  decryptedBody: { bodyText?: string; bodyHtml?: string }
): string {
  const date =
    originalMessage.sentAt instanceof Date
      ? originalMessage.sentAt
      : originalMessage.sentAt.toDate();

  const bodyText = decryptedBody.bodyText || decryptedBody.bodyHtml?.replace(/<[^>]*>/g, '') || '';
  return formatQuotedBody(originalMessage.from, bodyText, date);
}

/**
 * カーソルを本文の先頭に設定
 */
function setCursorToStart() {
  if (bodyTextareaRef.value?.$el) {
    const textarea = bodyTextareaRef.value.$el.querySelector(
      'textarea'
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.setSelectionRange(0, 0);
      textarea.focus();
    }
  }
}

/**
 * 元のメールを取得して初期化
 */
async function initializeCompose() {
  const mode = route.query.mode as string | undefined;
  const messageId = route.query.messageId as string | undefined;

  if (!mode || !messageId) {
    // 通常の作成モード
    return;
  }

  try {
    // 元のメールを取得
    const originalMessage = await mailService.fetchMessage(messageId);

    // threadIdとmessageIdを保存
    originalThreadId.value = originalMessage.threadId;
    originalMessageId.value = originalMessage.messageId;

    // 本文を復号化（返信・全員に返信・転送で使用）
    const decryptedBody = await mailService.decryptMailBody(messageId);
    const date =
      originalMessage.sentAt instanceof Date
        ? originalMessage.sentAt
        : originalMessage.sentAt.toDate();

    if (mode === 'reply') {
      // 返信モード：送信者を宛先に、件名にRe:を追加
      to.value = originalMessage.from;
      subject.value = addSubjectPrefix(originalMessage.subject, 'Re:');
      showCcBcc.value = false;
      // 本文を引用形式で追加
      const bodyText =
        decryptedBody.bodyText || decryptedBody.bodyHtml?.replace(/<[^>]*>/g, '') || '';
      body.value = formatQuotedBody(originalMessage.from, bodyText, date);
      // カーソルを先頭に設定
      await nextTick();
      setCursorToStart();
    } else if (mode === 'replyAll') {
      // 全員に返信モード：送信者とCc受信者を宛先に、件名にRe:を追加
      const recipients = [originalMessage.from];
      if (originalMessage.cc && originalMessage.cc.length > 0) {
        recipients.push(...originalMessage.cc);
      }
      to.value = formatEmailList(recipients);
      if (originalMessage.cc && originalMessage.cc.length > 0) {
        cc.value = formatEmailList(originalMessage.cc);
        showCcBcc.value = true;
      } else {
        showCcBcc.value = false;
      }
      subject.value = addSubjectPrefix(originalMessage.subject, 'Re:');
      // 本文を引用形式で追加
      const bodyText =
        decryptedBody.bodyText || decryptedBody.bodyHtml?.replace(/<[^>]*>/g, '') || '';
      body.value = formatQuotedBody(originalMessage.from, bodyText, date);
      // カーソルを先頭に設定
      await nextTick();
      setCursorToStart();
    } else if (mode === 'forward') {
      // 転送モード：件名にFw:を追加、本文に元のメール内容を含める、添付ファイルを取得
      subject.value = addSubjectPrefix(originalMessage.subject, 'Fw:');
      // 本文を引用形式で追加
      body.value = formatForwardBody(originalMessage, decryptedBody);

      // 添付ファイルがある場合、取得して追加
      if (originalMessage.hasAttachments) {
        try {
          const attachmentList = await mailService.getAttachmentsList(messageId);
          for (const attachment of attachmentList) {
            const downloadedAttachment = await mailService.downloadAttachment(
              messageId,
              attachment.filename
            );

            // Base64をBlobに変換してFileオブジェクトを作成
            const base64 = downloadedAttachment.content.replace(/-/g, '+').replace(/_/g, '/');
            const padLen = (4 - (base64.length % 4)) % 4;
            const padded = base64 + '='.repeat(padLen);
            const binary = atob(padded);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: downloadedAttachment.contentType });
            const file = new File([blob], downloadedAttachment.filename, {
              type: downloadedAttachment.contentType,
            });

            const composeAttachment: ComposeAttachment = {
              file,
              filename: downloadedAttachment.filename,
              contentType: downloadedAttachment.contentType,
              content: '', // Base64エンコードは送信時に生成
            };
            attachments.value.push(composeAttachment);
          }
        } catch (error) {
          console.error('Failed to load attachments for forward:', error);
          showError(error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize compose:', error);
    showError(error);
  }
}

/**
 * 初期化処理
 */
onMounted(async () => {
  // アカウント一覧を取得
  if (accountStore.accounts.length === 0) {
    await accountStore.fetchAccounts(false);
  }
  // 最初のアカウントを選択
  if (accountItems.value.length > 0) {
    selectedAccountId.value = accountItems.value[0].id;
  }

  // 返信・転送モードの初期化
  await initializeCompose();
});

/**
 * 入力内容があるかどうかをチェック
 */
function hasInput(): boolean {
  return !!(
    to.value.trim() ||
    cc.value.trim() ||
    bcc.value.trim() ||
    subject.value.trim() ||
    body.value.trim() ||
    attachments.value.length > 0
  );
}

/**
 * キャンセル処理
 */
function handleCancel() {
  if (hasInput()) {
    // 入力内容がある場合は確認ダイアログを表示
    cancelDialog.value = true;
  } else {
    // 入力内容がない場合は直接閉じる
    router.push('/');
  }
}

/**
 * キャンセル確認（破棄を選択した場合）
 */
function confirmCancel() {
  cancelDialog.value = false;
  router.push('/');
}

/**
 * ファイル選択ダイアログを開く
 */
function triggerFileSelect() {
  fileInputRef.value?.click();
}

/**
 * ファイル選択処理
 */
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;

  const files = Array.from(input.files);
  for (const file of files) {
    const attachment: ComposeAttachment = {
      file,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      content: '', // Base64エンコードは送信時に生成
    };
    attachments.value.push(attachment);
  }

  // ファイル入力の値をリセット（同じファイルを再度選択できるように）
  input.value = '';
}

/**
 * 添付ファイルを削除
 */
function removeAttachment(index: number) {
  attachments.value.splice(index, 1);
}

/**
 * ファイルをBase64エンコードする
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:application/pdf;base64, のようなプレフィックスを削除
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * メールアドレス文字列を配列に変換（カンマ区切り対応）
 */
function parseEmailList(emailString: string): string[] {
  if (!emailString.trim()) return [];
  return emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);
}

/**
 * 送信処理
 */
async function handleSend() {
  // バリデーション（フォームのバリデーションはv-text-fieldの:rulesで自動的に実行される）
  // 送信元アカウントのチェック
  if (!selectedAccountId.value) {
    showError(new Error(t('mail.compose.validation.toRequired')));
    return;
  }

  try {
    // 添付ファイルをBase64エンコード
    const encodedAttachments = await Promise.all(
      attachments.value.map(async attachment => {
        const content = await fileToBase64(attachment.file);
        return {
          filename: attachment.filename,
          content,
          contentType: attachment.contentType,
        };
      })
    );

    // 送信リクエストを作成
    const request: SendMailRequest = {
      accountId: selectedAccountId.value,
      to: parseEmailList(to.value),
      cc: cc.value ? parseEmailList(cc.value) : undefined,
      bcc: bcc.value ? parseEmailList(bcc.value) : undefined,
      subject: subject.value,
      body: body.value,
      attachments: encodedAttachments.length > 0 ? encodedAttachments : undefined,
      threadId: originalThreadId.value,
      inReplyToMessageId: originalMessageId.value,
    };

    // メール送信
    await mailStore.sendMail(request);

    // 送信成功
    showSuccess(t('mail.compose.sendSuccess'));

    // メール一覧画面に戻る
    router.push('/');
  } catch (error) {
    // エラーはmailStore.sendMailで既にmailStore.sendErrorに設定されている
    // スナックバーでエラーを表示
    showError(error);
  }
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}

.compose-view-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
