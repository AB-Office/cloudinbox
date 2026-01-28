/**
 * createCheckoutSession - Stripe Checkout Session作成機能のテスト
 */

/// <reference types="jest" />

import { createCheckoutSession } from '../createCheckoutSession';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getPriceId } from '../planConfig';

// モック
jest.mock('firebase-admin');
jest.mock('../planConfig');

// Stripeモック
const mockCheckoutSessionsCreate = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockSubscriptionsUpdate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
    customers: {
      retrieve: jest.fn(),
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      update: mockSubscriptionsUpdate,
    },
  }));
});

jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    https: {
      onCall: jest.fn((handler: any) => handler),
    },
  })),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(public code: string, public message: string) {
        super(message);
        this.name = 'HttpsError';
      }
    },
  },
  config: jest.fn(() => ({
    stripe: {
      secret_key: 'sk_test_mock_key',
    },
    app: {
      base_url: 'https://cloudinbox.app',
    },
  })),
}));

describe('createCheckoutSession', () => {
  const mockUid = 'test-user-123';
  const mockContext = {
    auth: {
      uid: mockUid,
    },
  } as functions.https.CallableContext;

  let mockFirestore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckoutSessionsCreate.mockClear();
    mockSubscriptionsRetrieve.mockClear();
    mockSubscriptionsUpdate.mockClear();

    // Firestoreモック
    mockFirestore = {
      collection: jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn((uid: string) => ({
              get: jest.fn(),
              update: jest.fn(),
            })),
          };
        }
        return { doc: jest.fn() };
      }),
    };

    (admin.firestore as any) = jest.fn().mockReturnValue(mockFirestore);
  });

  describe('認証チェック', () => {
    it('認証されていない場合はエラーを投げる', async () => {
      const unauthenticatedContext = {
        auth: undefined,
      } as functions.https.CallableContext;

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, unauthenticatedContext)
      ).rejects.toThrow('User must be authenticated');
    });
  });

  describe('パラメータ検証', () => {
    it('planIdが不足している場合、エラーを投げる', async () => {
      const data = {
        locale: 'ja' as const,
      } as any;

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('planId is required and must be "free" or "standard"');
    });

    it('localeが不足している場合、エラーを投げる', async () => {
      const data = {
        planId: 'standard' as const,
      } as any;

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('locale is required and must be "ja" or "en"');
    });

    it('無効なplanIdの場合、エラーを投げる', async () => {
      const data = {
        planId: 'invalid' as any,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('planId is required and must be "free" or "standard"');
    });

    it('無効なlocaleの場合、エラーを投げる', async () => {
      const data = {
        planId: 'standard' as const,
        locale: 'invalid' as any,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('locale is required and must be "ja" or "en"');
    });
  });

  describe('アップグレード（Free → Standard）', () => {
    beforeEach(() => {
      // デフォルトで環境変数を設定
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    });

    it('FreeプランからStandardプランへのアップグレードでCheckout Sessionを作成する', async () => {
      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'free',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      (getPriceId as jest.Mock).mockReturnValue('price_test_jpy');

      const mockCheckoutSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      };

      mockCheckoutSessionsCreate.mockResolvedValue(mockCheckoutSession);

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      const result = await createCheckoutSession(data, mockContext);

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/test',
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith({
        mode: 'subscription',
        line_items: [
          {
            price: 'price_test_jpy',
            quantity: 1,
          },
        ],
        success_url: expect.stringContaining('/settings/plan?success=true'),
        cancel_url: expect.stringContaining('/settings/plan?canceled=true'),
        metadata: {
          userId: mockUid,
          planId: 'standard',
        },
      });
    });
  });

  describe('ダウングレード（Standard → Free）', () => {
    beforeEach(() => {
      // デフォルトで環境変数を設定
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    });

    it('StandardプランからFreeプランへのダウングレードでサブスクリプションを更新する', async () => {
      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'standard',
          },
          billing: {
            stripeCustomerId: 'cus_test_123',
            stripeSubscriptionId: 'sub_test_123',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      const mockSubscription = {
        id: 'sub_test_123',
        status: 'active',
      };

      mockSubscriptionsRetrieve.mockResolvedValue(mockSubscription);
      mockSubscriptionsUpdate.mockResolvedValue({
        ...mockSubscription,
        cancel_at_period_end: true,
      });

      const data = {
        planId: 'free' as const,
        locale: 'ja' as const,
      };

      const result = await createCheckoutSession(data, mockContext);

      expect(result).toEqual({
        message: 'Subscription will be canceled at the end of the billing period',
      });

      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_test_123');
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_test_123', {
        cancel_at_period_end: true,
      });
    });

    it('billing情報が存在しない場合、エラーを投げる', async () => {
      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'standard',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      const data = {
        planId: 'free' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('Stripe customer or subscription not found');
    });
  });

  describe('同じプランへの変更', () => {
    beforeEach(() => {
      // デフォルトで環境変数を設定
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    });

    it('FreeプランからFreeプランへの変更はエラーを投げる', async () => {
      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'free',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      const data = {
        planId: 'free' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('Invalid plan change: free -> free');
    });

    it('StandardプランからStandardプランへの変更はエラーを投げる', async () => {
      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'standard',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('Invalid plan change: standard -> standard');
    });
  });

  describe('環境変数の検証', () => {
    beforeEach(() => {
      // デフォルトで環境変数を設定
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    });

    it('STRIPE_SECRET_KEYが未設定の場合、エラーを投げる', async () => {
      const originalEnv = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'free',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('Stripe secret key is not configured');

      // 環境変数を復元
      if (originalEnv) {
        process.env.STRIPE_SECRET_KEY = originalEnv;
      }
    });

    it('Price IDが未設定の場合、エラーを投げる', async () => {
      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'free',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      (getPriceId as jest.Mock).mockReturnValue('');

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('Stripe price ID is not configured');
    });

    it('BASE_URLが未設定の場合、デフォルト値を使用する', async () => {
      const originalBaseUrl = process.env.BASE_URL;
      delete process.env.BASE_URL;
      
      // STRIPE_SECRET_KEYは設定されている必要がある
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'free',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      (getPriceId as jest.Mock).mockReturnValue('price_test_jpy');

      const mockCheckoutSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      };

      mockCheckoutSessionsCreate.mockResolvedValue(mockCheckoutSession);

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      await createCheckoutSession(data, mockContext);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://cloudinbox.app/settings/plan?success=true',
          cancel_url: 'https://cloudinbox.app/settings/plan?canceled=true',
        })
      );

      // 環境変数を復元
      if (originalBaseUrl) {
        process.env.BASE_URL = originalBaseUrl;
      }
    });
  });

  describe('エラーハンドリング', () => {
    beforeEach(() => {
      // デフォルトで環境変数を設定
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    });

    it('Stripe APIエラーの場合、エラーを投げる', async () => {
      const mockUserDoc = {
        exists: true,
        data: () => ({
          plan: {
            id: 'free',
          },
        }),
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      (getPriceId as jest.Mock).mockReturnValue('price_test_jpy');

      mockCheckoutSessionsCreate.mockRejectedValue(
        new Error('Stripe API error')
      );

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('Failed to create checkout session');
    });

    it('ユーザードキュメントが存在しない場合、エラーを投げる', async () => {
      const mockUserDoc = {
        exists: false,
      };

      const mockUserRef = {
        get: jest.fn().mockResolvedValue(mockUserDoc),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      const data = {
        planId: 'standard' as const,
        locale: 'ja' as const,
      };

      await expect(
        createCheckoutSession(data, mockContext)
      ).rejects.toThrow('User not found');
    });
  });
});

