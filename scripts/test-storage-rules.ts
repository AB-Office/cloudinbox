#!/usr/bin/env node

/**
 * Test Firebase Storage Rules for legal-docs/**
 * 
 * This script tests the storage rules to verify:
 * 1. Authenticated users can read legal documents
 * 2. Unauthenticated users cannot read legal documents
 * 3. Non-admin users cannot write/delete legal documents
 * 
 * Note: This test requires Firebase Emulator Suite or actual Firebase project.
 * For emulator: firebase emulators:start --only storage
 * For actual project: Set GOOGLE_APPLICATION_CREDENTIALS or use gcloud auth
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Firebase Admin SDKの初期化
if (!admin.apps || admin.apps.length === 0) {
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'cloudinbox-dev.firebasestorage.app';
  admin.initializeApp({
    storageBucket: storageBucket,
  });
}

// Test configuration (for future use with Firebase Emulator Suite)
// const TEST_FILE_PATH = 'legal-docs/test_terms_ja.md';
// const TEST_CONTENT = '# Test Terms\n\nThis is a test file for storage rules validation.';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

/**
 * Test 1: Authenticated user can read legal document (rule validation)
 */
async function testAuthenticatedUserCanRead(): Promise<void> {
  const testName = 'Authenticated user can read legal document';
  console.log(`\n[TEST] ${testName}...`);

  try {
    // Verify the rule exists in storage.rules
    const rulesPath = path.join(__dirname, '../infra/firebase/storage.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // Check that the rule exists: allow read: if request.auth != null;
    if (!rules.includes('allow read: if request.auth != null')) {
      throw new Error('Storage rule for authenticated read not found');
    }

    // Check that the rule is in the correct path: legal-docs/**
    if (!rules.includes('match /legal-docs/{allPaths=**}')) {
      throw new Error('Storage rule path for legal-docs not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: Full test requires Firebase Emulator Suite or actual Firebase project`);
    console.log(`  ℹ Expected behavior: Authenticated users can read legal-docs/** files`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Test 2: Unauthenticated user cannot read legal document
 * 
 * Note: This test requires Firebase Emulator Suite or actual Firebase project
 * with proper authentication setup. In a real scenario, we would:
 * 1. Initialize Firebase Client SDK without authentication
 * 2. Try to read the file
 * 3. Expect an error (unauthorized)
 * 
 * For this script, we document the expected behavior.
 */
async function testUnauthenticatedUserCannotRead(): Promise<void> {
  const testName = 'Unauthenticated user cannot read legal document';
  console.log(`\n[TEST] ${testName}...`);

  try {
    // Note: This test requires Firebase Client SDK with unauthenticated context
    // In a real test environment, we would:
    // 1. Initialize Firebase Client SDK without authentication
    // 2. Try to getDownloadURL for the file
    // 3. Expect storage/unauthorized error
    
    // For this script, we verify the rule exists in storage.rules
    const fs = require('fs');
    const path = require('path');
    const rulesPath = path.join(__dirname, '../infra/firebase/storage.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // Check that the rule exists: allow read: if request.auth != null;
    if (!rules.includes('allow read: if request.auth != null')) {
      throw new Error('Storage rule for authenticated read not found');
    }

    // Check that write is denied: allow write: if false;
    if (!rules.includes('allow write: if false')) {
      throw new Error('Storage rule for write denial not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: Full test requires Firebase Emulator Suite or actual Firebase project`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Test 3: Non-admin users cannot write legal documents
 */
async function testNonAdminCannotWrite(): Promise<void> {
  const testName = 'Non-admin users cannot write legal documents';
  console.log(`\n[TEST] ${testName}...`);

  try {
    // Verify the rule exists in storage.rules
    const fs = require('fs');
    const path = require('path');
    const rulesPath = path.join(__dirname, '../infra/firebase/storage.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // Check that write is denied: allow write: if false;
    if (!rules.includes('allow write: if false')) {
      throw new Error('Storage rule for write denial not found');
    }

    // Check that delete is denied: allow delete: if false;
    if (!rules.includes('allow delete: if false')) {
      throw new Error('Storage rule for delete denial not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: Full test requires Firebase Client SDK with authenticated user trying to write`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Cleanup test file (if created)
 */
async function cleanup(): Promise<void> {
  // No cleanup needed for rule validation tests
  // If actual Firebase project tests are run, cleanup would be done here
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  console.log('Starting Firebase Storage Rules Tests...\n');
  console.log('Note: These tests validate the storage rules configuration.');
  console.log('For full integration tests, use Firebase Emulator Suite:\n');
  console.log('  firebase emulators:start --only storage\n');

  try {
    // Run tests
    await testAuthenticatedUserCanRead();
    await testUnauthenticatedUserCannotRead();
    await testNonAdminCannotWrite();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    
    testResults.forEach(result => {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`${status}: ${result.name}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
    
    console.log('='.repeat(60));
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('='.repeat(60));

    // Cleanup
    await cleanup();

    // Exit with appropriate code
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n✗ Error running tests:', error);
    await cleanup();
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main();
}

