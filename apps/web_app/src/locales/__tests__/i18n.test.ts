/**
 * i18n翻訳キーのテスト
 */

import { describe, it, expect } from 'vitest';
import ja from '../ja.json';
import en from '../en.json';

describe('i18n Translation Keys', () => {
  describe('plan selection keys', () => {
    const requiredKeys = [
      'plan.title',
      'plan.free',
      'plan.standard',
      'plan.currentPlan',
      'plan.changePlan',
      'plan.upgradeNow',
      'plan.back',
      'plan.success',
      'plan.canceled',
      'plan.processing',
      'plan.upgradeRequired',
      'plan.upgradeMessage',
      'plan.upgradeBanner',
      'plan.currentLimit',
      'plan.upgradeLimit',
      'plan.price.free',
      'plan.price.standard',
      'plan.storage.free',
      'plan.storage.standard',
      'plan.accounts.free',
      'plan.accounts.standard',
    ];

    requiredKeys.forEach(key => {
      it(`should have ${key} in Japanese`, () => {
        const keys = key.split('.');
        let value: any = ja;
        for (const k of keys) {
          expect(value).toHaveProperty(k);
          value = value[k];
        }
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      it(`should have ${key} in English`, () => {
        const keys = key.split('.');
        let value: any = en;
        for (const k of keys) {
          expect(value).toHaveProperty(k);
          value = value[k];
        }
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('settings keys', () => {
    const requiredKeys = [
      'settings.plan',
      'settings.currentPlan',
      'settings.maxAccounts',
      'settings.changePlan',
    ];

    requiredKeys.forEach(key => {
      it(`should have ${key} in Japanese`, () => {
        const keys = key.split('.');
        let value: any = ja;
        for (const k of keys) {
          expect(value).toHaveProperty(k);
          value = value[k];
        }
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      it(`should have ${key} in English`, () => {
        const keys = key.split('.');
        let value: any = en;
        for (const k of keys) {
          expect(value).toHaveProperty(k);
          value = value[k];
        }
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('error keys', () => {
    it('should have errors.account.upgradeRequired in Japanese', () => {
      expect(ja.errors).toHaveProperty('account');
      expect(ja.errors.account).toHaveProperty('upgradeRequired');
      expect(typeof ja.errors.account.upgradeRequired).toBe('string');
      expect(ja.errors.account.upgradeRequired.length).toBeGreaterThan(0);
    });

    it('should have errors.account.upgradeRequired in English', () => {
      expect(en.errors).toHaveProperty('account');
      expect(en.errors.account).toHaveProperty('upgradeRequired');
      expect(typeof en.errors.account.upgradeRequired).toBe('string');
      expect(en.errors.account.upgradeRequired.length).toBeGreaterThan(0);
    });

    it('should have errors.account.upgradeButton in Japanese', () => {
      expect(ja.errors).toHaveProperty('account');
      expect(ja.errors.account).toHaveProperty('upgradeButton');
      expect(typeof ja.errors.account.upgradeButton).toBe('string');
      expect(ja.errors.account.upgradeButton.length).toBeGreaterThan(0);
    });

    it('should have errors.account.upgradeButton in English', () => {
      expect(en.errors).toHaveProperty('account');
      expect(en.errors.account).toHaveProperty('upgradeButton');
      expect(typeof en.errors.account.upgradeButton).toBe('string');
      expect(en.errors.account.upgradeButton.length).toBeGreaterThan(0);
    });
  });
});

