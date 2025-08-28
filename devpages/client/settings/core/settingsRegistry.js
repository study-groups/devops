/**
 * client/settings/core/settingsRegistry.js
 * Registry for settings panels - Inversion of Control container
 */

class SettingsRegistry {
    constructor() {
        this.panels = new Map();
        this.log = window.APP?.services?.log?.createLogger('SettingsRegistry') || console;
    }

    /**
     * Register a settings panel
     */
    register(config) {
        if (!config || !config.id) {
            this.log.warn('REGISTER', 'Invalid panel config:', config);
            return;
        }

        this.panels.set(config.id, {
            id: config.id,
            title: config.title || config.id,
            component: config.component,
            order: config.order || 50,
            defaultCollapsed: config.defaultCollapsed || false,
            ...config
        });

        this.log.info('REGISTER', `Registered panel: ${config.id}`);
    }

    /**
     * Unregister a panel
     */
    unregister(panelId) {
        const removed = this.panels.delete(panelId);
        if (removed) {
            this.log.info('UNREGISTER', `Unregistered panel: ${panelId}`);
        } else {
            this.log.warn('UNREGISTER', `Panel not found: ${panelId}`);
        }
        return removed;
    }

    /**
     * Get all registered panels
     */
    getPanels() {
        return Array.from(this.panels.values());
    }

    /**
     * Get a specific panel by ID
     */
    getPanel(panelId) {
        return this.panels.get(panelId);
    }

    /**
     * Get the count of registered panels
     */
    count() {
        return this.panels.size;
    }

    /**
     * Clear all panels
     */
    clear() {
        this.panels.clear();
        this.log.info('CLEAR', 'All panels cleared');
    }

    /**
     * Check if a panel is registered
     */
    has(panelId) {
        return this.panels.has(panelId);
    }
}

// Create singleton instance
export const settingsRegistry = new SettingsRegistry();

// Expose globally for debugging
if (typeof window !== 'undefined') {
    window.APP.services.settingsRegistry = settingsRegistry;
}