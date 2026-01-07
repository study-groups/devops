/**
 * Terrain Persistence Module
 * localStorage save/load functionality
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;

    const STORAGE_KEY = 'terrain-settings';

    const TerrainPersistence = {
        /**
         * Initialize persistence module
         */
        init: function() {
            // Auto-save on page unload
            window.addEventListener('beforeunload', () => this.save());

            // Save on state changes (debounced)
            let saveTimeout = null;
            Events.on(Events.STATE_CHANGE, () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => this.save(), 500);
            });
        },

        /**
         * Save current state to localStorage
         */
        save: function() {
            try {
                const state = State.getAll();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                console.log('[Persistence] State saved');
                Events.emit(Events.STATE_SAVED, state);
            } catch (e) {
                console.error('[Persistence] Save failed:', e);
            }
        },

        /**
         * Load state from localStorage
         */
        load: function() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) {
                    console.log('[Persistence] No saved state found');
                    return false;
                }

                const state = JSON.parse(saved);
                State.replaceAll(state);
                console.log('[Persistence] State loaded');
                return true;
            } catch (e) {
                console.error('[Persistence] Load failed:', e);
                return false;
            }
        },

        /**
         * Clear all saved state
         */
        clear: function() {
            localStorage.removeItem(STORAGE_KEY);
            console.log('[Persistence] State cleared');
        },

        /**
         * Reset to defaults
         */
        resetToDefaults: function() {
            localStorage.clear();
            sessionStorage.clear();
            State.reset();
            console.log('[Persistence] Reset to defaults');

            // Reload page
            window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
        },

        /**
         * Export state as JSON
         */
        exportJSON: function() {
            return JSON.stringify(State.getAll(), null, 2);
        },

        /**
         * Import state from JSON
         */
        importJSON: function(jsonString) {
            try {
                const state = JSON.parse(jsonString);
                State.replaceAll(state);
                this.save();
                return true;
            } catch (e) {
                console.error('[Persistence] Import failed:', e);
                return false;
            }
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Persistence = TerrainPersistence;

})();
