/**
 * @file packages/devpages-debug/debugPanelInitializer.js
 * @description Initializes and registers all debug panels for the application.
 */

import { panelRegistry } from '/client/panels/panelRegistry.js';
import { panelStateManager } from '/client/panels/PanelStateManager.js';
import { JavaScriptInfoPanel } from './panels/JavaScriptInfoPanel.js';
import { CssFilesPanel } from './panels/CssFilesPanel/CssFilesPanel.js';
import { DomInspectorDebugPanel } from './panels/dom-inspector/DomInspectorDebugPanel.js';
import { DevToolsPanel } from './devtools/DevToolsPanel.js';
import './DebugPanelManager.js';

export async function initializeDebugPanels() {
    console.log('[DebugPanelInitializer] Starting debug panel registration...');
    
    try {
        // Register debug panels directly with panelRegistry for DebugPanelManager compatibility
        // This ensures the DebugPanelManager can find the components using panelRegistry.getAllPanels()
        
        // DevTools Panel
        console.log('[DebugPanelInitializer] Registering DevTools panel with component:', DevToolsPanel.name);
        panelRegistry.register({
            id: 'devtools',
            title: 'DevTools',
            group: 'debug',
            component: DevToolsPanel,
            description: 'Comprehensive debugging tools for StateKit, panels, and performance',
            icon: 'icon-bug',
            order: 1,
            isVisible: true,
            metadata: {
                category: 'debugging',
                features: ['action-history', 'time-travel', 'performance-monitoring', 'panel-debugging'],
                dependencies: ['appStore', 'panelRegistry', 'zIndexManager']
            }
        });

        // JavaScript Info Panel
        console.log('[DebugPanelInitializer] Registering JavaScript Info panel with component:', JavaScriptInfoPanel.name);
        panelRegistry.register({
            id: 'javascript-panel',
            title: 'JavaScript Info',
            group: 'debug',
            component: JavaScriptInfoPanel,
            description: 'JavaScript environment information and debugging',
            icon: 'icon-code',
            order: 2,
            isVisible: true,
            shortcut: 'Ctrl+Shift+J',
            defaultCollapsed: true,
            metadata: {
                category: 'debugging',
                features: ['js-info', 'environment-details'],
                dependencies: ['appStore']
            }
        });

        // CSS Files Panel
        console.log('[DebugPanelInitializer] Registering CSS Files panel with component:', CssFilesPanel.name);
        panelRegistry.register({
            id: 'css-files',
            title: 'CSS Files',
            group: 'debug',
            component: CssFilesPanel,
            description: 'CSS file management and inspection',
            icon: 'icon-css',
            order: 3,
            isVisible: true,
            shortcut: 'Ctrl+Shift+S',
            defaultCollapsed: false,
            metadata: {
                category: 'debugging',
                features: ['css-inspection', 'file-management'],
                dependencies: ['appStore']
            }
        });

        // DOM Inspector Panel
        console.log('[DebugPanelInitializer] Registering DOM Inspector panel with component:', DomInspectorDebugPanel.name);
        panelRegistry.register({
            id: 'dom-inspector',
            title: 'DOM Inspector',
            group: 'debug',
            component: DomInspectorDebugPanel,
            description: 'DOM structure inspection and debugging',
            icon: 'icon-dom',
            order: 4,
            isVisible: true,
            defaultCollapsed: false,
            metadata: {
                category: 'debugging',
                features: ['dom-inspection', 'element-selection'],
                dependencies: ['appStore']
            }
        });

        // Also register the main debug panel toggle with panelStateManager for sidebar integration
        await panelStateManager.registerPanel('debug-panel', {
            title: 'Debug Panel',
            group: 'manager', // Special group for panels that are just actions
            onActivate: () => {
                if (window.debugPanelManager) {
                    window.debugPanelManager.toggleVisibility();
                } else {
                    console.error('DebugPanelManager not found on window.');
                }
            },
            shortcut: 'Ctrl+Shift+D',
        });

        // Verify registration
        const registeredDebugPanels = panelRegistry.getAllPanels().filter(p => p.group === 'debug');
        console.log('[DebugPanelInitializer] All debug panels have been registered. Total debug panels:', registeredDebugPanels.length);
        registeredDebugPanels.forEach(panel => {
            console.log(`  - ${panel.id}: ${panel.title} (component: ${panel.component ? panel.component.name : 'undefined'})`);
        });
        
    } catch (error) {
        console.error('[DebugPanelInitializer] Error during debug panel registration:', error);
        throw error;
    }
} 