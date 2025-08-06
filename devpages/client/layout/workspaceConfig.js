/**
 * workspaceConfig.js - Data-Driven Workspace Configuration
 * Defensive, configuration-based system that separates workspace zones from panels
 */

// DEFENSIVE: Validate zone configuration
function validateZoneConfig(config) {
    const required = ['id', 'type', 'container'];
    const missing = required.filter(field => !config[field]);
    if (missing.length) {
        throw new Error(`Zone config missing required fields: ${missing.join(', ')}`);
    }
    return true;
}

// DEFENSIVE: Validate panel configuration  
function validatePanelConfig(config) {
    const required = ['id', 'type', 'factory'];
    const missing = required.filter(field => !config[field]);
    if (missing.length) {
        throw new Error(`Panel config missing required fields: ${missing.join(', ')}`);
    }
    return true;
}

// DATA-DRIVEN: Workspace Zone Definitions (NOT panels - these are layout structure)
// HIERARCHY: log (most special) > editor > preview > sidebar (least special)
export const WORKSPACE_ZONES = {
    // MOST SPECIAL: Main Log Area (bottom) - owns Redux store, top bar toggle
    log: {
        id: 'log',
        type: 'SPECIAL_LOG_ZONE',
        container: 'log-container',
        resizable: true, // Vertical resize with handle
        collapsible: true, // Toggle from top bar
        defaultHeight: 150,
        minHeight: 30,
        maxHeight: 500,
        position: 'bottom',
        purpose: 'console_terminal',
        reduxStore: 'ui.logVisible, ui.logHeight', // Has its own Redux state
        topBarToggle: 'log-toggle-btn',
        resizeHandle: 'log-resize-handle',
        validation: (config) => validateZoneConfig(config)
    },
    
    // SECOND: Editor Area (center) - fixed workspace zone
    editor: {
        id: 'editor', 
        type: 'FIXED_ZONE',
        container: 'workspace-editor',
        resizable: false, // Flex-grows
        collapsible: false, // Always visible
        defaultWidth: 'flex',
        position: 'center',
        purpose: 'primary_content',
        validation: (config) => validateZoneConfig(config)
    },
    
    // THIRD: Preview Area (right) - fixed workspace zone
    preview: {
        id: 'preview',
        type: 'FIXED_ZONE', 
        container: 'workspace-preview',
        resizable: true,
        collapsible: true, // Can hide preview
        defaultWidth: 300,
        minWidth: 200,
        maxWidth: 500,
        position: 'right',
        purpose: 'output_display',
        validation: (config) => validateZoneConfig(config)
    },
    
    // FOURTH: Sidebar Area (left) - contains draggable panels
    sidebar: {
        id: 'sidebar',
        type: 'PANEL_CONTAINER_ZONE',
        container: 'workspace-sidebar',
        resizable: true,
        collapsible: false,
        defaultWidth: 300,
        minWidth: 200,
        maxWidth: 500,
        position: 'left',
        purpose: 'draggable_panels',
        validation: (config) => validateZoneConfig(config)
    }
};

// DATA-DRIVEN: Panel Definitions (actual draggable/collapsible components)
export const PANEL_DEFINITIONS = {
    'file-browser': {
        id: 'file-browser',
        type: 'DRAGGABLE_PANEL',
        title: 'File Browser',
        factory: () => import('/client/file-browser/FileBrowserPanel.js').then(m => m.FileBrowserPanel),
        targetZone: 'sidebar',
        collapsible: true,
        draggable: true,
        resizable: false, // Within its zone
        defaultVisible: true,
        order: 1,
        validation: (config) => validatePanelConfig(config)
    },
    
    'code': {
        id: 'code',
        type: 'DRAGGABLE_PANEL',
        title: 'Code',
        factory: () => import('../panels/CodePanel.js').then(m => m.CodePanel),
        targetZone: 'sidebar',
        collapsible: true,
        draggable: true,
        resizable: false,
        defaultVisible: true,
        order: 2,
        validation: (config) => validatePanelConfig(config)
    },
    
    'settings-panel': {
        id: 'settings-panel',
        type: 'DRAGGABLE_PANEL',
        title: 'Design Tokens',
        factory: () => import('/client/settings/panels/css-design/DesignTokensPanel.js').then(m => m.DesignTokensPanel),
        targetZone: 'sidebar',
        collapsible: true,
        draggable: true,
        resizable: false,
        defaultVisible: false, // Start hidden
        order: 3,
        validation: (config) => validatePanelConfig(config)
    },
    
    'nlp-panel': {
        id: 'nlp-panel',
        type: 'DRAGGABLE_PANEL',
        title: 'NLP',
        factory: () => import('../panels/NlpPanel.js').then(m => m.NlpPanel),
        targetZone: 'sidebar', // Move to sidebar instead of bottom
        collapsible: true,
        draggable: true,
        resizable: false,
        defaultVisible: false,
        order: 4,
        validation: (config) => validatePanelConfig(config)
    },
    
    'log-panel': {
        id: 'log-panel',
        type: 'DRAGGABLE_PANEL',
        title: 'Log Panel',
        factory: () => import('../log/LogPanel.js').then(m => m.LogPanel),
        targetZone: 'sidebar',
        collapsible: true,
        draggable: true,
        resizable: false,
        defaultVisible: false,
        order: 5,
        note: 'This is different from the main Log area - this is just a draggable panel',
        validation: (config) => validatePanelConfig(config)
    }
};

// DEFENSIVE: Configuration validation
export function validateWorkspaceConfig() {
    const errors = [];
    
    // Validate zones
    Object.values(WORKSPACE_ZONES).forEach(zone => {
        try {
            zone.validation(zone);
        } catch (error) {
            errors.push(`Zone ${zone.id}: ${error.message}`);
        }
    });
    
    // Validate panels
    Object.values(PANEL_DEFINITIONS).forEach(panel => {
        try {
            panel.validation(panel);
        } catch (error) {
            errors.push(`Panel ${panel.id}: ${error.message}`);
        }
        
        // Validate target zone exists
        if (!WORKSPACE_ZONES[panel.targetZone]) {
            errors.push(`Panel ${panel.id}: Invalid targetZone '${panel.targetZone}'`);
        }
    });
    
    if (errors.length) {
        throw new Error(`Workspace configuration errors:\n${errors.join('\n')}`);
    }
    
    return true;
}

// DEFENSIVE: Safe zone access
export function getZoneConfig(zoneId) {
    const zone = WORKSPACE_ZONES[zoneId];
    if (!zone) {
        console.warn(`[WorkspaceConfig] Unknown zone: ${zoneId}`);
        return null;
    }
    return { ...zone }; // Return copy to prevent mutation
}

// DEFENSIVE: Safe panel access
export function getPanelConfig(panelId) {
    const panel = PANEL_DEFINITIONS[panelId];
    if (!panel) {
        console.warn(`[WorkspaceConfig] Unknown panel: ${panelId}`);
        return null;
    }
    return { ...panel }; // Return copy to prevent mutation
}

// DATA-DRIVEN: Get panels for a specific zone
export function getPanelsForZone(zoneId) {
    return Object.values(PANEL_DEFINITIONS)
        .filter(panel => panel.targetZone === zoneId)
        .sort((a, b) => (a.order || 99) - (b.order || 99));
}

// DEFENSIVE: Initialize with validation
export function initializeWorkspaceConfig() {
    try {
        validateWorkspaceConfig();
        console.log('✅ Workspace configuration validated successfully');
        return true;
    } catch (error) {
        console.error('❌ Workspace configuration validation failed:', error);
        throw error;
    }
}

// Export configuration types for TypeScript-like checking
export const CONFIG_TYPES = {
    ZONE: 'FIXED_ZONE',
    PANEL: 'DRAGGABLE_PANEL'
};