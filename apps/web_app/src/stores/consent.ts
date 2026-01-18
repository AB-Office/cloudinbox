import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getFirestore, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '@/services/firebase';
import { getDocumentMetadata, type Locale } from '@/services/legalDocument';

const db = getFirestore(firebaseApp);

/**
 * 法的文書の同意情報の型定義
 */
export interface LegalConsents {
  terms?: {
    consentedAt: Timestamp;
    documentVersion: string; // ISO 8601形式の更新日時
  };
  privacy?: {
    consentedAt: Timestamp;
    documentVersion: string; // ISO 8601形式の更新日時
  };
}

export const useConsentStore = defineStore('consent', () => {
  const legalConsents = ref<LegalConsents | null>(null);
  const isLoading = ref(false);
  const needsReconsent = ref(false);

  /**
   * 現在のロケールを取得する（デフォルトは'ja'）
   */
  function getCurrentLocale(): Locale {
    // ブラウザのロケールから判定（簡易版）
    // より正確な実装が必要な場合は、i18nストアや設定から取得
    if (typeof navigator !== 'undefined' && navigator.language) {
      const lang = navigator.language.split('-')[0];
      return lang === 'en' ? 'en' : 'ja';
    }
    return 'ja';
  }

  /**
   * ISO 8601形式の文字列を比較する
   * @param version1 バージョン1（ISO 8601形式）
   * @param version2 バージョン2（ISO 8601形式）
   * @returns version1 > version2 の場合 true
   */
  function compareVersions(version1: string, version2: string): boolean {
    return version1 > version2;
  }

  /**
   * 同意状態を確認する
   * ユーザードキュメントからlegalConsentsを取得し、Storageから法的文書のメタデータを取得して比較する
   */
  async function checkConsentStatus(): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    isLoading.value = true;
    try {
      // Firestoreからユーザードキュメントを取得
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('User document not found');
      }

      const userData = userSnap.data();
      const consents = userData.legalConsents as LegalConsents | null | undefined;
      legalConsents.value = consents || null;

      // 同意がない場合は再確認が必要
      if (!consents || !consents.terms || !consents.privacy) {
        needsReconsent.value = true;
        return;
      }

      // Storageから法的文書のメタデータを取得
      const locale = getCurrentLocale();
      let termsVersion: string;
      let privacyVersion: string;

      try {
        termsVersion = await getDocumentMetadata('terms', locale);
        privacyVersion = await getDocumentMetadata('privacy', locale);
      } catch (error) {
        // メタデータ取得エラー: 既存の同意があればそれを尊重
        console.warn('Failed to fetch document metadata:', error);
        needsReconsent.value = false;
        return;
      }

      // バージョン比較
      const termsNeedsUpdate = compareVersions(termsVersion, consents.terms.documentVersion);
      const privacyNeedsUpdate = compareVersions(privacyVersion, consents.privacy.documentVersion);

      needsReconsent.value = termsNeedsUpdate || privacyNeedsUpdate;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 同意を保存する
   * @param termsVersion 利用規約のバージョン（ISO 8601形式）
   * @param privacyVersion プライバシーポリシーのバージョン（ISO 8601形式）
   */
  async function saveConsent(termsVersion: string, privacyVersion: string): Promise<void> {
    const auth = getAuth(firebaseApp);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    isLoading.value = true;
    try {
      const userRef = doc(db, 'users', uid);
      const now = Timestamp.now();

      const newConsents: LegalConsents = {
        terms: {
          consentedAt: now,
          documentVersion: termsVersion,
        },
        privacy: {
          consentedAt: now,
          documentVersion: privacyVersion,
        },
      };

      await updateDoc(userRef, {
        legalConsents: newConsents,
        updatedAt: now,
      });

      // ストアの状態を更新
      legalConsents.value = newConsents;
      needsReconsent.value = false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 同意が必要かどうかを判定する
   * @returns 同意が必要な場合 true
   */
  async function isConsentRequired(): Promise<boolean> {
    // 既にチェック済みでキャッシュされている場合はそれを使用
    // ただし、初回チェック時は必ず確認する
    if (legalConsents.value === null && !isLoading.value) {
      await checkConsentStatus();
    }

    // 再確認が必要な場合は常に同意が必要
    if (needsReconsent.value) {
      return true;
    }

    // legalConsentsがnullの場合は同意が必要
    if (!legalConsents.value || !legalConsents.value.terms || !legalConsents.value.privacy) {
      return true;
    }

    // それ以外の場合は同意済みとみなす
    return false;
  }

  /**
   * ストアの状態をリセットする（ログアウト時などに使用）
   */
  function reset(): void {
    legalConsents.value = null;
    isLoading.value = false;
    needsReconsent.value = false;
  }

  return {
    legalConsents,
    isLoading,
    needsReconsent,
    checkConsentStatus,
    saveConsent,
    isConsentRequired,
    reset,
  };
});

