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
// Terrain.State - Shared state management for panels
// ============================================================================

Terrain.State = {
    org: 'tetra',
    env: 'local',
    user: '',
    _onEnvChange: null,

    /**
     * Initialize state from URL params
     */
    initFromUrl: function() {
        const params = new URLSearchParams(window.location.search);
        this.org = params.get('org') || 'tetra';
        this.env = params.get('env') || 'local';
        this.user = params.get('user') || '';
        return this;
    },

    /**
     * Update state from env-change message
     * Returns { envChanged, orgChanged, userChanged }
     */
    update: function(msg) {
        const changes = {
            envChanged: msg.env && msg.env !== this.env,
            orgChanged: msg.org && msg.org !== this.org,
            userChanged: msg.user !== undefined && msg.user !== this.user
        };

        if (msg.env) this.env = msg.env;
        if (msg.org) this.org = msg.org;
        if (msg.user !== undefined) this.user = msg.user || '';

        return changes;
    },

    /**
     * Build API URL with org/env/user params
     */
    apiUrl: function(endpoint) {
        const params = new URLSearchParams({ org: this.org, env: this.env });
        if (this.user) params.set('user', this.user);
        return `${endpoint}?${params}`;
    },

    /**
     * Register callback for env changes
     */
    onEnvChange: function(callback) {
        this._onEnvChange = callback;
        return this;
    },

    /**
     * Handle env-change message (called internally by Terrain.Iframe)
     */
    _handleEnvChange: function(msg) {
        const changes = this.update(msg);
        if (this._onEnvChange && (changes.envChanged || changes.orgChanged || changes.userChanged)) {
            this._onEnvChange(changes, msg);
        }
    }
};

// ============================================================================
// Terrain.Mode - Display mode detection and styling
// ============================================================================

Terrain.Mode = {
    // Modes: 'panel' (in grid), 'full-panel' (takeover), 'single-page' (standalone)
    current: 'panel',
    _callbacks: [],

    /**
     * Detect display mode based on context
     */
    detect: function() {
        const isIframe = window.parent !== window;
        if (!isIframe) {
            this.current = 'single-page';
        } else {
            // Default to panel, parent will notify if takeover
            this.current = 'panel';
        }
        this._apply();
        return this.current;
    },

    /**
     * Set mode (called by parent via message)
     */
    set: function(mode) {
        if (this.current === mode) return;
        const prev = this.current;
        this.current = mode;
        this._apply();
        this._callbacks.forEach(cb => cb(mode, prev));
    },

    /**
     * Register callback for mode changes
     */
    onChange: function(callback) {
        this._callbacks.push(callback);
        return this;
    },

    /**
     * Apply mode to document
     */
    _apply: function() {
        document.body.dataset.terrainMode = this.current;

        // Set CSS variables for mode-specific styling
        const root = document.documentElement;
        switch (this.current) {
            case 'single-page':
                root.style.setProperty('--terrain-padding', '2rem');
                root.style.setProperty('--terrain-max-width', '900px');
                root.style.setProperty('--terrain-font-scale', '1.1');
                break;
            case 'full-panel':
                root.style.setProperty('--terrain-padding', '1.5rem');
                root.style.setProperty('--terrain-max-width', 'none');
                root.style.setProperty('--terrain-font-scale', '1.05');
                break;
            default: // panel
                root.style.setProperty('--terrain-padding', '8px');
                root.style.setProperty('--terrain-max-width', 'none');
                root.style.setProperty('--terrain-font-scale', '1');
        }
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
     * @param {Object} opts - { name, onMessage, onReady, useSharedState }
     */
    init: function(opts) {
        this.initialized = true;
        opts = opts || {};
        this.name = opts.name || this._detectName();
        this.onMessage = opts.onMessage || function(){};
        this.onReady = opts.onReady || function(){};

        // Auto-initialize shared state from URL if enabled (default: true)
        if (opts.useSharedState !== false) {
            Terrain.State.initFromUrl();
        }

        // Detect display mode
        Terrain.Mode.detect();

        // Listen for messages and publish to Bus
        window.addEventListener('message', (e) => {
            if (e.data && typeof e.data === 'object') {
                // Handle token injection
                if (e.data.type === 'injectTokens' && e.data.tokens) {
                    Object.entries(e.data.tokens).forEach(([k, v]) => {
                        document.documentElement.style.setProperty('--' + k, v);
                    });
                }

                // Handle mode changes from parent
                if (e.data.type === 'mode-change' && e.data.mode) {
                    Terrain.Mode.set(e.data.mode);
                }

                // Auto-handle env-change via Terrain.State
                if (e.data.type === 'env-change' && opts.useSharedState !== false) {
                    Terrain.State._handleEnvChange(e.data);
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
