/**
 * @deprecated The panel registry is being replaced by a new system.
 * This file is a temporary compatibility layer.
 * Do not add new panels here.
 *
 * It is being replaced by a new system where panels are defined in a single
 * `panel-definitions.js` file and registered dynamically.
 *
 * For now, it provides a centralized place to register and retrieve panel
 * definitions. It avoids the complexities of the old class-based system.
 */

const panels = new Map();

export const panelRegistry = {
    /**
     * @param {object} panelDef - The panel definition object.
     */
    register: (panelDef) => {
        if (!panelDef.id || !panelDef.factory) {
            throw new Error('Panel definition must have an `id` and a `factory` function.');
        }
        if (panels.has(panelDef.id)) {
            console.warn(`[PanelRegistry] Overwriting panel with duplicate ID: ${panelDef.id}`);
        }
        panels.set(panelDef.id, panelDef);
    },

    /**
     * @param {string} id - The ID of the panel to retrieve.
     * @returns {object|undefined} The panel definition.
     */
    getPanel: (id) => {
        return panels.get(id);
    },

    /**
     * @returns {Array<object>} A list of all registered panel definitions.
     */
    getAllPanels: () => {
        return Array.from(panels.values());
    },

    /**
     * Clears all registered panels.
     * Useful for testing or hot-reloading scenarios.
     */
    clear: () => {
        panels.clear();
    }
};

// Default export for convenience
export default panelRegistry; 