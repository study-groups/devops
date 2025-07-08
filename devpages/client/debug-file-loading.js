/**
 * Debug script for file loading issues
 * Run this in the browser console to diagnose what's happening
 */

// Add to window for easy access
window.debugFileLoading = function() {
    console.log('=== FILE LOADING DEBUG ===');
    
    // Check app state
    console.log('1. App State:');
    if (window.appStore) {
        const state = window.appStore.getState();
        console.log('  - Auth:', state.auth);
        console.log('  - File:', state.file);
        console.log('  - UI:', state.ui);
    } else {
        console.log('  - appStore not available');
    }
    
    // Check event bus
    console.log('2. Event Bus:');
    if (window.eventBus) {
        console.log('  - eventBus available');
        console.log('  - emit function:', typeof window.eventBus.emit);
    } else {
        console.log('  - eventBus not available');
    }
    
    // Check file manager
    console.log('3. File Manager:');
    console.log('  - APP.fileManagerInitialized:', window.APP?.fileManagerInitialized);
    
    // Check logging
    console.log('4. Logging:');
    console.log('  - window.logMessage:', typeof window.logMessage);
    console.log('  - window.logPanelInstance:', !!window.logPanelInstance);
    
    // Check API
    console.log('5. API:');
    console.log('  - fetch available:', typeof fetch);
    
    // Test navigation - COMMENTED OUT to prevent unwanted file changes
    console.log('6. Navigation Test Available:');
    if (window.eventBus && typeof window.eventBus.emit === 'function') {
        console.log('  - eventBus.emit available for navigation testing');
        console.log('  - To test navigation manually, run: window.eventBus.emit("navigate:pathname", { pathname: "test.md", isDirectory: false })');
    } else {
        console.log('  - eventBus not available for navigation testing');
    }
    
    console.log('=== END DEBUG ===');
};

// Auto-run if in development - DISABLED to prevent overriding user file selection
// if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
//     setTimeout(() => {
//         console.log('Auto-running file loading debug...');
//         window.debugFileLoading();
//     }, 2000);
// } 