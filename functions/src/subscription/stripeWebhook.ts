/**
 * stripeWebhook - Stripe Webhook処理
 * 
 * Stripe Webhookイベントを受信し、Firestoreのプラン情報を更新する
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { Request, Response } from 'express';
import { getPlanConfig } from './planConfig';

// Firebase Admin SDKの初期化（確実に初期化されるように）
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Stripe Webhookを処理するHTTP Request Function
 */
export const stripeWebhook: any = functions
  .region('asia-northeast1')
  .https.onRequest(async (req: Request, res: Response) => {
    // Stripe Webhookシークレットの取得
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      functions.logger.error('Stripe webhook secret is not configured');
      res.status(500).send('Webhook secret not configured');
      return;
    }

    // Stripeインスタンスの作成（署名検証のみのため、APIキーは不要）
    const stripe = new Stripe('', {
      apiVersion: '2023-10-16',
    });

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      functions.logger.error('Missing stripe-signature header');
      res.status(400).send('Missing stripe-signature header');
      return;
    }

    let event: Stripe.Event;

    try {
      // 署名検証
      // rawBodyはFirebase Functionsで提供されるが、型定義に含まれていないため型アサーションを使用
      const rawBody = (req as any).rawBody || req.body;
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      functions.logger.error('Webhook signature verification failed', err);
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    const db = admin.firestore();

    try {
      // イベントタイプに応じた処理
      switch (event.type) {
        case 'checkout.session.completed': {
          await handleCheckoutSessionCompleted(event, db);
          break;
        }
        case 'customer.subscription.updated': {
          await handleSubscriptionUpdated(event, db);
          break;
        }
        case 'customer.subscription.deleted': {
          await handleSubscriptionDeleted(event, db);
          break;
        }
        default:
          functions.logger.info(`Unhandled event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      functions.logger.error('Webhook handler failed', error);
      res.status(500).send('Webhook handler failed');
    }
  });

/**
 * checkout.session.completed イベントを処理
 */
async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  db: admin.firestore.Firestore
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId as 'free' | 'standard';

  if (!userId || !planId) {
    functions.logger.warn('Missing userId or planId in checkout session metadata', {
      userId,
      planId,
    });
    return;
  }

  if (planId !== 'standard') {
    functions.logger.warn('Invalid planId in checkout session metadata', { planId });
    return;
  }

  const planConfig = getPlanConfig('standard');
  const userRef = db.collection('users').doc(userId);

  await userRef.update({
    plan: {
      id: planConfig.id,
      label: planConfig.label,
      maxStorageBytes: planConfig.maxStorageBytes,
      maxAccounts: planConfig.maxAccounts,
    },
    billing: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  functions.logger.info(`Updated user plan to standard: userId=${userId}`);
}

/**
 * customer.subscription.updated イベントを処理
 */
async function handleSubscriptionUpdated(
  event: Stripe.Event,
  db: admin.firestore.Firestore
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  // Firestoreでbilling.stripeCustomerIdが一致するユーザーを検索
  const usersSnapshot = await db
    .collection('users')
    .where('billing.stripeCustomerId', '==', customerId)
    .get();

  if (usersSnapshot.empty) {
    functions.logger.warn(`User not found for customer: ${customerId}`);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const userRef = userDoc.ref;

  // cancel_at_period_end: trueかつstatus: 'active'の場合、請求期間終了時までStandardプランを維持
  if (subscription.cancel_at_period_end && subscription.status === 'active') {
    functions.logger.info(
      `Subscription will be canceled at period end, maintaining standard plan: userId=${userId}`
    );
    return;
  }

  // cancel_at_period_end: trueかつstatus: 'canceled'の場合、請求期間終了時にFreeプランに更新
  if (
    subscription.cancel_at_period_end &&
    subscription.status === 'canceled' &&
    subscription.current_period_end &&
    subscription.current_period_end < Math.floor(Date.now() / 1000)
  ) {
    const planConfig = getPlanConfig('free');
    await userRef.update({
      plan: {
        id: planConfig.id,
        label: planConfig.label,
        maxStorageBytes: planConfig.maxStorageBytes,
        maxAccounts: planConfig.maxAccounts,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`Updated user plan to free (period ended): userId=${userId}`);
    return;
  }

  // その他の場合、Price IDからプランIDを判定して更新
  // 注意: この実装では、Price IDからプランIDを判定するロジックが必要
  // 簡易実装として、subscription.statusが'active'の場合はstandard、それ以外はfreeとする
  if (subscription.status === 'active') {
    const planConfig = getPlanConfig('standard');
    await userRef.update({
      plan: {
        id: planConfig.id,
        label: planConfig.label,
        maxStorageBytes: planConfig.maxStorageBytes,
        maxAccounts: planConfig.maxAccounts,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`Updated user plan to standard: userId=${userId}`);
  }
}

/**
 * customer.subscription.deleted イベントを処理
 */
async function handleSubscriptionDeleted(
  event: Stripe.Event,
  db: admin.firestore.Firestore
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  // Firestoreでbilling.stripeCustomerIdが一致するユーザーを検索
  const usersSnapshot = await db
    .collection('users')
    .where('billing.stripeCustomerId', '==', customerId)
    .get();

  if (usersSnapshot.empty) {
    functions.logger.warn(`User not found for customer: ${customerId}`);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const userRef = userDoc.ref;

  const planConfig = getPlanConfig('free');
  await userRef.update({
    plan: {
      id: planConfig.id,
      label: planConfig.label,
      maxStorageBytes: planConfig.maxStorageBytes,
      maxAccounts: planConfig.maxAccounts,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  functions.logger.info(`Updated user plan to free (subscription deleted): userId=${userId}`);
}

