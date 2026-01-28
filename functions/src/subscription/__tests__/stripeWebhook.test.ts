/**
 * stripeWebhook - Stripe Webhook処理機能のテスト
 */

/// <reference types="jest" />

import { stripeWebhook } from '../stripeWebhook';
import * as admin from 'firebase-admin';
import { getPlanConfig } from '../planConfig';

// モック
const mockFirestoreInstance = {
  collection: jest.fn(),
};

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' })),
};

jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    ...actualAdmin,
    firestore: jest.fn(() => mockFirestoreInstance),
    apps: [],
    initializeApp: jest.fn(),
  };
});

// FieldValueをモック
(admin.firestore as any).FieldValue = mockFieldValue;

jest.mock('../planConfig');

// Stripeモック
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }));
});

jest.mock('firebase-functions', () => ({
  region: jest.fn(() => ({
    https: {
      onRequest: jest.fn((handler: any) => handler),
    },
  })),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  config: jest.fn(() => ({
    stripe: {
      webhook_secret: 'whsec_test_secret',
    },
  })),
}));

describe('stripeWebhook', () => {
  let mockFirestore: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConstructEvent.mockClear();

    // Firestoreモック（各テストで上書きされる）
    mockFirestore = {
      collection: jest.fn(),
    };
    
    // mockFirestoreInstanceをリセット
    mockFirestoreInstance.collection = jest.fn();

    // Express Request/Responseモック
    mockRequest = {
      body: {},
      headers: {
        'stripe-signature': 'test-signature',
      },
      rawBody: Buffer.from('test-body'),
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('署名検証', () => {
    it('署名検証に失敗した場合、400エラーを返す', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await stripeWebhook(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Webhook signature verification failed');
    });
  });

  describe('checkout.session.completed イベント', () => {
    it('アップグレード時にプランをStandardに更新する', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
            metadata: {
              userId: 'test-user-123',
              planId: 'standard',
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const mockUpdate = jest.fn().mockResolvedValue({});
      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            plan: {
              id: 'free',
            },
          }),
        }),
        update: mockUpdate,
      };

      const mockDoc = jest.fn(() => mockUserRef);
      mockFirestoreInstance.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: mockDoc,
          };
        }
        return { doc: jest.fn() };
      });

      (getPlanConfig as jest.Mock).mockReturnValue({
        id: 'standard',
        label: 'Standard',
        maxStorageBytes: 53687091200,
        maxAccounts: 10,
      });

      await stripeWebhook(mockRequest, mockResponse);

      expect(mockDoc).toHaveBeenCalledWith('test-user-123');
      expect(mockUpdate).toHaveBeenCalledWith({
        plan: {
          id: 'standard',
          label: 'Standard',
          maxStorageBytes: 53687091200,
          maxAccounts: 10,
        },
        billing: {
          stripeCustomerId: 'cus_test_123',
          stripeSubscriptionId: 'sub_test_123',
        },
        updatedAt: expect.any(Object),
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('customer.subscription.updated イベント', () => {
    it('cancel_at_period_end: trueかつstatus: activeの場合、プラン更新を行わない', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
            status: 'active',
            cancel_at_period_end: true,
            current_period_end: Math.floor(Date.now() / 1000) + 86400, // 1日後
            items: {
              data: [
                {
                  price: {
                    id: 'price_test_jpy',
                  },
                },
              ],
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            billing: {
              stripeCustomerId: 'cus_test_123',
            },
          }),
        }),
        update: jest.fn().mockResolvedValue({}),
      };

      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: 'test-user-123',
            ref: mockUserRef,
            data: () => ({
              billing: {
                stripeCustomerId: 'cus_test_123',
              },
            }),
          },
        ],
      };

      mockFirestoreInstance.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
            where: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockQuerySnapshot),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      await stripeWebhook(mockRequest, mockResponse);

      expect(mockUserRef.update).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });

    it('cancel_at_period_end: trueかつstatus: canceledで期間終了時、Freeプランに更新する', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
            status: 'canceled',
            cancel_at_period_end: true,
            current_period_end: Math.floor(Date.now() / 1000) - 86400, // 1日前（期間終了済み）
            items: {
              data: [
                {
                  price: {
                    id: 'price_test_jpy',
                  },
                },
              ],
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const mockUpdate = jest.fn().mockResolvedValue({});
      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            billing: {
              stripeCustomerId: 'cus_test_123',
            },
          }),
        }),
        update: mockUpdate,
      };

      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: 'test-user-123',
            ref: mockUserRef,
          },
        ],
      };

      mockFirestoreInstance.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
            where: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockQuerySnapshot),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      (getPlanConfig as jest.Mock).mockReturnValue({
        id: 'free',
        label: 'Free',
        maxStorageBytes: 2147483648,
        maxAccounts: 1,
      });

      await stripeWebhook(mockRequest, mockResponse);

      expect(mockUpdate).toHaveBeenCalledWith({
        plan: {
          id: 'free',
          label: 'Free',
          maxStorageBytes: 2147483648,
          maxAccounts: 1,
        },
        updatedAt: expect.any(Object),
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('customer.subscription.deleted イベント', () => {
    it('サブスクリプション削除時にFreeプランに更新する', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const mockUpdate = jest.fn().mockResolvedValue({});
      const mockUserRef = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            billing: {
              stripeCustomerId: 'cus_test_123',
            },
          }),
        }),
        update: mockUpdate,
      };

      const mockQuerySnapshot = {
        empty: false,
        docs: [
          {
            id: 'test-user-123',
            ref: mockUserRef,
          },
        ],
      };

      mockFirestoreInstance.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
            where: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockQuerySnapshot),
            })),
          };
        }
        return { doc: jest.fn() };
      });

      (getPlanConfig as jest.Mock).mockReturnValue({
        id: 'free',
        label: 'Free',
        maxStorageBytes: 2147483648,
        maxAccounts: 1,
      });

      await stripeWebhook(mockRequest, mockResponse);

      expect(mockUpdate).toHaveBeenCalledWith({
        plan: {
          id: 'free',
          label: 'Free',
          maxStorageBytes: 2147483648,
          maxAccounts: 1,
        },
        updatedAt: expect.any(Object),
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('エラーハンドリング', () => {
    it('イベント処理中にエラーが発生した場合、500エラーを返す', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
            metadata: {
              userId: 'test-user-123',
              planId: 'standard',
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const mockUserRef = {
        get: jest.fn().mockRejectedValue(new Error('Firestore error')),
      };

      mockFirestore.collection = jest.fn((path: string) => {
        if (path === 'users') {
          return {
            doc: jest.fn(() => mockUserRef),
          };
        }
        return { doc: jest.fn() };
      });

      await stripeWebhook(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Webhook handler failed');
    });

    it('未対応のイベントタイプの場合、200を返す（処理をスキップ）', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {},
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      await stripeWebhook(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });
});

