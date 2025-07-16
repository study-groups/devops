/**
 * @file client/panels/core/panelRegistry.js
 * @description A central registry for all UI panels in the application.
 * This module provides a single place to register, unregister, and retrieve panels.
 * It ensures that panels are managed consistently across the application.
 * @exports panelRegistry
 */

class PanelRegistry {
    constructor() {
        if (PanelRegistry.instance) {
            return PanelRegistry.instance;
        }
        this.panels = new Map();
        PanelRegistry.instance = this;
    }

    /**
     * Registers a panel.
     * @param {string} id - The unique identifier for the panel.
     * @param {object} config - The panel configuration object.
     */
    register(id, config) {
        if (this.panels.has(id)) {
            console.warn(`Panel with id "${id}" is already registered.`);
            return;
        }
        this.panels.set(id, { id, ...config });
        console.log(`Panel registered: ${id}`);
    }

    /**
     * Unregisters a panel.
     * @param {string} id - The ID of the panel to unregister.
     */
    unregister(id) {
        if (!this.panels.has(id)) {
            console.warn(`Panel with id "${id}" not found.`);
            return;
        }
        this.panels.delete(id);
        console.log(`Panel unregistered: ${id}`);
    }

    /**
     * Retrieves a panel configuration.
     * @param {string} id - The ID of the panel to retrieve.
     * @returns {object|undefined} The panel configuration object or undefined if not found.
     */
    getPanel(id) {
        return this.panels.get(id);
    }

    /**
     * Retrieves all registered panels.
     * @returns {object[]} An array of all panel configuration objects.
     */
    getAllPanels() {
        return Array.from(this.panels.values());
    }
}

export const panelRegistry = new PanelRegistry(); 