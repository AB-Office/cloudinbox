/**
 * errorHandler.tsのテスト
 */

import { describe, it, expect, vi } from 'vitest';
import { FirebaseError } from 'firebase/app';
import { parseError, ErrorCategory } from '../errorHandler';
import type { SettingsData } from '@/types/settings';

describe('errorHandler', () => {
  describe('parseError', () => {
    describe('Account limit reached error with upgrade info', () => {
      it('should detect Account limit reached error and return upgrade required error', () => {
        const error = new Error('Account limit reached');
        const t = vi.fn((key: string) => key);

        const result = parseError(error, t);

        expect(result.messageKey.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.messageKey.key).toBe('errors.account.upgradeRequired');
        expect(t).toHaveBeenCalledWith('errors.account.upgradeRequired');
      });

      it('should detect Account limit reached error with plan info and return upgrade required error with plan details', () => {
        const error = new Error('Account limit reached');
        const t = vi.fn((key: string, values?: Record<string, unknown>) => {
          if (values) {
            return `${key} with ${JSON.stringify(values)}`;
          }
          return key;
        });

        const planInfo: SettingsData = {
          planLabel: 'Free',
          maxStorageBytes: 2147483648, // 2GB
          usedStorageBytes: 0,
          maxAccounts: 1,
        };

        const result = parseError(error, t, planInfo);

        expect(result.messageKey.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.messageKey.key).toBe('errors.account.upgradeRequired');
        expect(result.message).toContain('errors.account.upgradeRequired');
        expect(result.message).toContain('Free');
        expect(result.message).toContain('1');
        expect(result.message).toContain('10'); // Standard plan max accounts
      });

      it('should include upgrade action in error result when plan info is provided', () => {
        const error = new Error('Account limit reached');
        const t = vi.fn((key: string) => key);

        const planInfo: SettingsData = {
          planLabel: 'Free',
          maxStorageBytes: 2147483648,
          usedStorageBytes: 0,
          maxAccounts: 1,
        };

        const result = parseError(error, t, planInfo);

        expect(result.upgradeAction).toBeDefined();
        expect(result.upgradeAction?.type).toBe('navigate');
        expect(result.upgradeAction?.path).toBe('/settings/plan?upgrade=true');
      });

      it('should include current plan limits and upgrade limits in error result', () => {
        const error = new Error('Account limit reached');
        const t = vi.fn((key: string) => key);

        const planInfo: SettingsData = {
          planLabel: 'Free',
          maxStorageBytes: 2147483648, // 2GB
          usedStorageBytes: 0,
          maxAccounts: 1,
        };

        const result = parseError(error, t, planInfo);

        expect(result.currentPlan).toBeDefined();
        expect(result.currentPlan?.label).toBe('Free');
        expect(result.currentPlan?.maxAccounts).toBe(1);
        expect(result.currentPlan?.maxStorageBytes).toBe(2147483648);

        expect(result.upgradePlan).toBeDefined();
        expect(result.upgradePlan?.label).toBe('Standard');
        expect(result.upgradePlan?.maxAccounts).toBe(10);
        expect(result.upgradePlan?.maxStorageBytes).toBe(53687091200); // 50GB
      });

      it('should handle Account limit reached error without plan info', () => {
        const error = new Error('Account limit reached');
        const t = vi.fn((key: string) => key);

        const result = parseError(error, t);

        expect(result.messageKey.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.messageKey.key).toBe('errors.account.upgradeRequired');
        expect(result.upgradeAction).toBeUndefined();
        expect(result.currentPlan).toBeUndefined();
        expect(result.upgradePlan).toBeUndefined();
      });

      it('should detect 上限エラー (Japanese) and return upgrade required error', () => {
        const error = new Error('アカウント数の上限に達しています');
        const t = vi.fn((key: string) => key);

        const result = parseError(error, t);

        expect(result.messageKey.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.messageKey.key).toBe('errors.account.upgradeRequired');
      });
    });

    describe('Other errors', () => {
      it('should handle null/undefined error', () => {
        const t = vi.fn((key: string) => key);

        const result = parseError(null, t);

        expect(result.messageKey.category).toBe(ErrorCategory.UNKNOWN);
        expect(result.messageKey.key).toBe('errors.generic');
      });

      it('should handle FirebaseError', () => {
        const error = new FirebaseError('auth/user-not-found', 'User not found');
        const t = vi.fn((key: string) => key);

        const result = parseError(error, t);

        expect(result.messageKey.category).toBe(ErrorCategory.AUTH);
        expect(result.messageKey.key).toBe('errors.firebase.authFailed');
      });

      it('should handle network error', () => {
        const error = new Error('Network error occurred');
        const t = vi.fn((key: string) => key);

        const result = parseError(error, t);

        expect(result.messageKey.category).toBe(ErrorCategory.NETWORK);
        expect(result.messageKey.key).toBe('errors.network');
      });
    });
  });
});

