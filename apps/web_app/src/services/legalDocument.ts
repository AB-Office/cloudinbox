/**
 * Legal Document Service
 *
 * Service for fetching legal documents (terms, privacy policy, etc.) from Firebase Storage
 */

import { getStorage, ref, getBytes } from 'firebase/storage';
import { firebaseApp } from './firebase';

export type DocumentType = 'terms' | 'privacy' | 'commercial' | 'pricing';
export type Locale = 'ja' | 'en';

/**
 * Get legal document from Firebase Storage
 * @param documentType Type of document (terms, privacy, commercial, pricing)
 * @param locale Language locale (ja, en)
 * @returns Promise that resolves to the Markdown content of the document
 * @throws Error if document cannot be fetched (file not found, network error, etc.)
 */
export async function getDocument(documentType: DocumentType, locale: Locale): Promise<string> {
  const storage = getStorage(firebaseApp);
  const path = `legal-docs/${documentType}_${locale}.md`;
  const storageRef = ref(storage, path);

  try {
    // 認証状態を確認（デバッグ用）
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth(firebaseApp);
    if (!auth.currentUser) {
      throw new Error('User not authenticated. Please sign in to view legal documents.');
    }

    // getBytesを使用して直接バイトデータを取得（CORS問題を回避）
    const bytes = await getBytes(storageRef);

    // UTF-8でデコード
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (error) {
    if (error instanceof Error) {
      // Firebase Storageのエラーを処理
      const errorCode = (error as any).code;
      if (
        error.message.includes('storage/object-not-found') ||
        errorCode === 'storage/object-not-found'
      ) {
        throw new Error(`Document not found: ${path}`);
      }
      if (error.message.includes('storage/unauthorized') || errorCode === 'storage/unauthorized') {
        throw new Error(`Unauthorized: Authentication required to access ${path}`);
      }
      // 既に詳細なエラーメッセージが設定されている場合はそのまま再スロー
      if (error.message.includes('Failed to fetch document')) {
        throw error;
      }
      // その他のエラー
      throw new Error(`Failed to fetch document: ${error.message}. Path: ${path}`);
    }
    throw new Error(`Failed to fetch document: ${String(error)}. Path: ${path}`);
  }
}
