/**
 * TERRAIN Bridge Module
 * Unifies window.TERRAIN and window.Terrain namespaces
 * Adds cross-iframe communication via TERRAIN.Bridge
 *
 * Load AFTER core Terrain modules (config, events, state, utils)
 */
(function() {
    'use strict';

    // Compact ISO 8601 timestamp with millisecond precision
    // Format: YYYYMMDDTHHMMSS.mmmZ (e.g., 20260113T143245.123Z)
    function compactISO() {
        const d = new Date();
        const pad = (n, w = 2) => String(n).padStart(w, '0');
        return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
               `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}` +
               `.${pad(d.getUTCMilliseconds(), 3)}Z`;
    }

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
        _registry: new Map(),  // id -> { source, nodeIndex, node, ready, registeredAt }
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
                timestamp: Date.now(),
                ts: compactISO()
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
                timestamp: Date.now(),
                ts: compactISO()
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
        },

        // =====================================================================
        // Iframe Registry (merged from IframeManager)
        // =====================================================================

        /**
         * Handle incoming iframe message (registration, etc.)
         */
        handleMessage: function(event) {
            const data = event.data;
            const source = event.source;

            // Find which iframe sent this message
            let senderIndex = null;
            document.querySelectorAll('.node-iframe').forEach((iframe) => {
                if (iframe.contentWindow === source) {
                    const card = iframe.closest('.terrain-node');
                    senderIndex = parseInt(card?.dataset.index);
                }
            });

            // Handle registration
            if (data.type === 'ready') {
                const node = senderIndex !== null && TERRAIN.State ?
                    TERRAIN.State.nodes.get(senderIndex) : null;
                const id = data.from || (node ? node.id : 'unknown-' + Date.now());

                this._registry.set(id, {
                    source: source,
                    nodeIndex: senderIndex,
                    node: node,
                    ready: true,
                    registeredAt: Date.now()
                });

                console.log('[TERRAIN.Bridge] Iframe registered:', id);

                // Update CLI targets
                if (TERRAIN.CLI) {
                    TERRAIN.CLI.updateTargets(senderIndex);
                }

                // Inject tokens when iframe is ready
                if (senderIndex !== null) {
                    const card = document.querySelector(`[data-index="${senderIndex}"]`);
                    const iframe = card?.querySelector('.node-iframe');
                    if (iframe) {
                        this.injectTokens(iframe);
                    }
                    if (TERRAIN.CLI) {
                        TERRAIN.CLI.updateStatus(senderIndex, 'active', 'connected: ' + id);
                    }
                }
            }

            // Log to CLI if node is expanded
            if (senderIndex !== null && TERRAIN.CLI) {
                TERRAIN.CLI.log(senderIndex, 'in', data);
            }
        },

        /**
         * Get list of registered iframe IDs
         */
        getTargets: function() {
            return Array.from(this._registry.keys());
        },

        /**
         * Get registry entry by ID
         */
        getTarget: function(id) {
            return this._registry.get(id);
        },

        /**
         * Send message to a node's iframe by index
         */
        sendToNode: function(index, data) {
            const card = document.querySelector(`[data-index="${index}"]`);
            const iframe = card?.querySelector('.node-iframe');
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(data, '*');
                return true;
            }
            return false;
        },

        /**
         * Send message to a specific target by ID
         */
        sendToTarget: function(targetId, data) {
            const entry = this._registry.get(targetId);
            if (entry && entry.source) {
                entry.source.postMessage(data, '*');
                return true;
            }
            return false;
        },

        /**
         * Extract CSS tokens from document
         */
        extractTokens: function() {
            const style = getComputedStyle(document.documentElement);
            const tokenNames = [
                'bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-hover',
                'border', 'border-visible', 'border-active',
                'text-primary', 'text-secondary', 'text-muted', 'text-code',
                'accent-primary', 'accent-secondary', 'success', 'error', 'warning',
                'font-primary', 'font-secondary', 'font-code',
                'curve-sm', 'curve-md', 'curve-lg',
                'gap-xs', 'gap-sm', 'gap-md', 'gap-lg', 'gap-xl',
                'tempo-fast', 'tempo-normal', 'tempo-slow'
            ];

            const tokens = {};
            tokenNames.forEach(name => {
                const value = style.getPropertyValue('--' + name).trim();
                if (value) tokens[name] = value;
            });
            return tokens;
        },

        /**
         * Inject CSS tokens into an iframe
         */
        injectTokens: function(iframe) {
            if (!iframe?.contentWindow) return;
            const tokens = this.extractTokens();
            iframe.contentWindow.postMessage({
                type: 'injectTokens',
                tokens: tokens
            }, '*');
            console.log('[TERRAIN.Bridge] Injected tokens:', Object.keys(tokens).length);
        },

        /**
         * Inject tokens to all registered iframes
         */
        refreshAllTokens: function() {
            const tokens = this.extractTokens();
            this._registry.forEach((entry) => {
                if (entry.source) {
                    entry.source.postMessage({
                        type: 'injectTokens',
                        tokens: tokens
                    }, '*');
                }
            });
        },

        /**
         * Unregister an iframe
         */
        unregister: function(id) {
            this._registry.delete(id);
        },

        /**
         * Clear all registrations
         */
        clearRegistry: function() {
            this._registry.clear();
        }
    };

    // Attach Bridge to TERRAIN
    TERRAIN.Bridge = TerrainBridge;

    // Expose timestamp utility
    TERRAIN.compactISO = compactISO;

    // Backwards compat: IframeManager now uses Bridge
    TERRAIN.IframeManager = {
        handleMessage: (e) => TerrainBridge.handleMessage(e),
        getTargets: () => TerrainBridge.getTargets(),
        get: (id) => TerrainBridge.getTarget(id),
        sendToNode: (i, d) => TerrainBridge.sendToNode(i, d),
        sendToTarget: (t, d) => TerrainBridge.sendToTarget(t, d),
        broadcast: (d) => TerrainBridge.broadcast('iframe:message', d),
        extractTokens: () => TerrainBridge.extractTokens(),
        injectTokens: (f) => TerrainBridge.injectTokens(f),
        refreshAllTokens: () => TerrainBridge.refreshAllTokens(),
        unregister: (id) => TerrainBridge.unregister(id),
        clear: () => TerrainBridge.clearRegistry()
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TerrainBridge.init());
    } else {
        TerrainBridge.init();
    }

    console.log('[TERRAIN] Platform bridge initialized');

})();
