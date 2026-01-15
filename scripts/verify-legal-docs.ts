#!/usr/bin/env node

/**
 * Verify legal documents uploaded to Firebase Storage
 * 
 * This script verifies that all legal documents have been correctly uploaded
 * to Firebase Storage with proper metadata.
 */

import * as admin from 'firebase-admin';
import { Buffer } from 'buffer';

// Firebase Admin SDKの初期化
if (!admin.apps || admin.apps.length === 0) {
  // 環境変数からstorageBucketを取得、またはデフォルト値を使用
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'cloudinbox-dev.firebasestorage.app';
  admin.initializeApp({
    storageBucket: storageBucket,
  });
}

interface ExpectedFile {
  path: string;
  type: string;
  locale: string;
}

// 期待されるファイルリスト
const expectedFiles: ExpectedFile[] = [
  { path: 'legal-docs/terms_ja.md', type: 'terms', locale: 'ja' },
  { path: 'legal-docs/terms_en.md', type: 'terms', locale: 'en' },
  { path: 'legal-docs/privacy_ja.md', type: 'privacy', locale: 'ja' },
  { path: 'legal-docs/privacy_en.md', type: 'privacy', locale: 'en' },
  { path: 'legal-docs/commercial_ja.md', type: 'commercial', locale: 'ja' },
  { path: 'legal-docs/pricing_en.md', type: 'pricing', locale: 'en' },
];

interface VerificationResult {
  path: string;
  exists: boolean;
  contentType?: string;
  size?: number;
  error?: string;
}

/**
 * ファイルの存在とメタデータを検証
 */
async function verifyFile(file: ExpectedFile): Promise<VerificationResult> {
  const storage = admin.storage();
  const bucket = storage.bucket();
  const fileRef = bucket.file(file.path);

  try {
    // ファイルの存在確認
    const [exists] = await fileRef.exists();
    if (!exists) {
      return {
        path: file.path,
        exists: false,
        error: 'File does not exist',
      };
    }

    // メタデータの取得
    const [metadata] = await fileRef.getMetadata();
    
    // sizeはstring | number | undefinedの可能性があるため、適切に変換
    let size = 0;
    if (metadata.size !== undefined) {
      if (typeof metadata.size === 'number') {
        size = metadata.size;
      } else {
        size = parseInt(metadata.size, 10);
      }
    }
    
    return {
      path: file.path,
      exists: true,
      contentType: metadata.contentType,
      size: size,
    };
  } catch (error) {
    return {
      path: file.path,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    console.log('Verifying legal documents in Firebase Storage...\n');

    const results: VerificationResult[] = [];
    
    // 各ファイルを検証
    for (const file of expectedFiles) {
      const result = await verifyFile(file);
      results.push(result);
      
      if (result.exists) {
        console.log(`✓ ${file.path}`);
        console.log(`  Content-Type: ${result.contentType}`);
        console.log(`  Size: ${result.size} bytes`);
        
        // メタデータの検証
        if (result.contentType !== 'text/markdown') {
          console.warn(`  ⚠ Warning: Expected contentType 'text/markdown', got '${result.contentType}'`);
        }
        if (result.size === 0) {
          console.warn(`  ⚠ Warning: File size is 0 bytes`);
        }
      } else {
        console.error(`✗ ${file.path}`);
        console.error(`  Error: ${result.error}`);
      }
      console.log('');
    }

    // 結果の集計
    const successCount = results.filter(r => r.exists).length;
    const failCount = results.filter(r => !r.exists).length;
    const totalCount = results.length;

    console.log('--- Verification Summary ---');
    console.log(`Total files: ${totalCount}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    if (failCount > 0) {
      console.error('\n✗ Verification failed: Some files are missing or have incorrect metadata.');
      process.exit(1);
    }

    // メタデータの検証
    const invalidMetadata = results.filter(r => 
      r.exists && (r.contentType !== 'text/markdown' || r.size === 0)
    );
    
    if (invalidMetadata.length > 0) {
      console.warn('\n⚠ Warning: Some files have incorrect metadata.');
      process.exit(1);
    }

    console.log('\n✓ All files verified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error verifying files:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

