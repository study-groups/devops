/**
 * Clear persisted panel state to show Settings and Debug docks
 */

// Clear localStorage panel state
if (typeof localStorage !== 'undefined') {
    const keys = ['panel_state', 'devpages_panels_state_v3', 'devpages_docks_state_v3'];
    keys.forEach(key => {
        try {
            localStorage.removeItem(key);
            console.log(`Cleared ${key} from localStorage`);
        } catch (e) {
            console.warn(`Failed to clear ${key}:`, e);
        }
    });
}

// If running in browser with access to storageService
if (typeof window !== 'undefined' && window.storageService) {
    window.storageService.removeItem('panel_state');
    console.log('Cleared panel_state using storageService');
}

// If Redux store is available, dispatch actions to show the docks
if (typeof window !== 'undefined' && window.appStore) {
    const { panelActions } = await import('./client/store/slices/panelSlice.js');
    
    // Make sure settings and debug docks are visible
    window.appStore.dispatch(panelActions.updateDock('settings-dock', { isVisible: true }));
    window.appStore.dispatch(panelActions.updateDock('debug-dock', { isVisible: true }));
    
    console.log('Updated dock visibility states');
}

console.log('Panel state reset complete. Refresh the page to see changes.');