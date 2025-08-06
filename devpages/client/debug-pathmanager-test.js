/**
 * client/debug-pathmanager-test.js
 * Comprehensive test to verify PathManagerComponent functionality after meta language implementation
 */

console.log('🧪 PathManagerComponent Test Script - META LANGUAGE VERSION');

// Test 1: Check if fileReducer is properly integrated
function testFileReducerIntegration() {
    console.log('\n📊 Test 1: File Reducer Integration');
    console.log('=================================');
    
    const state = appStore.getState();
    console.log('Available state domains:', Object.keys(state));
    
    if (state.file) {
        console.log('✅ File domain exists in state');
        console.log('File state shape:', Object.keys(state.file));
        console.log('Current file state:', state.file);
    } else {
        console.log('❌ File domain missing from state');
        return false;
    }
    return true;
}

// Test 2: Check action types are defined
function testActionTypes() {
    console.log('\n📋 Test 2: Action Types Definition');
    console.log('==================================');
    
    const { ActionTypes } = appStore;
    const requiredActions = [
        'FS_SET_TOP_DIRS',
        'FS_LOAD_LISTING_START', 
        'FS_LOAD_LISTING_SUCCESS',
        'FS_SET_CURRENT_PATH',
        'FS_SET_CONTENT'
    ];
    
    requiredActions.forEach(action => {
        if (ActionTypes[action]) {
            console.log(`✅ ${action}: ${ActionTypes[action]}`);
        } else {
            console.log(`❌ ${action}: MISSING`);
        }
    });
}

// Test 3: Test directory loading functionality
async function testDirectoryLoading() {
    console.log('\n📁 Test 3: Directory Loading');
    console.log('============================');
    
    try {
        // Import and call the thunk
        const { fileThunks } = await import('./thunks/fileThunks.js');
        console.log('📦 fileThunks imported successfully');
        
        const beforeState = appStore.getState().file;
        console.log('State before loading:', beforeState.availableTopLevelDirs);
        
        await appStore.dispatch(fileThunks.loadTopLevelDirectories());
        
        const afterState = appStore.getState().file;
        console.log('State after loading:', afterState.availableTopLevelDirs);
        
        if (afterState.availableTopLevelDirs && afterState.availableTopLevelDirs.length > 0) {
            console.log('✅ Directories loaded successfully');
            return true;
        } else {
            console.log('⚠️ No directories returned (may be expected)');
            return true; // Still success if API works
        }
    } catch (error) {
        console.log('❌ Directory loading failed:', error.message);
        return false;
    }
}

// Test 4: Test PathManagerComponent rendering
function testPathManagerRendering() {
    console.log('\n🎨 Test 4: PathManagerComponent Rendering');
    console.log('==========================================');
    
    const pathManagerElement = document.getElementById('context-primary-select');
    if (pathManagerElement) {
        console.log('✅ PathManager select element found');
        console.log('Options count:', pathManagerElement.options.length);
        console.log('Current value:', pathManagerElement.value);
        
        // Check if it has meaningful options
        if (pathManagerElement.options.length > 1) {
            console.log('✅ PathManager has options (functioning)');
            return true;
        } else {
            console.log('⚠️ PathManager has limited options');
            return false;
        }
    } else {
        console.log('❌ PathManager select element not found');
        return false;
    }
}

// Test 5: Test action dispatch directly
function testDirectActionDispatch() {
    console.log('\n⚡ Test 5: Direct Action Dispatch');
    console.log('=================================');
    
    try {
        const testDirs = ['test-dir-1', 'test-dir-2', 'test-dir-3'];
        
        const beforeState = appStore.getState().file;
        console.log('Before dispatch:', beforeState.availableTopLevelDirs);
        
        appStore.dispatch({
            type: 'FS_SET_TOP_DIRS',
            payload: testDirs
        });
        
        const afterState = appStore.getState().file;
        console.log('After dispatch:', afterState.availableTopLevelDirs);
        
        if (JSON.stringify(afterState.availableTopLevelDirs) === JSON.stringify(testDirs)) {
            console.log('✅ Direct action dispatch works perfectly');
            return true;
        } else {
            console.log('❌ Action dispatch failed');
            return false;
        }
    } catch (error) {
        console.log('❌ Action dispatch error:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting comprehensive PathManagerComponent tests...\n');
    
    const results = {
        fileReducer: testFileReducerIntegration(),
        actionTypes: testActionTypes(),
        directDispatch: testDirectActionDispatch(),
        rendering: testPathManagerRendering()
    };
    
    // Directory loading test (async)
    results.directoryLoading = await testDirectoryLoading();
    
    console.log('\n📊 TEST SUMMARY');
    console.log('===============');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
    });
    
    const passCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.values(results).length;
    
    console.log(`\n🎯 OVERALL: ${passCount}/${totalCount} tests passed`);
    
    if (passCount === totalCount) {
        console.log('🎉 ALL TESTS PASSED! PathManagerComponent should be working!');
    } else {
        console.log('⚠️ Some tests failed. PathManagerComponent may have issues.');
    }
    
    return results;
}

// Export for console use
window.testPathManager = runAllTests;

// Auto-run if not in production
if (window.location.hostname === 'localhost' || window.location.hostname.includes('qa')) {
    console.log('🔧 Development environment detected. Run window.testPathManager() to test.');
} 