/**
 * Tests for upload-legal-docs script
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// モック用の型定義
interface MockBucket {
  file: jest.Mock;
}

interface MockStorage {
  bucket: jest.Mock;
}

describe('upload-legal-docs', () => {
  const sourceDir = path.join(process.cwd(), 'apps/web_app/public');
  const fileMapping = {
    'terms.md': { type: 'terms', locale: 'ja' },
    'terms_en.md': { type: 'terms', locale: 'en' },
    'privacy.md': { type: 'privacy', locale: 'ja' },
    'privacy_en.md': { type: 'privacy', locale: 'en' },
    'commercial.md': { type: 'commercial', locale: 'ja' },
    'pricing_en.md': { type: 'pricing', locale: 'en' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate that all source files exist', () => {
    for (const [sourceFile] of Object.entries(fileMapping)) {
      const filePath = path.join(sourceDir, sourceFile);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('should have correct file mapping structure', () => {
    for (const [sourceFile, mapping] of Object.entries(fileMapping)) {
      expect(mapping).toHaveProperty('type');
      expect(mapping).toHaveProperty('locale');
      expect(typeof mapping.type).toBe('string');
      expect(typeof mapping.locale).toBe('string');
      expect(['ja', 'en']).toContain(mapping.locale);
    }
  });

  it('should generate correct storage paths', () => {
    const expectedPaths = {
      'terms.md': 'legal-docs/terms_ja.md',
      'terms_en.md': 'legal-docs/terms_en.md',
      'privacy.md': 'legal-docs/privacy_ja.md',
      'privacy_en.md': 'legal-docs/privacy_en.md',
      'commercial.md': 'legal-docs/commercial_ja.md',
      'pricing_en.md': 'legal-docs/pricing_en.md',
    };

    for (const [sourceFile, mapping] of Object.entries(fileMapping)) {
      const storagePath = `legal-docs/${mapping.type}_${mapping.locale}.md`;
      expect(storagePath).toBe(expectedPaths[sourceFile as keyof typeof expectedPaths]);
    }
  });

  it('should read source files as UTF-8', () => {
    for (const [sourceFile] of Object.entries(fileMapping)) {
      const filePath = path.join(sourceDir, sourceFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        expect(typeof content).toBe('string');
      }
    }
  });
});

