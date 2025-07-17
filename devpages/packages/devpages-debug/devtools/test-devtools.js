/**
 * Test script for StateKit DevTools
 * Run this in the browser console to test DevTools functionality
 */

export function testDevTools() {
    console.log('🧪 Testing StateKit DevTools...');
    
    // Check if DevTools are available
    if (!window.__STATEKIT_DEVTOOLS__) {
        console.error('❌ DevTools not found on window.__STATEKIT_DEVTOOLS__');
        console.log('💡 Make sure createDevTools() is in your middleware array');
        return false;
    }
    
    const devTools = window.__STATEKIT_DEVTOOLS__;
    console.log('✅ DevTools found:', devTools);
    
    // Test basic functionality
    console.log('📊 Action History:', devTools.getActionHistory().length, 'actions');
    console.log('⚡ Performance Metrics:', devTools.getPerformanceMetrics());
    
    // Test state access
    if (window.appStore) {
        console.log('🏪 Current State:', window.appStore.getState());
    }
    
    // Test DevPages integration
    if (window.devTools) {
        console.log('🔧 DevPages DevTools available');
        console.log('📋 History:', window.devTools.getHistory().length, 'actions');
        console.log('📈 Metrics:', window.devTools.getMetrics());
    }
    
    // Test console panel
    if (window.__STATEKIT_PANEL__) {
        console.log('📱 Console Panel available');
        console.log('💡 Try: window.__STATEKIT_PANEL__.showHistory()');
    }
    
    console.log('✅ DevTools test completed successfully!');
    console.log('');
    console.log('🎯 Try these commands:');
    console.log('  window.__STATEKIT_PANEL__.showHistory()');
    console.log('  window.__STATEKIT_PANEL__.showPerformance()');
    console.log('  window.devTools.getStateSlice("auth")');
    console.log('  window.devTools.timeTravel(0)');
    
    return true;
}

// Auto-run test if this script is loaded
if (typeof window !== 'undefined') {
    // Wait a bit for everything to initialize
    setTimeout(() => {
        testDevTools();
    }, 1000);
} 