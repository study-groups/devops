/**
 * @file client/settings/settingsInitializer.refactored.js
 * @description Refactored panel initialization using centralized state management
 */

import { FileBrowserPanel } from '/client/file-browser/FileBrowserPanel.js';
import { PublishedSummaryPanel } from '/client/sidebar/panels/PublishedSummaryPanel.js';
import { PanelManagerPanel } from '/client/panels/types/PanelManagerPanel.js';
import { TokensPanel } from '/client/panels/types/TokensPanel.js';
import { ContextPanel } from '/client/panels/types/ContextPanel.js';
import { LogsPanel } from '/client/panels/types/LogsPanel.js';
import { DevToolsPanel } from '/client/settings/panels/dev-tools/DevToolsPanel.js';
import { JavaScriptPanel } from '/client/settings/panels/javascript/JavaScriptPanel.js';
import { CssFilesPanel } from '/client/settings/panels/CssFilesPanel/CssFilesPanel.js';
import { TreesPanel } from '/client/panels/trees/TreesPanel.js';

import { panelStateManager } from '/client/panels/PanelStateManager.js';

let initializePanelsCallCount = 0;

export function initializePanels() {
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
    
    // Register all panels using the centralized state manager
    
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
    });

    // Panel Manager
    panelStateManager.registerPanel('panel-manager', {
        title: 'Panel Manager',
        group: 'sidebar',
        icon: 'panel-manager',
        shortcut: 'Ctrl+Shift+P',
        category: 'system',
        priority: 1,
        panelClass: PanelManagerPanel,
        canFloat: false,
        canClose: false,
        isVisible: true,
        metadata: {
            description: 'This panel allows you to manage and reorder other sidebar panels.'
        }
    });

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
    });

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
    });
    
    // Tokens Panel
    panelStateManager.registerPanel('tokens', {
        title: 'Design Tokens',
        group: 'sidebar',
        icon: 'tokens',
        shortcut: 'Ctrl+Shift+D',
        canFloat: true,
        canClose: true,
        isVisible: true,
        priority: 4,
        panelClass: TokensPanel,
    });
    
    // Logs Panel
    panelStateManager.registerPanel('logs', {
        title: 'Logs',
        group: 'sidebar',
        icon: 'logs',
        shortcut: 'Ctrl+Shift+L',
        canFloat: true,
        canClose: true,
        isVisible: false, // Hidden by default
        priority: 5,
        panelClass: LogsPanel,
    });

    // --- Debug Panels ---

    panelStateManager.registerPanel('dev-tools', {
        title: 'Dev Tools',
        group: 'debug',
        panelClass: DevToolsPanel,
        shortcut: 'Ctrl+Shift+T',
        defaultCollapsed: true,
        isVisible: true,
    });

    panelStateManager.registerPanel('javascript-panel', {
        title: 'JavaScript',
        group: 'debug',
        panelClass: JavaScriptPanel,
        shortcut: 'Ctrl+Shift+J',
        defaultCollapsed: true,
        isVisible: true,
    });

    panelStateManager.registerPanel('css-files', {
        title: 'CSS Files',
        group: 'debug',
        panelClass: CssFilesPanel,
        shortcut: 'Ctrl+Shift+S',
        defaultCollapsed: false,
        isVisible: true,
    });

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
    });

    console.log('All panels have been registered with centralized state management.');
    window.panelsInitialized = true;
} 