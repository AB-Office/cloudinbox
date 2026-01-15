#!/usr/bin/env node

/**
 * Setup CORS configuration for Firebase Storage
 *
 * This script sets up CORS configuration for Firebase Storage bucket
 * to allow web applications to access legal documents.
 *
 * Prerequisites:
 * - Google Cloud SDK (gsutil) must be installed
 * - Authentication: gcloud auth application-default login or GOOGLE_APPLICATION_CREDENTIALS
 *
 * Usage:
 *   npm run setup-storage-cors
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const corsConfigPath = path.join(__dirname, '../infra/firebase/storage.cors.json');
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'cloudinbox-dev.firebasestorage.app';

async function setupCors(): Promise<void> {
  console.log('Setting up CORS configuration for Firebase Storage...\n');

  // CORS設定ファイルの存在確認
  if (!fs.existsSync(corsConfigPath)) {
    console.error(`Error: CORS config file not found: ${corsConfigPath}`);
    process.exit(1);
  }

  console.log(`CORS config file: ${corsConfigPath}`);
  console.log(`Bucket name: ${bucketName}\n`);

  try {
    // gsutilコマンドでCORS設定を適用
    const command = `gsutil cors set ${corsConfigPath} gs://${bucketName}`;
    console.log(`Executing: ${command}\n`);
    execSync(command, { stdio: 'inherit' });
    console.log('\n✓ CORS configuration applied successfully!');
  } catch (error) {
    console.error('\n✗ Failed to apply CORS configuration');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('\nPlease ensure:');
    console.error('1. Google Cloud SDK (gsutil) is installed');
    console.error('2. You are authenticated: gcloud auth application-default login');
    console.error('3. You have permission to modify the Storage bucket');
    process.exit(1);
  }
}

if (require.main === module) {
  setupCors();
}

