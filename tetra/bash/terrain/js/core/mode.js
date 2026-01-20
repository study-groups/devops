/**
 * Terrain Mode Module
 * Unified behavioral configuration (replaces controldeck + skins)
 *
 * Mode controls:
 * - Canvas behavior (freerange/fixed, drag, pan, grid)
 * - Layout (type, dimensions)
 * - Features (what's enabled/disabled)
 * - UI visibility (buttons, panels)
 * - Discovery (how to find data)
 * - Card behavior (CLI, edit, status)
 * - Default theme
 */
(function() {
    'use strict';

    const TerrainMode = {
        config: null,
        modeName: null,
        themeName: null,

        /**
         * Default mode (freerange)
         */
        defaults: {
            mode: {
                name: 'Default',
                version: '1.0.0',
                description: 'Free-range infinite canvas'
            },
            defaultTheme: 'dark',
            canvas: {
                mode: 'freerange',
                drag: true,
                pan: true,
                grid: true
            },
            layout: {
                type: 'canvas',
                gap: '16px'
            },
            features: {
                designMode: false,
                toasts: true,
                persistence: true,
                fonts: true,
                nodes: true
            },
            header: {
                show: false,
                title: 'Terrain'
            },
            ui: {
                homeBtn: true,
                addBtn: true,
                fab: true,
                configPanel: true
            },
            toasts: {
                navigator: false,
                tokens: false,
                fonts: false,
                projects: false,
                storage: false
            },
            discovery: {
                type: 'static',
                source: 'data/defaults.json'
            },
            card: {
                showCli: false,
                showEdit: true,
                showStatus: true
            }
        },

        /**
         * Initialize mode module
         * @param {string} modePath - Path to mode JSON file
         * @param {string} themeName - Optional theme override
         */
        init: async function(modePath, themeName) {
            const path = modePath || 'freerange.mode.json';

            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error('Mode not found: ' + path);
                }
                this.config = await response.json();
                this.modeName = this.config.mode?.name || 'Unknown';
                console.log('[Terrain.Mode] Loaded:', this.modeName);

                // Determine theme: explicit > mode default > system default
                this.themeName = themeName || this.config.defaultTheme || 'dark';

                // Load theme CSS
                await this.loadTheme(this.themeName);

                return true;
            } catch (e) {
                console.log('[Terrain.Mode] Using defaults (freerange):', e.message);
                this.config = this.defaults;
                this.modeName = 'default';
                this.themeName = themeName || 'dark';
                await this.loadTheme(this.themeName);
                return false;
            }
        },

        /**
         * Load theme CSS file
         * @param {string} themeName - Theme identifier
         */
        loadTheme: async function(themeName) {
            const themePath = `dist/themes/${themeName}.theme.css`;

            return new Promise((resolve) => {
                // Remove existing theme
                const existing = document.getElementById('terrain-theme');
                if (existing) {
                    existing.remove();
                }

                const link = document.createElement('link');
                link.id = 'terrain-theme';
                link.rel = 'stylesheet';
                link.href = themePath;
                link.onload = () => {
                    console.log('[Terrain.Mode] Theme loaded:', themeName);
                    resolve(true);
                };
                link.onerror = () => {
                    console.warn('[Terrain.Mode] Theme not found:', themePath);
                    resolve(false);
                };
                document.head.appendChild(link);
            });
        },

        /**
         * Check if URL has a parameter
         */
        _hasUrlParam: function(name) {
            if (window.Terrain?.Utils?.hasUrlParam) {
                return window.Terrain.Utils.hasUrlParam(name);
            }
            return new URLSearchParams(window.location.search).has(name);
        },

        /**
         * Get URL parameter value
         */
        _getUrlParam: function(name) {
            if (window.Terrain?.Utils?.getUrlParam) {
                return window.Terrain.Utils.getUrlParam(name);
            }
            return new URLSearchParams(window.location.search).get(name);
        },

        /**
         * Apply mode settings to Terrain.Config
         * URL parameters always override mode settings
         */
        apply: function() {
            if (!this.config) return;

            const Config = window.Terrain.Config;
            if (!Config) {
                console.warn('[Terrain.Mode] Config not available');
                return;
            }

            // Apply canvas settings
            if (this.config.canvas) {
                Config.canvas = Config.canvas || {};
                Config.canvas.mode = this.config.canvas.mode || 'freerange';
                Config.canvas.drag = this.config.canvas.drag !== false;
                Config.canvas.pan = this.config.canvas.pan !== false;
            }

            // Apply feature flags (but don't override URL params)
            if (this.config.features) {
                Config.features = Config.features || {};
                for (const [key, value] of Object.entries(this.config.features)) {
                    // Skip designMode if URL param is set
                    if (key === 'designMode' && this._hasUrlParam('design')) {
                        continue;
                    }
                    Config.features[key] = value;
                }
            }

            // Apply UI visibility
            if (this.config.ui) {
                Config.ui = Config.ui || {};
                Object.assign(Config.ui, this.config.ui);
            }

            // Apply toast visibility
            if (this.config.toasts) {
                Config.toasts = this.config.toasts;
            }

            // Apply discovery config
            if (this.config.discovery) {
                Config.discovery = this.config.discovery;
            }

            // Apply card config
            if (this.config.card) {
                Config.card = Config.card || {};
                Config.set('card.showCli', this.config.card.showCli ?? false);
                Config.set('card.showEdit', this.config.card.showEdit ?? true);
                Config.set('card.showStatus', this.config.card.showStatus ?? true);
            }

            // Emit event
            if (window.Terrain.Events) {
                window.Terrain.Events.emit(window.Terrain.Events.MODE_APPLIED, {
                    mode: this.modeName,
                    theme: this.themeName,
                    config: this.config
                });
            }

            console.log('[Terrain.Mode] Applied:', this.modeName, 'with theme:', this.themeName);
        },

        // =====================================================================
        // Query Methods
        // =====================================================================

        /**
         * Get canvas mode
         * @returns {string} 'freerange' or 'fixed'
         */
        getCanvasMode: function() {
            return this.config?.canvas?.mode || 'freerange';
        },

        /**
         * Check if canvas is draggable
         */
        isDraggable: function() {
            return this.config?.canvas?.drag !== false;
        },

        /**
         * Check if canvas is pannable
         */
        isPannable: function() {
            return this.config?.canvas?.pan !== false;
        },

        /**
         * Check if grid is enabled
         */
        hasGrid: function() {
            return this.config?.canvas?.grid !== false;
        },

        /**
         * Check if a feature is enabled
         */
        isFeatureEnabled: function(feature) {
            return this.config?.features?.[feature] !== false;
        },

        /**
         * Check if a toast should be visible
         */
        isToastVisible: function(toast) {
            return this.config?.toasts?.[toast] === true;
        },

        /**
         * Get layout type
         */
        getLayoutType: function() {
            return this.config?.layout?.type || 'canvas';
        },

        /**
         * Get header configuration
         */
        getHeader: function() {
            return this.config?.header || { show: false, title: 'Terrain' };
        },

        /**
         * Get discovery configuration
         */
        getDiscovery: function() {
            return this.config?.discovery || {
                type: 'static',
                source: 'data/defaults.json'
            };
        },

        /**
         * Get card configuration
         */
        getCard: function() {
            return this.config?.card || {
                showCli: false,
                showEdit: true,
                showStatus: true
            };
        },

        /**
         * Get raw config object
         */
        getConfig: function() {
            return this.config;
        },

        /**
         * Get mode name
         */
        getName: function() {
            return this.modeName;
        },

        /**
         * Get theme name
         */
        getTheme: function() {
            return this.themeName;
        },

        /**
         * Switch theme at runtime
         * Delegates to TERRAIN.CSS if available
         */
        switchTheme: async function(themeName) {
            this.themeName = themeName;

            // Use TERRAIN.CSS if available (preferred API)
            if (window.TERRAIN?.CSS?.theme?.load) {
                await TERRAIN.CSS.theme.load(themeName);
            } else {
                await this.loadTheme(themeName);
            }

            if (window.Terrain.Events) {
                window.Terrain.Events.emit(window.Terrain.Events.THEME_CHANGED, {
                    theme: themeName
                });
            }
        },

        // =====================================================================
        // Mode Compatibility API
        // =====================================================================

        /**
         * Mode compatibility data (lazy loaded)
         */
        _compatibility: null,
        _coreModes: ['freerange', 'control', 'deploy', 'dashboard'],

        /**
         * Load mode compatibility data
         */
        loadCompatibility: async function() {
            if (this._compatibility) return this._compatibility;

            try {
                const response = await fetch('data/mode-compatibility.json');
                if (response.ok) {
                    this._compatibility = await response.json();
                    console.log('[Terrain.Mode] Compatibility data loaded');
                }
            } catch (e) {
                console.warn('[Terrain.Mode] Could not load compatibility data:', e.message);
            }

            if (!this._compatibility) {
                this._compatibility = { transitions: {} };
            }

            return this._compatibility;
        },

        /**
         * Get compatibility info for a mode transition
         * @param {string} fromMode - Source mode
         * @param {string} toMode - Target mode
         * @returns {Object|null} Transition info or null if not defined
         */
        getCompatibility: async function(fromMode, toMode) {
            await this.loadCompatibility();

            if (!this._compatibility?.transitions?.[fromMode]?.[toMode]) {
                // Check if non-core mode
                if (!this._coreModes.includes(fromMode) || !this._coreModes.includes(toMode)) {
                    return { compatibility: 'unmapped', message: 'Transition not yet defined' };
                }
                return null;
            }

            return this._compatibility.transitions[fromMode][toMode];
        },

        /**
         * Alias for getCompatibility
         */
        getTransitionInfo: async function(fromMode, toMode) {
            return this.getCompatibility(fromMode, toMode);
        },

        /**
         * Get all available modes
         */
        getAvailableModes: function() {
            return ['freerange', 'control', 'deploy', 'dashboard', 'site', 'thesis', 'guide', 'reference'];
        },

        /**
         * Get core modes (those with defined transitions)
         */
        getCoreModes: function() {
            return this._coreModes;
        },

        /**
         * Switch mode at runtime with transition handling
         * @param {string} targetMode - Mode to switch to
         * @param {Object} options - { force: boolean, preserveTheme: boolean }
         */
        switchMode: async function(targetMode, options = {}) {
            const fromMode = this.modeName?.toLowerCase() || 'freerange';

            // Emit transition start event
            if (window.Terrain.Events) {
                window.Terrain.Events.emit('MODE_TRANSITION_START', {
                    from: fromMode,
                    to: targetMode
                });
            }

            // Load new mode config
            const modePath = `dist/modes/${targetMode}.mode.json`;
            const success = await this.init(modePath, options.preserveTheme ? this.themeName : null);

            // Apply to Config
            this.apply();

            // Emit transition complete event
            if (window.Terrain.Events) {
                window.Terrain.Events.emit('MODE_TRANSITION_COMPLETE', {
                    from: fromMode,
                    to: targetMode,
                    success: success
                });
            }

            return success;
        }
    };

    // Export to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Mode = TerrainMode;

    // Backwards compatibility aliases
    window.Terrain.ControlDeck = TerrainMode;
    window.Terrain.Skins = {
        init: async () => {}, // No-op, mode.js handles this now
        getCurrentName: () => TerrainMode.getName(),
        getCurrent: () => TerrainMode.getConfig(),
        getCardConfig: () => TerrainMode.getCard(),
        getDiscoveryConfig: () => TerrainMode.getDiscovery()
    };

})();
