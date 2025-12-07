/**
 * Terrain Utils Module
 * Shared utility functions
 */
(function() {
    'use strict';

    const TerrainUtils = {
        /**
         * Escape HTML to prevent XSS
         * @param {string} text - Text to escape
         * @returns {string} Escaped HTML
         */
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        },

        /**
         * Format bytes to human readable string
         * @param {number} bytes - Byte count
         * @returns {string} Formatted string (e.g., "1.5 KB")
         */
        formatBytes: function(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },

        /**
         * Debounce a function
         * @param {Function} fn - Function to debounce
         * @param {number} delay - Delay in ms
         * @returns {Function} Debounced function
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
         * @param {number} limit - Minimum time between calls in ms
         * @returns {Function} Throttled function
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
         * Generate a unique ID
         * @param {string} prefix - Optional prefix
         * @returns {string} Unique ID
         */
        uniqueId: function(prefix) {
            return (prefix || 'id') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * Deep clone an object
         * @param {Object} obj - Object to clone
         * @returns {Object} Cloned object
         */
        deepClone: function(obj) {
            return JSON.parse(JSON.stringify(obj));
        },

        /**
         * Get value from nested object by dot-notation path
         * @param {Object} obj - Source object
         * @param {string} path - Dot-notation path
         * @param {*} defaultValue - Default if not found
         * @returns {*} Value at path
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
        }
    };

    // Export to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Utils = TerrainUtils;

})();
