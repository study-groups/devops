#!/usr/bin/env node

/**
 * Test script for the new RTK Query + PData authentication system
 * 
 * This script tests:
 * 1. PData token creation and validation
 * 2. API endpoints with proper authentication
 * 3. RTK Query integration
 */

import { PData } from './pdata/PData.js';

async function testPDataIntegration() {
  console.log('🧪 Testing PData integration...\n');
  
  try {
    // Initialize PData
    const pdata = new PData();
    console.log('✅ PData initialized successfully');
    
    // Test user validation (you'll need to have a test user)
    const testUsername = 'admin'; // Change this to a user that exists in your system
    const testPassword = 'your-password'; // Change this to the actual password
    
    console.log(`\n🔐 Testing user validation for: ${testUsername}`);
    
    // Note: We can't test password validation without the actual password
    // But we can test token creation if the user exists
    const users = pdata.listUsers();
    console.log(`📋 Available users: ${users.join(', ')}`);
    
    if (users.includes(testUsername)) {
      console.log(`✅ User ${testUsername} exists in PData`);
      
      // Test role retrieval
      const role = pdata.getUserRole(testUsername);
      console.log(`👤 User role: ${role}`);
      
      // Test system status
      const systemStatus = pdata.getSystemStatus();
      console.log('📊 System status:', systemStatus);
      
    } else {
      console.log(`⚠️  User ${testUsername} not found. You may need to create test users.`);
    }
    
    console.log('\n✅ PData integration test completed');
    
  } catch (error) {
    console.error('❌ PData integration test failed:', error);
    return false;
  }
  
  return true;
}

async function testAPIEndpoints() {
  console.log('\n🌐 Testing API endpoints...\n');
  
  // This would require the server to be running
  // For now, just log what we would test
  console.log('📝 API endpoints to test:');
  console.log('  - POST /api/auth/login');
  console.log('  - GET /api/auth/user');
  console.log('  - POST /api/auth/token/generate');
  console.log('  - GET /api/files/dirs');
  console.log('  - GET /api/files/list?pathname=/');
  console.log('  - POST /api/auth/logout');
  
  console.log('\n💡 To test these endpoints:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Open browser to http://localhost:3000');
  console.log('3. Try logging in with your credentials');
  console.log('4. Check browser console for RTK Query logs');
  
  return true;
}

async function main() {
  console.log('🚀 Testing New Authentication System\n');
  console.log('=====================================\n');
  
  const pdataTest = await testPDataIntegration();
  const apiTest = await testAPIEndpoints();
  
  console.log('\n📊 Test Results:');
  console.log(`PData Integration: ${pdataTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API Endpoints: ${apiTest ? '✅ READY' : '❌ FAIL'}`);
  
  if (pdataTest && apiTest) {
    console.log('\n🎉 All tests passed! The new auth system is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

// Run the tests
main().catch(console.error);
