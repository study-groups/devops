/**
 * workspaceAPI.js - Unified API for workspace controls
 * Exposes clean interface for the new workspace hierarchy
 */

import { unifiedWorkspaceController } from './UnifiedWorkspaceController.js';

/**
 * DEFENSIVE: Expose clean workspace API
 * Recognizes proper workspace hierarchy with Log as most special
 */
export function exposeWorkspaceAPI() {
    if (typeof window === 'undefined') return;
    
    window.APP = window.APP || {};
    window.APP.workspace = {
        // SPECIAL: Main Log Area controls (most special)
        toggleLogArea: () => {
            try {
                return unifiedWorkspaceController.toggleLogArea();
            } catch (error) {
                console.error('[WorkspaceAPI] Failed to toggle log area:', error);
                return false;
            }
        },
        
        // FIXED ZONES: Editor, Preview controls 
        toggleZone: (zoneId) => {
            try {
                return unifiedWorkspaceController.toggleZone(zoneId);
            } catch (error) {
                console.error(`[WorkspaceAPI] Failed to toggle zone ${zoneId}:`, error);
                return false;
            }
        },
        
        // DRAGGABLE PANELS: Sidebar panel controls
        togglePanel: (panelId) => {
            try {
                return unifiedWorkspaceController.togglePanel(panelId);
            } catch (error) {
                console.error(`[WorkspaceAPI] Failed to toggle panel ${panelId}:`, error);
                return false;
            }
        },
        
        // SYSTEM INFO: Get current workspace status
        getSystemInfo: () => {
            try {
                return unifiedWorkspaceController.getSystemStatus();
            } catch (error) {
                console.error('[WorkspaceAPI] Failed to get system info:', error);
                return {
                    error: 'System info unavailable',
                    architecture: 'UNKNOWN'
                };
            }
        },
        
        // HIERARCHY INFO: Show the proper workspace hierarchy
        getHierarchy: () => ({
            description: 'Workspace areas in order of importance',
            hierarchy: [
                {
                    rank: 1,
                    name: 'Main Log Area',
                    position: 'bottom',
                    specialness: 'MOST SPECIAL - owns Redux store, top bar toggle',
                    controls: 'window.APP.workspace.toggleLogArea()'
                },
                {
                    rank: 2,
                    name: 'Editor Area', 
                    position: 'center',
                    specialness: 'Fixed workspace zone, always visible',
                    controls: 'Not toggleable (always visible)'
                },
                {
                    rank: 3,
                    name: 'Preview Area',
                    position: 'right', 
                    specialness: 'Fixed workspace zone, collapsible',
                    controls: 'window.APP.workspace.toggleZone("preview")'
                },
                {
                    rank: 4,
                    name: 'Sidebar Area',
                    position: 'left',
                    specialness: 'Contains draggable panels',
                    controls: 'window.APP.workspace.togglePanel("panel-id")'
                }
            ]
        }),
        
        // LEGACY COMPATIBILITY: Helpful guidance for old calls
        resetDefaults: () => {
            console.log('🚫 resetDefaults() DEPRECATED');
            console.log('🎯 New API available:');
            console.log('  - toggleLogArea() - for main log (most special)');
            console.log('  - toggleZone("preview") - for preview area');
            console.log('  - togglePanel("panel-id") - for sidebar panels');
            console.log('  - getHierarchy() - understand workspace structure');
        },
        
        // DEBUGGING: Show what replaced the old systems
        getReplacementInfo: () => ({
            replaced: {
                'WorkspaceManager': 'Confused zones and panels - eliminated',
                'WorkspaceController': 'Redundant with Manager - eliminated'
            },
            newSystem: 'UnifiedWorkspaceController',
            benefits: [
                'Clear workspace hierarchy (Log > Editor > Preview > Sidebar)',
                'No more zone/panel confusion',
                'Single controller eliminates redundancy',
                'Proper Log area recognition (most special)',
                'Defensive error handling'
            ]
        })
    };
    
    console.log('✅ Unified workspace API exposed to window.APP.workspace');
    console.log('🎖️ Proper hierarchy recognized: Log (most special) > Editor > Preview > Sidebar');
}

/**
 * DATA-DRIVEN: Get available workspace controls for UI
 */
export function getAvailableWorkspaceControls() {
    try {
        if (!unifiedWorkspaceController.initialized) {
            return { error: 'Workspace not initialized' };
        }
        
        const status = unifiedWorkspaceController.getSystemStatus();
        
        return {
            hierarchy: [
                { 
                    id: 'log', 
                    type: 'SPECIAL_LOG_ZONE', 
                    name: 'Main Log Area',
                    description: 'Most special - Redux store, top bar toggle',
                    available: true
                },
                { 
                    id: 'editor', 
                    type: 'FIXED_ZONE',
                    name: 'Editor Area', 
                    description: 'Always visible center area',
                    available: false // Not toggleable
                },
                { 
                    id: 'preview', 
                    type: 'FIXED_ZONE',
                    name: 'Preview Area',
                    description: 'Collapsible right area', 
                    available: true
                },
                { 
                    id: 'sidebar', 
                    type: 'PANEL_CONTAINER_ZONE',
                    name: 'Sidebar Area',
                    description: 'Contains draggable panels',
                    available: false, // Individual panels are toggleable
                    panels: status.panels
                }
            ],
            systemInfo: status
        };
    } catch (error) {
        console.error('[WorkspaceAPI] Failed to get available controls:', error);
        return { error: 'Failed to get workspace controls' };
    }
}