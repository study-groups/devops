/**
 * TERRAIN Core
 * Platform foundation for modular web applications
 */

window.TERRAIN = (function() {
    'use strict';

    const TERRAIN = {
        version: '1.0.0',
        modules: {},
        _initialized: false,

        // ================================================================
        // Module Registration
        // ================================================================

        /**
         * Register a module with TERRAIN
         * @param {string} name - Module name
         * @param {Object} module - Module object
         */
        register: function(name, module) {
            if (this.modules[name]) {
                console.warn(`[TERRAIN] Module '${name}' already registered`);
                return false;
            }

            this.modules[name] = module;
            this[name] = module;

            console.log(`[TERRAIN] Registered: ${name}`);
            this.Events.emit('terrain:module:register', { name, module });

            return true;
        },

        /**
         * Unregister a module
         * @param {string} name - Module name
         */
        unregister: function(name) {
            if (!this.modules[name]) return false;

            const module = this.modules[name];
            if (typeof module.destroy === 'function') {
                module.destroy();
            }

            delete this.modules[name];
            delete this[name];

            this.Events.emit('terrain:module:unregister', { name });
            return true;
        },

        /**
         * Get a registered module
         * @param {string} name - Module name
         */
        get: function(name) {
            return this.modules[name];
        },

        /**
         * Check if module is registered
         * @param {string} name - Module name
         */
        has: function(name) {
            return name in this.modules;
        },

        // ================================================================
        // Initialization
        // ================================================================

        /**
         * Initialize TERRAIN platform
         * @param {Object} options - Configuration options
         */
        init: function(options = {}) {
            if (this._initialized) {
                console.warn('[TERRAIN] Already initialized');
                return this;
            }

            // Apply options to Config
            if (options.config) {
                Object.assign(this.Config, options.config);
            }

            // Initialize Bridge
            this.Bridge.init();

            this._initialized = true;
            this.Events.emit('terrain:init');
            console.log('[TERRAIN] Initialized v' + this.version);

            return this;
        }
    };

    return TERRAIN;
})();
