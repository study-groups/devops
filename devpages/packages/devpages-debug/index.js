/**
 * @devpages/debug - Debug Tools Package
 * Main entry point for debug tools and panels
 */

// packages/devpages-debug/index.js
import { PDataPanel } from './panels/PDataPanel.js';
import { panelActions } from '../../client/store/slices/panelSlice.js';
import { DevToolsPanel } from './devtools/DevToolsPanel.js';
import { DomInspectorDebugPanel } from './panels/dom-inspector/DomInspectorDebugPanel.js';
import { CssFilesPanel } from './panels/CssFilesPanel/CssFilesPanel.js';
import { JavaScriptInfoPanel } from './panels/JavaScriptInfoPanel.js';

// An array of all debug panel classes to be initialized
const debugPanelClasses = [
    PDataPanel,
    DevToolsPanel,
    DomInspectorDebugPanel,
    CssFilesPanel,
    JavaScriptInfoPanel,
];

let registered = false;

/**
 * Initializes all debug panels and registers them with the WorkspaceManager.
 * This function can be called multiple times, but will only register panels once.
 */
export async function initializeDebugPanels() {
    if (registered) {
        return;
    }
    
    console.log('[DevPages Debug] Initializing debug panels...');

    // In a real application, you would get the panel manager instance
    // For now, we assume it's available on a global or passed in
    // const panelManager = window.APP.services.panelManager;
    // if (!panelManager) {
    //     console.error('[DevPages Debug] PanelManager not found.');
    //     return;
    // }

    for (const PanelClass of debugPanelClasses) {
        try {
            // The panel's static `id` property is used for registration
            const panelId = PanelClass.id || (new PanelClass({ store: window.APP.services.store })).id;
            if (!panelId) {
                console.error(`[DevPages Debug] Panel class ${PanelClass.name} is missing a static id property.`);
                continue;
            }

            // NEW: Register with WorkspaceManager directly
            if (window.APP && window.APP.workspace && window.APP.workspace.registerPanel) {
                window.APP.workspace.registerPanel(panelId, () => Promise.resolve(PanelClass));
                console.log(`[DevPages Debug] Registered panel: ${panelId} with WorkspaceManager`);
            } else {
                console.error('[DevPages Debug] window.APP.workspace.registerPanel not found.');
            }
        } catch (error) {
            console.error(`[DevPages Debug] Failed to register panel ${PanelClass.name}:`, error);
        }
    }
    
    registered = true;
    console.log('[DevPages Debug] All debug panels registered.');
}

// Individual panels (for selective import)
export { DevToolsPanel } from './devtools/DevToolsPanel.js';
export { DomInspectorDebugPanel } from './panels/dom-inspector/DomInspectorDebugPanel.js';
export { CssFilesPanel } from './panels/CssFilesPanel/CssFilesPanel.js';
export { JavaScriptInfoPanel } from './panels/JavaScriptInfoPanel.js';

// Utilities and managers (if needed)
// Note: DebugPanelManager is deprecated/disabled - using sidebar integration instead

// Package metadata
export const debugPackageInfo = {
  name: '@devpages/debug',
  version: '1.0.0',
  description: 'Debug tools and panels for DevPages',
  features: [
    'StateKit DevTools integration',
    'CSS file debugging',
    'DOM inspection',
    'JavaScript debugging',
    'Panel system debugging'
  ]
};