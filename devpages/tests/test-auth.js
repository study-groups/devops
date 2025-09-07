#!/usr/bin/env node

/**
 * Simple Authentication Test Runner
 * 
 * Run this script to test if authentication is working after login:
 * node test-auth.js
 */

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'https://devpages.qa.pixeljamarcade.com',
  testUser: {
    username: process.env.user || 'mike',
    password: process.env.password || 'nigelt'
  }
};

/**
 * Simple fetch wrapper with error handling
 */
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json().catch(() => null);
    return { status: response.status, data, headers: response.headers };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Test the complete authentication flow
 */
async function testAuthentication() {
  console.log('🧪 Testing Authentication System');
  console.log(`📍 URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`👤 User: ${TEST_CONFIG.testUser.username}`);
  console.log('='.repeat(50));

  let sessionCookie = null;
  let pdataToken = null;

  // Step 1: Test login
  console.log('\n1️⃣ Testing Login...');
  const loginResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: TEST_CONFIG.testUser.username,
      password: TEST_CONFIG.testUser.password
    }),
    credentials: 'include'
  });

  if (loginResult.error) {
    console.log('❌ Login failed:', loginResult.error);
    return false;
  }

  if (loginResult.status === 200 && loginResult.data?.user) {
    console.log('✅ Login successful');
    console.log(`   User: ${loginResult.data.user.username}`);
    console.log(`   Role: ${loginResult.data.user.role}`);
    
    // Extract session cookie
    const setCookieHeader = loginResult.headers.get('set-cookie');
    if (setCookieHeader) {
      sessionCookie = setCookieHeader;
      console.log('✅ Session cookie received');
    }
  } else {
    console.log('❌ Login failed:', loginResult.data?.error || 'Unknown error');
    return false;
  }

  // Step 2: Test user status
  console.log('\n2️⃣ Testing User Status...');
  const userResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/user`, {
    headers: { 'Cookie': sessionCookie },
    credentials: 'include'
  });

  if (userResult.status === 200 && userResult.data?.isAuthenticated) {
    console.log('✅ User is authenticated');
    console.log(`   Auth method: ${userResult.data.authMethod}`);
  } else {
    console.log('❌ User authentication failed:', userResult.data?.error || 'Not authenticated');
    return false;
  }

  // Step 3: Test token generation
  console.log('\n3️⃣ Testing Token Generation...');
  const tokenResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/token/generate`, {
    method: 'POST',
    headers: { 'Cookie': sessionCookie },
    body: JSON.stringify({
      expiryHours: 24,
      description: 'Test Token'
    }),
    credentials: 'include'
  });

  if (tokenResult.status === 200 && tokenResult.data?.success && tokenResult.data?.token) {
    console.log('✅ Token generated successfully');
    console.log(`   Token length: ${tokenResult.data.token.length} characters`);
    pdataToken = tokenResult.data.token;
  } else {
    console.log('❌ Token generation failed:', tokenResult.data?.error || 'Unknown error');
    return false;
  }

  // Step 4: Test API access
  console.log('\n4️⃣ Testing API Access...');
  const apiResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/dirs`, {
    headers: { 'Authorization': `Bearer ${pdataToken}` }
  });

  if (apiResult.status === 200 && Array.isArray(apiResult.data)) {
    console.log('✅ API access successful');
    console.log(`   Directories: ${apiResult.data.join(', ')}`);
  } else {
    console.log('❌ API access failed:', apiResult.data?.error || 'Unknown error');
    return false;
  }

  // Step 5: Test file listing
  console.log('\n5️⃣ Testing File Listing...');
  const listResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/list?pathname=/`, {
    headers: { 'Authorization': `Bearer ${pdataToken}` }
  });

  if (listResult.status === 200 && listResult.data) {
    console.log('✅ File listing successful');
    console.log(`   Directories: ${listResult.data.dirs?.length || 0}`);
    console.log(`   Files: ${listResult.data.files?.length || 0}`);
  } else {
    console.log('❌ File listing failed:', listResult.data?.error || 'Unknown error');
    return false;
  }

  // Step 6: Test logout
  console.log('\n6️⃣ Testing Logout...');
  const logoutResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Cookie': sessionCookie },
    credentials: 'include'
  });

  if (logoutResult.status === 200) {
    console.log('✅ Logout successful');
  } else {
    console.log('⚠️ Logout failed:', logoutResult.data?.error || 'Unknown error');
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 All tests passed! Authentication system is working correctly.');
  return true;
}

/**
 * Test error scenarios
 */
async function testErrorScenarios() {
  console.log('\n🚨 Testing Error Scenarios...');

  // Test invalid token
  const invalidTokenResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/dirs`, {
    headers: { 'Authorization': 'Bearer invalid-token' }
  });
  console.log(`Invalid token: ${invalidTokenResult.status} ${invalidTokenResult.data?.error || ''}`);

  // Test invalid login
  const invalidLoginResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: 'invalid-user',
      password: 'invalid-password'
    }),
    credentials: 'include'
  });
  console.log(`Invalid login: ${invalidLoginResult.status} ${invalidLoginResult.data?.error || ''}`);

  // Test unauthenticated access
  const unauthenticatedResult = await makeRequest(`${TEST_CONFIG.baseUrl}/api/files/dirs`);
  console.log(`Unauthenticated: ${unauthenticatedResult.status} ${unauthenticatedResult.data?.error || ''}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Authentication Tests...\n');
  
  try {
    const authResult = await testAuthentication();
    
    if (authResult) {
      await testErrorScenarios();
      console.log('\n🎯 Summary: Authentication system is working correctly!');
      process.exit(0);
    } else {
      console.log('\n💥 Summary: Authentication system has issues that need to be fixed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testAuthentication, testErrorScenarios };
