
// Test script for panel system - run in browser console
// This helps verify that panels are registered and keyboard shortcuts work

function testPanelSystem() {
    console.log('🧪 Testing Panel System...');
    
    const state = window.APP.store.getState();
    const panels = state.panels || {};
    
    console.log('📊 Panel State Analysis:');
    console.log('• Main panels:', Object.keys(panels.panels || {}));
    console.log('• Sidebar panels:', Object.keys(panels.sidebarPanels || {}));
    console.log('• Docks:', Object.keys(panels.docks || {}));
    
    console.log('\n⌨️ Testing Keyboard Shortcuts:');
    console.log('• Ctrl+Shift+D (Debug Panel)');
    console.log('• Ctrl+Shift+S (Settings Panel)');
    
    console.log('\n🎯 Manual Tests:');
    console.log('1. Press Ctrl+Shift+D - should toggle debug panel');
    console.log('2. Press Ctrl+Shift+S - should toggle settings panel');
    console.log('3. Check sidebar for visible panels');
    
    return {
        panelCount: Object.keys(panels.panels || {}).length,
        sidebarPanelCount: Object.keys(panels.sidebarPanels || {}).length,
        dockCount: Object.keys(panels.docks || {}).length
    };
}

// Auto-run
testPanelSystem();
