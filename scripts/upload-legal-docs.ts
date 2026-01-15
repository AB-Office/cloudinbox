#!/usr/bin/env node

/**
 * Upload legal documents (terms, privacy policy, etc.) to Firebase Storage
 * 
 * This script reads Markdown files from apps/web_app/public/ and uploads them
 * to Firebase Storage under the legal-docs/ path.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';

// Firebase Admin SDKの初期化
if (!admin.apps || admin.apps.length === 0) {
  // 環境変数からstorageBucketを取得、またはデフォルト値を使用
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'cloudinbox-dev.firebasestorage.app';
  admin.initializeApp({
    storageBucket: storageBucket,
  });
}

interface FileMapping {
  type: string;
  locale: string;
}

interface UploadConfig {
  sourceDir: string;
  storagePath: string;
  fileMapping: {
    [sourceFile: string]: FileMapping;
  };
}

// ファイルマッピング定義
const fileMapping: { [sourceFile: string]: FileMapping } = {
  'terms.md': { type: 'terms', locale: 'ja' },
  'terms_en.md': { type: 'terms', locale: 'en' },
  'privacy.md': { type: 'privacy', locale: 'ja' },
  'privacy_en.md': { type: 'privacy', locale: 'en' },
  'commercial.md': { type: 'commercial', locale: 'ja' },
  'pricing_en.md': { type: 'pricing', locale: 'en' },
};

// プロジェクトルートを取得（scriptsディレクトリから実行される場合を考慮）
// process.cwd()がscriptsディレクトリの場合、親ディレクトリに移動
const currentDir = process.cwd();
const projectRoot = currentDir.endsWith('scripts') 
  ? path.resolve(currentDir, '..')
  : currentDir;
const config: UploadConfig = {
  sourceDir: path.join(projectRoot, 'apps/web_app/public'),
  storagePath: 'legal-docs',
  fileMapping,
};

/**
 * ファイルの存在確認とバリデーション
 */
function validateSourceFiles(): void {
  console.log('Validating source files...');
  
  for (const [sourceFile, mapping] of Object.entries(config.fileMapping)) {
    const filePath = path.join(config.sourceDir, sourceFile);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Source file not found: ${filePath}`);
    }
    
    // ファイルが空でないことを確認
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error(`Source file is empty: ${filePath}`);
    }
    
    // マッピングのバリデーション
    if (!mapping.type || !mapping.locale) {
      throw new Error(`Invalid mapping for ${sourceFile}: missing type or locale`);
    }
    
    if (!['ja', 'en'].includes(mapping.locale)) {
      throw new Error(`Invalid locale for ${sourceFile}: ${mapping.locale}`);
    }
    
    console.log(`  ✓ ${sourceFile} -> legal-docs/${mapping.type}_${mapping.locale}.md`);
  }
  
  console.log('All source files validated.\n');
}

/**
 * ファイルをStorageにアップロード
 */
async function uploadFile(
  sourcePath: string,
  storagePath: string,
  fileName: string
): Promise<void> {
  const storage = admin.storage();
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  
  // ファイルを読み込み
  const fileContent = fs.readFileSync(sourcePath, 'utf-8');
  const buffer = Buffer.from(fileContent, 'utf-8');
  
  // Storageにアップロード
  await file.save(buffer, {
    metadata: {
      contentType: 'text/markdown',
    },
  });
  
  console.log(`  ✓ Uploaded: ${fileName} -> ${storagePath}`);
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    console.log('Starting legal documents upload...\n');
    
    // ソースファイルのバリデーション
    validateSourceFiles();
    
    // 各ファイルをアップロード
    console.log('Uploading files to Firebase Storage...');
    for (const [sourceFile, mapping] of Object.entries(config.fileMapping)) {
      const sourcePath = path.join(config.sourceDir, sourceFile);
      const storageFileName = `${mapping.type}_${mapping.locale}.md`;
      const storagePath = `${config.storagePath}/${storageFileName}`;
      
      await uploadFile(sourcePath, storagePath, sourceFile);
    }
    
    console.log('\n✓ All files uploaded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error uploading files:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

