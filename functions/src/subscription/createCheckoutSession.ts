/**
 * createCheckoutSession - Stripe Checkout Session作成
 * 
 * ユーザーが選択したプランに基づいてStripe Checkout Sessionを作成する
 * または、ダウングレードの場合は既存のサブスクリプションを更新する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { getPriceId } from './planConfig';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Checkout Session作成リクエストの型定義
 */
interface CreateCheckoutSessionRequest {
  planId: 'free' | 'standard';
  locale: 'ja' | 'en';
}

/**
 * Checkout Session作成レスポンスの型定義
 */
interface CreateCheckoutSessionResponse {
  url?: string;
  message?: string;
}

/**
 * Stripe Checkout Sessionを作成するHTTP Callable Function
 */
export const createCheckoutSession: any = functions
  .region('asia-northeast1')
  .https.onCall(
    async (
      data: CreateCheckoutSessionRequest,
      context: functions.https.CallableContext
    ): Promise<CreateCheckoutSessionResponse> => {
      // 認証チェック
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const uid = context.auth.uid;

      // パラメータ検証
      if (!data.planId || (data.planId !== 'free' && data.planId !== 'standard')) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'planId is required and must be "free" or "standard"'
        );
      }

      if (!data.locale || (data.locale !== 'ja' && data.locale !== 'en')) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'locale is required and must be "ja" or "en"'
        );
      }

      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User not found'
        );
      }

      const userData = userDoc.data();
      const currentPlanId = userData?.plan?.id || 'free';

      // Stripe APIキーの取得
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Stripe secret key is not configured'
        );
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });

      // プラン変更の種類に応じた処理
      if (currentPlanId === 'free' && data.planId === 'standard') {
        // アップグレード（Free → Standard）
        const priceId = getPriceId('standard', data.locale);
        if (!priceId) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Stripe price ID is not configured'
          );
        }

        // ベースURLの取得（環境変数またはデフォルト値）
        const baseUrl = process.env.BASE_URL || 'https://cloudinbox.app';
        const successUrl = `${baseUrl}/settings/plan?success=true`;
        const cancelUrl = `${baseUrl}/settings/plan?canceled=true`;

        try {
          const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [
              {
                price: priceId,
                quantity: 1,
              },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
              userId: uid,
              planId: 'standard',
            },
          });

          if (!session.url) {
            throw new Error('Checkout session URL is missing');
          }

          return {
            url: session.url,
          };
        } catch (error: any) {
          functions.logger.error('Failed to create checkout session', error);
          throw new functions.https.HttpsError(
            'internal',
            `Failed to create checkout session: ${error.message}`
          );
        }
      } else if (currentPlanId === 'standard' && data.planId === 'free') {
        // ダウングレード（Standard → Free）
        const billing = userData?.billing;
        if (!billing?.stripeCustomerId || !billing?.stripeSubscriptionId) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Stripe customer or subscription not found'
          );
        }

        try {
          // 既存のサブスクリプションを取得（存在確認のため）
          await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);

          // サブスクリプションを更新（請求期間終了時にキャンセル）
          await stripe.subscriptions.update(billing.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });

          return {
            message: 'Subscription will be canceled at the end of the billing period',
          };
        } catch (error: any) {
          functions.logger.error('Failed to update subscription', error);
          throw new functions.https.HttpsError(
            'internal',
            `Failed to update subscription: ${error.message}`
          );
        }
      } else {
        // 同じプランへの変更や無効な変更
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid plan change: ${currentPlanId} -> ${data.planId}`
        );
      }
    }
  );

