/**
 * @file client/panels/corePanelInitializer.js
 * @description Initializes and registers all core panels for the application.
 */

import { panelRegistry } from './panelRegistry.js';

export function initializeCorePanels() {
    console.log('[CorePanelInitializer] Starting core panel registration...');

    const corePanels = [
        {
            id: 'code-panel',
            title: 'Code Editor',
            group: 'core',
            factory: () => import('./CodePanel.js'),
            isDefault: true,
        },
        {
            id: 'context-panel',
            title: 'Context Browser',
            group: 'core',
            factory: () => import('./ContextPanel.js'),
            isDefault: true,
        },
        {
            id: 'file-tree-panel',
            title: 'File Tree',
            group: 'core',
            factory: () => import('./FileTreePanel.js'),
            isDefault: false,
        },
        {
            id: 'html-panel',
            title: 'HTML Viewer',
            group: 'core',
            factory: () => import('./HtmlPanel.js'),
            isDefault: false,
        },
        {
            id: 'javascript-panel',
            title: 'JavaScript Console',
            group: 'core',
            factory: () => import('./JavaScriptPanel.js'),
            isDefault: false,
        }
    ];

    corePanels.forEach(panel => {
        panelRegistry.register(panel);
    });

    console.log(`[CorePanelInitializer] Core panels registered: ${corePanels.length}`);
}
