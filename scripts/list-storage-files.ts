#!/usr/bin/env node

/**
 * List files in Firebase Storage
 * 
 * This script lists all files in a specified Storage path
 */

import * as admin from 'firebase-admin';

// Firebase Admin SDKの初期化
if (!admin.apps || admin.apps.length === 0) {
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'cloudinbox-dev.firebasestorage.app';
  admin.initializeApp({
    storageBucket: storageBucket,
  });
}

async function listFiles(prefix: string = 'legal-docs/'): Promise<void> {
  try {
    const storage = admin.storage();
    const bucket = storage.bucket();
    
    console.log(`Listing files in: ${prefix}\n`);
    
    const [files] = await bucket.getFiles({ prefix });
    
    if (files.length === 0) {
      console.log('No files found.');
      return;
    }
    
    console.log(`Found ${files.length} file(s):\n`);
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      console.log(`  ${file.name}`);
      console.log(`    Size: ${metadata.size} bytes`);
      console.log(`    Content-Type: ${metadata.contentType}`);
      console.log(`    Updated: ${metadata.updated}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error listing files:', error);
    process.exit(1);
  }
}

// メイン処理
const prefix = process.argv[2] || 'legal-docs/';
listFiles(prefix).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

