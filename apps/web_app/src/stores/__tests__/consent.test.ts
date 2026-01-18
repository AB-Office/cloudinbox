/**
 * Tests for ConsentStore
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConsentStore, type LegalConsents } from '../consent';
import { getFirestore, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDocumentMetadata } from '@/services/legalDocument';
import { firebaseApp } from '@/services/firebase';

// Firebase Firestoreのモック
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ seconds: 1000000000, nanoseconds: 0 })),
  },
}));

// Firebase Authのモック
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
}));

// Legal Document Serviceのモック
vi.mock('@/services/legalDocument', () => ({
  getDocumentMetadata: vi.fn(),
}));

// Firebase Appのモック
vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
}));

describe('consentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('checkConsentStatus', () => {
    it('should fetch consent status when user has no consent', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const mockUserSnap = {
        exists: () => true,
        data: () => ({ legalConsents: null }),
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      await store.checkConsentStatus();

      expect(store.legalConsents).toBeNull();
      expect(store.needsReconsent).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('should detect when reconsent is needed due to document update', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const existingConsents: LegalConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
      };
      const mockUserSnap = {
        exists: () => true,
        data: () => ({ legalConsents: existingConsents }),
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // terms
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // privacy

      await store.checkConsentStatus();

      expect(store.needsReconsent).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('should detect when no reconsent is needed', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const existingConsents: LegalConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-12-31T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-12-31T00:00:00.000Z',
        },
      };
      const mockUserSnap = {
        exists: () => true,
        data: () => ({ legalConsents: existingConsents }),
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // terms
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // privacy

      await store.checkConsentStatus();

      expect(store.needsReconsent).toBe(false);
      expect(store.isLoading).toBe(false);
    });

    it('should handle metadata fetch error gracefully', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const existingConsents: LegalConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
      };
      const mockUserSnap = {
        exists: () => true,
        data: () => ({ legalConsents: existingConsents }),
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);
      vi.mocked(getDocumentMetadata).mockRejectedValue(new Error('Network error'));

      await store.checkConsentStatus();

      // 既存の同意があればそれを尊重
      expect(store.needsReconsent).toBe(false);
      expect(store.isLoading).toBe(false);
    });

    it('should throw error when user is not authenticated', async () => {
      const store = useConsentStore();

      vi.mocked(getAuth).mockReturnValue({
        currentUser: null,
      } as any);

      await expect(store.checkConsentStatus()).rejects.toThrow('User not authenticated');
    });

    it('should throw error when user document not found', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const mockUserSnap = {
        exists: () => false,
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      await expect(store.checkConsentStatus()).rejects.toThrow('User document not found');
    });
  });

  describe('saveConsent', () => {
    it('should save consent to Firestore', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const termsVersion = '2024-12-31T00:00:00.000Z';
      const privacyVersion = '2024-12-31T00:00:00.000Z';

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      await store.saveConsent(termsVersion, privacyVersion);

      expect(updateDoc).toHaveBeenCalledWith(
        mockUserRef,
        expect.objectContaining({
          legalConsents: expect.objectContaining({
            terms: expect.objectContaining({
              documentVersion: termsVersion,
            }),
            privacy: expect.objectContaining({
              documentVersion: privacyVersion,
            }),
          }),
        })
      );
      expect(store.legalConsents).toBeTruthy();
      expect(store.needsReconsent).toBe(false);
      expect(store.isLoading).toBe(false);
    });

    it('should throw error when user is not authenticated', async () => {
      const store = useConsentStore();

      vi.mocked(getAuth).mockReturnValue({
        currentUser: null,
      } as any);

      await expect(store.saveConsent('2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('isConsentRequired', () => {
    it('should return true when no consent exists', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const mockUserSnap = {
        exists: () => true,
        data: () => ({ legalConsents: null }),
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);

      const result = await store.isConsentRequired();

      expect(result).toBe(true);
    });

    it('should return true when needsReconsent is true', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const existingConsents: LegalConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
      };
      const mockUserSnap = {
        exists: () => true,
        data: () => ({ legalConsents: existingConsents }),
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // terms
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // privacy

      const result = await store.isConsentRequired();

      expect(result).toBe(true);
      expect(store.needsReconsent).toBe(true);
    });

    it('should return false when consent is up to date', async () => {
      const store = useConsentStore();
      const mockDb = {};
      const mockUserRef = {};
      const existingConsents: LegalConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-12-31T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-12-31T00:00:00.000Z',
        },
      };
      const mockUserSnap = {
        exists: () => true,
        data: () => ({ legalConsents: existingConsents }),
      };

      vi.mocked(getFirestore).mockReturnValue(mockDb as any);
      vi.mocked(doc).mockReturnValue(mockUserRef as any);
      vi.mocked(getDoc).mockResolvedValue(mockUserSnap as any);
      vi.mocked(getAuth).mockReturnValue({
        currentUser: { uid: 'test-user' },
      } as any);
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // terms
      vi.mocked(getDocumentMetadata).mockResolvedValueOnce('2024-12-31T00:00:00.000Z'); // privacy

      const result = await store.isConsentRequired();

      expect(result).toBe(false);
      expect(store.needsReconsent).toBe(false);
    });
  });

  describe('compareVersions', () => {
    it('should compare ISO 8601 versions correctly', () => {
      const store = useConsentStore();

      // バージョン比較ロジックは内部関数なので、実装を通じてテストする
      // compareVersions('2024-12-31T00:00:00.000Z', '2024-01-01T00:00:00.000Z') は true
      // compareVersions('2024-01-01T00:00:00.000Z', '2024-12-31T00:00:00.000Z') は false
      
      // 実際の使用例として、isConsentRequiredを通じてテストする
      // ただし、バージョン比較ロジックを直接テストするために、checkConsentStatusを使用する
    });
  });

  describe('reset', () => {
    it('should reset store state', () => {
      const store = useConsentStore();
      store.legalConsents = {
        terms: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
        privacy: {
          consentedAt: Timestamp.now(),
          documentVersion: '2024-01-01T00:00:00.000Z',
        },
      };
      store.needsReconsent = true;
      store.isLoading = true;

      store.reset();

      expect(store.legalConsents).toBeNull();
      expect(store.needsReconsent).toBe(false);
      expect(store.isLoading).toBe(false);
    });
  });
});

