/**
 * @deprecated The panel registry is being replaced by a unified component system in bootloader.js.
 * This file is now a temporary, static list of panel definitions that will be consumed by the bootloader.
 */

// Panel registry object for backward compatibility
class PanelRegistry {
    constructor() {
        this.panels = new Map();
    }

    register(config) {
        if (!config || !config.id) {
            console.warn('[PanelRegistry] register() called with invalid config:', config);
            return;
        }
        
        this.panels.set(config.id, config);
        console.log(`[PanelRegistry] Registered panel: ${config.id}`);
    }

    unregister(panelId) {
        if (!panelId) {
            console.warn('[PanelRegistry] unregister() called with invalid panelId:', panelId);
            return;
        }
        
        const removed = this.panels.delete(panelId);
        if (removed) {
            console.log(`[PanelRegistry] Unregistered panel: ${panelId}`);
        } else {
            console.warn(`[PanelRegistry] Panel not found for unregister: ${panelId}`);
        }
    }

    getPanels() {
        return Array.from(this.panels.values());
    }

    getPanel(panelId) {
        return this.panels.get(panelId);
    }

    clear() {
        this.panels.clear();
    }
}

export const panelRegistry = new PanelRegistry();

export const panelDefinitions = [
    {
        name: 'FileBrowser',
        id: 'file-browser',
        factory: () => import('/client/file-browser/FileBrowserPanel.js').then(m => m.FileBrowserPanel),
        title: 'File Browser',
        isDefault: true,
        defaultZone: 'left',
    },
    {
        name: 'CodePanel',
        id: 'code',
        factory: () => import('./CodePanel.js').then(m => m.CodePanel),
        title: 'Code Editor',
        isDefault: true,
        defaultZone: 'main',
    },
    {
        name: 'PreviewPanel',
        id: 'preview',
        factory: () => import('./PreviewPanel.js').then(m => m.PreviewPanel),
        title: 'Preview',
        isDefault: true,
        defaultZone: 'main',
    },
    {
        name: 'LogPanel',
        id: 'log',
        factory: () => import('/client/log/LogPanel.js').then(m => m.LogPanel),
        title: 'Console Log',
        isDefault: false,
        defaultZone: 'bottom',
    },
    {
        name: 'NlpPanel',
        id: 'nlp-panel',
        factory: () => import('./NlpPanel.js').then(m => m.NlpPanel),
        title: 'NLP',
        isDefault: false,
        defaultZone: 'bottom',
    },
    {
        name: 'SettingsPanel',
        id: 'settings-panel',
        factory: () => import('/client/settings/panels/css-design/DesignTokensPanel.js').then(m => m.DesignTokensPanel),
        title: 'Design Tokens',
        isDefault: false,
        defaultZone: 'right',
    },

]; 