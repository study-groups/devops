/**
 * @file packages/devpages-debug/debugPanelInitializer.js
 * @description Initializes and registers all debug panels for the application.
 */

import { panelRegistry } from '../../client/panels/panelRegistry.js';
import { JavaScriptInfoPanel } from './panels/JavaScriptInfoPanel.js';
import { CssFilesPanel } from './panels/CssFilesPanel/CssFilesPanel.js';
import { DomInspectorDebugPanel } from './panels/dom-inspector/DomInspectorDebugPanel.js';
import { DevToolsPanel } from './devtools/DevToolsPanel.js';
import { ExternalDependenciesPanel } from './panels/ExternalDependenciesPanel.js';
import { PDataPanel } from './panels/PDataPanel.js';

export function initializeDebugPanels() {
    console.log('[DebugPanelInitializer] Starting debug panel registration...');
    
    try {
        const debugPanels = [
            {
                id: 'devtools',
                title: 'DevTools',
                group: 'debug',
                factory: () => Promise.resolve(DevToolsPanel),
                description: 'Comprehensive debugging tools for StateKit, panels, and performance',
                icon: 'icon-bug',
                order: 1,
                isVisible: true,
                metadata: {
                    category: 'debugging',
                    features: ['action-history', 'time-travel', 'performance-monitoring', 'panel-debugging'],
                    dependencies: ['appStore', 'panelRegistry', 'zIndexManager']
                }
            },
            {
                id: 'javascript-info',
                title: 'JavaScript Info',
                group: 'debug',
                factory: () => Promise.resolve(JavaScriptInfoPanel),
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
            },
            {
                id: 'css-files',
                title: 'CSS Files',
                group: 'debug',
                factory: () => Promise.resolve(CssFilesPanel),
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
            },
            {
                id: 'dom-inspector-debug',
                title: 'DOM Inspector',
                group: 'debug',
                factory: () => Promise.resolve(DomInspectorDebugPanel),
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
            },
            {
                id: 'pdata-panel',
                title: 'PData Panel',
                group: 'debug',
                factory: () => Promise.resolve(PDataPanel),
                description: 'Debug PData authentication, session, and API functionality',
                icon: 'icon-database',
                order: 1,
                isVisible: true,
                defaultCollapsed: false,
                metadata: {
                    category: 'debugging',
                    features: ['authentication', 'session-debug', 'api-explorer', 'user-verification'],
                    dependencies: []
                }
            },
            {
                id: 'external-dependencies',
                title: 'External Dependencies',
                group: 'debug',
                factory: () => Promise.resolve(ExternalDependenciesPanel),
                description: 'Monitor and audit all external JavaScript libraries and CSS dependencies',
                icon: 'icon-package',
                order: 5,
                isVisible: true,
                defaultCollapsed: false,
                metadata: {
                    category: 'debugging',
                    features: ['dependency-tracking', 'performance-monitoring', 'architecture-compliance', 'security-audit'],
                    dependencies: []
                }
            }
        ];

        debugPanels.forEach(panel => {
            panelRegistry.register(panel);
            console.log(`[DebugPanelInitializer] Registered: ${panel.id}`);
        });

        // Verify registration
        const registeredDebugPanels = panelRegistry.getAllPanels().filter(p => p.group === 'debug');
        console.log(`[DebugPanelInitializer] All debug panels have been registered. Total: ${registeredDebugPanels.length}`);
        
    } catch (error) {
        console.error('[DebugPanelInitializer] Error during debug panel registration:', error);
        throw error;
    }
} 