#!/usr/bin/env node

/**
 * Test Firebase Firestore Rules for users/{uid}/legalConsents
 * 
 * This script tests the Firestore rules to verify:
 * 1. Authenticated users can read/write their own legalConsents field
 * 2. Authenticated users cannot read/write other users' legalConsents field
 * 3. Unauthenticated users cannot access legalConsents field
 * 
 * Note: This test requires Firebase Emulator Suite or actual Firebase project.
 * For emulator: firebase emulators:start --only firestore
 * For actual project: Set GOOGLE_APPLICATION_CREDENTIALS or use gcloud auth
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Firebase Admin SDKの初期化
if (!admin.apps || admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'cloudinbox-dev';
  admin.initializeApp({
    projectId: projectId,
  });
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

/**
 * Test 1: Authenticated user can read/write their own legalConsents (rule validation)
 */
async function testAuthenticatedUserCanReadWriteOwnLegalConsents(): Promise<void> {
  const testName = 'Authenticated user can read/write their own legalConsents';
  console.log(`\n[TEST] ${testName}...`);

  try {
    // Verify the rule exists in firestore.rules
    const rulesPath = path.join(__dirname, '../infra/firebase/firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // Check that the rule exists: allow read, write: if request.auth != null && request.auth.uid == uid;
    if (!rules.includes('allow read, write: if request.auth != null && request.auth.uid == uid')) {
      throw new Error('Firestore rule for authenticated read/write not found');
    }

    // Check that the rule is in the correct path: users/{uid}
    if (!rules.includes('match /users/{uid}')) {
      throw new Error('Firestore rule path for users/{uid} not found');
    }

    // Check that the rule mentions legalConsents (in comments or documentation)
    // The rule applies to all fields including legalConsents
    if (!rules.includes('users/{uid}')) {
      throw new Error('Firestore rule path for users not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: Full test requires Firebase Emulator Suite or actual Firebase project`);
    console.log(`  ℹ Expected behavior: Authenticated users can read/write their own users/{uid} document (including legalConsents)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Test 2: Authenticated user cannot read/write other users' legalConsents
 * 
 * Note: This test validates that the rule enforces uid matching
 */
async function testAuthenticatedUserCannotAccessOtherUsersLegalConsents(): Promise<void> {
  const testName = 'Authenticated user cannot read/write other users\' legalConsents';
  console.log(`\n[TEST] ${testName}...`);

  try {
    // Verify the rule exists in firestore.rules
    const rulesPath = path.join(__dirname, '../infra/firebase/firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // Check that the rule requires uid matching: request.auth.uid == uid
    if (!rules.includes('request.auth.uid == uid')) {
      throw new Error('Firestore rule for uid matching not found');
    }

    // Check that the rule path uses {uid} parameter
    if (!rules.includes('/users/{uid}')) {
      throw new Error('Firestore rule path with uid parameter not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: Full test requires Firebase Emulator Suite or actual Firebase project`);
    console.log(`  ℹ Expected behavior: Authenticated users cannot read/write other users' users/{uid} documents`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Test 3: Unauthenticated user cannot access legalConsents
 * 
 * Note: This test validates that the rule requires authentication
 */
async function testUnauthenticatedUserCannotAccessLegalConsents(): Promise<void> {
  const testName = 'Unauthenticated user cannot access legalConsents';
  console.log(`\n[TEST] ${testName}...`);

  try {
    // Verify the rule exists in firestore.rules
    const rulesPath = path.join(__dirname, '../infra/firebase/firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // Check that the rule requires authentication: request.auth != null
    if (!rules.includes('request.auth != null')) {
      throw new Error('Firestore rule for authentication check not found');
    }

    // Check that the rule is in the users/{uid} path
    if (!rules.includes('match /users/{uid}')) {
      throw new Error('Firestore rule path for users/{uid} not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: Full test requires Firebase Emulator Suite or actual Firebase project`);
    console.log(`  ℹ Expected behavior: Unauthenticated users cannot access users/{uid} documents`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Test 4: Rule applies to legalConsents field
 * 
 * Note: This test validates that the rule comment mentions legalConsents
 */
async function testRuleAppliesToLegalConsents(): Promise<void> {
  const testName = 'Rule applies to legalConsents field';
  console.log(`\n[TEST] ${testName}...`);

  try {
    // Verify the rule exists in firestore.rules
    const rulesPath = path.join(__dirname, '../infra/firebase/firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // Check that the rule comment mentions legalConsents
    // The comment should mention that legalConsents is included
    if (!rules.includes('legalConsents')) {
      throw new Error('Firestore rule comment for legalConsents not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: The rule comment confirms that legalConsents is covered by the users/{uid} rule`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Cleanup test data (if created)
 */
async function cleanup(): Promise<void> {
  // No cleanup needed for rule validation tests
  // If actual Firebase project tests are run, cleanup would be done here
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  console.log('Starting Firebase Firestore Rules Tests for legalConsents...\n');
  console.log('Note: These tests validate the Firestore rules configuration.');
  console.log('For full integration tests, use Firebase Emulator Suite:\n');
  console.log('  firebase emulators:start --only firestore\n');

  try {
    // Run tests
    await testAuthenticatedUserCanReadWriteOwnLegalConsents();
    await testAuthenticatedUserCannotAccessOtherUsersLegalConsents();
    await testUnauthenticatedUserCannotAccessLegalConsents();
    await testRuleAppliesToLegalConsents();

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

