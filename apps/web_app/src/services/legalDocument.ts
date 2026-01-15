/**
 * Legal Document Service
 *
 * Service for fetching legal documents (terms, privacy policy, etc.) from Firebase Storage
 */

import { getStorage, ref, getDownloadURL } from 'firebase/storage';
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
    const url = await getDownloadURL(storageRef);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      // Firebase Storageのエラーを再スロー
      if (error.message.includes('storage/object-not-found')) {
        throw new Error(`Document not found: ${path}`);
      }
      // ネットワークエラーやその他のエラーを再スロー
      throw error;
    }
    throw new Error(`Failed to fetch document: ${String(error)}`);
  }
}
