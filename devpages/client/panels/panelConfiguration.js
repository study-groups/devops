/**
 * client/panels/panelConfiguration.js
 * Central data-driven configuration for all panels across all docks
 * This is the single source of truth for panel definitions
 */

// =================================================================
// PANEL CONFIGURATION - SINGLE SOURCE OF TRUTH
// =================================================================

export const PANEL_CONFIGURATION = {
    // =================================================================
    // SETTINGS DOCK PANELS
    // =================================================================
    'design-tokens': {
        id: 'design-tokens',
        title: 'Design Tokens',
        group: 'settings',
        component: () => import('/client/settings/panels/css-design/DesignTokensPanel.js').then(m => m.DesignTokensPanel),
        order: 1,
        defaultCollapsed: false,
        icon: '🎨',
        description: 'Manage CSS design tokens and variables',
        keywords: ['css', 'tokens', 'variables', 'design'],
        metadata: {
            category: 'styling',
            features: ['design-tokens', 'css-variables', 'theming'],
            dependencies: ['appStore']
        }
    },

    'theme-selector': {
        id: 'theme-selector',
        title: 'Theme Selector',
        group: 'settings',
        component: () => import('/client/settings/panels/themes/ThemeSelectorPanel.js').then(m => m.ThemeSelectorPanel),
        order: 2,
        defaultCollapsed: false,
        icon: '🌙',
        description: 'Switch between light/dark themes and custom themes',
        keywords: ['theme', 'dark', 'light', 'appearance'],
        metadata: {
            category: 'appearance',
            features: ['theme-switching', 'dark-mode', 'custom-themes'],
            dependencies: ['appStore', 'panelRegistry']
        }
    },

    'css-settings': {
        id: 'css-settings',
        title: 'CSS Settings',
        group: 'settings',
        component: () => import('/client/settings/panels/css/CssSettingsPanel.js').then(m => m.CssSettingsPanel),
        order: 3,
        defaultCollapsed: true,
        icon: '💄',
        description: 'CSS file management and debugging tools',
        keywords: ['css', 'files', 'debugging', 'styles'],
        metadata: {
            category: 'debugging',
            features: ['css-debugging', 'file-management', 'style-inspection'],
            dependencies: ['appStore']
        }
    },

    'preview-settings': {
        id: 'preview-settings',
        title: 'Preview Settings',
        group: 'settings',
        component: () => import('/client/settings/panels/preview/PreviewSettingsPanel.js').then(m => m.PreviewSettingsPanel),
        order: 4,
        defaultCollapsed: true,
        icon: '👁️',
        description: 'Configure preview rendering and display options',
        keywords: ['preview', 'rendering', 'display', 'output'],
        metadata: {
            category: 'rendering',
            features: ['preview-controls', 'rendering-options', 'display-settings'],
            dependencies: ['appStore', 'previewSlice']
        }
    },

    'icons-panel': {
        id: 'icons-panel',
        title: 'Icons Panel',
        group: 'settings',
        component: () => import('/client/settings/panels/icons/IconsPanel.js').then(m => m.IconsPanel),
        order: 5,
        defaultCollapsed: true,
        icon: '🔣',
        description: 'Icon management and selection tools',
        keywords: ['icons', 'symbols', 'graphics', 'ui'],
        metadata: {
            category: 'assets',
            features: ['icon-library', 'icon-selection', 'symbol-management'],
            dependencies: ['appStore']
        }
    },

    'plugins-panel': {
        id: 'plugins-panel',
        title: 'Plugins Panel',
        group: 'settings',
        component: () => import('/client/settings/panels/plugins/PluginsPanel.js').then(m => m.PluginsPanel),
        order: 6,
        defaultCollapsed: true,
        icon: '🔌',
        description: 'Plugin management and configuration',
        keywords: ['plugins', 'extensions', 'addons', 'modules'],
        metadata: {
            category: 'extensions',
            features: ['plugin-management', 'extension-config', 'module-loading'],
            dependencies: ['appStore', 'pluginSlice']
        }
    },

    // =================================================================
    // CONTROLS DOCK PANELS
    // =================================================================
    'workspace-controls': {
        id: 'workspace-controls',
        title: 'Workspace Controls',
        group: 'controls',
        component: () => import('/client/controls/panels/WorkspaceControlPanel.js').then(m => m.WorkspaceControlPanel),
        order: 1,
        defaultCollapsed: false,
        icon: '🏗️',
        description: 'Workspace layout and zone management controls',
        keywords: ['workspace', 'layout', 'zones', 'management'],
        metadata: {
            category: 'workspace',
            features: ['layout-controls', 'zone-management', 'workspace-config'],
            dependencies: ['appStore', 'workspaceManager']
        }
    },

    'system-controls': {
        id: 'system-controls',
        title: 'System Controls',
        group: 'controls',
        component: () => import('/client/controls/panels/SystemControlPanel.js').then(m => m.SystemControlPanel),
        order: 2,
        defaultCollapsed: true,
        icon: '⚙️',
        description: 'System-level controls and configuration',
        keywords: ['system', 'config', 'admin', 'settings'],
        metadata: {
            category: 'system',
            features: ['system-config', 'admin-controls', 'system-monitoring'],
            dependencies: ['appStore', 'systemSlice']
        }
    },

    'ui-controls': {
        id: 'ui-controls',
        title: 'UI Controls',
        group: 'controls',
        component: () => import('/client/controls/panels/UIControlPanel.js').then(m => m.UIControlPanel),
        order: 3,
        defaultCollapsed: true,
        icon: '🎛️',
        description: 'User interface control and customization',
        keywords: ['ui', 'interface', 'controls', 'customization'],
        metadata: {
            category: 'interface',
            features: ['ui-controls', 'interface-config', 'layout-options'],
            dependencies: ['appStore', 'uiSlice']
        }
    },

    // =================================================================
    // LOGS DOCK PANELS
    // =================================================================
    'console-logs': {
        id: 'console-logs',
        title: 'Console Logs',
        group: 'logs',
        component: () => import('/client/log/panels/ConsoleLogPanel.js').then(m => m.ConsoleLogPanel),
        order: 1,
        defaultCollapsed: false,
        icon: '📄',
        description: 'Application console output and logging',
        keywords: ['console', 'logs', 'output', 'debugging'],
        metadata: {
            category: 'logging',
            features: ['console-output', 'log-filtering', 'log-export'],
            dependencies: ['appStore', 'logSlice']
        }
    },

    'error-logs': {
        id: 'error-logs',
        title: 'Error Logs',
        group: 'logs',
        component: () => import('/client/log/panels/ErrorLogPanel.js').then(m => m.ErrorLogPanel),
        order: 2,
        defaultCollapsed: true,
        icon: '🚨',
        description: 'Error tracking and debugging information',
        keywords: ['errors', 'exceptions', 'debugging', 'troubleshooting'],
        metadata: {
            category: 'debugging',
            features: ['error-tracking', 'exception-handling', 'debug-info'],
            dependencies: ['appStore', 'errorTracker']
        }
    },

    'system-logs': {
        id: 'system-logs',
        title: 'System Logs',
        group: 'logs',
        component: () => import('/client/log/panels/SystemLogPanel.js').then(m => m.SystemLogPanel),
        order: 3,
        defaultCollapsed: true,
        icon: '📊',
        description: 'System event logs and monitoring',
        keywords: ['system', 'events', 'monitoring', 'performance'],
        metadata: {
            category: 'monitoring',
            features: ['system-monitoring', 'event-logging', 'performance-tracking'],
            dependencies: ['appStore', 'systemSlice']
        }
    },

    // =================================================================
    // DEBUG DOCK PANELS (from devpages-debug package)
    // =================================================================
    'devtools': {
        id: 'devtools',
        title: 'DevTools',
        group: 'debug',
        component: () => import('/packages/devpages-debug/devtools/DevToolsPanel.js').then(m => m.DevToolsPanel),
        order: 1,
        defaultCollapsed: false,
        icon: '🛠️',
        description: 'Comprehensive debugging tools for StateKit, panels, and performance',
        keywords: ['devtools', 'debugging', 'statekit', 'performance'],
        metadata: {
            category: 'debugging',
            features: ['action-history', 'time-travel', 'performance-monitoring', 'panel-debugging'],
            dependencies: ['appStore', 'panelRegistry', 'zIndexManager']
        }
    },

    'dom-inspector': {
        id: 'dom-inspector',
        title: 'DOM Inspector',
        group: 'debug',
        component: () => import('/packages/devpages-debug/panels/dom-inspector/DomInspectorDebugPanel.js').then(m => m.DomInspectorDebugPanel),
        order: 2,
        defaultCollapsed: true,
        icon: '🔍',
        description: 'DOM structure inspection and debugging',
        keywords: ['dom', 'inspector', 'elements', 'html'],
        metadata: {
            category: 'debugging',
            features: ['dom-inspection', 'element-selection', 'html-debugging'],
            dependencies: ['appStore']
        }
    },

    'css-files': {
        id: 'css-files',
        title: 'CSS Files',
        group: 'debug',
        component: () => import('/packages/devpages-debug/panels/CssFilesPanel/CssFilesPanel.js').then(m => m.CssFilesPanel),
        order: 3,
        defaultCollapsed: true,
        icon: '📄',
        description: 'CSS file management and inspection',
        keywords: ['css', 'files', 'stylesheets', 'debugging'],
        metadata: {
            category: 'debugging',
            features: ['css-inspection', 'file-management', 'style-debugging'],
            dependencies: ['appStore']
        }
    }
};

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Get all panels for a specific group
 */
export function getPanelsByGroup(group) {
    return Object.values(PANEL_CONFIGURATION)
        .filter(panel => panel.group === group)
        .sort((a, b) => a.order - b.order);
}

/**
 * Get all available groups
 */
export function getAllGroups() {
    const groups = new Set();
    Object.values(PANEL_CONFIGURATION).forEach(panel => {
        groups.add(panel.group);
    });
    return Array.from(groups).sort();
}

/**
 * Get panel configuration by ID
 */
export function getPanelConfig(panelId) {
    return PANEL_CONFIGURATION[panelId];
}

/**
 * Search panels by keywords
 */
export function searchPanels(query) {
    const searchTerm = query.toLowerCase();
    return Object.values(PANEL_CONFIGURATION).filter(panel => {
        return panel.title.toLowerCase().includes(searchTerm) ||
               panel.description.toLowerCase().includes(searchTerm) ||
               panel.keywords.some(keyword => keyword.includes(searchTerm));
    });
}

/**
 * Get dock configuration mapping
 */
export function getDockConfiguration() {
    return {
        'settings-dock': {
            id: 'settings-dock',
            title: 'Settings',
            panelGroup: 'settings',
            isFloating: false,
            defaultExpanded: true,
            icon: '⚙️'
        },
        'controls-dock': {
            id: 'controls-dock', 
            title: 'Controls',
            panelGroup: 'controls',
            isFloating: false,
            defaultExpanded: false,
            icon: '🎛️'
        },
        'logs-dock': {
            id: 'logs-dock',
            title: 'Logs',
            panelGroup: 'logs', 
            isFloating: false,
            defaultExpanded: false,
            icon: '📋'
        },
        'debug-dock': {
            id: 'debug-dock',
            title: 'Debug Tools',
            panelGroup: 'debug',
            isFloating: true,
            defaultExpanded: false,
            icon: '🐛'
        }
    };
}

/**
 * Validate panel configuration
 */
export function validatePanelConfig(config) {
    const required = ['id', 'title', 'group', 'component'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
        throw new Error(`Panel config missing required fields: ${missing.join(', ')}`);
    }
    
    return true;
}

// =================================================================
// AUTO-REGISTRATION HELPER
// =================================================================

/**
 * Register all panels with the panel registry
 */
export async function registerAllPanelsFromConfig(panelRegistry) {
    const registeredCount = Object.values(PANEL_CONFIGURATION).length;
    let successCount = 0;
    
    console.log(`[PanelConfiguration] Registering ${registeredCount} panels from central configuration...`);
    
    for (const [panelId, config] of Object.entries(PANEL_CONFIGURATION)) {
        try {
            validatePanelConfig(config);
            
            // Create registration config for panelRegistry
            const registrationConfig = {
                ...config,
                // Convert component factory to component if needed
                component: typeof config.component === 'function' 
                    ? await config.component() 
                    : config.component
            };
            
            panelRegistry.register(registrationConfig);
            successCount++;
            
            console.log(`[PanelConfiguration] ✅ Registered panel: ${panelId} (${config.group})`);
        } catch (error) {
            console.error(`[PanelConfiguration] ❌ Failed to register panel ${panelId}:`, error);
        }
    }
    
    console.log(`[PanelConfiguration] Registration complete: ${successCount}/${registeredCount} panels registered`);
    return successCount;
}