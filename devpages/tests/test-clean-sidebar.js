/**
 * test-clean-sidebar.js
 * Confidence test for the clean, working sidebar implementation
 */

function testCleanSidebarWithConfidence() {
    console.log('🚀 CONFIDENCE TEST: Clean Sidebar Implementation');
    console.log('===============================================');
    
    let testsPassed = 0;
    let totalTests = 0;
    
    function test(name, condition, details = '') {
        totalTests++;
        if (condition) {
            console.log(`✅ ${name} ${details}`);
            testsPassed++;
        } else {
            console.error(`❌ ${name} ${details}`);
        }
    }
    
    // Test 1: Basic DOM structure
    const sidebarElement = document.getElementById('workspace-sidebar');
    test('Sidebar DOM element exists', !!sidebarElement);
    
    // Test 2: WorkspaceManager exists
    const workspaceManager = window.APP?.services?.workspaceManager;
    test('WorkspaceManager exists', !!workspaceManager);
    
    // Test 3: Sidebar component exists
    test('Sidebar component exists', !!workspaceManager?.sidebar);
    
    // Test 4: Clean API exists
    test('Clean Sidebar API exists', !!window.APP?.sidebar);
    
    if (window.APP?.sidebar) {
        // Test 5: API methods
        const api = window.APP.sidebar;
        test('API has toggle method', typeof api.toggle === 'function');
        test('API has getDock method', typeof api.getDock === 'function');
        test('API has getSystemInfo method', typeof api.getSystemInfo === 'function');
        test('API has listDocks method', typeof api.listDocks === 'function');
        test('API has listPanels method', typeof api.listPanels === 'function');
        
        // Test 6: System info
        try {
            const systemInfo = api.getSystemInfo();
            test('System info returns data', !!systemInfo);
            test('Architecture is correct', systemInfo.architecture === 'SIDEBAR_DOCK_MANAGER');
            console.log('📊 System Info:', systemInfo);
        } catch (error) {
            test('System info works', false, `Error: ${error.message}`);
        }
    }
    
    // Test 7: Toggle sidebar and check for clean rendering
    console.log('\n🔄 Testing sidebar toggle...');
    
    try {
        if (window.APP?.sidebar?.toggle) {
            window.APP.sidebar.toggle();
            
            setTimeout(() => {
                const sidebarLayout = sidebarElement?.querySelector('.sidebar-layout');
                test('Sidebar layout renders', !!sidebarLayout);
                
                const sidebarHeader = sidebarElement?.querySelector('.sidebar-header-container');
                test('Sidebar header renders', !!sidebarHeader);
                
                const docksContainer = sidebarElement?.querySelector('.sidebar-docks-container');
                test('Docks container renders', !!docksContainer);
                
                const settingsDock = sidebarElement?.querySelector('#settings-dock-container');
                test('Settings dock renders', !!settingsDock);
                
                // Test CLI elements
                const cliButtons = sidebarElement?.querySelectorAll('.cli-btn');
                test('CLI buttons render', cliButtons?.length > 0, `(${cliButtons?.length} buttons)`);
                
                const cliInput = sidebarElement?.querySelector('.cli-input');
                test('CLI input renders', !!cliInput);
                
                const statusLine = sidebarElement?.querySelector('.status-line');
                test('Status line renders', !!statusLine);
                
                // Test panel loading
                if (window.APP?.sidebar?.listPanels) {
                    console.log('\n📋 Testing panel listing...');
                    try {
                        const panels = window.APP.sidebar.listPanels();
                        test('Panel listing works', Array.isArray(panels));
                        test('Panels found', panels?.length > 0, `(${panels?.length} panels)`);
                    } catch (error) {
                        test('Panel listing works', false, `Error: ${error.message}`);
                    }
                }
                
                // Final results
                console.log('\n🎯 CONFIDENCE TEST RESULTS');
                console.log('==========================');
                console.log(`✅ Tests Passed: ${testsPassed}/${totalTests}`);
                console.log(`📊 Success Rate: ${Math.round((testsPassed/totalTests) * 100)}%`);
                
                if (testsPassed === totalTests) {
                    console.log('🎉 ALL TESTS PASSED! Sidebar implementation is working with confidence!');
                    return true;
                } else {
                    console.log(`⚠️ ${totalTests - testsPassed} tests failed. Check the issues above.`);
                    return false;
                }
                
            }, 1000); // Wait 1 second for rendering
            
        } else {
            test('Sidebar toggle method exists', false);
        }
    } catch (error) {
        test('Sidebar toggle works', false, `Error: ${error.message}`);
    }
}

// Export for browser console use
if (typeof window !== 'undefined') {
    window.testCleanSidebarWithConfidence = testCleanSidebarWithConfidence;
    console.log('🧪 Clean test function available: window.testCleanSidebarWithConfidence()');
}

export { testCleanSidebarWithConfidence };