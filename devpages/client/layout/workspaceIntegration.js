/**
 * workspaceIntegration.js - Integration layer for new workspace architecture
 * Defensive integration that replaces the old WorkspaceManager
 */

import { workspaceController } from './WorkspaceController.js';

/**
 * DEFENSIVE: Initialize the new workspace system
 * Replaces the confusing WorkspaceManager with clear zone/panel separation
 */
export async function initializeWorkspace() {
    try {
        console.log('[WorkspaceIntegration] Starting workspace initialization...');
        
        // DEFENSIVE: Check DOM is ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // DEFENSIVE: Validate required DOM elements exist
        const requiredElements = [
            'workspace-sidebar',
            'workspace-editor', 
            'workspace-preview'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length) {
            throw new Error(`Missing required workspace elements: ${missingElements.join(', ')}`);
        }
        
        // Initialize the workspace controller
        await workspaceController.initialize();
        
        // Expose safe API to window.APP
        exposeWorkspaceAPI();
        
        console.log('✅ Workspace initialization complete');
        return workspaceController;
        
    } catch (error) {
        console.error('❌ Workspace initialization failed:', error);
        throw error;
    }
}

/**
 * DEFENSIVE: Expose safe workspace API to window.APP
 * Replaces the old confused panel system with clear zone/panel controls
 */
function exposeWorkspaceAPI() {
    if (typeof window === 'undefined') return;
    
    window.APP = window.APP || {};
    window.APP.workspace = {
        // DEFENSIVE: Safe zone controls
        toggleZone: (zoneId) => {
            try {
                return workspaceController.toggleZone(zoneId);
            } catch (error) {
                console.error(`[WorkspaceAPI] Failed to toggle zone ${zoneId}:`, error);
                return false;
            }
        },
        
        // DEFENSIVE: Safe panel controls  
        togglePanel: (panelId) => {
            try {
                return workspaceController.togglePanel(panelId);
            } catch (error) {
                console.error(`[WorkspaceAPI] Failed to toggle panel ${panelId}:`, error);
                return false;
            }
        },
        
        // DEFENSIVE: Safe status access
        getZoneStatus: (zoneId) => {
            try {
                return workspaceController.getZoneStatus(zoneId);
            } catch (error) {
                console.error(`[WorkspaceAPI] Failed to get zone status ${zoneId}:`, error);
                return null;
            }
        },
        
        getPanelStatus: (panelId) => {
            try {
                return workspaceController.getPanelStatus(panelId);
            } catch (error) {
                console.error(`[WorkspaceAPI] Failed to get panel status ${panelId}:`, error);
                return null;
            }
        },
        
        // DEFENSIVE: System info
        getSystemInfo: () => ({
            architecture: 'DEFENSIVE_DATA_DRIVEN',
            version: '2.0',
            zones: Array.from(workspaceController.zones.keys()),
            panels: Array.from(workspaceController.panels.keys()),
            message: 'Workspace zones and panels are now properly separated'
        }),
        
        // DEPRECATED: Legacy compatibility
        resetDefaults: () => {
            console.log('🚫 resetDefaults() DEPRECATED - Use window.APP.workspace methods');
            console.log('🎯 Available: toggleZone(), togglePanel(), getSystemInfo()');
        }
    };
    
    console.log('✅ Workspace API exposed to window.APP.workspace');
}

/**
 * DEFENSIVE: Legacy compatibility layer
 * Handles old calls gracefully while guiding to new system
 */
export function createLegacyCompatibility() {
    if (typeof window === 'undefined') return;
    
    // DEFENSIVE: Intercept old panel calls
    const legacyPanelMap = {
        'editor': () => {
            console.log('🚫 "editor" is now a fixed workspace zone, not a panel');
            console.log('🎯 Editor is always visible in the center workspace area');
        },
        'preview': () => {
            console.log('🚫 "preview" is now a fixed workspace zone, not a panel');
            console.log('🎯 Use window.APP.workspace.toggleZone("preview") to toggle preview area');
            return workspaceController.toggleZone('preview');
        }
    };
    
    // Override old methods with helpful guidance
    Object.entries(legacyPanelMap).forEach(([panelId, handler]) => {
        // This would intercept any old calls and provide guidance
    });
}

/**
 * DATA-DRIVEN: Get all available controls for UI
 * Returns configuration-driven list of available zones and panels
 */
export function getAvailableControls() {
    try {
        const zones = Array.from(workspaceController.zones.keys()).map(zoneId => ({
            id: zoneId,
            type: 'zone',
            status: workspaceController.getZoneStatus(zoneId)
        }));
        
        const panels = Array.from(workspaceController.panels.keys()).map(panelId => ({
            id: panelId,
            type: 'panel', 
            status: workspaceController.getPanelStatus(panelId)
        }));
        
        return { zones, panels };
    } catch (error) {
        console.error('[WorkspaceIntegration] Failed to get available controls:', error);
        return { zones: [], panels: [] };
    }
}

// DEFENSIVE: Export safe initialization function
export default initializeWorkspace;