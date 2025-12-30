import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { parseError } from '@/utils/errorHandler';

/**
 * スナックバー表示用のComposable
 */
export function useSnackbar() {
  const { t } = useI18n();
  const snackbar = ref(false);
  const snackbarText = ref('');
  const snackbarColor = ref<'success' | 'error' | 'info' | 'warning'>('error');

  /**
   * エラーをスナックバーで表示する
   * @param error エラーオブジェクト
   */
  function showError(error: unknown) {
    const { message } = parseError(error, t);
    snackbarText.value = message;
    snackbarColor.value = 'error';
    snackbar.value = true;
    console.error('Error:', error);
  }

  /**
   * 成功メッセージをスナックバーで表示する
   * @param message メッセージ
   */
  function showSuccess(message: string) {
    snackbarText.value = message;
    snackbarColor.value = 'success';
    snackbar.value = true;
  }

  /**
   * 情報メッセージをスナックバーで表示する
   * @param message メッセージ
   */
  function showInfo(message: string) {
    snackbarText.value = message;
    snackbarColor.value = 'info';
    snackbar.value = true;
  }

  /**
   * 警告メッセージをスナックバーで表示する
   * @param message メッセージ
   */
  function showWarning(message: string) {
    snackbarText.value = message;
    snackbarColor.value = 'warning';
    snackbar.value = true;
  }

  return {
    snackbar,
    snackbarText,
    snackbarColor,
    showError,
    showSuccess,
    showInfo,
    showWarning,
  };
}
