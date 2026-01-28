/**
 * subscription.tsサービスのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { httpsCallable } from 'firebase/functions';
import { createCheckoutSession } from '../subscription';
import type { CreateCheckoutSessionResponse } from '@/types/subscription';

// モック
vi.mock('firebase/functions', () => {
  const mockFunctions = {};
  return {
    getFunctions: vi.fn(() => mockFunctions),
    httpsCallable: vi.fn(),
  };
});

vi.mock('../firebase', () => ({
  firebaseApp: {},
}));

// window.location.hrefのモック
Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
});

describe('createCheckoutSession', () => {
  let mockHttpsCallable: any;

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = '';

    mockHttpsCallable = vi.fn();

    vi.mocked(httpsCallable).mockReturnValue(mockHttpsCallable);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('アップグレード（URLが返される場合）', () => {
    it('StandardプランへのアップグレードでURLにリダイレクトする', async () => {
      const mockResponse: CreateCheckoutSessionResponse = {
        url: 'https://checkout.stripe.com/test-session',
      };

      mockHttpsCallable.mockResolvedValue({
        data: mockResponse,
      });

      await createCheckoutSession('standard', 'ja');

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createCheckoutSession');
      expect(mockHttpsCallable).toHaveBeenCalledWith({
        planId: 'standard',
        locale: 'ja',
      });
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session');
    });

    it('英語ロケールでStandardプランへのアップグレードでURLにリダイレクトする', async () => {
      const mockResponse: CreateCheckoutSessionResponse = {
        url: 'https://checkout.stripe.com/test-session-en',
      };

      mockHttpsCallable.mockResolvedValue({
        data: mockResponse,
      });

      await createCheckoutSession('standard', 'en');

      expect(mockHttpsCallable).toHaveBeenCalledWith({
        planId: 'standard',
        locale: 'en',
      });
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session-en');
    });
  });

  describe('ダウングレード（メッセージが返される場合）', () => {
    it('Freeプランへのダウングレードでメッセージを表示し、リダイレクトしない', async () => {
      const mockResponse: CreateCheckoutSessionResponse = {
        message: 'Subscription will be canceled at the end of the billing period',
      };

      mockHttpsCallable.mockResolvedValue({
        data: mockResponse,
      });

      // window.alertをモック
      const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

      await createCheckoutSession('free', 'ja');

      expect(mockHttpsCallable).toHaveBeenCalledWith({
        planId: 'free',
        locale: 'ja',
      });
      expect(mockAlert).toHaveBeenCalledWith('Subscription will be canceled at the end of the billing period');
      expect(window.location.href).toBe('');

      mockAlert.mockRestore();
    });
  });

  describe('エラーハンドリング', () => {
    it('Firebase Functions呼び出しエラー時に例外をスローする', async () => {
      const error = new Error('Network error');
      mockHttpsCallable.mockRejectedValue(error);

      await expect(createCheckoutSession('standard', 'ja')).rejects.toThrow('Network error');
      expect(window.location.href).toBe('');
    });

    it('レスポンスにURLもメッセージも含まれない場合、エラーをスローする', async () => {
      const mockResponse: CreateCheckoutSessionResponse = {};

      mockHttpsCallable.mockResolvedValue({
        data: mockResponse,
      });

      await expect(createCheckoutSession('standard', 'ja')).rejects.toThrow(
        'Invalid response from createCheckoutSession'
      );
      expect(window.location.href).toBe('');
    });
  });
});

