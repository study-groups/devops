/**
 * client/store/reducers/panelMetadata.js
 * Utility to identify and mark panel-related reducer slices
 * Provides metadata about panel state management patterns
 */

/**
 * Panel state reducer metadata
 * Identifies which reducers handle panel state and their patterns
 */
export const PANEL_REDUCERS = {
    // Main panel system - sidebar panels
    panels: {
        type: 'main-panels',
        description: 'Main sidebar panels (files, context, tokens, etc.)',
        collapsedStateKey: 'sidebarPanels.*.collapsed',
        visibilityStateKey: 'sidebarPanels.*.visible',
        registry: 'panelRegistry',
        persistenceKey: 'devpages_panels_state',
        supportsCollapse: true,
        supportsVisibility: true,
        supportsReordering: true
    },
    
    // Settings panel system
    settingsPanel: {
        type: 'floating-panel',
        description: 'Settings panel (themes, icons, design tokens, etc.)',
        collapsedStateKey: 'collapsedSections',
        visibilityStateKey: 'visible',
        registry: 'settingsRegistry',
        persistenceKey: 'devpages_settings_panel_state',
        supportsCollapse: true,
        supportsVisibility: true,
        supportsReordering: false,
        floatingPanel: true
    },
    
    // Debug panel system  
    debugPanel: {
        type: 'floating-panel',
        description: 'Debug panel (state inspector, DOM inspector, etc.)',
        collapsedStateKey: 'collapsedSections',
        visibilityStateKey: 'visible',
        registry: 'panelRegistry',
        registryFilter: 'group: debug',
        persistenceKey: 'devpages_debug_panel_state',
        supportsCollapse: true,
        supportsVisibility: true,
        supportsReordering: false,
        floatingPanel: true
    },
    
    // DOM Inspector (individual panel)
    domInspector: {
        type: 'individual-panel',
        description: 'DOM Inspector panel specific state',
        collapsedStateKey: 'collapsedSections',
        visibilityStateKey: 'visible',
        registry: null,
        persistenceKey: null, // Uses parent debug panel persistence
        supportsCollapse: true,
        supportsVisibility: true,
        supportsReordering: false,
        parentPanel: 'debugPanel'
    },
    
    // Workspace panels
    workspace: {
        type: 'layout-panels',
        description: 'Workspace layout panels (editor, preview, sidebar)',
        collapsedStateKey: null, // No collapse support
        visibilityStateKey: '*.visible',
        registry: null,
        persistenceKey: null, // Uses localStorage directly
        supportsCollapse: false,
        supportsVisibility: true,
        supportsReordering: false
    },
    
    // UI panels (legacy/mixed)
    ui: {
        type: 'mixed-ui',
        description: 'Mixed UI state including some panel visibility',
        collapsedStateKey: null,
        visibilityStateKey: 'logVisible,textVisible,previewVisible',
        registry: null,
        persistenceKey: 'multiple', // Multiple keys
        supportsCollapse: false,
        supportsVisibility: true,
        supportsReordering: false,
        legacy: true
    }
};

/**
 * Get metadata for a specific panel reducer
 * @param {string} reducerName - Name of the reducer slice
 * @returns {object|null} Panel metadata or null if not a panel reducer
 */
export function getPanelReducerMetadata(reducerName) {
    return PANEL_REDUCERS[reducerName] || null;
}

/**
 * Check if a reducer slice manages panel state
 * @param {string} reducerName - Name of the reducer slice
 * @returns {boolean} True if this reducer manages panel state
 */
export function isPanelReducer(reducerName) {
    return reducerName in PANEL_REDUCERS;
}

/**
 * Get all panel reducers by type
 * @param {string} type - Panel type to filter by
 * @returns {object} Object with reducer names as keys and metadata as values
 */
export function getPanelReducersByType(type) {
    const result = {};
    for (const [name, metadata] of Object.entries(PANEL_REDUCERS)) {
        if (metadata.type === type) {
            result[name] = metadata;
        }
    }
    return result;
}

/**
 * Get all reducers that support collapse functionality
 * @returns {string[]} Array of reducer names that support collapse
 */
export function getCollapsiblePanelReducers() {
    return Object.entries(PANEL_REDUCERS)
        .filter(([name, meta]) => meta.supportsCollapse)
        .map(([name]) => name);
}

/**
 * Get all floating panel reducers
 * @returns {string[]} Array of reducer names for floating panels
 */
export function getFloatingPanelReducers() {
    return Object.entries(PANEL_REDUCERS)
        .filter(([name, meta]) => meta.floatingPanel)
        .map(([name]) => name);
}

/**
 * Get collapsed state path for a panel reducer
 * @param {string} reducerName - Name of the reducer slice
 * @returns {string|null} Path to collapsed state or null if not supported
 */
export function getCollapsedStatePath(reducerName) {
    const metadata = getPanelReducerMetadata(reducerName);
    return metadata?.collapsedStateKey || null;
}

/**
 * Get visibility state path for a panel reducer
 * @param {string} reducerName - Name of the reducer slice  
 * @returns {string|null} Path to visibility state or null if not supported
 */
export function getVisibilityStatePath(reducerName) {
    const metadata = getPanelReducerMetadata(reducerName);
    return metadata?.visibilityStateKey || null;
}

/**
 * Debug utility to analyze panel reducer coverage
 * @returns {object} Analysis of panel state management
 */
export function analyzePanelReducers() {
    const analysis = {
        totalPanelReducers: Object.keys(PANEL_REDUCERS).length,
        byType: {},
        capabilities: {
            collapse: getCollapsiblePanelReducers().length,
            visibility: Object.values(PANEL_REDUCERS).filter(m => m.supportsVisibility).length,
            reordering: Object.values(PANEL_REDUCERS).filter(m => m.supportsReordering).length,
            floating: getFloatingPanelReducers().length
        },
        registries: [...new Set(Object.values(PANEL_REDUCERS).map(m => m.registry).filter(Boolean))],
        persistenceKeys: [...new Set(Object.values(PANEL_REDUCERS).map(m => m.persistenceKey).filter(Boolean))]
    };
    
    // Count by type
    for (const metadata of Object.values(PANEL_REDUCERS)) {
        analysis.byType[metadata.type] = (analysis.byType[metadata.type] || 0) + 1;
    }
    
    return analysis;
}

// Add to window for debugging
if (typeof window !== 'undefined') {
    window.panelReducerMetadata = {
        PANEL_REDUCERS,
        getPanelReducerMetadata,
        isPanelReducer,
        getPanelReducersByType,
        getCollapsiblePanelReducers,
        getFloatingPanelReducers,
        getCollapsedStatePath,
        getVisibilityStatePath,
        analyzePanelReducers
    };
} 