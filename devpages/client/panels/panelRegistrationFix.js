
import { panelActions } from '/client/store/slices/panelSlice.js';

// Centralized panel configuration
const panelConfigurations = {
    // Core Panels
    'context-panel': {
        id: 'context-panel',
        name: 'Context Panel',
        dockId: 'sidebar-dock',
        group: 'core',
        isVisible: true,
        order: 0
    },
    'file-browser': {
        id: 'file-browser',
        name: 'File Browser',
        dockId: 'sidebar-dock',
        group: 'core',
        isVisible: true,
        order: 1
    },
    'design-tokens': {
        id: 'design-tokens',
        name: 'Design Tokens',
        dockId: 'sidebar-dock',
        group: 'core',
        isVisible: true,
        order: 2
    },

    // Debug Panels
    'devtools': {
        id: 'devtools',
        name: 'DevTools',
        dockId: 'debug-dock',
        group: 'debug',
        isVisible: true,
        order: 0
    },
    'css-files': {
        id: 'css-files',
        name: 'CSS Files',
        dockId: 'debug-dock',
        group: 'debug',
        isVisible: true,
        order: 1
    },
    'javascript-panel': {
        id: 'javascript-panel',
        name: 'JavaScript Info',
        dockId: 'debug-dock',
        group: 'debug',
        isVisible: true,
        order: 2
    },
    'external-dependencies': {
        id: 'external-dependencies',
        name: 'External Dependencies',
        dockId: 'debug-dock',
        group: 'debug',
        isVisible: true,
        order: 3
    },
    'dom-inspector': {
        id: 'dom-inspector',
        name: 'DOM Inspector',
        dockId: 'debug-dock',
        group: 'debug',
        isVisible: true,
        order: 4
    }
};

// Unified panel registration function
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

    // Ensure debug dock exists
    store.dispatch(panelActions.registerPanel({
        id: 'debug-dock',
        dockId: 'debug-dock',
        config: {
            title: 'Debug Tools',
            zone: 'floating',
            isVisible: true,
            isExpanded: true
        }
    }));

    // Register each panel configuration
    Object.values(panelConfigurations).forEach(panelConfig => {
        try {
            store.dispatch(panelAction({
                id: panelConfig.id,
                dockId: panelConfig.dockId || 'sidebar-dock',
                config: {
                    ...panelConfig,
                    name: panelConfig.name || panelConfig.id
                }
            }));
        } catch (error) {
            console.error(`[PanelRegistration] Failed to register panel ${panelConfig.id}:`, error);
        }
    });
}

// Export for use in bootloader or other initialization scripts
export default registerPanels;
