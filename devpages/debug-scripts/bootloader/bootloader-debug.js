#!/usr/bin/env node

/**
 * Bootloader Debug Script
 * Tests bootloader state, deep link functionality, and component initialization
 */

console.log('🔍 Bootloader Debug Script Starting...\n');

// Test if we're running in browser context
if (typeof window === 'undefined') {
    console.log('❌ This script must be run in the browser console');
    console.log('📋 Copy and paste this entire script into the browser console');
    process.exit(1);
}

// Main debug function
function debugBootloader() {
    console.log('='.repeat(60));
    console.log('🔍 BOOTLOADER DEBUG ANALYSIS');
    console.log('='.repeat(60));
    
    // 1. Check APP object structure
    console.log('\n1️⃣ APP Object Structure:');
    if (window.APP) {
        console.log('✅ window.APP exists');
        console.log('   - bootloader:', !!window.APP.bootloader);
        console.log('   - services:', !!window.APP.services);
        console.log('   - bootloader.phase:', window.APP.bootloader?.phase);
        console.log('   - bootloader.instance:', !!window.APP.bootloader?.instance);
    } else {
        console.log('❌ window.APP does not exist');
        return;
    }
    
    // 2. Check bootloader state
    console.log('\n2️⃣ Bootloader State:');
    const bootloader = window.APP.bootloader;
    if (bootloader) {
        console.log('   - Phase:', bootloader.phase);
        console.log('   - Instance available:', !!bootloader.instance);
        
        if (bootloader.instance) {
            const systemAPIs = bootloader.instance.getSystemAPIs();
            console.log('   - System APIs:', !!systemAPIs);
            console.log('   - Store available:', !!systemAPIs?.store);
        }
    }
    
    // 3. Check Redux store
    console.log('\n3️⃣ Redux Store:');
    const store = window.APP.services?.store;
    if (store) {
        console.log('✅ Store exists');
        const state = store.getState();
        console.log('   - Auth state:', {
            isAuthenticated: state.auth?.isAuthenticated,
            authChecked: state.auth?.authChecked,
            user: state.auth?.user?.username
        });
        console.log('   - Path state:', {
            currentPath: state.path?.currentPath,
            isDirectory: state.path?.isDirectory,
            status: state.path?.status
        });
        console.log('   - System state:', {
            isInitialized: state.system?.isInitialized,
            loadingComponents: Object.keys(state.system?.loadingComponents || {}),
            readyComponents: Object.keys(state.system?.readyComponents || {})
        });
    } else {
        console.log('❌ Store not available');
    }
    
    // 4. Check URL parameters
    console.log('\n4️⃣ URL Parameters:');
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = urlParams.get('pathname');
    console.log('   - Current URL:', window.location.href);
    console.log('   - Pathname parameter:', pathname || 'None');
    
    if (pathname) {
        const isDirectory = !/.+\.[^/]+$/.test(pathname);
        console.log('   - Detected as:', isDirectory ? 'Directory' : 'File');
    }
    
    // 5. Check component registry
    console.log('\n5️⃣ Component Status:');
    const components = [
        'authDisplay',
        'pathManager', 
        'viewControls',
        'contextSettingsPopup',
        'resizableManager'
    ];
    
    components.forEach(name => {
        const element = document.getElementById(name === 'authDisplay' ? 'auth-component-container' : 
                                             name === 'pathManager' ? 'context-manager-container' :
                                             name === 'viewControls' ? 'view-controls-container' : 
                                             name);
        console.log(`   - ${name}: ${element ? '✅ DOM element found' : '❌ DOM element missing'}`);
    });
    
    // 6. Test deep link functionality
    console.log('\n6️⃣ Deep Link Test:');
    if (pathname && store) {
        console.log('   - Testing navigation to:', pathname);
        try {
            // Import pathThunks and test navigation
            import('./store/slices/pathSlice.js').then(({ pathThunks }) => {
                const isDirectory = !/.+\.[^/]+$/.test(pathname);
                store.dispatch(pathThunks.navigateToPath({ pathname, isDirectory }));
                console.log('   ✅ Navigation dispatch successful');
                
                // Check state after navigation
                setTimeout(() => {
                    const newState = store.getState();
                    console.log('   - Updated path state:', {
                        currentPath: newState.path?.currentPath,
                        isDirectory: newState.path?.isDirectory,
                        status: newState.path?.status
                    });
                }, 1000);
            }).catch(err => {
                console.log('   ❌ Failed to import pathThunks:', err.message);
            });
        } catch (error) {
            console.log('   ❌ Navigation test failed:', error.message);
        }
    } else {
        console.log('   - No pathname to test or store unavailable');
    }
    
    // 7. Check services
    console.log('\n7️⃣ Services:');
    const services = window.APP.services || {};
    Object.keys(services).forEach(serviceName => {
        console.log(`   - ${serviceName}: ✅ Available`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Debug analysis complete');
    console.log('='.repeat(60));
}

// Run the debug function
debugBootloader();

// Export for manual testing
window.debugBootloader = debugBootloader;
console.log('\n💡 Function exported as window.debugBootloader() for re-running');
