/**
 * Redux-compatible Panel Registry
 * Manages panel definitions and provides registration/lookup functionality
 */

class PanelRegistry {
    constructor() {
        this.panels = new Map();
        this.initializeCorePanels();
    }

    /**
     * Register a panel definition
     */
    register(panelDef) {
        if (!panelDef.id || !panelDef.factory) {
            throw new Error('Panel must have id and factory');
        }
        this.panels.set(panelDef.id, panelDef);
        console.log(`[PanelRegistry] Registered panel: ${panelDef.id}`);
    }

    /**
     * Get panel definition by ID
     */
    getPanel(id) {
        return this.panels.get(id);
    }

    /**
     * Get all panel definitions
     */
    getAllPanels() {
        return Array.from(this.panels.values());
    }

    /**
     * Get panels for a specific zone
     */
    getPanelsForZone(zone) {
        return this.getAllPanels().filter(panel => 
            !panel.allowedZones || panel.allowedZones.includes(zone)
        );
    }

    /**
     * Initialize core panels that should always be available
     */
    initializeCorePanels() {
        // Core editing panels
        this.register({
            name: 'CodePanel',
            id: 'code-panel',
            factory: () => import('./CodePanel.js').then(m => m.CodePanel),
            title: 'Code Editor',
            icon: 'code',
            isDefault: true,
            allowedZones: ['main', 'sidebar'],
            defaultZone: 'main',
        });

        // Editor and Preview are now Views, not Panels
        // They are managed directly by WorkspaceManager as core workspace areas

        // Context and navigation panels
        this.register({
            name: 'ContextPanel',
            id: 'context-panel',
            factory: () => import('./ContextPanel.js').then(m => m.ContextPanel),
            title: 'Context Browser',
            icon: 'folder',
            isDefault: true,
            allowedZones: ['sidebar'],
            defaultZone: 'sidebar',
        });

        this.register({
            name: 'FileTreePanel',
            id: 'file-tree-panel',
            factory: () => import('./FileTreePanel.js').then(m => m.FileTreePanel),
            title: 'File Tree',
            icon: 'folder-tree',
            isDefault: false,
            allowedZones: ['sidebar'],
            defaultZone: 'sidebar',
        });

        // Publishing and deployment - temporarily disabled until file exists
        // this.register({
        //     name: 'PublishSettingsPanel',
        //     id: 'publish-settings-panel',
        //     factory: () => import('../settings/panels/publish/PublishSettingsPanel.js').then(m => m.PublishSettingsPanel),
        //     title: 'Digital Ocean Publishing',
        //     icon: 'upload-cloud',
        //     isDefault: false,
        //     allowedZones: ['sidebar'],
        //     defaultZone: 'sidebar',
        // });

        // Development panels
        this.register({
            name: 'HtmlPanel',
            id: 'html-panel',
            factory: () => import('./HtmlPanel.js').then(m => m.HtmlPanel),
            title: 'HTML Viewer',
            icon: 'code-2',
            isDefault: false,
            allowedZones: ['main', 'sidebar'],
            defaultZone: 'main',
        });

        this.register({
            name: 'JavaScriptPanel',
            id: 'javascript-panel',
            factory: () => import('./JavaScriptPanel.js').then(m => m.JavaScriptPanel),
            title: 'JavaScript Console',
            icon: 'terminal',
            isDefault: false,
            allowedZones: ['main', 'sidebar'],
            defaultZone: 'sidebar',
        });

        // Debug panels are registered separately by debugPanelInitializer.js
        // to avoid conflicts and ensure proper initialization

        console.log(`[PanelRegistry] Initialized ${this.panels.size} core panels`);
    }
}

// Create singleton instance
const panelRegistry = new PanelRegistry();

// Export both the instance and the definitions for compatibility
export { panelRegistry };
export const panelDefinitions = panelRegistry.getAllPanels(); 