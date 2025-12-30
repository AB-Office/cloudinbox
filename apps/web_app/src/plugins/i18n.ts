import { createI18n } from 'vue-i18n';
import type { I18n } from 'vue-i18n';
import ja from '../locales/ja.json';
import en from '../locales/en.json';

/**
 * 日付・時刻のフォーマット設定
 */
const dateTimeFormats = {
  ja: {
    short: {
      year: 'numeric' as const,
      month: 'short' as const,
      day: 'numeric' as const,
    },
    long: {
      year: 'numeric' as const,
      month: 'long' as const,
      day: 'numeric' as const,
      hour: 'numeric' as const,
      minute: 'numeric' as const,
    },
    dateTime: {
      year: 'numeric' as const,
      month: '2-digit' as const,
      day: '2-digit' as const,
      hour: '2-digit' as const,
      minute: '2-digit' as const,
    },
    time: {
      hour: '2-digit' as const,
      minute: '2-digit' as const,
    },
  },
  en: {
    short: {
      year: 'numeric' as const,
      month: 'short' as const,
      day: 'numeric' as const,
    },
    long: {
      year: 'numeric' as const,
      month: 'long' as const,
      day: 'numeric' as const,
      hour: 'numeric' as const,
      minute: 'numeric' as const,
    },
    dateTime: {
      year: 'numeric' as const,
      month: '2-digit' as const,
      day: '2-digit' as const,
      hour: '2-digit' as const,
      minute: '2-digit' as const,
    },
    time: {
      hour: '2-digit' as const,
      minute: '2-digit' as const,
    },
  },
};

/**
 * 数値のフォーマット設定
 */
const numberFormats = {
  ja: {
    currency: {
      style: 'currency' as const,
      currency: 'JPY' as const,
    },
    decimal: {
      style: 'decimal' as const,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
    percent: {
      style: 'percent' as const,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  },
  en: {
    currency: {
      style: 'currency' as const,
      currency: 'USD' as const,
    },
    decimal: {
      style: 'decimal' as const,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
    percent: {
      style: 'percent' as const,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  },
};

const i18n: I18n = createI18n({
  legacy: false, // Composition APIを使用するため
  globalInjection: true, // テンプレート内で$tを使用可能にする
  locale:
    typeof navigator !== 'undefined' && navigator.language
      ? navigator.language.split('-')[0]
      : 'ja',
  fallbackLocale: 'ja',
  messages: {
    ja,
    en,
  },
  datetimeFormats: dateTimeFormats,
  numberFormats: numberFormats,
});

/**
 * 相対的な日付・時刻をフォーマットする（例: "2時間前"）
 * コンポーネント内では useI18n() を使用してこの関数を呼び出すことを推奨
 */
export function formatRelativeTime(
  date: Date,
  t: (key: string, values?: Record<string, unknown>) => string
): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return t('dateTime.justNow');
  } else if (diffMinutes < 60) {
    return t('dateTime.minutesAgo', { count: diffMinutes });
  } else if (diffHours < 24) {
    return t('dateTime.hoursAgo', { count: diffHours });
  } else if (diffDays === 1) {
    return t('dateTime.yesterday');
  } else if (diffDays < 7) {
    return t('dateTime.daysAgo', { count: diffDays });
  } else if (diffWeeks < 4) {
    return t('dateTime.weeksAgo', { count: diffWeeks });
  } else if (diffMonths < 12) {
    return t('dateTime.monthsAgo', { count: diffMonths });
  } else {
    return t('dateTime.yearsAgo', { count: diffYears });
  }
}

/**
 * ファイルサイズをフォーマットする（例: "1.5 MB"）
 * コンポーネント内では useI18n() を使用してこの関数を呼び出すことを推奨
 */
export function formatFileSize(
  bytes: number,
  t: (key: string, values?: Record<string, unknown>) => string
): string {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  const tb = gb * 1024;

  if (bytes < kb) {
    return t('fileSize.bytes', { size: bytes });
  } else if (bytes < mb) {
    return t('fileSize.kilobytes', { size: (bytes / kb).toFixed(2) });
  } else if (bytes < gb) {
    return t('fileSize.megabytes', { size: (bytes / mb).toFixed(2) });
  } else if (bytes < tb) {
    return t('fileSize.gigabytes', { size: (bytes / gb).toFixed(2) });
  } else {
    return t('fileSize.terabytes', { size: (bytes / tb).toFixed(2) });
  }
}

export default i18n;
