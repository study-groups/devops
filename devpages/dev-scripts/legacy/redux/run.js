(function(global) {
    function runReduxPersistenceTests() {
        console.log('🧪 RUNNING REDUX PERSISTENCE VERIFICATION TESTS');
        console.log('===========================================');
    
        // Test State Persistence Function
        function testStatePersistence(verifyFunc, config) {
            console.group(`🔍 Testing ${config.sliceName} Persistence`);
            let result = { success: false, errors: [] };
            try {
                // Directly call the function with config
                result = verifyFunc(config);
                console.log('Result:', result);
                console.log('Success:', result.success ? '✅ PASSED' : '❌ FAILED');
                
                if (result.errors && result.errors.length > 0) {
                    console.error('Errors:', result.errors);
                }
            } catch (error) {
                console.error('Test failed with error:', error);
                result.errors.push(error.message);
            }
            console.groupEnd();
            return result;
        }
    
        // Verify functions are available
        console.log('\n1. CHECKING VERIFICATION FUNCTIONS:');
        console.log('APP.verifyStatePersistence:', !!window.APP?.verifyStatePersistence);
        console.log('APP.verifyUIStatePersistence:', !!window.APP?.verifyUIStatePersistence);
        console.log('APP.verifyAuthPersistence:', !!window.APP?.verifyAuthPersistence);
    
        // Prepare test configurations
        const testConfigs = [
            {
                name: 'UI State',
                func: window.APP?.verifyUIStatePersistence,
                config: null  // UI persistence test has no config, runs automatically
            },
            {
                name: 'Auth State',
                func: window.APP?.verifyAuthPersistence,
                config: null  // Auth persistence test has no config, runs automatically
            },
            {
                name: 'Generic State',
                func: window.APP?.verifyStatePersistence,
                config: {
                    sliceName: 'settings',
                    storageKey: 'settings',
                    relevantFields: [
                        'preview.cssFiles', 
                        'preview.activeCssFiles', 
                        'preview.enableRootCss', 
                        'publish.mode'
                    ],
                    modifyState: (store) => {
                        const currentState = store.getState().settings;
                        return {
                            type: 'SETTINGS_UPDATENESTEDSETTING',
                            payload: {
                                path: 'preview.enableRootCss',
                                value: !currentState.preview.enableRootCss
                            }
                        };
                    }
                }
            }
        ];
    
        // Run tests
        console.log('\n2. RUNNING PERSISTENCE TESTS:');
        const testResults = testConfigs.map(test => {
            if (!test.func) {
                console.warn(`❌ ${test.name} verification function not available`);
                return { name: test.name, status: 'Not Available' };
            }
            
            console.log(`\nTesting ${test.name} Persistence:`);
            
            // For functions that run automatically (UI and Auth)
            if (test.config === null) {
                try {
                    const result = test.func();
                    console.log(`✅ ${test.name} verification triggered`);
                    return { name: test.name, status: 'Triggered', result };
                } catch (error) {
                    console.error(`❌ ${test.name} verification failed:`, error);
                    return { name: test.name, status: 'Failed', error };
                }
            }
            
            // For generic state persistence
            return {
                name: test.name,
                ...testStatePersistence(test.func, test.config)
            };
        });
    
        console.log('\n3. TEST SUMMARY:');
        testResults.forEach(result => {
            if (result) {
                console.log(`${result.name}: ${result.status || (result.success ? '✅ PASSED' : '❌ FAILED')}`);
            }
        });
    
        console.log('\n🏁 REDUX PERSISTENCE VERIFICATION COMPLETE');
        return testResults;
    }

    // Expose to global scope for easy testing
    if (global.APP) {
        global.APP.runReduxPersistenceTests = runReduxPersistenceTests;
    }
})(typeof window !== 'undefined' ? window : global);