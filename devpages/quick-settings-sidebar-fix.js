// Quick fix to put settings dock in sidebar - paste in browser console

console.log('🔧 PUTTING SETTINGS DOCK IN SIDEBAR');
console.log('==================================');

const store = window.APP?.store || window.APP?.services?.appStore;
if (!store) {
    console.error('❌ Redux store not found!');
    throw new Error('Redux store not available');
}

// Settings panels that should be in the sidebar settings dock
const settingsPanels = [
    'design-tokens',
    'theme-selector', 
    'css-settings',
    'preview-settings',
    'icons-panel',
    'plugins-panel'
];

console.log('📋 Registering settings panels to settings-dock in sidebar...');

settingsPanels.forEach(panelId => {
    try {
        // Register as sidebar panel first
        store.dispatch({
            type: 'panels/registerPanel',
            payload: {
                panelId: panelId,
                config: {
                    title: panelId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    visible: false, // Hidden by default, show in dock
                    collapsed: false,
                    order: 50,
                    dockId: 'settings-dock',
                    zone: 'sidebar'
                }
            }
        });
        
        // Also create in main panels for dock system
        store.dispatch({
            type: 'panels/createPanel',
            payload: {
                id: panelId,
                title: panelId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type: panelId,
                dockId: 'settings-dock',
                config: {}
            }
        });
        
        console.log(`✅ Registered ${panelId} to settings-dock`);
    } catch (error) {
        console.error(`❌ Failed to register ${panelId}:`, error);
    }
});

// Force workspace manager to re-render
setTimeout(() => {
    const workspaceManager = window.APP?.services?.workspaceManager;
    if (workspaceManager && typeof workspaceManager.render === 'function') {
        console.log('🔄 Re-rendering workspace manager...');
        workspaceManager.render();
    }
    
    // Check results
    const state = store.getState();
    const settingsDock = state.panels?.docks?.['settings-dock'];
    const sidebarPanels = state.panels?.sidebarPanels || {};
    
    console.log('📊 Results:');
    console.log('• Settings dock exists:', !!settingsDock);
    console.log('• Settings dock visible:', settingsDock?.isVisible);
    console.log('• Settings dock panels:', settingsDock?.panels || []);
    console.log('• Sidebar panels with settings:', Object.keys(sidebarPanels).filter(id => settingsPanels.includes(id)));
    
    console.log('🎯 Now try Ctrl+Shift+S to toggle the settings dock in the sidebar!');
}, 1000);

console.log('✅ Settings dock setup complete!');