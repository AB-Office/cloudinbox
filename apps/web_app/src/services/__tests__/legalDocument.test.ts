/**
 * Tests for LegalDocumentService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocument } from '../legalDocument';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/services/firebase';

// Firebase Storageのモック
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
}));

describe('LegalDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get document from Firebase Storage', async () => {
    const mockStorage = {};
    const mockRef = {};
    const mockUrl = 'https://example.com/legal-docs/terms_ja.md';
    const mockContent = '# 利用規約\n\n本文...';

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

    // fetchのモック
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockContent,
    });

    const result = await getDocument('terms', 'ja');

    expect(getStorage).toHaveBeenCalledWith(firebaseApp);
    expect(ref).toHaveBeenCalledWith(mockStorage, 'legal-docs/terms_ja.md');
    expect(getDownloadURL).toHaveBeenCalledWith(mockRef);
    expect(global.fetch).toHaveBeenCalledWith(mockUrl);
    expect(result).toBe(mockContent);
  });

  it('should handle file not found error', async () => {
    const mockStorage = {};
    const mockRef = {};

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockRejectedValue(new Error('storage/object-not-found'));

    await expect(getDocument('terms', 'ja')).rejects.toThrow(
      'Document not found: legal-docs/terms_ja.md'
    );
  });

  it('should handle authentication error', async () => {
    const mockStorage = {};
    const mockRef = {};

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockRejectedValue(new Error('storage/unauthorized'));

    await expect(getDocument('privacy', 'en')).rejects.toThrow();
  });

  it('should handle network error', async () => {
    const mockStorage = {};
    const mockRef = {};
    const mockUrl = 'https://example.com/legal-docs/privacy_en.md';

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(getDocument('privacy', 'en')).rejects.toThrow('Network error');
  });

  it('should handle HTTP error response', async () => {
    const mockStorage = {};
    const mockRef = {};
    const mockUrl = 'https://example.com/legal-docs/commercial_ja.md';

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(getDocument('commercial', 'ja')).rejects.toThrow(
      'Failed to fetch document: Not Found'
    );
  });

  it('should generate correct storage path for different document types', async () => {
    const mockStorage = {};
    const testCases = [
      { type: 'terms', locale: 'ja', expectedPath: 'legal-docs/terms_ja.md' },
      { type: 'terms', locale: 'en', expectedPath: 'legal-docs/terms_en.md' },
      { type: 'privacy', locale: 'ja', expectedPath: 'legal-docs/privacy_ja.md' },
      { type: 'privacy', locale: 'en', expectedPath: 'legal-docs/privacy_en.md' },
      { type: 'commercial', locale: 'ja', expectedPath: 'legal-docs/commercial_ja.md' },
      { type: 'pricing', locale: 'en', expectedPath: 'legal-docs/pricing_en.md' },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      const mockRef = {};
      const mockUrl = `https://example.com/${testCase.expectedPath}`;

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'content',
      });

      await getDocument(testCase.type as any, testCase.locale as any);

      expect(ref).toHaveBeenCalledWith(mockStorage, testCase.expectedPath);
    }
  });

  it('should handle non-Error exceptions', async () => {
    const mockStorage = {};
    const mockRef = {};

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockRejectedValue('String error');

    await expect(getDocument('terms', 'ja')).rejects.toThrow(
      'Failed to fetch document: String error'
    );
  });

  it('should handle fetch response with non-ok status', async () => {
    const mockStorage = {};
    const mockRef = {};
    const mockUrl = 'https://example.com/legal-docs/pricing_en.md';

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(getDocument('pricing', 'en')).rejects.toThrow(
      'Failed to fetch document: Forbidden'
    );
  });

  it('should handle empty response text', async () => {
    const mockStorage = {};
    const mockRef = {};
    const mockUrl = 'https://example.com/legal-docs/commercial_ja.md';

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });

    const result = await getDocument('commercial', 'ja');
    expect(result).toBe('');
  });
});
