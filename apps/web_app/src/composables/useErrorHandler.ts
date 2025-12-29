import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { parseError, type ErrorMessageKey } from '@/utils/errorHandler';

/**
 * エラーハンドリング用のComposable
 */
export function useErrorHandler() {
  const { t } = useI18n();
  const errorMessage = ref<string | null>(null);
  const errorMessageKey = ref<ErrorMessageKey | null>(null);

  /**
   * エラーを処理してユーザー向けメッセージを設定する
   * @param error エラーオブジェクト
   * @returns エラーメッセージ
   */
  function handleError(error: unknown): string {
    const { messageKey, message } = parseError(error, t);
    errorMessageKey.value = messageKey;
    errorMessage.value = message;
    return message;
  }

  /**
   * エラーをクリアする
   */
  function clearError() {
    errorMessage.value = null;
    errorMessageKey.value = null;
  }

  return {
    errorMessage,
    errorMessageKey,
    handleError,
    clearError,
  };
}

