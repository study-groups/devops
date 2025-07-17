/**
 * @file client/settings/settingsInitializer.refactored.js
 * @description Refactored panel initialization using centralized state management
 */

import { FileBrowserPanel } from '/client/file-browser/FileBrowserPanel.js';
import { PublishedSummaryPanel } from '/client/sidebar/panels/PublishedSummaryPanel.js';
import { ContextPanel } from '/client/panels/ContextPanel.js';
import { TreesPanel } from '/client/panels/TreesPanel.js';
import { DesignTokensPanel } from '/client/settings/panels/css-design/DesignTokensPanel.js';

import { panelStateManager } from '/client/panels/PanelStateManager.js';

let initializePanelsCallCount = 0;

export async function initializePanels() {
    initializePanelsCallCount++;
    console.warn(`[initializePanels] Called - COUNT: ${initializePanelsCallCount}`);
    
    if (initializePanelsCallCount > 1) {
        console.error(`[initializePanels] WARNING: Called ${initializePanelsCallCount} times!`);
    }
    
    if (window.panelsInitialized) {
        console.error('[initializePanels] Already initialized, skipping');
        return;
    }
    
    console.warn('[initializePanels] Starting panel registration...');
    
    // Initialize the panel state manager
    panelStateManager.initialize();
    
    // Register all panels using the centralized state manager with StateKit thunks
    try {
        // Register panels in parallel for better performance
        await Promise.all([
            // Files panel
            panelStateManager.registerPanel('files', {
                title: 'Files',
                group: 'sidebar',
                icon: 'files',
                shortcut: 'Ctrl+Shift+F',
                category: 'general',
                priority: 20,
                panelClass: FileBrowserPanel,
                canFloat: true,
                canClose: true,
                isVisible: true,
            }),

            // Published Summary
            panelStateManager.registerPanel('published-summary', {
                title: 'Published Contexts',
                group: 'sidebar',
                icon: 'files',
                shortcut: 'Ctrl+Shift+U',
                category: 'general',
                priority: 30,
                panelClass: PublishedSummaryPanel,
                canFloat: true,
                canClose: true,
                isVisible: true,
            }),

            // Context Panel
            panelStateManager.registerPanel('context', {
                title: 'Context',
                group: 'sidebar',
                icon: 'context',
                shortcut: 'Ctrl+Shift+C',
                canFloat: true,
                canClose: true,
                isVisible: true,
                priority: 3,
                panelClass: ContextPanel,
            }),
            
            // Tokens Panel
            panelStateManager.registerPanel('design-tokens', {
                title: 'Design Tokens',
                group: 'sidebar',
                icon: 'tokens',
                shortcut: 'Ctrl+Shift+D',
                canFloat: true,
                canClose: true,
                isVisible: true,
                priority: 4,
                panelClass: DesignTokensPanel,
            }),

            // --- Settings Panels ---

            panelStateManager.registerPanel('trees', {
                title: 'Trees',
                group: 'settings',
                panelClass: TreesPanel,
                shortcut: 'Ctrl+Shift+R',
                defaultCollapsed: false,
                isVisible: true,
                metadata: {
                    description: 'File tree and other hierarchical data views'
                }
            }),
        ]);

        console.log('All panels have been registered with centralized StateKit state management.');
        window.panelsInitialized = true;
        
    } catch (error) {
        console.error('[initializePanels] Error during panel registration:', error);
        throw error;
    }
} 