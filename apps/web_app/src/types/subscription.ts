/**
 * サブスクリプション関連の型定義
 */

/**
 * プラン情報
 */
export interface Plan {
  id: 'free' | 'standard';
  label: string;
  price: number; // Standardプランのみ（Freeは0）
  priceLabel: string; // "¥500/月"（日本語）または"$5/month"（英語）
  currency: 'JPY' | 'USD'; // 通貨
  maxStorageBytes: number;
  maxAccounts: number;
  features: string[];
}

/**
 * Checkout Session作成リクエスト
 */
export interface CreateCheckoutSessionRequest {
  planId: 'free' | 'standard';
  locale: 'ja' | 'en';
}

/**
 * Checkout Session作成レスポンス
 */
export interface CreateCheckoutSessionResponse {
  url?: string;
  message?: string;
}

