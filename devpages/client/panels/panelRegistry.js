/**
 * @deprecated The panel registry is being replaced by a unified component system in bootloader.js.
 * This file is now a temporary, static list of panel definitions that will be consumed by the bootloader.
 */
export const panelDefinitions = [
    {
        name: 'FileBrowser',
        id: 'file-browser',
        factory: () => import('./FileBrowserPanel.js').then(m => m.FileBrowserPanel),
        title: 'File Browser',
        isDefault: true,
        allowedZones: ['left', 'right'],
        defaultZone: 'left',
    },
    {
        name: 'CodePanel',
        id: 'code',
        factory: () => import('./CodePanel.js').then(m => m.CodePanel),
        title: 'Code Editor',
        isDefault: true,
        allowedZones: ['main'],
        defaultZone: 'main',
    },
    {
        name: 'PreviewPanel',
        id: 'preview',
        factory: () => import('./PreviewPanel.js').then(m => m.PreviewPanel),
        title: 'Preview',
        isDefault: true,
        allowedZones: ['main'],
        defaultZone: 'main',
    },
    {
        name: 'LogPanel',
        id: 'log',
        factory: () => import('../log/LogPanel.js').then(m => m.LogPanel),
        title: 'Console Log',
        isDefault: false,
        allowedZones: ['bottom'],
        defaultZone: 'bottom',
    },
    {
        name: 'DomInspectorPanel',
        id: 'dom-inspector',
        factory: () => import('../dom-inspector/DomInspectorPanel.js').then(m => m.DomInspectorPanel),
        title: 'DOM Inspector',
        isDefault: false,
        allowedZones: ['left', 'right', 'bottom'],
    },
]; 