import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import type { MailThread, MailMessage, AttachmentListItem } from '@/types/mail';
import { mailService, calculateItemsPerPage } from '@/services/mail';

export const useMailStore = defineStore('mail', () => {
  const threads = ref<MailThread[]>([]);
  const currentMessage = ref<MailMessage | null>(null);
  const selectedThreadId = ref<string | null>(null); // 2列レイアウト用の選択中スレッドID
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastDocument = ref<QueryDocumentSnapshot | null>(null);
  const hasMore = ref(true);

  /**
   * メールスレッド一覧を取得する
   * @param label ラベル（'inbox', 'trash', 'all'）
   * @param limit 取得件数（指定しない場合は画面サイズに応じて自動計算）
   */
  async function fetchThreads(label: string = 'inbox', limit?: number) {
    // 初期読み込み時は画面サイズに応じた件数を計算
    // 追加読み込み時は指定されたlimitを使用（通常は同じ件数）
    const itemsPerPage = limit || calculateItemsPerPage();

    isLoading.value = true;
    error.value = null;
    try {
      const result = await mailService.fetchThreads(label, itemsPerPage, lastDocument.value);
      if (lastDocument.value === null) {
        // 初期読み込み: 既存のリストを置き換え
        threads.value = result.threads;
      } else {
        // 追加読み込み: 既存のリストに追加
        threads.value.push(...result.threads);
      }
      lastDocument.value = result.lastDocument;
      hasMore.value = result.hasMore;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 追加読み込み（無限スクロール）
   * @param label ラベル（'inbox', 'trash', 'all'）
   */
  async function loadMore(label: string = 'inbox') {
    // 追加読み込み（無限スクロール）
    if (isLoading.value || !hasMore.value) return;

    const itemsPerPage = calculateItemsPerPage();
    await fetchThreads(label, itemsPerPage);
  }

  /**
   * メールメッセージを取得する
   * @param messageId メッセージID
   */
  async function fetchMessage(messageId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      currentMessage.value = await mailService.fetchMessage(messageId);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * メール本文を復号化する
   * @param messageId メッセージID
   * @returns 復号化されたメール本文
   */
  async function decryptMailBody(
    messageId: string
  ): Promise<{ bodyText?: string; bodyHtml?: string }> {
    return await mailService.decryptMailBody(messageId);
  }

  /**
   * 添付ファイル一覧を取得する
   * @param messageId メッセージID
   * @returns 添付ファイル一覧
   */
  async function getAttachmentsList(messageId: string): Promise<AttachmentListItem[]> {
    return await mailService.getAttachmentsList(messageId);
  }

  /**
   * メールを既読にする
   * @param messageId メッセージID
   * @param threadId スレッドID
   */
  async function markAsRead(messageId: string, threadId: string) {
    await mailService.markAsRead(messageId, threadId);
    // スレッドのhasUnreadを再計算
    const thread = threads.value.find(t => t.threadId === threadId);
    if (thread) {
      // スレッド内のすべてのメッセージを確認してhasUnreadを再計算
      // （実装詳細はmailServiceに委譲）
      // ここでは、既読にしたメッセージが最新メッセージの場合、hasUnreadをfalseにする
      if (thread.latestMessageId === messageId) {
        thread.hasUnread = false;
      }
    }
  }

  /**
   * 2列レイアウト用: 選択中のスレッドIDを設定
   * @param threadId スレッドID（nullの場合は選択を解除）
   */
  function selectThread(threadId: string | null) {
    selectedThreadId.value = threadId;
    if (threadId) {
      // 選択されたスレッドの最新メッセージを取得
      const thread = threads.value.find(t => t.threadId === threadId);
      if (thread?.latestMessageId) {
        fetchMessage(thread.latestMessageId);
      }
    } else {
      currentMessage.value = null;
    }
  }

  /**
   * ストアの状態をリセットする
   */
  function reset() {
    threads.value = [];
    currentMessage.value = null;
    selectedThreadId.value = null;
    lastDocument.value = null;
    hasMore.value = true;
    error.value = null;
  }

  return {
    // state
    threads,
    currentMessage,
    selectedThreadId,
    isLoading,
    error,
    hasMore,
    // actions
    fetchThreads,
    loadMore,
    fetchMessage,
    decryptMailBody,
    getAttachmentsList,
    markAsRead,
    selectThread,
    reset,
  };
});
