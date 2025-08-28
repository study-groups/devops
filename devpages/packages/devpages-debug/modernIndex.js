/**
 * @devpages/debug - Modern Package Definition
 * Enhanced portable panel package with automatic registration
 */

import { DevToolsPanel } from './devtools/DevToolsPanel.js';
import { CssFilesPanel } from './panels/CssFilesPanel/CssFilesPanel.js';
import { DomInspectorDebugPanel } from './panels/dom-inspector/DomInspectorDebugPanel.js';
import { JavaScriptInfoPanel } from './panels/JavaScriptInfoPanel.js';
import { PDataPanel } from './panels/PDataPanel.js';

/**
 * Modern package definition with enhanced metadata
 */
export const debugPackage = {
    name: '@devpages/debug',
    version: '1.0.0',
    description: 'Debug tools and panels for DevPages development',
    author: 'DevPages Team',
    
    // Package dependencies
    dependencies: [
        '@reduxjs/toolkit'
    ],
    
    // Panel definitions
    panels: [
        {
            id: 'devtools',
            name: 'DevToolsPanel',
            factory: () => DevToolsPanel,
            title: 'DevTools',
            icon: '🛠️',
            description: 'Comprehensive debugging tools for StateKit, panels, and performance',
            category: 'debugging',
            allowedZones: ['sidebar', 'floating'],
            defaultZone: 'sidebar',
            defaultOptions: {
                collapsible: true,
                resizable: true,
                showFlyoutToggle: true
            },
            features: [
                'action-history',
                'time-travel',
                'performance-monitoring',
                'panel-debugging'
            ],
            keywords: ['devtools', 'debugging', 'statekit', 'performance']
        },
        
        {
            id: 'css-files-panel',
            name: 'CssFilesPanel',
            factory: () => CssFilesPanel,
            title: 'CSS Files',
            icon: '🎨',
            description: 'CSS file analysis and debugging tools',
            category: 'debugging',
            allowedZones: ['sidebar', 'floating'],
            defaultZone: 'sidebar',
            defaultOptions: {
                collapsible: true,
                resizable: true,
                showFlyoutToggle: true
            },
            features: [
                'css-analysis',
                'conflict-detection',
                'z-index-analysis'
            ],
            keywords: ['css', 'styles', 'debugging', 'analysis']
        },
        
        {
            id: 'dom-inspector-debug',
            name: 'DomInspectorDebugPanel',
            factory: () => DomInspectorDebugPanel,
            title: 'DOM Inspector',
            icon: '🔍',
            description: 'Real-time DOM inspection and debugging',
            category: 'debugging',
            allowedZones: ['sidebar', 'floating'],
            defaultZone: 'sidebar',
            defaultOptions: {
                collapsible: true,
                resizable: true,
                showFlyoutToggle: true
            },
            features: [
                'dom-inspection',
                'element-highlighting',
                'style-debugging'
            ],
            keywords: ['dom', 'inspector', 'elements', 'debugging']
        },
        
        {
            id: 'javascript-info',
            name: 'JavaScriptInfoPanel',
            factory: () => JavaScriptInfoPanel,
            title: 'JavaScript Info',
            icon: '📜',
            description: 'JavaScript debugging and information panel',
            category: 'debugging',
            allowedZones: ['sidebar', 'floating'],
            defaultZone: 'sidebar',
            defaultOptions: {
                collapsible: true,
                resizable: true
            },
            features: [
                'script-analysis',
                'error-tracking',
                'performance-metrics'
            ],
            keywords: ['javascript', 'js', 'debugging', 'info']
        },
        
        {
            id: 'pdata-panel',
            name: 'PDataPanel',
            factory: () => PDataPanel,
            title: 'PData Debug',
            icon: '🔍',
            description: 'PData system debugging and authentication panel',
            category: 'debugging',
            allowedZones: ['sidebar', 'floating'],
            defaultZone: 'sidebar',
            defaultOptions: {
                collapsible: true,
                resizable: true,
                showFlyoutToggle: true,
                width: 400
            },
            features: [
                'authentication-debug',
                'session-management',
                'api-testing',
                'user-verification'
            ],
            keywords: ['pdata', 'auth', 'session', 'debugging']
        }
    ],
    
    // Package lifecycle hooks
    hooks: {
        beforeInstall: (registry) => {
            console.log(`[${debugPackage.name}] Preparing to install debug panels...`);
        },
        
        afterInstall: (registry, installedPanels) => {
            console.log(`[${debugPackage.name}] Installed ${installedPanels.length} debug panels`);
        },
        
        beforeUninstall: (registry) => {
            console.log(`[${debugPackage.name}] Preparing to uninstall debug panels...`);
        },
        
        afterUninstall: (registry) => {
            console.log(`[${debugPackage.name}] Debug panels uninstalled`);
        }
    },
    
    // Auto-installation method
    install: async (panelRegistry) => {
        try {
            // Run before install hook
            if (debugPackage.hooks.beforeInstall) {
                debugPackage.hooks.beforeInstall(panelRegistry);
            }
            
            // Register the package
            const packageInfo = panelRegistry.registerPackage(debugPackage.name, debugPackage);
            
            // Run after install hook
            if (debugPackage.hooks.afterInstall) {
                debugPackage.hooks.afterInstall(panelRegistry, debugPackage.panels);
            }
            
            return packageInfo;
            
        } catch (error) {
            console.error(`[${debugPackage.name}] Installation failed:`, error);
            throw error;
        }
    },
    
    // Uninstallation method
    uninstall: async (panelRegistry) => {
        try {
            // Run before uninstall hook
            if (debugPackage.hooks.beforeUninstall) {
                debugPackage.hooks.beforeUninstall(panelRegistry);
            }
            
            // Unregister the package
            panelRegistry.unregisterPackage(debugPackage.name);
            
            // Run after uninstall hook
            if (debugPackage.hooks.afterUninstall) {
                debugPackage.hooks.afterUninstall(panelRegistry);
            }
            
        } catch (error) {
            console.error(`[${debugPackage.name}] Uninstallation failed:`, error);
            throw error;
        }
    }
};

/**
 * Initialize debug panels with modern registry
 */
export async function initializeDebugPanels(panelRegistry) {
    return await debugPackage.install(panelRegistry);
}

/**
 * Individual panel exports for direct import
 */
export {
    DevToolsPanel,
    CssFilesPanel,
    DomInspectorDebugPanel,
    JavaScriptInfoPanel,
    PDataPanel
};

/**
 * Default export is the package definition
 */
export default debugPackage;
