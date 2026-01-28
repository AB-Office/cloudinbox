/**
 * PlanConfig - プラン設定のテスト
 */

import { PLAN_CONFIGS, getPlanConfig, getPriceId } from '../planConfig';

describe('PlanConfig', () => {
  describe('PLAN_CONFIGS', () => {
    it('Freeプランの設定が正しく定義されている', () => {
      const freePlan = PLAN_CONFIGS.free;
      expect(freePlan.id).toBe('free');
      expect(freePlan.label).toBe('Free');
      expect(freePlan.priceIdJpy).toBe('');
      expect(freePlan.priceIdUsd).toBe('');
      expect(freePlan.maxStorageBytes).toBe(2147483648); // 2GB
      expect(freePlan.maxAccounts).toBe(1);
    });

    it('Standardプランの設定が正しく定義されている', () => {
      const standardPlan = PLAN_CONFIGS.standard;
      expect(standardPlan.id).toBe('standard');
      expect(standardPlan.label).toBe('Standard');
      expect(standardPlan.maxStorageBytes).toBe(53687091200); // 50GB
      expect(standardPlan.maxAccounts).toBe(10);
      // Price IDは環境変数から取得されるため、空文字列または環境変数の値
      expect(typeof standardPlan.priceIdJpy).toBe('string');
      expect(typeof standardPlan.priceIdUsd).toBe('string');
    });
  });

  describe('getPlanConfig', () => {
    it('freeプランIDでFreeプラン設定を取得できる', () => {
      const config = getPlanConfig('free');
      expect(config.id).toBe('free');
      expect(config.label).toBe('Free');
    });

    it('standardプランIDでStandardプラン設定を取得できる', () => {
      const config = getPlanConfig('standard');
      expect(config.id).toBe('standard');
      expect(config.label).toBe('Standard');
    });
  });

  describe('getPriceId', () => {
    beforeEach(() => {
      // 環境変数をリセット
      delete process.env.STRIPE_STANDARD_PRICE_ID_JPY;
      delete process.env.STRIPE_STANDARD_PRICE_ID_USD;
    });

    it('Freeプランの場合は空文字列を返す（日本語）', () => {
      const priceId = getPriceId('free', 'ja');
      expect(priceId).toBe('');
    });

    it('Freeプランの場合は空文字列を返す（英語）', () => {
      const priceId = getPriceId('free', 'en');
      expect(priceId).toBe('');
    });

    it('Standardプランで日本語ロケールの場合は円用Price IDを返す', () => {
      process.env.STRIPE_STANDARD_PRICE_ID_JPY = 'price_jpy_123';
      process.env.STRIPE_STANDARD_PRICE_ID_USD = 'price_usd_456';
      
      const priceId = getPriceId('standard', 'ja');
      expect(priceId).toBe('price_jpy_123');
    });

    it('Standardプランで英語ロケールの場合はドル用Price IDを返す', () => {
      process.env.STRIPE_STANDARD_PRICE_ID_JPY = 'price_jpy_123';
      process.env.STRIPE_STANDARD_PRICE_ID_USD = 'price_usd_456';
      
      const priceId = getPriceId('standard', 'en');
      expect(priceId).toBe('price_usd_456');
    });

    it('環境変数が設定されていない場合は空文字列を返す', () => {
      delete process.env.STRIPE_STANDARD_PRICE_ID_JPY;
      delete process.env.STRIPE_STANDARD_PRICE_ID_USD;
      
      const priceIdJpy = getPriceId('standard', 'ja');
      const priceIdUsd = getPriceId('standard', 'en');
      
      expect(priceIdJpy).toBe('');
      expect(priceIdUsd).toBe('');
    });
  });
});

