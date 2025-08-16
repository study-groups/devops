#!/usr/bin/env node

/**
 * Authentication Test Runner
 * 
 * This script runs all authentication tests and provides a comprehensive report.
 * 
 * Usage:
 *   node run-tests.js          # Run all tests
 *   node run-tests.js quick    # Run only quick tests
 *   node run-tests.js full     # Run only full integration tests
 */

import { runQuickTests } from './tests/quick-auth-test.js';
import { runAuthTests } from './tests/auth-integration.test.js';

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Authentication Test Suite Runner');
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  const results = {};

  try {
    // Run quick tests
    console.log('\n📋 Running Quick Tests...');
    results.quick = await runQuickTests();
    
    // Run full integration tests
    console.log('\n📋 Running Full Integration Tests...');
    results.full = await runAuthTests();
    
    // Summary
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Final Test Results');
    console.log('='.repeat(50));
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`🚀 Quick Tests: ${results.quick ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`🔧 Full Tests: ${results.full ? '✅ PASSED' : '❌ FAILED'}`);
    
    const allPassed = results.quick && results.full;
    
    if (allPassed) {
      console.log('\n🎉 All tests passed! Authentication system is fully operational.');
      console.log('✅ Login, session management, token generation, and API access are working correctly.');
      return true;
    } else {
      console.log('\n💥 Some tests failed. Please review the authentication system.');
      if (!results.quick) {
        console.log('🔧 Quick tests failed - check basic authentication flow');
      }
      if (!results.full) {
        console.log('🔧 Full integration tests failed - check comprehensive functionality');
      }
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Test runner failed:', error.message);
    return false;
  }
}

/**
 * Run specific test suite
 */
async function runSpecificTests(type) {
  console.log(`🚀 Running ${type} Authentication Tests`);
  console.log('='.repeat(50));
  
  try {
    let result;
    
    switch (type) {
      case 'quick':
        result = await runQuickTests();
        break;
      case 'full':
        result = await runAuthTests();
        break;
      default:
        console.error('❌ Unknown test type. Use "quick" or "full"');
        return false;
    }
    
    if (result) {
      console.log(`\n🎉 ${type} tests passed!`);
    } else {
      console.log(`\n💥 ${type} tests failed!`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`\n❌ ${type} tests failed:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0];
  
  if (testType) {
    await runSpecificTests(testType);
  } else {
    await runAllTests();
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runAllTests, runSpecificTests };
