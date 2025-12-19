/**
 * TERRAIN Bridge Module
 * Unifies window.TERRAIN and window.Terrain namespaces
 * Adds cross-iframe communication via TERRAIN.Bridge
 *
 * Load AFTER core Terrain modules (config, events, state, utils)
 */
(function() {
    'use strict';

    // Ensure Terrain namespace exists
    window.Terrain = window.Terrain || {};

    // Create TERRAIN as the platform layer, aliasing Terrain
    window.TERRAIN = window.Terrain;

    // Add version info
    TERRAIN.version = TERRAIN.version || '1.0.0';
    TERRAIN.modules = TERRAIN.modules || {};

    // =========================================================================
    // Module Registration
    // =========================================================================

    /**
     * Register a module with TERRAIN
     * @param {string} name - Module name
     * @param {Object} module - Module object
     */
    TERRAIN.register = function(name, module) {
        if (this.modules[name]) {
            console.warn(`[TERRAIN] Module '${name}' already registered`);
            return false;
        }

        this.modules[name] = module;
        this[name] = module;

        console.log(`[TERRAIN] Registered: ${name}`);
        if (this.Events) {
            this.Events.emit('terrain:module:register', { name, module });
        }

        return true;
    };

    /**
     * Get a registered module
     * @param {string} name - Module name
     */
    TERRAIN.get = function(name) {
        return this.modules[name];
    };

    /**
     * Check if module is registered
     * @param {string} name - Module name
     */
    TERRAIN.has = function(name) {
        return name in this.modules;
    };

    // =========================================================================
    // Cross-Iframe Bridge
    // =========================================================================

    const TerrainBridge = {
        _handlers: new Map(),
        _iframes: new Set(),
        _initialized: false,
        _origin: '*',

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
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            }

            this._initialized = true;
            console.log('[TERRAIN.Bridge] Initialized');
        },

        /**
         * Send message to specific iframe
         * @param {Window|HTMLIFrameElement} target - Target window or iframe
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
         * Handle incoming message
         */
        _onMessage: function(e) {
            if (e.data?.source !== 'terrain') return;

            const { type, payload } = e.data;

            // Emit to Terrain events if available
            if (TERRAIN.Events) {
                TERRAIN.Events.emit('bridge:message', {
                    type,
                    payload,
                    origin: e.origin,
                    source: e.source
                });
            }

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
         * Check if running in iframe
         */
        isInIframe: function() {
            return window.parent !== window;
        },

        /**
         * Get registered iframe count
         */
        getIframeCount: function() {
            return this._iframes.size;
        }
    };

    // Attach Bridge to TERRAIN
    TERRAIN.Bridge = TerrainBridge;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TerrainBridge.init());
    } else {
        TerrainBridge.init();
    }

    console.log('[TERRAIN] Platform bridge initialized');

})();
