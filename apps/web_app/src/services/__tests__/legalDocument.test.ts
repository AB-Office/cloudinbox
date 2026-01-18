/**
 * Tests for LegalDocumentService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocument, getDocumentMetadata } from '../legalDocument';
import { getStorage, ref, getBytes, getMetadata } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '@/services/firebase';

// Firebase Storageのモック
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  getBytes: vi.fn(),
  getMetadata: vi.fn(),
}));

// Firebase Authのモック
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
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
    const mockContent = '# 利用規約\n\n本文...';
    const mockBytes = new TextEncoder().encode(mockContent);

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getBytes).mockResolvedValue(mockBytes as any);
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: 'test-user' },
    } as any);

    const result = await getDocument('terms', 'ja');

    expect(getStorage).toHaveBeenCalledWith(firebaseApp);
    expect(ref).toHaveBeenCalledWith(mockStorage, 'legal-docs/terms_ja.md');
    expect(getBytes).toHaveBeenCalledWith(mockRef);
    expect(result).toBe(mockContent);
  });

  it('should handle file not found error', async () => {
    const mockStorage = {};
    const mockRef = {};
    const error = new Error('storage/object-not-found');
    (error as any).code = 'storage/object-not-found';

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getBytes).mockRejectedValue(error);
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: 'test-user' },
    } as any);

    await expect(getDocument('terms', 'ja')).rejects.toThrow(
      'Document not found: legal-docs/terms_ja.md'
    );
  });

  it('should handle authentication error', async () => {
    const mockStorage = {};
    const mockRef = {};
    const error = new Error('storage/unauthorized');
    (error as any).code = 'storage/unauthorized';

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getBytes).mockRejectedValue(error);
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: 'test-user' },
    } as any);

    await expect(getDocument('privacy', 'en')).rejects.toThrow();
  });

  it('should handle network error', async () => {
    const mockStorage = {};
    const mockRef = {};

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getBytes).mockRejectedValue(new Error('Network error'));
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: 'test-user' },
    } as any);

    await expect(getDocument('privacy', 'en')).rejects.toThrow('Network error');
  });

  it('should handle general error', async () => {
    const mockStorage = {};
    const mockRef = {};

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getBytes).mockRejectedValue(new Error('General error'));
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: 'test-user' },
    } as any);

    await expect(getDocument('commercial', 'ja')).rejects.toThrow('General error');
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
      const mockBytes = new TextEncoder().encode('content');

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getBytes).mockResolvedValue(mockBytes as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      await getDocument(testCase.type as any, testCase.locale as any);

      expect(ref).toHaveBeenCalledWith(mockStorage, testCase.expectedPath);
    }
  });

  it('should handle non-Error exceptions', async () => {
    const mockStorage = {};
    const mockRef = {};

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getBytes).mockRejectedValue('String error');
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: 'test-user' },
    } as any);

    await expect(getDocument('terms', 'ja')).rejects.toThrow(
      'Failed to fetch document: String error'
    );
  });

  it('should handle unauthorized user', async () => {
    const mockStorage = {};
    const mockRef = {};

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getAuth).mockReturnValue({
      currentUser: null,
    } as any);

    await expect(getDocument('pricing', 'en')).rejects.toThrow('User not authenticated');
  });

  it('should handle empty content', async () => {
    const mockStorage = {};
    const mockRef = {};
    const mockBytes = new TextEncoder().encode('');

    vi.mocked(getStorage).mockReturnValue(mockStorage as any);
    vi.mocked(ref).mockReturnValue(mockRef as any);
    vi.mocked(getBytes).mockResolvedValue(mockBytes as any);
    vi.mocked(getAuth).mockReturnValue({
      currentUser: { uid: 'test-user' },
    } as any);

    const result = await getDocument('commercial', 'ja');
    expect(result).toBe('');
  });

  describe('getDocumentMetadata', () => {
    it('should get document metadata from Firebase Storage', async () => {
      const mockStorage = {};
      const mockRef = {};
      const mockUpdatedTime = new Date('2024-01-01T00:00:00.000Z');
      const mockMetadata = {
        updated: mockUpdatedTime,
        timeCreated: new Date('2023-12-01T00:00:00.000Z'),
      };

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getMetadata).mockResolvedValue(mockMetadata as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      const result = await getDocumentMetadata('terms', 'ja');

      expect(getStorage).toHaveBeenCalledWith(firebaseApp);
      expect(ref).toHaveBeenCalledWith(mockStorage, 'legal-docs/terms_ja.md');
      expect(getMetadata).toHaveBeenCalledWith(mockRef);
      expect(result).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should use timeCreated when updated is not available', async () => {
      const mockStorage = {};
      const mockRef = {};
      const mockTimeCreated = new Date('2024-01-01T00:00:00.000Z');
      const mockMetadata = {
        updated: undefined,
        timeCreated: mockTimeCreated,
      };

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getMetadata).mockResolvedValue(mockMetadata as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      const result = await getDocumentMetadata('privacy', 'en');

      expect(result).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle metadata without timestamp', async () => {
      const mockStorage = {};
      const mockRef = {};
      const mockMetadata = {
        updated: undefined,
        timeCreated: undefined,
      };

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getMetadata).mockResolvedValue(mockMetadata as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      await expect(getDocumentMetadata('terms', 'ja')).rejects.toThrow(
        'Metadata does not contain timestamp: legal-docs/terms_ja.md'
      );
    });

    it('should handle file not found error', async () => {
      const mockStorage = {};
      const mockRef = {};
      const error = new Error('storage/object-not-found');
      (error as any).code = 'storage/object-not-found';

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getMetadata).mockRejectedValue(error);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      await expect(getDocumentMetadata('terms', 'ja')).rejects.toThrow(
        'Document not found: legal-docs/terms_ja.md'
      );
    });

    it('should handle unauthorized error', async () => {
      const mockStorage = {};
      const mockRef = {};
      const error = new Error('storage/unauthorized');
      (error as any).code = 'storage/unauthorized';

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getMetadata).mockRejectedValue(error);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      await expect(getDocumentMetadata('privacy', 'en')).rejects.toThrow('Unauthorized');
    });

    it('should handle unauthorized user', async () => {
      const mockStorage = {};
      const mockRef = {};

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: null,
      } as any);

      await expect(getDocumentMetadata('terms', 'ja')).rejects.toThrow('User not authenticated');
    });

    it('should return ISO 8601 format string', async () => {
      const mockStorage = {};
      const mockRef = {};
      const mockUpdatedTime = new Date('2024-12-31T23:59:59.999Z');
      const mockMetadata = {
        updated: mockUpdatedTime,
      };

      vi.mocked(getStorage).mockReturnValue(mockStorage as any);
      vi.mocked(ref).mockReturnValue(mockRef as any);
      vi.mocked(getMetadata).mockResolvedValue(mockMetadata as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      const result = await getDocumentMetadata('terms', 'ja');

      // ISO 8601形式の文字列であることを確認
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result).toBe('2024-12-31T23:59:59.999Z');
    });
  });
});
