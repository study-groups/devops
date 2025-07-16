/**
 * @file client/settings/settingsInitializer.js
 * @description Initializes and registers all panels for the application.
 */

import { panelRegistry } from '/client/panels/core/panelRegistry.js';
import { FileBrowserPanel } from '/client/file-browser/FileBrowserPanel.js';
import { PublishedSummaryPanel } from '/client/sidebar/panels/PublishedSummaryPanel.js';
import { PanelManagerPanel } from '/client/panels/types/PanelManagerPanel.js';
import { TokensPanel } from '/client/panels/types/TokensPanel.js';
import { ContextPanel } from '/client/panels/types/ContextPanel.js';
import { SubPanel } from '/client/panels/core/SubPanel.js';

// Import Debug Panels
import { DevToolsPanel } from '/client/settings/panels/dev-tools/DevToolsPanel.js';
import { JavaScriptPanel } from '/client/settings/panels/javascript/JavaScriptPanel.js';
import { CssFilesPanel } from '/client/settings/panels/CssFilesPanel/CssFilesPanel.js';
import { DomInspectorDebugPanel } from '/client/settings/panels/dom-inspector/DomInspectorDebugPanel.js';

// Import Trees Panel
import { TreesPanel } from '/client/panels/trees/TreesPanel.js';

let initializePanelsCallCount = 0;

// Cache instances to prevent duplicate creation
const panelInstances = new Map();

function getOrCreateInstance(panelId, createFn) {
    if (!panelInstances.has(panelId)) {
        try {
            const instance = createFn();
            panelInstances.set(panelId, instance);
        } catch (error) {
            console.error(`[initializePanels] ERROR creating instance for ${panelId}:`, error);
            throw error;
        }
    }
    return panelInstances.get(panelId);
}

export function initializePanels() {
    // Ensure this initializer only runs once.
    if (window.panelsInitialized) {
        return;
    }
    window.panelsInitialized = true; // Set the flag immediately.

    initializePanelsCallCount++;
    
    if (initializePanelsCallCount > 1) {
        console.error(`[initializePanels] WARNING: Called ${initializePanelsCallCount} times!`);
    }
    
    // Files panel
    panelRegistry.register('files', {
        title: 'Files',
        group: 'sidebar',
        icon: 'files',
        shortcut: 'Ctrl+Shift+F',
        category: 'general',
        priority: 20,
        createInstance: () => {
            return new FileBrowserPanel();
        },
        canFloat: true,
        canClose: true,
        isVisible: true,
    });

    panelRegistry.register('panel-manager', {
        title: 'Panel Manager',
        group: 'sidebar',
        icon: 'panel-manager',
        shortcut: 'Ctrl+Shift+P',
        category: 'system',
        priority: 1,
        canFloat: false,
        canClose: false,
        isVisible: true,
        metadata: {
            description: 'This panel allows you to manage and reorder other sidebar panels.'
        },
        instance: getOrCreateInstance('panel-manager', () => new PanelManagerPanel()),
    });

    panelRegistry.register('published-summary', {
        title: 'Published Contexts',
        group: 'sidebar',
        icon: 'files',
        shortcut: 'Ctrl+Shift+U',
        category: 'general',
        priority: 30,
        instance: getOrCreateInstance('published-summary', () => new PublishedSummaryPanel()),
        canFloat: true,
        canClose: true,
        isVisible: true,
    });

    panelRegistry.register('context', {
        title: 'Context',
        group: 'sidebar',
        icon: 'context',
        shortcut: 'Ctrl+Shift+C',
        canFloat: true,
        canClose: true,
        isVisible: true,
        priority: 3,
        instance: getOrCreateInstance('context', () => new ContextPanel()),
    });
    
    panelRegistry.register('tokens', {
        title: 'Design Tokens',
        group: 'sidebar',
        icon: 'tokens',
        shortcut: 'Ctrl+Shift+D',
        canFloat: true,
        canClose: true,
        isVisible: true,
        priority: 4,
        instance: getOrCreateInstance('tokens', () => new TokensPanel()),
    });
    
    panelRegistry.register('controller', {
        title: 'Controller',
        group: 'sidebar',
        icon: 'panel-manager',
        shortcut: 'Ctrl+Shift+L',
        canFloat: true,
        canClose: true,
        isVisible: false, // Hidden by default
        priority: 5,
        render: () => {
            return `<div class="placeholder-content" style="padding: 10px; color: var(--text-color-secondary);">
                        <h4 style="margin-top:0; margin-bottom: 5px;">Controller Panel</h4>
                        <p style="font-size: 0.9em; margin-bottom: 0;">This is a placeholder for future controller UI.</p>
                    </div>`;
        }
    });

    // --- Debug Panels ---

    panelRegistry.register('dev-tools', {
        title: 'Dev Tools',
        group: 'debug',
        component: DevToolsPanel,
        shortcut: 'Ctrl+Shift+T',
        defaultCollapsed: true,
        isVisible: true,
    });

    panelRegistry.register('javascript-panel', {
        title: 'JavaScript',
        group: 'debug',
        component: JavaScriptPanel,
        shortcut: 'Ctrl+Shift+J',
        defaultCollapsed: true,
        isVisible: true,
    });

    panelRegistry.register('css-files', {
        title: 'CSS Files',
        group: 'debug',
        component: CssFilesPanel,
        shortcut: 'Ctrl+Shift+S',
        defaultCollapsed: false,
        isVisible: true,
    });

    panelRegistry.register('dom-inspector', {
        title: 'DOM Inspector',
        group: 'debug',
        component: DomInspectorDebugPanel,
        defaultCollapsed: false,
        isVisible: true,
    });

    // --- Settings Panels ---

    panelRegistry.register('trees', {
        title: 'Trees',
        group: 'settings',
        component: TreesPanel,
        shortcut: 'Ctrl+Shift+R',
        defaultCollapsed: false,
        isVisible: true,
        metadata: {
            description: 'File tree and other hierarchical data views'
        }
    });

    console.log('All panels have been registered.');
} 