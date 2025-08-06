// Force panel registration - paste this in browser console if panels aren't showing

console.log('🔧 FORCE PANEL REGISTRATION');
console.log('===========================');

// Get store
const store = window.APP?.store || window.APP?.services?.appStore;
if (!store) {
    console.error('❌ No Redux store found!');
    throw new Error('Redux store not available');
}

// Import panel actions (assuming they're available globally)
const panelActions = window.APP?.panelActions;
if (!panelActions) {
    console.error('❌ Panel actions not found! Trying to import...');
    
    // Try to dispatch directly
    const panelsToRegister = [
        { id: 'file-browser', title: 'File Browser', visible: true, order: 1 },
        { id: 'context', title: 'Context Panel', visible: true, order: 2 },
        { id: 'design-tokens', title: 'Design Tokens', visible: false, order: 3 },
        { id: 'pdata-panel', title: 'Debug Panel', visible: false, order: 10 },
        { id: 'settings-panel', title: 'Settings Panel', visible: false, order: 11 }
    ];
    
    panelsToRegister.forEach(panelConfig => {
        try {
            store.dispatch({
                type: 'panels/registerPanel',
                payload: {
                    panelId: panelConfig.id,
                    config: {
                        title: panelConfig.title,
                        visible: panelConfig.visible,
                        collapsed: false,
                        order: panelConfig.order
                    }
                }
            });
            console.log(`✅ Registered: ${panelConfig.id}`);
        } catch (error) {
            console.error(`❌ Failed to register ${panelConfig.id}:`, error);
        }
    });
} else {
    console.log('✅ Panel actions found, using proper registration...');
    
    const panelsToRegister = [
        { id: 'file-browser', title: 'File Browser', visible: true, order: 1 },
        { id: 'context', title: 'Context Panel', visible: true, order: 2 },
        { id: 'design-tokens', title: 'Design Tokens', visible: false, order: 3 },
        { id: 'pdata-panel', title: 'Debug Panel', visible: false, order: 10 },
        { id: 'settings-panel', title: 'Settings Panel', visible: false, order: 11 }
    ];
    
    panelsToRegister.forEach(panelConfig => {
        try {
            store.dispatch(panelActions.registerPanel({
                panelId: panelConfig.id,
                config: {
                    title: panelConfig.title,
                    visible: panelConfig.visible,
                    collapsed: false,
                    order: panelConfig.order
                }
            }));
            console.log(`✅ Registered: ${panelConfig.id}`);
        } catch (error) {
            console.error(`❌ Failed to register ${panelConfig.id}:`, error);
        }
    });
}

// Check results
setTimeout(() => {
    const state = store.getState();
    console.log('📊 Panel registration results:');
    console.log('• Sidebar panels:', Object.keys(state.panels?.sidebarPanels || {}));
    console.log('• Main panels:', Object.keys(state.panels?.panels || {}));
    
    // Try to trigger WorkspaceManager render
    const workspaceManager = window.APP?.services?.workspaceManager;
    if (workspaceManager && typeof workspaceManager.render === 'function') {
        console.log('🔄 Triggering WorkspaceManager render...');
        workspaceManager.render();
    }
}, 1000);

console.log('✅ Force registration complete - check sidebar for panels!');