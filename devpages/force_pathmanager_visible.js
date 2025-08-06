/**
 * EMERGENCY FIX: Force PathManager to be visible
 * Run this in browser console to immediately show the PathManager with sidebar toggle
 */

console.log('🚨 FORCING PATHMANAGER TO BE VISIBLE');

// 1. Force UI state to show PathManager
if (window.APP?.services?.store) {
    const store = window.APP.services.store;
    
    // Dispatch action to show PathManager
    store.dispatch({
        type: 'ui/updateSetting',
        payload: { key: 'contextManagerVisible', value: true }
    });
    
    console.log('✅ Redux state updated: contextManagerVisible = true');
} else {
    console.log('❌ Redux store not found');
}

// 2. Force the container to be visible directly
const pathManagerContainer = document.getElementById('context-manager-container');
if (pathManagerContainer) {
    pathManagerContainer.style.display = 'block';
    pathManagerContainer.style.visibility = 'visible';
    console.log('✅ PathManager container forced visible');
} else {
    console.log('❌ PathManager container not found');
}

// 3. Trigger PathManager component re-render
if (window.APP?.services?.eventBus) {
    window.APP.services.eventBus.emit('ui:refresh');
    console.log('✅ UI refresh triggered');
}

// 4. Verify sidebar toggle is working
setTimeout(() => {
    const sidebarToggle = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggle) {
        console.log('✅ SIDEBAR TOGGLE FOUND:', sidebarToggle);
        console.log('   - Has click handler:', !!sidebarToggle.onclick);
        console.log('   - WorkspaceManager available:', !!window.APP?.services?.workspaceManager);
        
        // Test the toggle function
        if (window.APP?.services?.workspaceManager?.toggleLeftSidebar) {
            console.log('✅ toggleLeftSidebar function is available');
        } else {
            console.log('❌ toggleLeftSidebar function missing');
        }
    } else {
        console.log('❌ SIDEBAR TOGGLE NOT FOUND - PathManager may need re-render');
        
        // Force complete re-render by calling the component function
        if (window.createPathManagerComponent) {
            console.log('🔄 Attempting complete PathManager re-render...');
            window.createPathManagerComponent();
        }
    }
}, 1000);

console.log('🎯 PATHMANAGER VISIBILITY FIX COMPLETE - Check for four corner logo!');