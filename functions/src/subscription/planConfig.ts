/**
 * PlanConfig - プラン設定
 * 
 * Stripe連携で使用するプラン設定を定義する
 */

/**
 * プラン設定のインターフェース
 */
export interface PlanConfig {
  id: 'free' | 'standard';
  label: string;
  priceIdJpy: string; // Stripe Price ID（円用）
  priceIdUsd: string; // Stripe Price ID（ドル用）
  maxStorageBytes: number;
  maxAccounts: number;
}

/**
 * プラン設定の定数
 * 注意: priceIdJpyとpriceIdUsdは環境変数から動的に取得されるため、
 * getPriceId関数を使用してPrice IDを取得すること
 */
export const PLAN_CONFIGS: Record<'free' | 'standard', PlanConfig> = {
  free: {
    id: 'free',
    label: 'Free',
    priceIdJpy: '', // FreeプランはCheckout不要
    priceIdUsd: '', // FreeプランはCheckout不要
    maxStorageBytes: 2147483648, // 2GB
    maxAccounts: 1,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    priceIdJpy: '', // getPriceId関数で動的に取得
    priceIdUsd: '', // getPriceId関数で動的に取得
    maxStorageBytes: 53687091200, // 50GB
    maxAccounts: 10,
  },
};

/**
 * プラン設定を取得する
 * @param planId プランID
 * @returns プラン設定
 */
export function getPlanConfig(planId: 'free' | 'standard'): PlanConfig {
  return PLAN_CONFIGS[planId];
}

/**
 * ロケールに応じたPrice IDを取得する
 * @param planId プランID
 * @param locale ロケール（'ja'または'en'）
 * @returns Stripe Price ID
 */
export function getPriceId(planId: 'free' | 'standard', locale: 'ja' | 'en'): string {
  if (planId === 'free') {
    return '';
  }
  
  // Standardプランの場合、Cloud Runの環境変数から動的に取得
  if (locale === 'ja') {
    return process.env.STRIPE_STANDARD_PRICE_ID_JPY || '';
  } else {
    return process.env.STRIPE_STANDARD_PRICE_ID_USD || '';
  }
}

