/**
 * PanelStateManager.js - Lightweight state manager for panel UI state
 *
 * Manages panel-specific UI state (position, size, preferences) with
 * localStorage persistence. Does NOT use Redux - this is for UI state only.
 *
 * Use cases:
 * - Panel positions and sizes
 * - Collapsed sections
 * - Filter preferences
 * - Inspector selections
 * - Any UI state that should survive page refresh
 *
 * NOT for:
 * - Global app state (use Redux)
 * - Transient state (use local component state)
 * - Cross-panel shared state (use PanelEventBus)
 */

export class PanelStateManager {
    constructor() {
        this.panels = new Map();
        this.storageKey = 'devpages-panel-state-v1';
        this.loadAll();

        console.log('[PanelStateManager] Initialized with', this.panels.size, 'saved panels');
    }

    /**
     * Register a panel and restore its saved state
     * @param {string} id - Panel ID
     * @param {Object} initialState - Initial/default state
     * @returns {Object} Current state (saved or initial)
     */
    registerPanel(id, initialState = {}) {
        if (!id) {
            console.error('[PanelStateManager] Panel ID is required');
            return initialState;
        }

        // Check if we have saved state
        if (this.panels.has(id)) {
            const savedState = this.panels.get(id);
            // Merge saved state with initial state (initial state provides defaults)
            const mergedState = { ...initialState, ...savedState };
            this.panels.set(id, mergedState);
            console.log(`[PanelStateManager] Restored state for panel "${id}"`, mergedState);
            return mergedState;
        }

        // No saved state, use initial
        this.panels.set(id, initialState);
        console.log(`[PanelStateManager] Registered new panel "${id}"`, initialState);
        return initialState;
    }

    /**
     * Update panel state (partial update)
     * @param {string} id - Panel ID
     * @param {Object} updates - State updates (will be merged)
     * @returns {Object} New complete state
     */
    updatePanel(id, updates) {
        if (!id) {
            console.error('[PanelStateManager] Panel ID is required');
            return null;
        }

        const current = this.panels.get(id) || {};
        const newState = { ...current, ...updates };
        this.panels.set(id, newState);

        // Persist to localStorage
        this.persist(id);

        console.log(`[PanelStateManager] Updated panel "${id}"`, updates);
        return newState;
    }

    /**
     * Get panel state
     * @param {string} id - Panel ID
     * @returns {Object|null} Panel state or null if not found
     */
    getPanel(id) {
        return this.panels.get(id) || null;
    }

    /**
     * Get specific property from panel state
     * @param {string} id - Panel ID
     * @param {string} key - Property key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Property value
     */
    getPanelProperty(id, key, defaultValue = null) {
        const state = this.panels.get(id);
        if (!state) return defaultValue;
        return state[key] !== undefined ? state[key] : defaultValue;
    }

    /**
     * Set specific property in panel state
     * @param {string} id - Panel ID
     * @param {string} key - Property key
     * @param {*} value - Property value
     */
    setPanelProperty(id, key, value) {
        this.updatePanel(id, { [key]: value });
    }

    /**
     * Check if panel has saved state
     * @param {string} id - Panel ID
     * @returns {boolean}
     */
    hasPanel(id) {
        return this.panels.has(id);
    }

    /**
     * Unregister a panel and optionally remove saved state
     * @param {string} id - Panel ID
     * @param {boolean} removeSaved - If true, remove from localStorage
     */
    unregisterPanel(id, removeSaved = false) {
        this.panels.delete(id);

        if (removeSaved) {
            this.removePersisted(id);
        }

        console.log(`[PanelStateManager] Unregistered panel "${id}" (removeSaved: ${removeSaved})`);
    }

    /**
     * Persist single panel to localStorage
     * @private
     * @param {string} id - Panel ID
     */
    persist(id) {
        const state = this.panels.get(id);
        if (!state) return;

        try {
            const stored = this.loadStorage();
            stored[id] = {
                ...state,
                lastUpdated: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(stored));
        } catch (error) {
            console.error('[PanelStateManager] Failed to persist state:', error);
        }
    }

    /**
     * Load all panel states from localStorage
     * @private
     */
    loadAll() {
        const stored = this.loadStorage();
        Object.entries(stored).forEach(([id, state]) => {
            // Remove lastUpdated metadata
            const { lastUpdated, ...cleanState } = state;
            this.panels.set(id, cleanState);
        });
    }

    /**
     * Load storage data
     * @private
     * @returns {Object} Stored panel states
     */
    loadStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('[PanelStateManager] Failed to load storage:', error);
            return {};
        }
    }

    /**
     * Remove persisted state for a panel
     * @private
     * @param {string} id - Panel ID
     */
    removePersisted(id) {
        try {
            const stored = this.loadStorage();
            delete stored[id];
            localStorage.setItem(this.storageKey, JSON.stringify(stored));
        } catch (error) {
            console.error('[PanelStateManager] Failed to remove persisted state:', error);
        }
    }

    /**
     * Export all panel states (for backup)
     * @returns {Object} Export data
     */
    export() {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            panels: Object.fromEntries(this.panels)
        };
    }

    /**
     * Import panel states (from backup)
     * @param {Object} data - Export data
     * @returns {boolean} Success
     */
    import(data) {
        if (!data || data.version !== '1.0') {
            console.error('[PanelStateManager] Invalid import data or version mismatch');
            return false;
        }

        try {
            this.panels = new Map(Object.entries(data.panels));
            localStorage.setItem(this.storageKey, JSON.stringify(data.panels));
            console.log('[PanelStateManager] Imported', this.panels.size, 'panel states');
            return true;
        } catch (error) {
            console.error('[PanelStateManager] Import failed:', error);
            return false;
        }
    }

    /**
     * Clear all panel states
     * @param {boolean} clearStorage - Also clear localStorage
     */
    clearAll(clearStorage = false) {
        this.panels.clear();

        if (clearStorage) {
            try {
                localStorage.removeItem(this.storageKey);
            } catch (error) {
                console.error('[PanelStateManager] Failed to clear storage:', error);
            }
        }

        console.log('[PanelStateManager] Cleared all panel states');
    }

    /**
     * Get all registered panel IDs
     * @returns {string[]} Array of panel IDs
     */
    getPanelIds() {
        return Array.from(this.panels.keys());
    }

    /**
     * Get statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const stored = this.loadStorage();
        return {
            registeredPanels: this.panels.size,
            persistedPanels: Object.keys(stored).length,
            storageSize: this._getStorageSize()
        };
    }

    /**
     * Get approximate storage size in bytes
     * @private
     * @returns {number} Size in bytes
     */
    _getStorageSize() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? new Blob([data]).size : 0;
        } catch (error) {
            return 0;
        }
    }
}

// Create singleton instance
export const panelStateManager = new PanelStateManager();

// Register in window.APP
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.services = window.APP.services || {};
    window.APP.services.panelStateManager = panelStateManager;

    console.log('[PanelStateManager] Registered at window.APP.services.panelStateManager');
}
