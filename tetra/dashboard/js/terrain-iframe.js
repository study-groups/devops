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
// Terrain.Mode - Extensible display mode system
// ============================================================================

Terrain.Mode = {
    current: 'panel',
    _callbacks: [],
    _modes: {},
    _autoDetect: {
        iframe: 'panel',      // Default when in iframe
        standalone: 'single-page'  // Default when standalone
    },

    /**
     * Define a display mode with CSS variables
     * @param {string} name - Mode name (e.g., 'panel', 'presentation')
     * @param {Object} vars - CSS variable values (without -- prefix)
     *
     * Example:
     *   Terrain.Mode.define('panel', { padding: '8px', maxWidth: 'none' });
     *   Terrain.Mode.define('presentation', { padding: '3rem', fontSize: '18px' });
     */
    define: function(name, vars) {
        this._modes[name] = vars;
        return this;
    },

    /**
     * Configure auto-detection defaults
     * @param {Object} opts - { iframe: 'mode', standalone: 'mode' }
     */
    autoDetect: function(opts) {
        if (opts.iframe) this._autoDetect.iframe = opts.iframe;
        if (opts.standalone) this._autoDetect.standalone = opts.standalone;
        return this;
    },

    /**
     * Detect display mode based on context
     */
    detect: function() {
        const isIframe = window.parent !== window;
        this.current = isIframe ? this._autoDetect.iframe : this._autoDetect.standalone;
        this._apply();
        return this.current;
    },

    /**
     * Set mode (called by parent via message or manually)
     */
    set: function(mode) {
        if (this.current === mode) return;
        if (!this._modes[mode]) {
            console.warn(`[Terrain.Mode] Unknown mode: ${mode}`);
            return;
        }
        const prev = this.current;
        this.current = mode;
        this._apply();
        this._callbacks.forEach(cb => cb(mode, prev));
    },

    /**
     * Get current mode's CSS variables
     */
    vars: function() {
        return this._modes[this.current] || {};
    },

    /**
     * Register callback for mode changes
     */
    onChange: function(callback) {
        this._callbacks.push(callback);
        return this;
    },

    /**
     * Apply current mode to document
     */
    _apply: function() {
        const mode = this._modes[this.current];
        if (!mode) return;

        document.body.dataset.terrainMode = this.current;

        // Apply all CSS variables from mode definition
        const root = document.documentElement;
        for (const [key, value] of Object.entries(mode)) {
            // Convert camelCase to kebab-case: fontSize -> font-size
            const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            root.style.setProperty(`--terrain-${cssVar}`, value);
        }
    }
};

// ============================================================================
// Default mode definitions - can be overridden before Terrain.Iframe.init()
// ============================================================================

Terrain.Mode
    .define('panel', {
        padding: '8px',
        maxWidth: 'none',
        fontScale: '1',
        headerHeight: '32px'
    })
    .define('full-panel', {
        padding: '1.5rem',
        maxWidth: 'none',
        fontScale: '1.05',
        headerHeight: '40px'
    })
    .define('single-page', {
        padding: '2rem',
        maxWidth: '900px',
        fontScale: '1.1',
        headerHeight: '48px'
    });

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

                // Handle font size changes - use zoom to scale all content
                // (setting body.fontSize doesn't work because most elements have explicit px sizes)
                if (e.data.type === 'set-font-size' && e.data.size) {
                    const baseSize = 12; // Standard base font size
                    const scale = e.data.size / baseSize;
                    document.body.style.zoom = scale;
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

// ============================================================================
// Terrain.Design - Design token viewer (?design=true)
// ============================================================================

Terrain.Design = {
    _panel: null,
    _fab: null,
    _styles: null,

    /**
     * Check if design mode is requested
     */
    isEnabled: function() {
        return new URLSearchParams(window.location.search).get('design') === 'true';
    },

    /**
     * Initialize design mode
     */
    init: function() {
        if (!this.isEnabled()) return;

        this._injectStyles();
        this._createFab();
        this._createPanel();

        // Auto-show panel
        setTimeout(() => this.show(), 100);

        console.log('[Terrain.Design] Initialized');
    },

    /**
     * Inject styles
     */
    _injectStyles: function() {
        if (this._styles) return;

        this._styles = document.createElement('style');
        this._styles.textContent = `
            .terrain-design-fab {
                position: fixed;
                bottom: 16px;
                right: 16px;
                width: 44px;
                height: 44px;
                background: var(--paper-mid, #2a2a2a);
                border: 2px solid var(--one, #ff6b6b);
                border-radius: 50%;
                cursor: pointer;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                transition: transform 0.15s;
            }
            .terrain-design-fab:hover { transform: scale(1.1); }
            .terrain-design-fab svg { color: var(--ink, #eee); width: 20px; height: 20px; }

            .terrain-design-panel {
                position: fixed;
                top: 16px;
                right: 16px;
                width: 320px;
                max-height: calc(100vh - 32px);
                background: var(--paper-dark, #1a1a1a);
                border: 2px solid var(--one, #ff6b6b);
                border-radius: 4px;
                z-index: 99998;
                display: none;
                flex-direction: column;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                font-family: system-ui, sans-serif;
            }
            .terrain-design-panel.visible { display: flex; }

            .terrain-design-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 14px;
                background: var(--paper-mid, #2a2a2a);
                border-bottom: 1px solid var(--border, #333);
            }
            .terrain-design-title {
                font-size: 11px;
                font-weight: 700;
                color: var(--one, #ff6b6b);
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .terrain-design-close {
                cursor: pointer;
                color: var(--ink-muted, #888);
                font-size: 18px;
                line-height: 1;
            }
            .terrain-design-close:hover { color: var(--one, #ff6b6b); }

            .terrain-design-content {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
            }
            .terrain-design-category {
                margin-bottom: 14px;
            }
            .terrain-design-category-title {
                font-size: 9px;
                font-weight: 700;
                color: var(--ink-muted, #888);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 6px;
                padding-bottom: 4px;
                border-bottom: 1px solid var(--border, #333);
            }
            .terrain-design-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 5px 8px;
                background: var(--paper-mid, #2a2a2a);
                border-radius: 3px;
                margin-bottom: 3px;
                cursor: pointer;
                transition: background 0.1s;
            }
            .terrain-design-row:hover { background: var(--paper-light, #3a3a3a); }
            .terrain-design-row.copied { background: var(--four, #4ecdc4); }
            .terrain-design-swatch {
                width: 18px;
                height: 18px;
                border: 1px solid var(--border, #333);
                border-radius: 2px;
                flex-shrink: 0;
            }
            .terrain-design-name {
                font-size: 10px;
                color: var(--ink, #eee);
                font-family: monospace;
            }
            .terrain-design-value {
                font-size: 9px;
                color: var(--ink-muted, #888);
                font-family: monospace;
                margin-left: auto;
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(this._styles);
    },

    /**
     * Create FAB button
     */
    _createFab: function() {
        this._fab = document.createElement('button');
        this._fab.className = 'terrain-design-fab';
        this._fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>`;
        this._fab.onclick = () => this.toggle();
        document.body.appendChild(this._fab);
    },

    /**
     * Create panel
     */
    _createPanel: function() {
        this._panel = document.createElement('div');
        this._panel.className = 'terrain-design-panel';
        this._panel.innerHTML = `
            <div class="terrain-design-header">
                <span class="terrain-design-title">Design Tokens</span>
                <span class="terrain-design-close">&times;</span>
            </div>
            <div class="terrain-design-content"></div>
        `;
        this._panel.querySelector('.terrain-design-close').onclick = () => this.hide();
        document.body.appendChild(this._panel);

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    },

    /**
     * Extract all CSS variables from document
     */
    _extractVars: function() {
        const vars = {};
        const computed = getComputedStyle(document.documentElement);

        // Try to get from stylesheets
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules || []) {
                    if (rule.selectorText === ':root' || rule.selectorText === 'html') {
                        for (const prop of rule.style) {
                            if (prop.startsWith('--')) {
                                vars[prop] = computed.getPropertyValue(prop).trim();
                            }
                        }
                    }
                }
            } catch (e) { /* cross-origin */ }
        }

        // Also check inline styles on :root
        const inlineStyle = document.documentElement.style;
        for (let i = 0; i < inlineStyle.length; i++) {
            const prop = inlineStyle[i];
            if (prop.startsWith('--')) {
                vars[prop] = computed.getPropertyValue(prop).trim();
            }
        }

        return vars;
    },

    /**
     * Categorize variables
     */
    _categorize: function(vars) {
        const categories = {
            'Colors': [],
            'Paper/Background': [],
            'Layout': [],
            'Typography': [],
            'Terrain Mode': [],
            'Other': []
        };

        for (const [name, value] of Object.entries(vars)) {
            if (/^--(one|two|three|four|ink|accent|error|success|warning)/.test(name)) {
                categories['Colors'].push([name, value]);
            } else if (/^--(paper|bg-|shade|border)/.test(name)) {
                categories['Paper/Background'].push([name, value]);
            } else if (/^--(gap|height|width|size|padding|margin)/.test(name)) {
                categories['Layout'].push([name, value]);
            } else if (/^--(font|text)/.test(name)) {
                categories['Typography'].push([name, value]);
            } else if (/^--terrain-/.test(name)) {
                categories['Terrain Mode'].push([name, value]);
            } else {
                categories['Other'].push([name, value]);
            }
        }

        return categories;
    },

    /**
     * Render tokens
     */
    _render: function() {
        const content = this._panel.querySelector('.terrain-design-content');
        const vars = this._extractVars();
        const categories = this._categorize(vars);

        let html = '';
        for (const [category, tokens] of Object.entries(categories)) {
            if (tokens.length === 0) continue;

            html += `<div class="terrain-design-category">
                <div class="terrain-design-category-title">${category} (${tokens.length})</div>`;

            for (const [name, value] of tokens) {
                const isColor = /^#|^rgb|^hsl/.test(value);
                const swatch = isColor ? `<div class="terrain-design-swatch" style="background:${value}"></div>` : '';
                html += `<div class="terrain-design-row" data-var="${name}">
                    ${swatch}
                    <span class="terrain-design-name">${name}</span>
                    <span class="terrain-design-value" title="${value}">${value}</span>
                </div>`;
            }
            html += '</div>';
        }

        content.innerHTML = html || '<div style="color:#888;padding:20px;text-align:center">No CSS variables found</div>';

        // Click to copy
        content.querySelectorAll('.terrain-design-row').forEach(row => {
            row.onclick = () => {
                navigator.clipboard.writeText(`var(${row.dataset.var})`);
                row.classList.add('copied');
                setTimeout(() => row.classList.remove('copied'), 400);
            };
        });
    },

    /**
     * Show panel
     */
    show: function() {
        if (!this._panel) return;
        this._render();
        this._panel.classList.add('visible');
    },

    /**
     * Hide panel
     */
    hide: function() {
        if (!this._panel) return;
        this._panel.classList.remove('visible');
    },

    /**
     * Toggle panel
     */
    toggle: function() {
        if (this._panel?.classList.contains('visible')) {
            this.hide();
        } else {
            this.show();
        }
    }
};

// ============================================================================
// Auto-initialize
// ============================================================================

// Auto-initialize on load (simple mode)
// Skipped if init() was already called manually with options
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!Terrain.Iframe.initialized) {
            Terrain.Iframe.init();
        }
        Terrain.Design.init();
    });
} else {
    // DOM already loaded
    setTimeout(() => {
        if (!Terrain.Iframe.initialized) {
            Terrain.Iframe.init();
        }
        Terrain.Design.init();
    }, 0);
}
