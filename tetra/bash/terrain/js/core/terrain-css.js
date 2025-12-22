/**
 * TERRAIN.CSS Module
 * Unified CSS token, theme, and design system management
 */
(function() {
    'use strict';

    // Token categories for listing/filtering
    const TOKEN_CATEGORIES = {
        palette: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
        accent: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
        utility: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
        background: ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-hover'],
        border: ['border', 'border-visible', 'border-active'],
        text: ['text-primary', 'text-secondary', 'text-muted', 'text-code'],
        status: ['accent-primary', 'accent-secondary', 'success', 'error', 'warning'],
        depth: ['depth-sm', 'depth-md', 'depth-lg'],
        curve: ['curve-sm', 'curve-md', 'curve-lg', 'curve-full'],
        gap: ['gap-xs', 'gap-sm', 'gap-md', 'gap-lg', 'gap-xl'],
        tempo: ['tempo-fast', 'tempo-normal', 'tempo-slow'],
        font: ['font-primary', 'font-secondary', 'font-code'],
        z: ['z-base', 'z-dropdown', 'z-sticky', 'z-sidebar', 'z-header', 'z-panel', 'z-fab', 'z-toast', 'z-modal', 'z-tooltip', 'z-max']
    };

    // Available themes
    const THEMES = ['dark', 'midnight', 'cyber', 'forest', 'amber', 'lava', 'lcd', 'tv', 'controldeck'];

    // Current state
    let currentTheme = 'dark';
    let themeStylesheet = null;

    const TerrainCSS = {
        /**
         * Token Management
         */
        tokens: {
            /**
             * Get a token value
             * @param {string} name - Token name (without --)
             * @returns {string} Computed value
             */
            get: function(name) {
                const prop = name.startsWith('--') ? name : `--${name}`;
                return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
            },

            /**
             * Set a token value at runtime
             * @param {string} name - Token name (without --)
             * @param {string} value - New value
             */
            set: function(name, value) {
                const prop = name.startsWith('--') ? name : `--${name}`;
                document.documentElement.style.setProperty(prop, value);

                if (window.TERRAIN?.Events) {
                    TERRAIN.Events.emit('css:token:change', { token: name, value });
                }
            },

            /**
             * List tokens by category
             * @param {string} category - Category name (palette, accent, background, etc.)
             * @returns {Object} Token name -> value map
             */
            list: function(category) {
                const names = TOKEN_CATEGORIES[category];
                if (!names) return {};

                const result = {};
                names.forEach(name => {
                    result[name] = this.get(name);
                });
                return result;
            },

            /**
             * Get all token categories
             * @returns {string[]} Category names
             */
            categories: function() {
                return Object.keys(TOKEN_CATEGORIES);
            },

            /**
             * Export all tokens as object
             * @returns {Object} All tokens by category
             */
            export: function() {
                const result = {};
                Object.keys(TOKEN_CATEGORIES).forEach(category => {
                    result[category] = TerrainCSS.tokens.list(category);
                });
                return result;
            }
        },

        /**
         * Theme Management
         */
        theme: {
            /**
             * Get current theme name
             */
            get current() {
                return currentTheme;
            },

            /**
             * List available themes
             * @returns {string[]} Theme names
             */
            list: function() {
                return [...THEMES];
            },

            /**
             * Load a theme
             * @param {string} name - Theme name
             * @returns {Promise} Resolves when loaded
             */
            load: function(name) {
                return new Promise((resolve, reject) => {
                    if (!THEMES.includes(name)) {
                        reject(new Error(`Unknown theme: ${name}`));
                        return;
                    }

                    const href = `dist/themes/${name}.theme.css`;

                    // Remove existing theme stylesheet
                    if (themeStylesheet) {
                        themeStylesheet.remove();
                    }

                    // Create new link
                    const link = document.createElement('link');
                    link.id = 'terrain-theme';
                    link.rel = 'stylesheet';
                    link.href = href;

                    link.onload = () => {
                        currentTheme = name;
                        themeStylesheet = link;
                        console.log(`[TERRAIN.CSS] Theme loaded: ${name}`);

                        if (window.TERRAIN?.Events) {
                            TERRAIN.Events.emit('css:theme:change', { theme: name });
                        }
                        resolve(name);
                    };

                    link.onerror = () => {
                        reject(new Error(`Failed to load theme: ${name}`));
                    };

                    document.head.appendChild(link);
                });
            },

            /**
             * Save current theme to localStorage
             */
            save: function() {
                try {
                    localStorage.setItem('terrain-theme', currentTheme);
                } catch (e) {
                    console.warn('[TERRAIN.CSS] Could not save theme:', e);
                }
            },

            /**
             * Restore theme from localStorage
             * @returns {Promise} Resolves when restored
             */
            restore: function() {
                try {
                    const saved = localStorage.getItem('terrain-theme');
                    if (saved && THEMES.includes(saved)) {
                        return this.load(saved);
                    }
                } catch (e) {
                    console.warn('[TERRAIN.CSS] Could not restore theme:', e);
                }
                return Promise.resolve(currentTheme);
            }
        },

        /**
         * FAB - Design token editor (Floating Action Button)
         */
        fab: {
            enabled: false,
            _panel: null,

            /**
             * Enable FAB mode
             */
            enable: function() {
                this.enabled = true;
                console.log('[TERRAIN.CSS] FAB enabled');
            },

            /**
             * Disable FAB mode
             */
            disable: function() {
                this.enabled = false;
                if (this._panel) {
                    this._panel.remove();
                    this._panel = null;
                }
            },

            /**
             * Inspect an element and extract its design tokens
             * @param {Element} el - DOM element to inspect
             * @returns {Object} Extracted token usage
             */
            inspect: function(el) {
                if (!el) return {};

                const computed = getComputedStyle(el);
                const tokens = {};

                // Extract colors
                tokens.colors = {
                    background: computed.backgroundColor,
                    color: computed.color,
                    borderColor: computed.borderColor
                };

                // Extract spacing
                tokens.spacing = {
                    padding: computed.padding,
                    margin: computed.margin,
                    gap: computed.gap
                };

                // Extract typography
                tokens.typography = {
                    fontFamily: computed.fontFamily,
                    fontSize: computed.fontSize,
                    fontWeight: computed.fontWeight,
                    lineHeight: computed.lineHeight
                };

                // Extract borders
                tokens.borders = {
                    borderRadius: computed.borderRadius,
                    borderWidth: computed.borderWidth
                };

                return tokens;
            },

            /**
             * Live edit a token
             * @param {string} token - Token name
             * @param {string} value - New value
             */
            edit: function(token, value) {
                TerrainCSS.tokens.set(token, value);
            },

            /**
             * Export modified tokens as CSS
             * @returns {string} CSS custom properties
             */
            export: function() {
                return TerrainCSS.export('css');
            }
        },

        /**
         * Import CSS
         * @param {string} css - CSS string to inject
         * @param {string} id - Optional style element ID
         */
        import: function(css, id) {
            let style = id ? document.getElementById(id) : null;

            if (!style) {
                style = document.createElement('style');
                if (id) style.id = id;
                document.head.appendChild(style);
            }

            style.textContent = css;
            console.log('[TERRAIN.CSS] Imported CSS' + (id ? `: ${id}` : ''));
        },

        /**
         * Export tokens in various formats
         * @param {string} format - 'css', 'json', or 'scss'
         * @returns {string} Formatted output
         */
        export: function(format = 'json') {
            const tokens = this.tokens.export();

            switch (format) {
                case 'css':
                    let css = ':root {\n';
                    Object.entries(tokens).forEach(([category, values]) => {
                        css += `    /* ${category} */\n`;
                        Object.entries(values).forEach(([name, value]) => {
                            css += `    --${name}: ${value};\n`;
                        });
                    });
                    css += '}\n';
                    return css;

                case 'scss':
                    let scss = '';
                    Object.entries(tokens).forEach(([category, values]) => {
                        scss += `// ${category}\n`;
                        Object.entries(values).forEach(([name, value]) => {
                            scss += `$${name}: ${value};\n`;
                        });
                        scss += '\n';
                    });
                    return scss;

                case 'json':
                default:
                    return JSON.stringify(tokens, null, 2);
            }
        },

        /**
         * Initialize the module
         */
        init: function() {
            // Find existing theme stylesheet if any
            themeStylesheet = document.getElementById('terrain-theme');

            console.log('[TERRAIN.CSS] Initialized');
        }
    };

    // Export to TERRAIN namespace (uppercase)
    window.TERRAIN = window.TERRAIN || {};
    window.TERRAIN.CSS = TerrainCSS;

    // Also export to Terrain for internal use
    window.Terrain = window.Terrain || {};
    window.Terrain.CSS = TerrainCSS;

})();
