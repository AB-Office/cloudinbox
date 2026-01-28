#!/usr/bin/env node

/**
 * Test Firebase Firestore Rules for users/{uid}/billing
 * 
 * This script tests the Firestore rules to verify:
 * 1. Authenticated users can read/write their own billing field
 * 2. Authenticated users cannot read/write other users' billing field
 * 3. Unauthenticated users cannot access billing field
 * 
 * Note: This test validates the Firestore rules configuration.
 * For full integration tests, use Firebase Emulator Suite:
 *   firebase emulators:start --only firestore
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

/**
 * Test 1: Authenticated user can read/write their own billing field
 */
function testAuthenticatedUserCanReadWriteOwnBilling(): void {
  const testName = 'Authenticated user can read/write their own billing field';
  console.log(`\n[TEST] ${testName}...`);

  try {
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

    // The rule applies to all fields including billing
    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: Full test requires Firebase Emulator Suite or actual Firebase project`);
    console.log(`  ℹ Expected behavior: Authenticated users can read/write their own users/{uid} document (including billing)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Test 2: Authenticated user cannot read/write other users' billing field
 */
function testAuthenticatedUserCannotAccessOtherUsersBilling(): void {
  const testName = 'Authenticated user cannot read/write other users\' billing field';
  console.log(`\n[TEST] ${testName}...`);

  try {
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
 * Test 3: Unauthenticated user cannot access billing field
 */
function testUnauthenticatedUserCannotAccessBilling(): void {
  const testName = 'Unauthenticated user cannot access billing field';
  console.log(`\n[TEST] ${testName}...`);

  try {
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
 * Test 4: Rule applies to billing field
 */
function testRuleAppliesToBilling(): void {
  const testName = 'Rule applies to billing field';
  console.log(`\n[TEST] ${testName}...`);

  try {
    const rulesPath = path.join(__dirname, '../infra/firebase/firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    // The rule applies to all fields in users/{uid} document, including billing
    // Check that the rule path exists
    if (!rules.includes('match /users/{uid}')) {
      throw new Error('Firestore rule path for users/{uid} not found');
    }

    // The comment mentions that all fields are included
    // Check that the rule allows read and write for the entire document
    if (!rules.includes('allow read, write')) {
      throw new Error('Firestore rule for read/write not found');
    }

    testResults.push({ name: testName, passed: true });
    console.log(`  ✓ PASSED: ${testName} (rule validation)`);
    console.log(`  ℹ Note: The rule applies to all fields in users/{uid} document, including billing`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ name: testName, passed: false, error: errorMessage });
    console.error(`  ✗ FAILED: ${testName}`);
    console.error(`    Error: ${errorMessage}`);
  }
}

/**
 * Main test execution
 */
function main(): void {
  console.log('Starting Firebase Firestore Rules Tests for billing field...\n');
  console.log('Note: These tests validate the Firestore rules configuration.');
  console.log('For full integration tests, use Firebase Emulator Suite:\n');
  console.log('  firebase emulators:start --only firestore\n');

  try {
    // Run tests
    testAuthenticatedUserCanReadWriteOwnBilling();
    testAuthenticatedUserCannotAccessOtherUsersBilling();
    testUnauthenticatedUserCannotAccessBilling();
    testRuleAppliesToBilling();

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

    // Exit with appropriate code
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n✗ Error running tests:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main();
}

