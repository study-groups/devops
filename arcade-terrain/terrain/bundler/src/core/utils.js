/**
 * TERRAIN Utils
 * Shared utility functions
 */

(function(TERRAIN) {
    'use strict';

    const Utils = {
        /**
         * Get value from nested object by dot-notation path
         * @param {Object} obj - Source object
         * @param {string} path - Dot-notation path
         * @param {*} defaultValue - Default if not found
         */
        getByPath: function(obj, path, defaultValue) {
            const keys = path.split('.');
            let result = obj;
            for (const key of keys) {
                if (result == null || typeof result !== 'object') {
                    return defaultValue;
                }
                result = result[key];
            }
            return result !== undefined ? result : defaultValue;
        },

        /**
         * Set value in nested object by dot-notation path
         * @param {Object} obj - Target object
         * @param {string} path - Dot-notation path
         * @param {*} value - Value to set
         */
        setByPath: function(obj, path, value) {
            const keys = path.split('.');
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in current) || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            current[keys[keys.length - 1]] = value;
        },

        /**
         * Deep clone an object
         * @param {Object} obj - Object to clone
         */
        deepClone: function(obj) {
            return JSON.parse(JSON.stringify(obj));
        },

        /**
         * Generate a unique ID
         * @param {string} prefix - Optional prefix
         */
        uniqueId: function(prefix = 'id') {
            return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        },

        /**
         * Debounce a function
         * @param {Function} fn - Function to debounce
         * @param {number} delay - Delay in ms
         */
        debounce: function(fn, delay) {
            let timer = null;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        },

        /**
         * Throttle a function
         * @param {Function} fn - Function to throttle
         * @param {number} limit - Minimum time between calls
         */
        throttle: function(fn, limit) {
            let inThrottle = false;
            return function(...args) {
                if (!inThrottle) {
                    fn.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        /**
         * Escape HTML to prevent XSS
         * @param {string} text - Text to escape
         */
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        },

        // =====================================================================
        // URL Parameter Utilities
        // =====================================================================

        _urlParams: null,

        /**
         * Get URLSearchParams (cached)
         */
        getUrlParams: function() {
            if (!this._urlParams) {
                this._urlParams = new URLSearchParams(window.location.search);
            }
            return this._urlParams;
        },

        /**
         * Get a URL parameter value
         * @param {string} name - Parameter name
         * @param {string} defaultValue - Default if not found
         */
        getUrlParam: function(name, defaultValue = null) {
            const value = this.getUrlParams().get(name);
            return value !== null ? value : defaultValue;
        },

        /**
         * Get URL parameter as boolean
         * @param {string} name - Parameter name
         * @param {boolean} defaultValue - Default if not found
         */
        getUrlParamBool: function(name, defaultValue = false) {
            const value = this.getUrlParams().get(name);
            if (value === null) return defaultValue;
            return value === 'true' || value === '1' || value === '';
        },

        /**
         * Check if URL has a parameter
         * @param {string} name - Parameter name
         */
        hasUrlParam: function(name) {
            return this.getUrlParams().has(name);
        }
    };

    TERRAIN.Utils = Utils;

})(window.TERRAIN);
