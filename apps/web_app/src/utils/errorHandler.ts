import { FirebaseError } from 'firebase/app';
import type { SettingsData } from '@/types/settings';

/**
 * エラーの種類
 */
export enum ErrorCategory {
  AUTH = 'auth',
  FIRESTORE = 'firestore',
  FUNCTIONS = 'functions',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

/**
 * ユーザー向けエラーメッセージのキー
 */
export interface ErrorMessageKey {
  category: ErrorCategory;
  key: string;
}

/**
 * アップグレードアクション
 */
export interface UpgradeAction {
  type: 'navigate';
  path: string;
}

/**
 * プラン情報
 */
export interface PlanInfo {
  label: string;
  maxAccounts: number;
  maxStorageBytes: number;
}

/**
 * エラー解析結果
 */
export interface ParseErrorResult {
  messageKey: ErrorMessageKey;
  message: string;
  upgradeAction?: UpgradeAction;
  currentPlan?: PlanInfo;
  upgradePlan?: PlanInfo;
}

/**
 * Firebaseエラーを解析してユーザー向けメッセージキーに変換する
 * @param error エラーオブジェクト
 * @param t 翻訳関数（オプション）
 * @param planInfo プラン情報（オプション、アップグレード促進用）
 * @returns エラーメッセージキーとメッセージ、アップグレード情報
 */
export function parseError(
  error: unknown,
  t?: (key: string, values?: Record<string, unknown>) => string,
  planInfo?: SettingsData
): ParseErrorResult {
  // エラーオブジェクトがnull/undefinedの場合
  if (!error) {
    return {
      messageKey: { category: ErrorCategory.UNKNOWN, key: 'errors.generic' },
      message: t ? t('errors.generic') : 'An error occurred',
    };
  }

  // Firebaseエラーの場合
  if (error instanceof FirebaseError) {
    return parseFirebaseError(error, t, planInfo);
  }

  // Errorオブジェクトの場合
  if (error instanceof Error) {
    return parseStandardError(error, t, planInfo);
  }

  // 文字列の場合
  if (typeof error === 'string') {
    return {
      messageKey: { category: ErrorCategory.UNKNOWN, key: 'errors.generic' },
      message: t ? t('errors.generic') : error,
    };
  }

  // その他の場合
  return {
    messageKey: { category: ErrorCategory.UNKNOWN, key: 'errors.generic' },
    message: t ? t('errors.generic') : 'An unknown error occurred',
  };
}

/**
 * Firebaseエラーを解析する
 */
function parseFirebaseError(
  error: FirebaseError,
  t?: (key: string, values?: Record<string, unknown>) => string,
  planInfo?: SettingsData
): ParseErrorResult {
  const code = error.code || '';

  // 認証エラー
  if (code.startsWith('auth/')) {
    return parseAuthError(error, t);
  }

  // Firestoreエラー
  if (code.startsWith('permission-denied')) {
    return {
      messageKey: { category: ErrorCategory.FIRESTORE, key: 'errors.firestore.permissionDenied' },
      message: t ? t('errors.firestore.permissionDenied') : 'Permission denied',
    };
  }
  if (code.startsWith('not-found')) {
    return {
      messageKey: { category: ErrorCategory.FIRESTORE, key: 'errors.firestore.notFound' },
      message: t ? t('errors.firestore.notFound') : 'Resource not found',
    };
  }
  if (code.startsWith('unavailable')) {
    return {
      messageKey: { category: ErrorCategory.NETWORK, key: 'errors.firebase.unavailable' },
      message: t ? t('errors.firebase.unavailable') : 'Service unavailable',
    };
  }

  // Cloud Functionsエラー
  if (code.startsWith('functions/')) {
    return parseFunctionsError(error, t, planInfo);
  }

  // その他のFirebaseエラー
  return {
    messageKey: { category: ErrorCategory.UNKNOWN, key: 'errors.firebase.unknown' },
    message: t ? t('errors.firebase.unknown') : 'An unknown Firebase error occurred',
  };
}

/**
 * 認証エラーを解析する
 */
function parseAuthError(
  error: FirebaseError,
  t?: (key: string, values?: Record<string, unknown>) => string,
  _planInfo?: SettingsData
): ParseErrorResult {
  const code = error.code || '';

  // ログインキャンセルは特別扱い（エラーメッセージを表示しない）
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      messageKey: { category: ErrorCategory.AUTH, key: 'auth.loginCancelled' },
      message: t ? t('auth.loginCancelled') : 'Login cancelled',
    };
  }

  // その他の認証エラー
  return {
    messageKey: { category: ErrorCategory.AUTH, key: 'errors.firebase.authFailed' },
    message: t ? t('errors.firebase.authFailed') : 'Authentication failed',
  };
}

/**
 * Cloud Functionsエラーを解析する
 */
function parseFunctionsError(
  error: FirebaseError,
  t?: (key: string, values?: Record<string, unknown>) => string,
  _planInfo?: SettingsData
): ParseErrorResult {
  const code = error.code || '';

  if (code.includes('timeout') || code.includes('deadline-exceeded')) {
    return {
      messageKey: { category: ErrorCategory.FUNCTIONS, key: 'errors.functions.timeout' },
      message: t ? t('errors.functions.timeout') : 'Request timeout',
    };
  }

  if (code.includes('unavailable')) {
    return {
      messageKey: { category: ErrorCategory.NETWORK, key: 'errors.firebase.unavailable' },
      message: t ? t('errors.firebase.unavailable') : 'Service unavailable',
    };
  }

  // その他のCloud Functionsエラー
  return {
    messageKey: { category: ErrorCategory.FUNCTIONS, key: 'errors.functions.callFailed' },
    message: t ? t('errors.functions.callFailed') : 'Function call failed',
  };
}

/**
 * 標準Errorオブジェクトを解析する
 */
function parseStandardError(
  error: Error,
  t?: (key: string, values?: Record<string, unknown>) => string,
  planInfo?: SettingsData
): ParseErrorResult {
  const message = error.message || '';

  // ユーザー認証エラー
  if (message.includes('not authenticated') || message.includes('User not authenticated')) {
    return {
      messageKey: { category: ErrorCategory.AUTH, key: 'errors.firebase.authFailed' },
      message: t ? t('errors.firebase.authFailed') : 'Authentication required',
    };
  }

  // ネットワークエラー
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes('network') ||
    message.includes('NetworkError') ||
    message.includes('Failed to fetch')
  ) {
    return {
      messageKey: { category: ErrorCategory.NETWORK, key: 'errors.network' },
      message: t ? t('errors.network') : 'Network error occurred',
    };
  }

  // アカウント上限エラー
  if (message.includes('Account limit reached') || message.includes('上限')) {
    return parseAccountLimitError(message, t, planInfo);
  }

  // その他のエラー（技術的詳細を隠す）
  // エラーメッセージが技術的な内容の場合は汎用メッセージを使用
  if (message.includes('FirebaseError') || message.includes('code:') || message.includes('at ')) {
    return {
      messageKey: { category: ErrorCategory.UNKNOWN, key: 'errors.generic' },
      message: t ? t('errors.generic') : 'An error occurred',
    };
  }

  // ユーザー向けメッセージと判断できる場合はそのまま使用
  return {
    messageKey: { category: ErrorCategory.UNKNOWN, key: 'errors.generic' },
    message: message,
  };
}

/**
 * アカウント上限エラーを解析し、アップグレード情報を含める
 */
function parseAccountLimitError(
  message: string,
  t?: (key: string, values?: Record<string, unknown>) => string,
  planInfo?: SettingsData
): ParseErrorResult {
  const baseResult: ParseErrorResult = {
    messageKey: { category: ErrorCategory.UNKNOWN, key: 'errors.account.upgradeRequired' },
    message: t ? t('errors.account.upgradeRequired') : message,
  };

  // プラン情報が提供されている場合、アップグレード情報を含める
  if (planInfo) {
    const currentPlan: PlanInfo = {
      label: planInfo.planLabel,
      maxAccounts: planInfo.maxAccounts,
      maxStorageBytes: planInfo.maxStorageBytes,
    };

    // Standardプランの情報
    const upgradePlan: PlanInfo = {
      label: 'Standard',
      maxAccounts: 10,
      maxStorageBytes: 53687091200, // 50GB
    };

    // エラーメッセージにプラン情報を含める
    const messageValues = {
      currentPlan: currentPlan.label,
      currentMaxAccounts: currentPlan.maxAccounts,
      upgradePlan: upgradePlan.label,
      upgradeMaxAccounts: upgradePlan.maxAccounts,
    };

    baseResult.message = t
      ? t('errors.account.upgradeRequired', messageValues)
      : `Account limit reached. Current plan: ${currentPlan.label} (${currentPlan.maxAccounts} accounts). Upgrade to ${upgradePlan.label} (${upgradePlan.maxAccounts} accounts).`;

    baseResult.upgradeAction = {
      type: 'navigate',
      path: '/settings/plan?upgrade=true',
    };

    baseResult.currentPlan = currentPlan;
    baseResult.upgradePlan = upgradePlan;
  }

  return baseResult;
}
