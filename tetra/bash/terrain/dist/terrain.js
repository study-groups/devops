// === /Users/mricos/src/devops/tetra/bash/terrain/bundler/src/core/terrain.js ===
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


// === /Users/mricos/src/devops/tetra/bash/terrain/bundler/src/core/events.js ===
/**
 * TERRAIN Events
 * Pub/sub event bus for decoupled module communication
 */

(function(TERRAIN) {
    'use strict';

    const listeners = new Map();

    const Events = {
        /**
         * Subscribe to an event
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         * @returns {Function} Unsubscribe function
         */
        on: function(event, callback) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event).add(callback);

            // Return unsubscribe function
            return () => this.off(event, callback);
        },

        /**
         * Subscribe once
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         */
        once: function(event, callback) {
            const wrapper = (data) => {
                this.off(event, wrapper);
                callback(data);
            };
            return this.on(event, wrapper);
        },

        /**
         * Emit an event
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        emit: function(event, data) {
            const handlers = listeners.get(event);
            if (handlers) {
                handlers.forEach(callback => {
                    try {
                        callback(data);
                    } catch (e) {
                        console.error(`[TERRAIN.Events] Error in '${event}' handler:`, e);
                    }
                });
            }

            // Wildcard handlers
            const wildcards = listeners.get('*');
            if (wildcards) {
                wildcards.forEach(callback => {
                    try {
                        callback(event, data);
                    } catch (e) {
                        console.error(`[TERRAIN.Events] Error in wildcard handler:`, e);
                    }
                });
            }
        },

        /**
         * Unsubscribe from an event
         * @param {string} event - Event name
         * @param {Function} callback - Handler to remove (optional - removes all if not provided)
         */
        off: function(event, callback) {
            if (!callback) {
                listeners.delete(event);
            } else {
                const handlers = listeners.get(event);
                if (handlers) {
                    handlers.delete(callback);
                    if (handlers.size === 0) {
                        listeners.delete(event);
                    }
                }
            }
        },

        /**
         * Clear all listeners
         */
        clear: function() {
            listeners.clear();
        },

        /**
         * Get listener count for event
         * @param {string} event - Event name
         */
        listenerCount: function(event) {
            return listeners.get(event)?.size || 0;
        }
    };

    // Standard event names
    Events.EVENTS = {
        // Platform lifecycle
        INIT: 'terrain:init',
        READY: 'terrain:ready',
        DESTROY: 'terrain:destroy',

        // Module lifecycle
        MODULE_REGISTER: 'terrain:module:register',
        MODULE_UNREGISTER: 'terrain:module:unregister',

        // State
        STATE_CHANGE: 'state:change',

        // Bridge
        BRIDGE_MESSAGE: 'bridge:message'
    };

    TERRAIN.Events = Events;

})(window.TERRAIN);


// === /Users/mricos/src/devops/tetra/bash/terrain/bundler/src/core/config.js ===
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


// === /Users/mricos/src/devops/tetra/bash/terrain/bundler/src/core/utils.js ===
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


// === /Users/mricos/src/devops/tetra/bash/terrain/bundler/src/core/state.js ===
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


// === /Users/mricos/src/devops/tetra/bash/terrain/bundler/src/core/bridge.js ===
/**
 * TERRAIN Bridge
 * Cross-iframe communication system
 */

(function(TERRAIN) {
    'use strict';

    const Bridge = {
        _handlers: new Map(),
        _iframes: new Set(),
        _initialized: false,
        _origin: '*',  // Configure for production

        /**
         * Initialize bridge
         */
        init: function() {
            if (this._initialized) return;

            window.addEventListener('message', this._onMessage.bind(this));
            this._discoverIframes();

            // Re-discover iframes when DOM changes
            if (typeof MutationObserver !== 'undefined') {
                const observer = new MutationObserver(() => {
                    this._discoverIframes();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }

            this._initialized = true;
            console.log('[TERRAIN.Bridge] Initialized');
        },

        /**
         * Send message to specific iframe
         * @param {Window|HTMLIFrameElement} target - Target window or iframe element
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        send: function(target, event, data) {
            const targetWindow = target.contentWindow || target;
            const message = {
                type: event,
                payload: data,
                source: 'terrain',
                timestamp: Date.now()
            };
            targetWindow.postMessage(message, this._origin);
        },

        /**
         * Broadcast to parent and all child iframes
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        broadcast: function(event, data) {
            const message = {
                type: event,
                payload: data,
                source: 'terrain',
                timestamp: Date.now()
            };

            // Send to parent (if we're in an iframe)
            if (window.parent !== window) {
                window.parent.postMessage(message, this._origin);
            }

            // Send to all child iframes
            this._iframes.forEach(iframe => {
                try {
                    iframe.contentWindow?.postMessage(message, this._origin);
                } catch (e) {
                    // Cross-origin iframe, ignore
                }
            });

            // Dispatch locally
            this._dispatch(event, data);
        },

        /**
         * Subscribe to bridge events
         * @param {string} event - Event name (* for all)
         * @param {Function} handler - Handler function
         * @returns {Function} Unsubscribe function
         */
        on: function(event, handler) {
            if (!this._handlers.has(event)) {
                this._handlers.set(event, new Set());
            }
            this._handlers.get(event).add(handler);

            return () => this.off(event, handler);
        },

        /**
         * Unsubscribe from bridge events
         * @param {string} event - Event name
         * @param {Function} handler - Handler to remove
         */
        off: function(event, handler) {
            const handlers = this._handlers.get(event);
            if (handlers) {
                if (handler) {
                    handlers.delete(handler);
                    if (handlers.size === 0) {
                        this._handlers.delete(event);
                    }
                } else {
                    this._handlers.delete(event);
                }
            }
        },

        /**
         * Request-response pattern
         * @param {Window|HTMLIFrameElement} target - Target window
         * @param {string} event - Event name
         * @param {*} data - Request data
         * @param {number} timeout - Timeout in ms
         * @returns {Promise} Response promise
         */
        request: function(target, event, data, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const requestId = TERRAIN.Utils.uniqueId('req');

                const timer = setTimeout(() => {
                    this.off(`${event}:response:${requestId}`, handler);
                    reject(new Error(`Bridge request timeout: ${event}`));
                }, timeout);

                const handler = (response) => {
                    clearTimeout(timer);
                    resolve(response);
                };

                this.on(`${event}:response:${requestId}`, handler);
                this.send(target, event, { ...data, _requestId: requestId });
            });
        },

        /**
         * Respond to a request
         * @param {string} event - Original event name
         * @param {string} requestId - Request ID from payload._requestId
         * @param {*} data - Response data
         */
        respond: function(event, requestId, data) {
            this.broadcast(`${event}:response:${requestId}`, data);
        },

        /**
         * Handle incoming message
         */
        _onMessage: function(e) {
            // Only handle terrain messages
            if (e.data?.source !== 'terrain') return;

            const { type, payload } = e.data;

            // Emit to TERRAIN events
            TERRAIN.Events.emit(TERRAIN.Events.EVENTS.BRIDGE_MESSAGE, {
                type,
                payload,
                origin: e.origin,
                source: e.source
            });

            // Dispatch to bridge handlers
            this._dispatch(type, payload, e);
        },

        /**
         * Dispatch to handlers
         */
        _dispatch: function(event, data, originalEvent = null) {
            // Specific event handlers
            const handlers = this._handlers.get(event);
            if (handlers) {
                handlers.forEach(h => {
                    try {
                        h(data, originalEvent);
                    } catch (e) {
                        console.error(`[TERRAIN.Bridge] Error in '${event}' handler:`, e);
                    }
                });
            }

            // Wildcard handlers
            const wildcards = this._handlers.get('*');
            if (wildcards) {
                wildcards.forEach(h => {
                    try {
                        h(event, data, originalEvent);
                    } catch (e) {
                        console.error('[TERRAIN.Bridge] Error in wildcard handler:', e);
                    }
                });
            }
        },

        /**
         * Discover iframes in document
         */
        _discoverIframes: function() {
            const iframes = document.querySelectorAll('iframe');
            this._iframes.clear();
            iframes.forEach(iframe => {
                this._iframes.add(iframe);
            });
        },

        /**
         * Get registered iframe count
         */
        getIframeCount: function() {
            return this._iframes.size;
        },

        /**
         * Check if running in iframe
         */
        isInIframe: function() {
            return window.parent !== window;
        }
    };

    TERRAIN.Bridge = Bridge;

})(window.TERRAIN);
