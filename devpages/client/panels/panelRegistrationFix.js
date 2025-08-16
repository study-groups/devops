
// Auto-generated panel registrations for missing panels
// This ensures all implemented panels are available in the Redux state

import { appStore, dispatch } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';

export function registerMissingPanels() {
    console.log('[PanelRegistration] Registering missing panels...');
    
    const panelsToRegister = [
        {
                "id": "file-browser",
                "title": "File Browser",
                "visible": true,
                "order": 1
        },
        {
                "id": "context",
                "title": "Context Panel",
                "visible": true,
                "order": 2
        },
        {
                "id": "settings-panel",
                "title": "🎨 Design Tokens",
                "visible": true,
                "order": 3
        },
        {
                "id": "dom-inspector",
                "title": "DOM Inspector",
                "visible": false,
                "order": 20
        },
        {
                "id": "console-log-panel",
                "title": "Console Log",
                "visible": false,
                "order": 21
        },
        {
                "id": "plugins",
                "title": "Plugins",
                "visible": false,
                "order": 22
        },
        {
                "id": "api-tokens",
                "title": "API Tokens",
                "visible": false,
                "order": 23
        },
        {
                "id": "nlp-panel",
                "title": "NLP Panel",
                "visible": false,
                "order": 30
        },
        {
                "id": "log-display",
                "title": "Log Display",
                "visible": false,
                "order": 31
        },
        {
                "id": "mount-info-panel",
                "title": "Mount Info",
                "visible": false,
                "order": 32
        }
];
    
    const state = appStore.getState();
    const existingSidebarPanels = state.panels?.sidebarPanels || {};
    
    panelsToRegister.forEach(panelConfig => {
        if (!existingSidebarPanels[panelConfig.id]) {
            console.log(`[PanelRegistration] Registering panel: ${panelConfig.id}`);
            dispatch(panelActions.createPanel({
                id: panelConfig.id,
                dockId: 'sidebar-dock', // Default to sidebar dock for these panels
                title: panelConfig.title,
                config: {
                    isVisible: panelConfig.visible,
                    isCollapsed: false,
                    order: panelConfig.order
                }
            }));
        } else {
            console.log(`[PanelRegistration] Panel already registered: ${panelConfig.id}`);
        }
    });
    
    console.log('[PanelRegistration] Panel registration complete');
}

// Auto-run on import (can be disabled by commenting out)
registerMissingPanels();
