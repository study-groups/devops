/**
 * Terrain.Css Module
 * Unified CSS token, theme, and design system management
 * Includes FAB (Floating Action Button) design panel
 *
 * Usage:
 *   Terrain.Css.tokens.get('bg-primary')
 *   Terrain.Css.tokens.set('bg-primary', '#1a1a1a')
 *   Terrain.Css.theme.load('dark')
 *   Terrain.Css.fab.toggle()
 */
(function() {
    'use strict';

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    const STORAGE_KEYS = {
        themes: 'terrain-themes',
        activeTheme: 'terrain-active-theme',
        sidebarPosition: 'terrain-sidebar-position'
    };

    // Token defaults - canonical values
    const DEFAULT_TOKENS = {
        '--bg-primary': '#0a0a0a',
        '--bg-secondary': '#1a1a1a',
        '--bg-tertiary': '#2a2a2a',
        '--bg-hover': '#3a3a3a',
        '--border': '#222222',
        '--border-visible': '#444444',
        '--border-active': '#4a9eff',
        '--text-primary': '#ffffff',
        '--text-secondary': '#aaaaaa',
        '--text-muted': '#666666',
        '--text-code': '#00ffaa',
        '--accent-primary': '#4a9eff',
        '--accent-secondary': '#ff6b35',
        '--success': '#00ff00',
        '--error': '#ff4444',
        '--warning': '#ffd700'
    };

    // Token groups for panel UI
    const TOKEN_GROUPS = {
        backgrounds: ['--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover'],
        borders: ['--border', '--border-visible', '--border-active'],
        text: ['--text-primary', '--text-secondary', '--text-muted', '--text-code'],
        accents: ['--accent-primary', '--accent-secondary', '--success', '--error', '--warning']
    };

    // Token categories (for listing/filtering)
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

    // Built-in themes
    const BUILTIN_THEMES = {
        'default': {
            metadata: { name: 'default', version: '1.0.0', description: 'Default dark theme' },
            tokens: DEFAULT_TOKENS
        },
        'electric': {
            metadata: { name: 'electric', version: '1.0.0', description: 'Vibrant neon theme' },
            tokens: {
                '--bg-primary': '#0a0014', '--bg-secondary': '#120024', '--bg-tertiary': '#1a0030', '--bg-hover': '#2a0050',
                '--border': '#3d0066', '--border-visible': '#6600aa', '--border-active': '#00ffff',
                '--text-primary': '#ffffff', '--text-secondary': '#cc99ff', '--text-muted': '#8855bb', '--text-code': '#00ffff',
                '--accent-primary': '#ff00ff', '--accent-secondary': '#00ffff', '--success': '#00ff88', '--error': '#ff0066', '--warning': '#ffff00'
            }
        }
    };

    // State
    let currentTheme = 'dark';
    let themeStylesheet = null;
    let autoSaveTimeout = null;

    // =========================================================================
    // UTILITIES
    // =========================================================================

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
        if (rgb.startsWith('#')) return rgb;
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return '#000000';
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    function showFeedback(element, message, type = 'success') {
        if (!element) return;
        const originalText = element.textContent;
        element.textContent = message;
        element.classList.add(`feedback-${type}`);
        setTimeout(() => {
            element.textContent = originalText;
            element.classList.remove(`feedback-${type}`);
        }, 2000);
    }

    // =========================================================================
    // TERRAIN.CSS MODULE
    // =========================================================================

    const TerrainCss = {
        // -----------------------------------------------------------------
        // TOKEN MANAGEMENT
        // -----------------------------------------------------------------
        tokens: {
            get: function(name) {
                const prop = name.startsWith('--') ? name : `--${name}`;
                return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
            },

            set: function(name, value, options = {}) {
                const prop = name.startsWith('--') ? name : `--${name}`;
                document.documentElement.style.setProperty(prop, value);

                // Update UI elements
                const tokenName = prop.replace('--', '');
                const displayEl = document.getElementById(`token-${tokenName}`);
                if (displayEl) displayEl.textContent = value;

                const picker = document.querySelector(`input[data-token="${prop}"]`);
                if (picker) picker.value = value;

                const swatch = document.querySelector(`[data-token="${prop}"]`)?.parentElement?.querySelector('.token-swatch');
                if (swatch) swatch.style.background = value;

                // Emit event
                if (!options.silent && window.Terrain?.Events) {
                    Terrain.Events.emit('css:token:change', { token: name, value });
                }

                // Auto-save
                if (!options.silent) {
                    TerrainCss.theme._autoSave();
                }
            },

            getAll: function() {
                const style = getComputedStyle(document.documentElement);
                const tokens = {};
                Object.keys(DEFAULT_TOKENS).forEach(token => {
                    tokens[token] = style.getPropertyValue(token).trim();
                });
                return tokens;
            },

            reset: function() {
                Object.entries(DEFAULT_TOKENS).forEach(([token, value]) => {
                    this.set(token, value, { silent: true });
                });
                if (window.Terrain?.Events) {
                    Terrain.Events.emit('css:tokens:reset');
                }
            },

            list: function(category) {
                const names = TOKEN_CATEGORIES[category];
                if (!names) return {};
                const result = {};
                names.forEach(name => {
                    result[name] = this.get(name);
                });
                return result;
            },

            categories: function() {
                return Object.keys(TOKEN_CATEGORIES);
            },

            export: function() {
                const result = {};
                Object.keys(TOKEN_CATEGORIES).forEach(category => {
                    result[category] = this.list(category);
                });
                return result;
            }
        },

        // -----------------------------------------------------------------
        // THEME MANAGEMENT
        // -----------------------------------------------------------------
        theme: {
            get current() {
                return currentTheme;
            },

            list: function() {
                return [...THEMES];
            },

            load: function(name) {
                return new Promise((resolve, reject) => {
                    if (!THEMES.includes(name)) {
                        reject(new Error(`Unknown theme: ${name}`));
                        return;
                    }

                    const href = `dist/themes/${name}.theme.css`;

                    if (themeStylesheet) {
                        themeStylesheet.remove();
                    }

                    const link = document.createElement('link');
                    link.id = 'terrain-theme';
                    link.rel = 'stylesheet';
                    link.href = href;

                    link.onload = () => {
                        currentTheme = name;
                        themeStylesheet = link;
                        console.log(`[Terrain.Css] Theme loaded: ${name}`);
                        if (window.Terrain?.Events) {
                            Terrain.Events.emit('css:theme:change', { theme: name });
                        }
                        resolve(name);
                    };

                    link.onerror = () => reject(new Error(`Failed to load theme: ${name}`));
                    document.head.appendChild(link);
                });
            },

            save: function(theme) {
                const themes = this.getSaved();
                const themeName = theme.metadata?.name || 'custom';
                themes[themeName] = theme;
                localStorage.setItem(STORAGE_KEYS.themes, JSON.stringify(themes));
                localStorage.setItem(STORAGE_KEYS.activeTheme, themeName);
                return themeName;
            },

            getSaved: function() {
                try {
                    return JSON.parse(localStorage.getItem(STORAGE_KEYS.themes)) || {};
                } catch {
                    return {};
                }
            },

            delete: function(themeName) {
                const themes = this.getSaved();
                delete themes[themeName];
                localStorage.setItem(STORAGE_KEYS.themes, JSON.stringify(themes));
                if (localStorage.getItem(STORAGE_KEYS.activeTheme) === themeName) {
                    localStorage.removeItem(STORAGE_KEYS.activeTheme);
                }
            },

            apply: function(theme) {
                if (theme.tokens) {
                    Object.entries(theme.tokens).forEach(([token, value]) => {
                        const cssVar = token.startsWith('--') ? token : `--${token}`;
                        TerrainCss.tokens.set(cssVar, typeof value === 'object' ? value.value : value, { silent: true });
                    });
                }
            },

            build: function() {
                return {
                    metadata: TerrainCss.fab._getMetadata(),
                    tokens: TerrainCss.tokens.getAll()
                };
            },

            _autoSave: function() {
                const activeTheme = localStorage.getItem(STORAGE_KEYS.activeTheme);
                if (!activeTheme) return;

                clearTimeout(autoSaveTimeout);
                autoSaveTimeout = setTimeout(() => {
                    const theme = this.build();
                    const themes = this.getSaved();
                    themes[activeTheme] = theme;
                    localStorage.setItem(STORAGE_KEYS.themes, JSON.stringify(themes));
                }, 500);
            },

            restore: function() {
                try {
                    const saved = localStorage.getItem(STORAGE_KEYS.activeTheme);
                    if (saved) {
                        // Check builtin first
                        if (BUILTIN_THEMES[saved]) {
                            this.apply(BUILTIN_THEMES[saved]);
                            return Promise.resolve(saved);
                        }
                        // Check saved themes
                        const themes = this.getSaved();
                        if (themes[saved]) {
                            this.apply(themes[saved]);
                            return Promise.resolve(saved);
                        }
                    }
                } catch (e) {
                    console.warn('[Terrain.Css] Could not restore theme:', e);
                }
                return Promise.resolve(currentTheme);
            }
        },

        // -----------------------------------------------------------------
        // FAB (FLOATING ACTION BUTTON) DESIGN PANEL
        // -----------------------------------------------------------------
        fab: {
            enabled: false,
            _panel: null,
            _fab: null,
            _handlers: {},

            init: function() {
                this.createFAB();
                this.createPanel();
                this._bindGlobalEvents();
                this._initPickers();
                this._updateThemeDropdown();

                // Restore theme
                TerrainCss.theme.restore();

                this.enabled = true;
                console.log('[Terrain.Css.fab] Initialized');
            },

            destroy: function() {
                if (this._panel) this._panel.remove();
                if (this._fab) this._fab.remove();
                this._unbindGlobalEvents();
                this._panel = null;
                this._fab = null;
                this.enabled = false;
            },

            createFAB: function() {
                if (document.getElementById('designFab')) {
                    this._fab = document.getElementById('designFab');
                    return this._fab;
                }

                const fab = document.createElement('button');
                fab.id = 'designFab';
                fab.className = 'fab fab-design';
                fab.innerHTML = this._getFABIcon();
                fab.title = 'Design Tokens';
                fab.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggle();
                });

                const container = document.querySelector('.fab-container');
                if (container) {
                    container.appendChild(fab);
                } else {
                    fab.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:1001;';
                    document.body.appendChild(fab);
                }

                this._fab = fab;
                return fab;
            },

            createPanel: function() {
                let panel = document.getElementById('designPanel');
                if (panel) {
                    panel.innerHTML = this._buildPanelHTML();
                    this._panel = panel;
                    return panel;
                }

                panel = document.createElement('div');
                panel.id = 'designPanel';
                panel.className = 'design-panel';
                panel.innerHTML = this._buildPanelHTML();
                document.body.appendChild(panel);
                this._panel = panel;
                return panel;
            },

            toggle: function() {
                if (this._panel) {
                    this._panel.classList.toggle('visible');
                }
            },

            show: function() {
                if (this._panel) {
                    this._panel.classList.add('visible');
                }
            },

            hide: function() {
                if (this._panel) {
                    this._panel.classList.remove('visible');
                }
            },

            // Panel HTML builders
            _getFABIcon: function() {
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28">
                    <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.15"/>
                    <rect x="25" y="30" width="18" height="18" rx="3" fill="var(--accent-primary, #4a9eff)"/>
                    <rect x="47" y="30" width="18" height="18" rx="3" fill="var(--success, #00ff00)"/>
                    <rect x="69" y="30" width="18" height="18" rx="3" fill="var(--warning, #ffd700)"/>
                    <rect x="25" y="52" width="18" height="18" rx="3" fill="var(--error, #ff4444)"/>
                    <rect x="47" y="52" width="18" height="18" rx="3" fill="var(--text-primary, #fff)"/>
                    <rect x="69" y="52" width="18" height="18" rx="3" fill="var(--text-secondary, #aaa)"/>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2" opacity="0.8"/>
                </svg>`;
            },

            _buildPanelHTML: function() {
                return `
                    <div class="design-panel-header">
                        <span>Design Tokens</span>
                        <span class="design-panel-close" data-action="close-panel">&times;</span>
                    </div>
                    <div class="design-panel-content">
                        ${this._buildThemeSection()}
                        ${this._buildColorsSection()}
                        ${this._buildExportSection()}
                    </div>
                `;
            },

            _buildThemeSection: function() {
                return `
                    <div class="token-section" data-section="theme">
                        <div class="token-section-header" data-action="toggle-section" data-target="theme">
                            <span>Theme</span>
                            <span class="section-toggle">▼</span>
                        </div>
                        <div class="token-section-content">
                            <div class="metadata-field">
                                <label>Active Theme</label>
                                <select id="themeSwitcher" class="font-select" data-action="switch-theme">
                                    <option value="">-- Select --</option>
                                </select>
                            </div>
                            <div class="design-panel-buttons">
                                <button class="design-panel-btn design-panel-btn--primary" id="saveThemeBtn" data-action="save-theme">Save</button>
                                <button class="design-panel-btn design-panel-btn--secondary" id="deleteThemeBtn" data-action="delete-theme">Delete</button>
                            </div>
                            <div class="metadata-field">
                                <label>Name</label>
                                <input type="text" id="themeName" value="my-theme" class="font-input">
                            </div>
                        </div>
                    </div>
                `;
            },

            _buildColorsSection: function() {
                let html = `
                    <div class="token-section" data-section="colors">
                        <div class="token-section-header" data-action="toggle-section" data-target="colors">
                            <span>Colors</span>
                            <span class="section-toggle">▼</span>
                        </div>
                        <div class="token-section-content">
                `;

                const groupTitles = { backgrounds: 'Background', borders: 'Border', text: 'Text', accents: 'Accent & Status' };
                Object.entries(TOKEN_GROUPS).forEach(([group, tokens]) => {
                    html += `<div class="token-group"><div class="token-group-title">${groupTitles[group] || group}</div>`;
                    tokens.forEach(cssVar => {
                        const name = cssVar.replace('--', '');
                        const value = DEFAULT_TOKENS[cssVar] || '#000000';
                        html += `
                            <div class="token-item">
                                <input type="color" class="token-picker" data-action="update-token" data-token="${cssVar}" value="${value}">
                                <div class="token-swatch" style="background: var(${cssVar})"></div>
                                <div class="token-info">
                                    <div class="token-name">${cssVar}</div>
                                    <div class="token-value" id="token-${name}">${value}</div>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                });

                html += '</div></div>';
                return html;
            },

            _buildExportSection: function() {
                return `
                    <div class="token-section collapsed" data-section="export">
                        <div class="token-section-header" data-action="toggle-section" data-target="export">
                            <span>Export / Import</span>
                            <span class="section-toggle">▶</span>
                        </div>
                        <div class="token-section-content">
                            <div class="design-panel-buttons">
                                <button class="design-panel-btn design-panel-btn--primary" data-action="export-json">JSON</button>
                                <button class="design-panel-btn design-panel-btn--secondary" data-action="copy-css">CSS</button>
                                <button class="design-panel-btn design-panel-btn--danger" data-action="reset-tokens">Reset</button>
                            </div>
                            <input type="file" id="themeFileInput" accept=".json" style="display:none" data-action="import-file">
                            <button class="design-panel-btn design-panel-btn--secondary" style="width:100%;margin-top:8px" data-action="import-json">Import JSON</button>
                        </div>
                    </div>
                `;
            },

            // Event binding
            _bindGlobalEvents: function() {
                const self = this;
                this._handlers.click = function(e) {
                    const action = e.target.closest('[data-action]')?.dataset.action;
                    if (!action) return;

                    switch (action) {
                        case 'close-panel': self.hide(); break;
                        case 'toggle-section': self._toggleSection(e.target.closest('[data-action]').dataset.target); break;
                        case 'update-token': self._handleTokenChange(e.target); break;
                        case 'switch-theme': self._handleThemeSwitch(e.target.value); break;
                        case 'save-theme': self._handleSaveTheme(); break;
                        case 'delete-theme': self._handleDeleteTheme(); break;
                        case 'export-json': self._handleExportJSON(); break;
                        case 'copy-css': self._handleCopyCSS(); break;
                        case 'reset-tokens': TerrainCss.tokens.reset(); break;
                        case 'import-json': document.getElementById('themeFileInput')?.click(); break;
                    }
                };

                this._handlers.change = function(e) {
                    if (e.target.id === 'themeFileInput') {
                        self._handleImportFile(e.target.files[0]);
                    }
                };

                document.addEventListener('click', this._handlers.click);
                document.addEventListener('change', this._handlers.change);
            },

            _unbindGlobalEvents: function() {
                if (this._handlers.click) document.removeEventListener('click', this._handlers.click);
                if (this._handlers.change) document.removeEventListener('change', this._handlers.change);
                this._handlers = {};
            },

            _initPickers: function() {
                const style = getComputedStyle(document.documentElement);
                Object.keys(DEFAULT_TOKENS).forEach(token => {
                    const value = style.getPropertyValue(token).trim();
                    const hex = rgbToHex(value);
                    const picker = document.querySelector(`input[data-token="${token}"]`);
                    if (picker) picker.value = hex;
                    const displayEl = document.getElementById('token-' + token.replace('--', ''));
                    if (displayEl) displayEl.textContent = hex;
                });
            },

            _toggleSection: function(name) {
                const section = document.querySelector(`[data-section="${name}"]`);
                if (!section) return;
                section.classList.toggle('collapsed');
                const toggle = section.querySelector('.section-toggle');
                if (toggle) toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
            },

            _handleTokenChange: function(picker) {
                const token = picker.dataset.token;
                if (token) TerrainCss.tokens.set(token, picker.value);
            },

            _handleThemeSwitch: function(themeName) {
                if (!themeName) {
                    TerrainCss.tokens.reset();
                    localStorage.removeItem(STORAGE_KEYS.activeTheme);
                    return;
                }

                if (themeName.startsWith('builtin:')) {
                    const name = themeName.replace('builtin:', '');
                    if (BUILTIN_THEMES[name]) {
                        TerrainCss.theme.apply(BUILTIN_THEMES[name]);
                        localStorage.setItem(STORAGE_KEYS.activeTheme, themeName);
                        this._initPickers();
                    }
                } else {
                    const themes = TerrainCss.theme.getSaved();
                    if (themes[themeName]) {
                        TerrainCss.theme.apply(themes[themeName]);
                        localStorage.setItem(STORAGE_KEYS.activeTheme, themeName);
                        this._initPickers();
                    }
                }
            },

            _handleSaveTheme: function() {
                const theme = TerrainCss.theme.build();
                const name = TerrainCss.theme.save(theme);
                this._updateThemeDropdown();
                showFeedback(document.getElementById('saveThemeBtn'), `Saved: ${name}`, 'success');
            },

            _handleDeleteTheme: function() {
                const dropdown = document.getElementById('themeSwitcher');
                const name = dropdown?.value;
                if (!name || name.startsWith('builtin:')) return;
                TerrainCss.theme.delete(name);
                dropdown.value = '';
                TerrainCss.tokens.reset();
                this._updateThemeDropdown();
                showFeedback(document.getElementById('deleteThemeBtn'), 'Deleted', 'success');
            },

            _handleExportJSON: function() {
                const theme = TerrainCss.theme.build();
                const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${theme.metadata?.name || 'theme'}.json`;
                a.click();
                URL.revokeObjectURL(url);
            },

            _handleCopyCSS: function() {
                const tokens = TerrainCss.tokens.getAll();
                let css = ':root {\n';
                Object.entries(tokens).forEach(([name, value]) => {
                    css += `    ${name}: ${value};\n`;
                });
                css += '}\n';
                navigator.clipboard.writeText(css).then(() => {
                    console.log('[Terrain.Css] CSS copied to clipboard');
                });
            },

            _handleImportFile: function(file) {
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const theme = JSON.parse(e.target.result);
                        TerrainCss.theme.apply(theme);
                        if (theme.metadata?.name) {
                            document.getElementById('themeName').value = theme.metadata.name;
                        }
                        this._initPickers();
                        console.log('[Terrain.Css] Theme imported');
                    } catch (err) {
                        console.error('[Terrain.Css] Import failed:', err);
                    }
                };
                reader.readAsText(file);
            },

            _updateThemeDropdown: function() {
                const dropdown = document.getElementById('themeSwitcher');
                if (!dropdown) return;

                const savedThemes = TerrainCss.theme.getSaved();
                const activeTheme = localStorage.getItem(STORAGE_KEYS.activeTheme);

                while (dropdown.options.length > 1) dropdown.remove(1);

                // Built-in themes
                const builtinGroup = document.createElement('optgroup');
                builtinGroup.label = 'Built-in';
                Object.keys(BUILTIN_THEMES).forEach(name => {
                    const option = document.createElement('option');
                    option.value = `builtin:${name}`;
                    option.textContent = name;
                    if (activeTheme === `builtin:${name}`) option.selected = true;
                    builtinGroup.appendChild(option);
                });
                dropdown.appendChild(builtinGroup);

                // Saved themes
                const savedKeys = Object.keys(savedThemes);
                if (savedKeys.length > 0) {
                    const savedGroup = document.createElement('optgroup');
                    savedGroup.label = 'Saved';
                    savedKeys.forEach(name => {
                        const option = document.createElement('option');
                        option.value = name;
                        option.textContent = name;
                        if (name === activeTheme) option.selected = true;
                        savedGroup.appendChild(option);
                    });
                    dropdown.appendChild(savedGroup);
                }
            },

            _getMetadata: function() {
                return {
                    name: document.getElementById('themeName')?.value || 'my-theme',
                    version: '1.0.0',
                    description: 'Custom theme'
                };
            },

            // Element inspection
            inspect: function(el) {
                if (!el) return {};
                const computed = getComputedStyle(el);
                return {
                    colors: {
                        background: computed.backgroundColor,
                        color: computed.color,
                        borderColor: computed.borderColor
                    },
                    spacing: {
                        padding: computed.padding,
                        margin: computed.margin,
                        gap: computed.gap
                    },
                    typography: {
                        fontFamily: computed.fontFamily,
                        fontSize: computed.fontSize,
                        fontWeight: computed.fontWeight
                    },
                    borders: {
                        borderRadius: computed.borderRadius,
                        borderWidth: computed.borderWidth
                    }
                };
            }
        },

        // -----------------------------------------------------------------
        // IMPORT/EXPORT
        // -----------------------------------------------------------------
        import: function(css, id) {
            let style = id ? document.getElementById(id) : null;
            if (!style) {
                style = document.createElement('style');
                if (id) style.id = id;
                document.head.appendChild(style);
            }
            style.textContent = css;
        },

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

        // -----------------------------------------------------------------
        // INITIALIZATION
        // -----------------------------------------------------------------
        init: function() {
            themeStylesheet = document.getElementById('terrain-theme');
            console.log('[Terrain.Css] Initialized');
        },

        destroy: function() {
            this.fab.destroy();
            if (themeStylesheet) {
                themeStylesheet.remove();
                themeStylesheet = null;
            }
        }
    };

    // =========================================================================
    // EXPORT
    // =========================================================================

    window.Terrain = window.Terrain || {};
    window.Terrain.Css = TerrainCss;

    // Backwards compat aliases
    window.TERRAIN = window.TERRAIN || window.Terrain;
    window.TERRAIN.CSS = TerrainCss;

})();
