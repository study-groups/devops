/**
 * Terrain Bootloader
 * Coordinates module loading and application initialization
 */
(function() {
    'use strict';

    // Ensure Terrain namespace exists
    window.Terrain = window.Terrain || {};

    const Bootloader = {
        loaded: [],
        startTime: Date.now(),

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
                projects: [
                    { id: 'terrain', title: 'Terrain', desc: 'Create spaces.', link: '/projects/index.html', status: 'draft', x: 101, y: 155 },
                    { id: 'synthetic-iris', title: 'Synthetic Iris', desc: 'Generative plant genetics', link: './synthetic-iris/index.html', status: 'draft', x: 102, y: 352 }
                ]
            };
        },

        /**
         * Initialize modules after loading
         */
        initModules: function() {
            // Initialize each module that has an init function
            const modules = ['Canvas', 'Grid', 'Nodes', 'Toasts', 'Persistence', 'ConfigPanel', 'Popups'];
            modules.forEach(name => {
                if (Terrain[name] && typeof Terrain[name].init === 'function') {
                    this.log(`Initializing ${name}`);
                    Terrain[name].init();
                }
            });

            // Initialize FAB only if design mode is enabled
            if (Terrain.Config.features.designMode && Terrain.FAB) {
                this.log('Initializing FAB (design mode)');
                Terrain.FAB.init();
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

                // Phase 1.5: Load utils
                await this.loadScript('js/core/utils.js');
                this.log('Utils loaded');

                // Phase 2: Load CSS
                await Promise.all([
                    this.loadCSS('css/tokens.css'),
                    this.loadCSS('css/core.css'),
                    this.loadCSS('css/components/nodes.css'),
                    this.loadCSS('css/components/toasts.css'),
                    this.loadCSS('css/components/panels.css')
                ]);
                this.log('CSS loaded');

                // Phase 3: Load feature modules
                await Promise.all([
                    this.loadScript('js/modules/canvas.js'),
                    this.loadScript('js/modules/grid.js'),
                    this.loadScript('js/modules/iframes.js'),
                    this.loadScript('js/modules/cli.js'),
                    this.loadScript('js/modules/nodes.js'),
                    this.loadScript('js/modules/toasts.js'),
                    this.loadScript('js/modules/persistence.js')
                ]);
                this.log('Feature modules loaded');

                // Phase 4: Load UI modules
                await Promise.all([
                    this.loadScript('js/ui/config-panel.js'),
                    this.loadScript('js/ui/popups.js')
                ]);
                this.log('UI modules loaded');

                // Phase 5: Load optional modules based on config
                if (Terrain.Config.features.fonts) {
                    await this.loadScript('js/modules/fonts.js');
                    this.log('Fonts module loaded');
                }

                if (Terrain.Config.features.designMode) {
                    await Promise.all([
                        this.loadCSS('css/components/fab.css'),
                        this.loadScript('js/ui/fab.js')
                    ]);
                    this.log('FAB module loaded (design mode enabled)');
                }

                // Phase 5.5: Load skins module
                await this.loadScript('js/core/skins.js');
                this.log('Skins module loaded');

                // Initialize skins (loads terrain.config.json)
                if (Terrain.Skins) {
                    await Terrain.Skins.init();
                    this.log('Skins initialized: ' + (Terrain.Skins.getCurrentName() || 'default'));
                }

                // Phase 6: Load defaults and restore state
                const defaults = await this.loadDefaults();
                // Support both 'nodes' and legacy 'projects' key
                const nodes = defaults.nodes || defaults.projects || [];
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
                Terrain.Events.emit(Terrain.Events.EVENTS.READY, {
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
