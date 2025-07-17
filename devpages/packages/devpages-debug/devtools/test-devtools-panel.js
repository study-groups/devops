/**
 * Test script for DevTools Panel integration
 * Run this in the browser console to test the DevTools panel functionality
 */

export function testDevToolsPanel() {
    console.log('🧪 Testing DevTools Panel Integration...');
    
    // Check if DebugPanelManager is available
    if (!window.debugPanelManager) {
        console.error('❌ DebugPanelManager not found on window');
        return false;
    }
    
    console.log('✅ DebugPanelManager found:', window.debugPanelManager);
    
    // Check if panel registry has debug panels
    const debugPanels = panelRegistry.getAllPanels().filter(p => p.group === 'debug');
    console.log('📋 Debug panels registered:', debugPanels.length);
    debugPanels.forEach(panel => {
        console.log(`  - ${panel.id}: ${panel.title}`);
    });
    
    // Check if DevTools panel is registered
    const devToolsPanel = panelRegistry.getPanel('devtools');
    if (devToolsPanel) {
        console.log('✅ DevTools panel registered:', devToolsPanel);
        console.log('  - Title:', devToolsPanel.title);
        console.log('  - Component:', devToolsPanel.component ? 'Available' : 'Missing');
        console.log('  - Metadata:', devToolsPanel.metadata);
    } else {
        console.error('❌ DevTools panel not found in registry');
    }
    
    // Check if StateKit DevTools are available
    if (window.__STATEKIT_DEVTOOLS__) {
        console.log('✅ StateKit DevTools available');
        const history = window.__STATEKIT_DEVTOOLS__.getActionHistory();
        console.log('  - Action history:', history.length, 'actions');
    } else {
        console.warn('⚠️ StateKit DevTools not available');
    }
    
    // Test panel visibility
    console.log('🔍 Testing panel visibility...');
    const debugState = appStore.getState().debugPanel;
    console.log('  - Debug panel visible:', debugState.visible);
    console.log('  - Debug panel panels:', debugState.panels.length);
    
    // Test panel instances
    if (window.debugPanelManager.sectionInstances) {
        console.log('📦 Panel instances:', Object.keys(window.debugPanelManager.sectionInstances));
    }
    
    console.log('✅ DevTools Panel test completed successfully!');
    console.log('');
    console.log('🎯 Try these commands:');
    console.log('  window.debugPanelManager.toggleVisibility()');
    console.log('  window.testDevTools()');
    console.log('  window.debugPanels()');
    console.log('  window.performanceReport()');
    
    return true;
}

// Auto-run test if this script is loaded
if (typeof window !== 'undefined') {
    // Wait a bit for everything to initialize
    setTimeout(() => {
        testDevToolsPanel();
    }, 1000);
} 