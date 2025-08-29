#!/usr/bin/env node

/**
 * Deep Link Test Script
 * Specifically tests deep link functionality and navigation
 */

console.log('🔗 Deep Link Test Script Starting...\n');

if (typeof window === 'undefined') {
    console.log('❌ This script must be run in the browser console');
    console.log('📋 Copy and paste this entire script into the browser console');
    process.exit(1);
}

function testDeepLinks() {
    console.log('='.repeat(60));
    console.log('🔗 DEEP LINK FUNCTIONALITY TEST');
    console.log('='.repeat(60));
    
    const store = window.APP?.services?.store;
    if (!store) {
        console.log('❌ Redux store not available');
        return;
    }
    
    // Test cases for deep links
    const testCases = [
        { path: 'users/mike/bizcard/mr-bizcard-scratch.md', type: 'file' },
        { path: 'users/mike/bizcard', type: 'directory' },
        { path: 'system/logs', type: 'directory' },
        { path: 'data/config.json', type: 'file' }
    ];
    
    console.log('\n1️⃣ Current URL State:');
    console.log('   - URL:', window.location.href);
    const currentParams = new URLSearchParams(window.location.search);
    console.log('   - Current pathname param:', currentParams.get('pathname') || 'None');
    
    console.log('\n2️⃣ Current Redux State:');
    const currentState = store.getState();
    console.log('   - Path:', currentState.path?.currentPath || 'None');
    console.log('   - Is Directory:', currentState.path?.isDirectory);
    console.log('   - Status:', currentState.path?.status);
    
    console.log('\n3️⃣ Testing Navigation Function:');
    
    // Import and test pathThunks
    import('./store/slices/pathSlice.js').then(({ pathThunks }) => {
        console.log('✅ pathThunks imported successfully');
        
        // Function to test a single path
        function testPath(testCase, index) {
            return new Promise((resolve) => {
                console.log(`\n   Test ${index + 1}: ${testCase.path} (${testCase.type})`);
                
                const isDirectory = testCase.type === 'directory';
                
                try {
                    // Dispatch navigation
                    store.dispatch(pathThunks.navigateToPath({ 
                        pathname: testCase.path, 
                        isDirectory 
                    }));
                    
                    console.log('     ✅ Dispatch successful');
                    
                    // Check URL update
                    setTimeout(() => {
                        const newParams = new URLSearchParams(window.location.search);
                        const urlPathname = newParams.get('pathname');
                        console.log('     - URL updated to:', urlPathname);
                        
                        // Check Redux state
                        const newState = store.getState();
                        console.log('     - Redux path:', newState.path?.currentPath);
                        console.log('     - Redux isDirectory:', newState.path?.isDirectory);
                        console.log('     - Status:', newState.path?.status);
                        
                        resolve();
                    }, 500);
                    
                } catch (error) {
                    console.log('     ❌ Navigation failed:', error.message);
                    resolve();
                }
            });
        }
        
        // Run tests sequentially
        async function runAllTests() {
            for (let i = 0; i < testCases.length; i++) {
                await testPath(testCases[i], i);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
            }
            
            console.log('\n4️⃣ Manual Deep Link Test:');
            console.log('   Run these URLs to test deep linking:');
            testCases.forEach(testCase => {
                const url = new URL(window.location);
                url.searchParams.set('pathname', testCase.path);
                console.log(`   - ${testCase.type}: ${url.toString()}`);
            });
            
            console.log('\n' + '='.repeat(60));
            console.log('🏁 Deep link tests complete');
            console.log('='.repeat(60));
        }
        
        runAllTests();
        
    }).catch(error => {
        console.log('❌ Failed to import pathThunks:', error.message);
    });
}

// Function to simulate bootloader deep link handling
function simulateBootloaderDeepLink(pathname) {
    console.log(`\n🔄 Simulating bootloader deep link for: ${pathname}`);
    
    const store = window.APP?.services?.store;
    if (!store) {
        console.log('❌ Store not available');
        return;
    }
    
    // Replicate bootloader logic
    const isDirectory = !/.+\.[^/]+$/.test(pathname);
    console.log(`   - Detected as: ${isDirectory ? 'directory' : 'file'}`);
    
    import('./store/slices/pathSlice.js').then(({ pathThunks }) => {
        try {
            store.dispatch(pathThunks.navigateToPath({ pathname, isDirectory }));
            console.log('   ✅ Bootloader simulation successful');
            
            setTimeout(() => {
                const state = store.getState();
                console.log('   - Result path:', state.path?.currentPath);
                console.log('   - Result isDirectory:', state.path?.isDirectory);
            }, 500);
            
        } catch (error) {
            console.log('   ❌ Bootloader simulation failed:', error.message);
        }
    });
}

// Run the test
testDeepLinks();

// Export functions for manual testing
window.testDeepLinks = testDeepLinks;
window.simulateBootloaderDeepLink = simulateBootloaderDeepLink;

console.log('\n💡 Functions exported:');
console.log('   - window.testDeepLinks() - Run full test suite');
console.log('   - window.simulateBootloaderDeepLink(pathname) - Test specific path');
