/**
 * Quick Authentication Test
 * 
 * This script provides immediate verification of the authentication system.
 * Run with: node tests/quick-auth-test.js
 */

const TEST_CONFIG = {
  baseUrl: 'https://devpages.qa.pixeljamarcade.com',
  testUser: {
    username: 'mike',
    password: 'nigelt'
  }
};

/**
 * Enhanced fetch wrapper with detailed logging
 */
async function makeRequest(url, options = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`  📡 ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json().catch(() => null);
    const duration = Date.now() - startTime;
    
    console.log(`  ⏱️  ${response.status} (${duration}ms)`);
    
    if (response.ok) {
      console.log(`  ✅ Success`);
    } else {
      console.log(`  ❌ Error: ${data?.error || 'Unknown error'}`);
    }
    
    return { 
      status: response.status, 
      data, 
      headers: response.headers,
      ok: response.ok,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`  ⏱️  ERROR (${duration}ms)`);
    console.log(`  ❌ Network Error: ${error.message}`);
    return { error: error.message, ok: false, duration };
  }
}

/**
 * Test step with detailed output
 */
async function testStep(name, testFunction) {
  console.log(`\n🔍 ${name}`);
  console.log('─'.repeat(50));
  
  try {
    const result = await testFunction();
    return result;
  } catch (error) {
    console.log(`  ❌ Test step failed: ${error.message}`);
    return false;
  }
}

/**
 * Quick authentication tests
 */
async function runQuickTests() {
  console.log('🚀 Quick Authentication Test Suite');
  console.log(`📍 URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`👤 User: ${TEST_CONFIG.testUser.username}`);
  console.log('='.repeat(60));

  let sessionCookie = null;
  let pdataToken = null;
  let testResults = [];

  // Test 1: Login
  const loginResult = await testStep('1. Login Process', async () => {
    const result = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_CONFIG.testUser.username,
        password: TEST_CONFIG.testUser.password
      }),
      credentials: 'include'
    });

    if (result.ok && result.data?.user) {
      sessionCookie = result.headers.get('set-cookie');
      console.log(`  👤 Logged in as: ${result.data.user.username}`);
      console.log(`  🎭 Role: ${result.data.user.role}`);
      return true;
    }
    return false;
  });
  testResults.push({ name: 'Login', passed: loginResult });

  // Test 2: User Status
  const userStatusResult = await testStep('2. User Status Check', async () => {
    if (!sessionCookie) {
      console.log('  ⚠️  No session cookie available');
      return false;
    }

    const result = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/user`, {
      headers: { 'Cookie': sessionCookie },
      credentials: 'include'
    });

    if (result.ok && result.data?.isAuthenticated) {
      console.log(`  🔐 Authentication method: ${result.data.authMethod}`);
      return true;
    }
    return false;
  });
  testResults.push({ name: 'User Status', passed: userStatusResult });

  // Test 3: Token Generation
  const tokenResult = await testStep('3. PData Token Generation', async () => {
    if (!sessionCookie) {
      console.log('  ⚠️  No session cookie available');
      return false;
    }

    const result = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/token/generate`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie },
      body: JSON.stringify({
        expiryHours: 24,
        description: 'Quick Test Token'
      }),
      credentials: 'include'
    });

    if (result.ok && result.data?.success && result.data?.token) {
      pdataToken = result.data.token;
      console.log(`  🎫 Token generated (${result.data.token.length} chars)`);
      console.log(`  ⏰ Expires: ${result.data.expiresAt}`);
      return true;
    }
    return false;
  });
  testResults.push({ name: 'Token Generation', passed: tokenResult });

  // Test 4: API Access with Token
  const apiAccessResult = await testStep('4. API Access with Token', async () => {
    if (!pdataToken) {
      console.log('  ⚠️  No token available');
      return false;
    }

    const result = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/dirs`, {
      headers: { 'Authorization': `Bearer ${pdataToken}` }
    });

    if (result.ok && Array.isArray(result.data)) {
      console.log(`  📁 Found ${result.data.length} directories`);
      console.log(`  📂 Sample: ${result.data.slice(0, 3).join(', ')}`);
      return true;
    }
    return false;
  });
  testResults.push({ name: 'API Access', passed: apiAccessResult });

  // Test 5: File Listing
  const fileListingResult = await testStep('5. File Listing', async () => {
    if (!pdataToken) {
      console.log('  ⚠️  No token available');
      return false;
    }

    const result = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/list?pathname=/`, {
      headers: { 'Authorization': `Bearer ${pdataToken}` }
    });

    if (result.ok && result.data) {
      console.log(`  📁 Directories: ${result.data.dirs?.length || 0}`);
      console.log(`  📄 Files: ${result.data.files?.length || 0}`);
      return true;
    }
    return false;
  });
  testResults.push({ name: 'File Listing', passed: fileListingResult });

  // Test 6: Error Scenarios
  const errorScenariosResult = await testStep('6. Error Scenarios', async () => {
    let allPassed = true;

    // Test invalid token
    console.log('  🔍 Testing invalid token...');
    const invalidTokenResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/dirs`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    if (invalidTokenResult.status !== 401) {
      console.log('  ❌ Invalid token should return 401');
      allPassed = false;
    } else {
      console.log('  ✅ Invalid token correctly rejected');
    }

    // Test unauthenticated access
    console.log('  🔍 Testing unauthenticated access...');
    const unauthenticatedResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/dirs`);
    if (unauthenticatedResult.status !== 401) {
      console.log('  ❌ Unauthenticated access should return 401');
      allPassed = false;
    } else {
      console.log('  ✅ Unauthenticated access correctly rejected');
    }

    return allPassed;
  });
  testResults.push({ name: 'Error Scenarios', passed: errorScenariosResult });

  // Test 7: Logout
  const logoutResult = await testStep('7. Logout Process', async () => {
    if (!sessionCookie) {
      console.log('  ⚠️  No session cookie available');
      return false;
    }

    const result = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie },
      credentials: 'include'
    });

    if (result.ok) {
      console.log('  🚪 Successfully logged out');
      return true;
    }
    return false;
  });
  testResults.push({ name: 'Logout', passed: logoutResult });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Quick Test Results Summary');
  console.log('='.repeat(60));

  const passedTests = testResults.filter(r => r.passed).length;
  const totalTests = testResults.length;

  testResults.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });

  console.log('\n' + '─'.repeat(60));
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All quick tests passed! Authentication system is working correctly.');
    console.log('✅ Login, session, token generation, and API access are working correctly.');
    return true;
  } else {
    console.log('\n💥 Some tests failed. Please review the authentication system.');
    console.log('🔧 Check the server logs and ensure all authentication endpoints are working.');
    return false;
  }
}

/**
 * Export for use in other modules
 */
export { runQuickTests, TEST_CONFIG };

/**
 * Run tests if this file is executed directly
 */
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runQuickTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
