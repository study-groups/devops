/**
 * TERRAIN State
 * Centralized state management
 */

(function(TERRAIN) {
    'use strict';

    const _state = {};

    const State = {
        /**
         * Get state value by path
         * @param {string} path - Dot-notation path
         * @param {*} defaultValue - Default if not found
         */
        get: function(path, defaultValue) {
            if (!path) return TERRAIN.Utils.deepClone(_state);
            return TERRAIN.Utils.getByPath(_state, path, defaultValue);
        },

        /**
         * Set state value by path
         * @param {string} path - Dot-notation path
         * @param {*} value - Value to set
         * @param {Object} options - { silent: boolean }
         */
        set: function(path, value, options = {}) {
            const oldValue = this.get(path);
            TERRAIN.Utils.setByPath(_state, path, value);

            if (!options.silent) {
                TERRAIN.Events.emit(TERRAIN.Events.EVENTS.STATE_CHANGE, {
                    path,
                    value,
                    oldValue
                });
            }
        },

        /**
         * Merge object into state
         * @param {string} path - Dot-notation path (or null for root)
         * @param {Object} obj - Object to merge
         * @param {Object} options - { silent: boolean }
         */
        merge: function(path, obj, options = {}) {
            const target = path ? this.get(path, {}) : _state;
            const merged = Object.assign(target, obj);

            if (path) {
                this.set(path, merged, options);
            } else if (!options.silent) {
                TERRAIN.Events.emit(TERRAIN.Events.EVENTS.STATE_CHANGE, {
                    path: '*',
                    value: _state
                });
            }
        },

        /**
         * Delete state value
         * @param {string} path - Dot-notation path
         */
        delete: function(path) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const parent = keys.length ? this.get(keys.join('.')) : _state;

            if (parent && typeof parent === 'object') {
                delete parent[lastKey];
                TERRAIN.Events.emit(TERRAIN.Events.EVENTS.STATE_CHANGE, {
                    path,
                    value: undefined,
                    deleted: true
                });
            }
        },

        /**
         * Check if path exists
         * @param {string} path - Dot-notation path
         */
        has: function(path) {
            return this.get(path) !== undefined;
        },

        /**
         * Clear all state
         */
        clear: function() {
            Object.keys(_state).forEach(key => delete _state[key]);
            TERRAIN.Events.emit(TERRAIN.Events.EVENTS.STATE_CHANGE, {
                path: '*',
                value: {},
                cleared: true
            });
        },

        /**
         * Export state as JSON
         */
        toJSON: function() {
            return JSON.stringify(_state);
        },

        /**
         * Import state from JSON
         * @param {string} json - JSON string
         */
        fromJSON: function(json) {
            const data = JSON.parse(json);
            this.clear();
            Object.assign(_state, data);
            TERRAIN.Events.emit(TERRAIN.Events.EVENTS.STATE_CHANGE, {
                path: '*',
                value: _state,
                imported: true
            });
        }
    };

    TERRAIN.State = State;

})(window.TERRAIN);
