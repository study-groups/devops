
import { panelActions } from '/client/store/slices/panelSlice.js';

// Auto-registration script for panels
const panelsToRegister = [
    { 
        id: 'file-browser', 
        name: 'File Browser', 
        dockId: 'sidebar-dock',
        config: { 
            defaultVisible: true,
            isVisible: true 
        } 
    },
    { 
        id: 'context-panel', 
        name: 'Context Panel', 
        dockId: 'sidebar-dock',
        config: { 
            defaultVisible: true,
            isVisible: true 
        } 
    },
    { 
        id: 'pdata-panel', 
        name: 'Debug Panel', 
        dockId: 'debug-dock',
        config: { 
            shortcut: 'Ctrl+Shift+D',
            isVisible: true 
        } 
    },
    { 
        id: 'settings-panel', 
        name: 'Settings Panel', 
        dockId: 'sidebar-dock',
        config: { 
            shortcut: 'Ctrl+Shift+S',
            isVisible: true 
        } 
    },
    { 
        id: 'dom-inspector', 
        name: 'DOM Inspector', 
        dockId: 'debug-dock',
        config: { isVisible: true } 
    },
    { 
        id: 'console-log-panel', 
        name: 'Console Log', 
        dockId: 'debug-dock',
        config: { isVisible: false } 
    },
    { 
        id: 'plugins', 
        name: 'Plugins Panel', 
        dockId: 'sidebar-dock',
        config: { isVisible: false } 
    },
    { 
        id: 'design-tokens', 
        name: 'Design Tokens', 
        dockId: 'sidebar-dock',
        config: { 
            defaultVisible: true,
            isVisible: true 
        } 
    },
    { 
        id: 'api-tokens', 
        name: 'API Tokens', 
        dockId: 'sidebar-dock',
        config: { isVisible: false } 
    },
    { 
        id: 'nlp-panel', 
        name: 'NLP Panel', 
        dockId: 'sidebar-dock',
        config: { isVisible: false } 
    },
    { 
        id: 'log-display', 
        name: 'Log Display', 
        dockId: 'debug-dock',
        config: { isVisible: false } 
    },
    { 
        id: 'mount-info-panel', 
        name: 'Mount Info', 
        dockId: 'debug-dock',
        config: { isVisible: false } 
    },
    { 
        id: 'devtools', 
        name: 'DevTools', 
        dockId: 'debug-dock',
        config: { isVisible: true } 
    },
    { 
        id: 'css-files', 
        name: 'CSS Files', 
        dockId: 'debug-dock',
        config: { isVisible: true } 
    },
    { 
        id: 'javascript-panel', 
        name: 'JavaScript Panel', 
        dockId: 'debug-dock',
        config: { isVisible: true } 
    },
    { 
        id: 'external-dependencies', 
        name: 'External Dependencies', 
        dockId: 'debug-dock',
        config: { isVisible: true } 
    }
];

function registerPanels(store) {
    if (!store || typeof store.dispatch !== 'function') {
        console.error('[PanelRegistration] Invalid store provided');
        return;
    }

    const panelAction = panelActions?.registerPanel;
    if (!panelAction) {
        console.error('[PanelRegistration] Panel registration action not found');
        return;
    }

    panelsToRegister.forEach(panel => {
        try {
            // Ensure all required fields are present
            if (!panel.id) {
                console.warn(`[PanelRegistration] Skipping panel with missing ID:`, panel);
                return;
            }

            store.dispatch(panelActions.registerPanel({
                id: panel.id,
                dockId: panel.dockId || 'sidebar-dock',
                config: {
                    ...panel.config,
                    name: panel.name || panel.id
                }
            }));
        } catch (error) {
            console.error(`[PanelRegistration] Failed to register panel ${panel.id}:`, error);
        }
    });
}

// Export for use in bootloader or other initialization scripts
export default registerPanels;
