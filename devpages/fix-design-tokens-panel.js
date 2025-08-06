// Fix Design Tokens panel to actually appear in sidebar - paste in browser console

console.log('🎨 FIXING DESIGN TOKENS PANEL');
console.log('============================');

const store = window.APP?.store || window.APP?.services?.appStore;
if (!store) {
    console.error('❌ Redux store not found!');
    throw new Error('Redux store not available');
}

// Register Design Tokens panel properly in sidebar
console.log('📋 Registering Design Tokens panel in sidebar...');

try {
    // Register the panel in sidebarPanels state
    store.dispatch({
        type: 'panels/registerPanel',
        payload: {
            panelId: 'settings-panel',
            config: {
                title: '🎨 Design Tokens',
                visible: true,
                collapsed: false,
                order: 3,
                group: 'sidebar'
            }
        }
    });
    
    console.log('✅ Design Tokens panel registered');
    
    // Force workspace manager to re-render
    setTimeout(() => {
        const workspaceManager = window.APP?.services?.workspaceManager;
        if (workspaceManager && typeof workspaceManager.render === 'function') {
            console.log('🔄 Re-rendering workspace...');
            workspaceManager.render();
        }
        
        // Check if it worked
        const state = store.getState();
        const sidebarPanels = state.panels?.sidebarPanels || {};
        
        console.log('📊 Results:');
        console.log('• All sidebar panels:', Object.keys(sidebarPanels));
        console.log('• settings-panel registered:', !!sidebarPanels['settings-panel']);
        console.log('• settings-panel config:', sidebarPanels['settings-panel']);
        
        if (sidebarPanels['settings-panel']) {
            console.log('✅ Design Tokens panel should now appear in sidebar!');
            console.log('🎯 Look for "🎨 Design Tokens" in the sidebar');
        } else {
            console.log('❌ Design Tokens panel still not registered');
        }
        
        // Check what's actually in the sidebar DOM
        const sidebar = document.getElementById('workspace-sidebar');
        if (sidebar) {
            const panelElements = sidebar.querySelectorAll('[class*="panel"], [id*="panel"]');
            console.log('📱 Panel elements in sidebar DOM:', panelElements.length);
            panelElements.forEach(el => {
                console.log(`  • ${el.tagName}#${el.id}.${el.className}`);
            });
        }
        
    }, 1000);
    
} catch (error) {
    console.error('❌ Failed to register Design Tokens panel:', error);
}

console.log('🎨 Design Tokens panel fix complete!');