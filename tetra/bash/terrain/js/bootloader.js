/**
 * Terrain Bootloader
 * Coordinates module loading and application initialization
 */
(function() {
    'use strict';

    // Ensure Terrain namespace exists
    window.Terrain = window.Terrain || {};

    // Mode configuration
    const MODE_CONFIG = {
        basePath: 'dist/modes/',
        defaultPath: 'terrain.mode.json',
        extension: '.mode.json'
    };

    // Parse URL parameter for mode
    function getModePath() {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (mode) {
            // Support shorthand (e.g., ?mode=contained) or full path
            if (mode.includes('/') || mode.includes('.json')) {
                return mode;
            }
            return MODE_CONFIG.basePath + mode + MODE_CONFIG.extension;
        }
        return MODE_CONFIG.defaultPath;
    }

    const Bootloader = {
        loaded: [],
        startTime: Date.now(),
        modePath: getModePath(),
        modeConfig: MODE_CONFIG,

        /**
         * Log with timestamp
         */
        log: function(msg) {
            const elapsed = Date.now() - this.startTime;
            console.log(`[Terrain ${elapsed}ms] ${msg}`);
        },

        /**
         * Load a script dynamically
         */
        loadScript: function(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    this.loaded.push(src);
                    resolve();
                };
                script.onerror = () => reject(new Error(`Failed to load: ${src}`));
                document.head.appendChild(script);
            });
        },

        /**
         * Load a CSS file dynamically
         */
        loadCSS: function(href) {
            return new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.onload = resolve;
                document.head.appendChild(link);
                // CSS loading doesn't block, resolve immediately
                resolve();
            });
        },

        /**
         * Load default data
         */
        loadDefaults: async function() {
            try {
                const response = await fetch(Terrain.Config.data.defaultsPath);
                if (response.ok) {
                    return await response.json();
                }
            } catch (e) {
                this.log('Could not load defaults, using embedded fallback');
            }
            // Fallback defaults
            return {
                nodes: [
                    { id: 'terrain', title: 'Terrain', desc: 'Create spaces.', link: '/projects/index.html', status: 'draft', x: 101, y: 155 },
                    { id: 'synthetic-iris', title: 'Synthetic Iris', desc: 'Generative plant genetics', link: './synthetic-iris/index.html', status: 'draft', x: 102, y: 352 }
                ]
            };
        },

        /**
         * Initialize modules after loading
         * Uses registry pattern - modules register themselves via TERRAIN.register()
         */
        initModules: function() {
            // Phase 1: Initialize platform modules (TERRAIN.CSS, TERRAIN.UI) first
            const platformModules = ['CSS', 'UI'];
            platformModules.forEach(name => {
                this._initModule(name, TERRAIN[name]);
            });

            // Phase 2: Initialize registered modules from TERRAIN.modules registry
            if (TERRAIN.modules) {
                Object.keys(TERRAIN.modules).forEach(name => {
                    // Skip already initialized platform modules
                    if (platformModules.includes(name)) return;
                    this._initModule(name, TERRAIN.modules[name]);
                });
            }

            // Phase 3: Fallback - initialize well-known modules directly from Terrain namespace
            // This provides backwards compatibility for modules not yet using TERRAIN.register()
            const legacyModules = ['Canvas', 'Grid', 'Nodes', 'Toasts', 'Persistence', 'ConfigPanel', 'Popups'];
            legacyModules.forEach(name => {
                // Only init if not already done via registry and module exists
                if (Terrain[name] && !TERRAIN.modules?.[name] && typeof Terrain[name].init === 'function') {
                    this._initModule(name, Terrain[name]);
                }
            });

            // URL ?design=true always wins (even after Persistence.load may have overwritten)
            if (Terrain.Utils.getUrlParamBool('design')) {
                Terrain.Config.features.designMode = true;
            }
        },

        /**
         * Initialize a single module with error boundary
         * @param {string} name - Module name
         * @param {Object} module - Module object
         */
        _initModule: function(name, module) {
            if (!module || typeof module.init !== 'function') return;

            try {
                this.log(`Initializing ${name}`);
                module.init();
                module._initialized = true;
            } catch (error) {
                console.error(`[Terrain] Failed to initialize ${name}:`, error);
                module._initError = error;
                // Continue with other modules - don't let one failure break everything
            }
        },

        /**
         * Hide loading overlay
         */
        hideLoading: function() {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.add('fade-out');
                setTimeout(() => overlay.remove(), 400);
            }
        },

        /**
         * Main boot sequence
         */
        boot: async function() {
            this.log('Boot sequence starting...');

            try {
                // Phase 1: Core modules are already loaded inline
                this.log('Core modules loaded (config, events, state)');

                // Phase 1.5: Load utils and mode
                await Promise.all([
                    this.loadScript('js/core/utils.js'),
                    this.loadScript('js/core/mode.js')
                ]);
                this.log('Utils and Mode modules loaded');

                // Phase 1.6: Load TERRAIN bridge (unifies TERRAIN/Terrain namespaces)
                await this.loadScript('js/core/terrain-bridge.js');
                this.log('TERRAIN bridge loaded');

                // Phase 1.62: Load TERRAIN.CSS and TERRAIN.UI
                await Promise.all([
                    this.loadScript('js/core/terrain-css.js'),
                    this.loadScript('js/core/terrain-ui.js')
                ]);
                this.log('TERRAIN.CSS and TERRAIN.UI loaded');

                // Phase 1.65: Load CardBase (shared card functionality)
                await this.loadScript('js/core/card-base.js');
                this.log('CardBase loaded');

                // Phase 1.7: Initialize and apply mode
                if (Terrain.Mode) {
                    await Terrain.Mode.init(this.modePath);
                    Terrain.Mode.apply();
                    this.log('Mode applied: ' + Terrain.Mode.getName());
                }

                // Phase 2: Load CSS (theme handled by Mode.init)
                const themePath = Terrain.Mode?.getConfig()?.theme
                    ? `dist/themes/${Terrain.Mode.getConfig().theme}.css`
                    : 'css/tokens.css';
                await Promise.all([
                    this.loadCSS(themePath),
                    this.loadCSS('css/core.css'),
                    this.loadCSS('css/terrain-ui.css'),
                    this.loadCSS('css/components/nodes.css'),
                    this.loadCSS('css/components/toasts.css'),
                    this.loadCSS('css/components/panels.css')
                ]);
                this.log('CSS loaded (theme: ' + (Terrain.Mode?.getTheme() || 'default') + ')');

                // Phase 3: Load feature modules
                await Promise.all([
                    this.loadScript('js/modules/canvas.js'),
                    this.loadScript('js/modules/grid.js'),
                    this.loadScript('js/modules/cli.js'),
                    this.loadScript('js/modules/nodes.js'),
                    this.loadScript('js/modules/toasts.js'),
                    this.loadScript('js/modules/persistence.js')
                ]);
                this.log('Feature modules loaded');

                // Phase 4: Load UI modules (based on mode settings)
                const uiModules = [this.loadScript('js/ui/popups.js')];
                if (Terrain.Mode?.getConfig()?.ui?.configPanel !== false) {
                    uiModules.push(this.loadScript('js/ui/config-panel.js'));
                }
                await Promise.all(uiModules);
                this.log('UI modules loaded');

                // Phase 5: Load optional modules based on config
                // URL ?design=true ALWAYS enables design mode
                if (Terrain.Utils.getUrlParamBool('design')) {
                    Terrain.Config.features.designMode = true;
                }

                if (Terrain.Config.features.fonts) {
                    await this.loadScript('js/modules/fonts.js');
                    this.log('Fonts module loaded');
                }

                if (Terrain.Config.features.designMode) {
                    await Promise.all([
                        this.loadCSS('css/components/fab.css'),
                        this.loadScript('js/ui/inspector.js')
                    ]);
                    this.log('Design mode assets loaded');

                    // Initialize Terrain.Css.fab (replaces TUT)
                    if (Terrain.Css && typeof Terrain.Css.fab.init === 'function') {
                        Terrain.Css.fab.init();
                        this.log('Terrain.Css.fab initialized');
                    }
                }

                // Phase 6: Load defaults and restore state
                const defaults = await this.loadDefaults();
                const nodes = defaults.nodes || [];
                Terrain.State.nodes.setAll(nodes);
                this.log('Default data loaded (' + nodes.length + ' nodes)');

                // Phase 7: Restore from localStorage
                if (Terrain.Persistence) {
                    Terrain.Persistence.load();
                    this.log('State restored from localStorage');
                }

                // Phase 8: Initialize all modules
                this.initModules();
                this.log('Modules initialized');

                // Phase 8.5: Initialize DOM bindings
                if (Terrain.Events && typeof Terrain.Events.bindDOM === 'function') {
                    Terrain.Events.bindDOM();
                    this.log('DOM bindings initialized');
                }

                // Phase 9: Fire ready event
                Terrain.Events.emit(Terrain.Events.READY, {
                    loadTime: Date.now() - this.startTime,
                    modules: this.loaded
                });
                this.log('Ready event fired');

                // Phase 10: Hide loading
                setTimeout(() => this.hideLoading(), 100);

            } catch (error) {
                console.error('[Terrain] Boot failed:', error);
                // Show error in loading overlay
                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.querySelector('.loading-text').textContent = 'LOAD ERROR';
                    overlay.querySelector('.loading-text').style.color = 'var(--signal-error)';
                }
            }
        }
    };

    // Export
    window.Terrain.Bootloader = Bootloader;

    // Auto-boot when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Bootloader.boot());
    } else {
        Bootloader.boot();
    }

})();
