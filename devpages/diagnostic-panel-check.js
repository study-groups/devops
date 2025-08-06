// Quick diagnostic script - paste this in browser console to check panel system status

console.log('🔍 PANEL SYSTEM DIAGNOSTIC');
console.log('========================');

// Check if Redux store exists
const store = window.APP?.store || window.APP?.services?.appStore;
if (!store) {
    console.error('❌ Redux store not found!');
    console.log('Available on window.APP:', Object.keys(window.APP || {}));
} else {
    console.log('✅ Redux store found');
    
    const state = store.getState();
    console.log('📊 Store state keys:', Object.keys(state));
    
    if (state.panels) {
        console.log('📋 Panel state found:');
        console.log('• Main panels:', Object.keys(state.panels.panels || {}));
        console.log('• Sidebar panels:', Object.keys(state.panels.sidebarPanels || {}));
        console.log('• Docks:', Object.keys(state.panels.docks || {}));
        
        // Check if our registered panels are there
        const sidebarPanels = state.panels.sidebarPanels || {};
        const expectedPanels = ['file-browser', 'context', 'pdata-panel', 'settings-panel', 'design-tokens'];
        
        console.log('🎯 Checking expected panels:');
        expectedPanels.forEach(panelId => {
            const exists = sidebarPanels[panelId];
            console.log(`• ${panelId}: ${exists ? '✅ Found' : '❌ Missing'}`, exists);
        });
    } else {
        console.error('❌ Panel state not found in store!');
    }
}

// Check if WorkspaceManager exists
const workspaceManager = window.APP?.services?.workspaceManager;
if (!workspaceManager) {
    console.error('❌ WorkspaceManager not found!');
} else {
    console.log('✅ WorkspaceManager found');
    console.log('• Has togglePanel method:', typeof workspaceManager.togglePanel === 'function');
}

// Check if panel registration fix was loaded
const panelRegistrationLoaded = document.querySelector('#design-tokens-panel-styles');
if (panelRegistrationLoaded) {
    console.log('✅ Panel registration fix CSS loaded');
} else {
    console.log('⚠️ Panel registration fix CSS not loaded');
}

// Check DOM elements
console.log('🏠 DOM Check:');
console.log('• Sidebar element:', !!document.getElementById('workspace-sidebar'));
console.log('• Editor element:', !!document.getElementById('workspace-editor'));
console.log('• Preview element:', !!document.getElementById('workspace-preview'));

// Check for visible panels in DOM
const panelElements = document.querySelectorAll('[id*="panel"]');
console.log('📱 Panel elements in DOM:', panelElements.length);
panelElements.forEach(el => {
    console.log(`• ${el.id}: ${el.style.display !== 'none' ? 'visible' : 'hidden'}`);
});

// Test keyboard shortcuts
console.log('⌨️ Testing keyboard shortcuts (in 3 seconds)...');
setTimeout(() => {
    console.log('Now try pressing Ctrl+Shift+D for debug panel');
    console.log('Now try pressing Ctrl+Shift+S for settings panel');
}, 3000);

// Return summary
return {
    storeExists: !!store,
    panelStateExists: !!(store?.getState()?.panels),
    workspaceManagerExists: !!workspaceManager,
    panelElementsCount: panelElements.length,
    timestamp: new Date().toISOString()
};