/**
 * Terrain - Shared communication protocol for dashboard panels
 *
 * Terrain.Bus - Pub/sub message bus (works in both parent and iframe)
 *   Terrain.Bus.subscribe('*', handler)     // Subscribe to all messages
 *   Terrain.Bus.subscribe('ready', handler) // Subscribe to specific type
 *   Terrain.Bus.publish({ type, ... })      // Publish message
 *
 * Terrain.Iframe - Iframe-specific helpers
 *   Terrain.Iframe.init({ name, onMessage })
 *   Terrain.Iframe.send(msg)
 *   Terrain.Iframe.on('action', handler)    // DOM event delegation
 */

window.Terrain = window.Terrain || {};

// ============================================================================
// Terrain.Bus - Universal pub/sub message bus
// ============================================================================

Terrain.Bus = {
    _subs: { '*': [] },
    _isParent: window.parent === window,
    _panels: null,  // Set by parent via configure()

    /**
     * Subscribe to messages by topic ('*' = all messages)
     * Returns unsubscribe function
     */
    subscribe: function(topic, handler) {
        if (!this._subs[topic]) this._subs[topic] = [];
        this._subs[topic].push(handler);
        return () => {
            this._subs[topic] = this._subs[topic].filter(h => h !== handler);
        };
    },

    /**
     * Publish a message - notifies local subscribers
     * In parent mode: also routes to iframes
     * In iframe mode: also sends to parent
     */
    publish: function(msg) {
        // Notify local subscribers
        this._notify(msg);

        // Cross-window communication
        if (this._isParent && this._panels) {
            // Parent: broadcast to all iframes
            this._panels.forEach(panel => {
                const iframe = panel.querySelector('iframe');
                if (iframe?.contentWindow) {
                    iframe.contentWindow.postMessage(msg, '*');
                }
            });
        } else if (!this._isParent) {
            // Iframe: send to parent
            window.parent.postMessage(msg, '*');
        }
    },

    /**
     * Notify local subscribers only (no cross-window)
     */
    _notify: function(msg) {
        const topic = msg.type || '*';
        // Topic-specific subscribers
        (this._subs[topic] || []).forEach(h => h(msg));
        // Wildcard subscribers (skip if topic is already *)
        if (topic !== '*') {
            this._subs['*'].forEach(h => h(msg));
        }
    },

    /**
     * Route to specific panel (parent only)
     */
    route: function(panel, msg) {
        if (!this._isParent) return;
        const iframe = panel.querySelector('iframe');
        const target = panel.dataset?.view || 'unknown';
        if (!iframe?.contentWindow) return;

        const routedMsg = { ...msg, _to: target };
        iframe.contentWindow.postMessage(routedMsg, '*');

        // Notify local subscribers about this routing
        this._notify({ ...msg, _from: 'parent', _to: target });
    },

    /**
     * Broadcast to all panels except source (parent only)
     */
    broadcast: function(msg, excludeSource = null) {
        if (!this._isParent || !this._panels) return;
        this._panels.forEach(panel => {
            const iframe = panel.querySelector('iframe');
            if (iframe?.contentWindow && iframe.contentWindow !== excludeSource) {
                this.route(panel, msg);
            }
        });
    },

    /**
     * Configure for parent mode
     */
    configure: function(opts) {
        if (opts.panels) this._panels = opts.panels;
        return this;
    }
};

// ============================================================================
// Terrain.Iframe - Iframe-specific helpers
// ============================================================================

Terrain.Iframe = {
    ready: false,
    initialized: false,
    name: null,
    onMessage: null,
    onReady: null,
    _actions: {},

    /**
     * Send message to parent window
     */
    send: function(data) {
        if (window.parent !== window) {
            window.parent.postMessage(data, '*');
        }
    },

    /**
     * Register action handler for data-action elements
     * @param {string} action - Action name (matches data-action="name")
     * @param {function} handler - Handler function(element, dataset)
     */
    on: function(action, handler) {
        this._actions[action] = handler;
        return this;
    },

    /**
     * Handle delegated events
     * @private
     */
    _handleAction: function(e, eventType) {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;
        const handler = this._actions[action];

        if (handler) {
            e.preventDefault();
            handler(el, el.dataset, e);
        }
    },

    /**
     * Initialize with options
     * @param {Object} opts - { name, onMessage, onReady }
     */
    init: function(opts) {
        this.initialized = true;
        opts = opts || {};
        this.name = opts.name || this._detectName();
        this.onMessage = opts.onMessage || function(){};
        this.onReady = opts.onReady || function(){};

        // Listen for messages and publish to Bus
        window.addEventListener('message', (e) => {
            if (e.data && typeof e.data === 'object') {
                // Handle token injection
                if (e.data.type === 'injectTokens' && e.data.tokens) {
                    Object.entries(e.data.tokens).forEach(([k, v]) => {
                        document.documentElement.style.setProperty('--' + k, v);
                    });
                }
                // Publish to Bus (notifies all subscribers)
                Terrain.Bus._notify(e.data);

                // Also call legacy onMessage callback
                if (this.onMessage) {
                    this.onMessage(e.data);
                }
            }
        });

        // Setup delegated DOM event listeners
        document.addEventListener('click', (e) => this._handleAction(e));
        document.addEventListener('change', (e) => this._handleAction(e));

        // Set ready when DOM is complete
        if (document.readyState === 'complete') {
            this._setReady();
        } else {
            window.addEventListener('load', () => this._setReady());
        }

        return this;
    },

    /**
     * Detect iframe name from title or filename
     */
    _detectName: function() {
        // Try document title
        if (document.title) {
            return document.title.toLowerCase();
        }
        // Try filename from URL
        const path = window.location.pathname;
        const match = path.match(/([^/]+)\.iframe\.html$/);
        if (match) {
            return match[1];
        }
        return 'iframe';
    },

    /**
     * Mark as ready and notify parent
     */
    _setReady: function() {
        if (this.ready) return;
        this.ready = true;

        if (this.onReady) {
            this.onReady();
        }

        this.send({ type: 'ready', from: this.name });
    }
};

// Auto-initialize on load (simple mode)
// Skipped if init() was already called manually with options
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!Terrain.Iframe.initialized) {
            Terrain.Iframe.init();
        }
    });
} else {
    // DOM already loaded
    setTimeout(() => {
        if (!Terrain.Iframe.initialized) {
            Terrain.Iframe.init();
        }
    }, 0);
}
