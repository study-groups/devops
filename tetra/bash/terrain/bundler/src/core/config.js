/**
 * TERRAIN Config
 * Runtime configuration management
 */

(function(TERRAIN) {
    'use strict';

    const Config = {
        // Feature flags
        features: {
            designMode: false,
            debug: false
        },

        // Data paths
        data: {
            defaultsPath: 'data/defaults.json'
        },

        // UI settings
        ui: {
            animations: true,
            toastDuration: 3000
        },

        /**
         * Get a config value by path
         * @param {string} path - Dot-notation path
         * @param {*} defaultValue - Default if not found
         */
        get: function(path, defaultValue) {
            return TERRAIN.Utils.getByPath(this, path, defaultValue);
        },

        /**
         * Set a config value by path
         * @param {string} path - Dot-notation path
         * @param {*} value - Value to set
         */
        set: function(path, value) {
            TERRAIN.Utils.setByPath(this, path, value);
            TERRAIN.Events.emit('config:change', { path, value });
        },

        /**
         * Merge configuration object
         * @param {Object} obj - Config to merge
         */
        merge: function(obj) {
            this._deepMerge(this, obj);
            TERRAIN.Events.emit('config:change', { path: '*' });
        },

        /**
         * Deep merge helper
         */
        _deepMerge: function(target, source) {
            for (const key of Object.keys(source)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    this._deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
            return target;
        }
    };

    TERRAIN.Config = Config;

})(window.TERRAIN);
