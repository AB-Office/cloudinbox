/**
 * サブスクリプション関連のサービス
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebase';
import type {
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from '@/types/subscription';

const functions = getFunctions(firebaseApp, 'asia-northeast1');

/**
 * Stripe Checkout Sessionを作成し、リダイレクトする
 * @param planId プランID（'free'または'standard'）
 * @param locale ロケール（'ja'または'en'）
 */
export async function createCheckoutSession(
  planId: 'free' | 'standard',
  locale: 'ja' | 'en'
): Promise<void> {
  const createCheckoutSessionFunction = httpsCallable<
    CreateCheckoutSessionRequest,
    CreateCheckoutSessionResponse
  >(functions, 'createCheckoutSession');

  const result = await createCheckoutSessionFunction({
    planId,
    locale,
  });

  const response = result.data;

  // ダウングレードの場合（messageが返される）
  if (response.message) {
    window.alert(response.message);
    return;
  }

  // アップグレードの場合（urlが返される）
  if (response.url) {
    window.location.href = response.url;
    return;
  }

  // URLもメッセージもない場合はエラー
  throw new Error('Invalid response from createCheckoutSession');
}
