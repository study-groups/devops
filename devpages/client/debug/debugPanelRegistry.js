/**
 * client/debug/debugPanelRegistry.js
 * A central registry for all debug panels.
 */

class DebugPanelRegistry {
    constructor() {
        this.panels = new Map();
    }

    register(panelConfig) {
        if (!panelConfig || !panelConfig.id) {
            console.error('Debug panel registration requires an id.', panelConfig);
            return;
        }
        if (this.panels.has(panelConfig.id)) {
            console.warn(`Debug panel with id "${panelConfig.id}" is already registered.`);
            return;
        }
        this.panels.set(panelConfig.id, panelConfig);
    }

    getPanel(id) {
        return this.panels.get(id);
    }

    getPanels() {
        return Array.from(this.panels.values());
    }
}

export const debugPanelRegistry = new DebugPanelRegistry(); 