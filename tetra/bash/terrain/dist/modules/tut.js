(function(TERRAIN) {
    'use strict';

    // Ensure TERRAIN exists
    if (!TERRAIN) {
        console.error('[TUT] TERRAIN not found');
        return;
    }

    // Check if already registered
    if (TERRAIN.modules?.['TUT']) {
        console.warn('[TUT] Already registered');
        return;
    }

    // === BEGIN MODULE ===
// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/core.js ===
/**
 * TUT Core - Constants, defaults, and utilities
 */

// Storage keys
const TUT_STORAGE_KEY = 'tut-themes';
const TUT_ACTIVE_THEME_KEY = 'tut-active-theme';

// Token defaults - canonical values for all design tokens (TERRAIN-compatible)
const TUT_DEFAULT_TOKENS = {
    // Backgrounds
    '--bg-primary': '#0a0a0a',
    '--bg-secondary': '#1a1a1a',
    '--bg-tertiary': '#2a2a2a',
    '--bg-hover': '#3a3a3a',
    // Borders
    '--border': '#222222',
    '--border-visible': '#444444',
    '--border-active': '#4a9eff',
    // Text
    '--text-primary': '#ffffff',
    '--text-secondary': '#aaaaaa',
    '--text-muted': '#666666',
    '--text-code': '#00ffaa',
    // Accents
    '--accent-primary': '#4a9eff',
    '--accent-secondary': '#ff6b35',
    // Status
    '--success': '#00ff00',
    '--error': '#ff4444',
    '--warning': '#ffd700'
};

// Token groups for panel UI (derived from TUT_DEFAULT_TOKENS)
const TUT_TOKEN_GROUPS = {
    backgrounds: ['--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover'],
    borders: ['--border', '--border-visible', '--border-active'],
    text: ['--text-primary', '--text-secondary', '--text-muted', '--text-code'],
    accents: ['--accent-primary', '--accent-secondary', '--success', '--error', '--warning']
};

// Font defaults
const TUT_DEFAULT_FONTS = {
    heading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    code: "'Courier New', Monaco, monospace"
};

// Token metadata for export/inspection
const TUT_TOKEN_METADATA = {
    '--bg-primary': { type: 'color', description: 'Page background - darkest surface' },
    '--bg-secondary': { type: 'color', description: 'Panel/card background - elevated surface' },
    '--bg-tertiary': { type: 'color', description: 'Section/header background - highest elevation' },
    '--bg-hover': { type: 'color', description: 'Hover state background' },
    '--border': { type: 'color', description: 'Default border color' },
    '--border-visible': { type: 'color', description: 'Visible/emphasized border' },
    '--border-active': { type: 'color', description: 'Active/focused element border' },
    '--text-primary': { type: 'color', description: 'Main body text - high contrast' },
    '--text-secondary': { type: 'color', description: 'Supporting text - medium contrast' },
    '--text-muted': { type: 'color', description: 'Disabled/subtle text - low contrast' },
    '--text-code': { type: 'color', description: 'Code/monospace text color' },
    '--accent-primary': { type: 'color', description: 'Primary action color - links, buttons' },
    '--accent-secondary': { type: 'color', description: 'Secondary accent - highlights' },
    '--success': { type: 'color', description: 'Success/positive feedback' },
    '--error': { type: 'color', description: 'Error/danger feedback' },
    '--warning': { type: 'color', description: 'Warning/caution feedback' }
};

// Utility: RGB to Hex conversion
function tutRgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return '#000000';
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

// Utility: Show inline feedback (replaces alerts)
function tutShowFeedback(element, message, type = 'success') {
    const originalText = element.textContent;
    const feedbackClass = `feedback-${type}`;

    element.textContent = message;
    element.classList.add(feedbackClass);

    setTimeout(() => {
        element.textContent = originalText;
        element.classList.remove(feedbackClass);
    }, 2000);
}

// Utility: Show inline error in container
function tutShowInlineError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let errorEl = container.querySelector('.inline-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'inline-error theme-feedback error';
        container.appendChild(errorEl);
    }

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');

    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 5000);
}


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/tokens.js ===
/**
 * TUT Tokens - Token update functions
 */

const TUT_Tokens = {
    /**
     * Update a CSS custom property token
     */
    update: function(tokenName, value, options = {}) {
        document.documentElement.style.setProperty(tokenName, value);

        // Update display element
        const displayId = 'token-' + tokenName.replace('--', '').replace(/-/g, '-');
        const displayEl = document.getElementById(displayId);
        if (displayEl) {
            displayEl.textContent = value;
        }

        // Update corresponding color picker
        const picker = document.querySelector(`input[data-token="${tokenName}"]`);
        if (picker) {
            picker.value = value;
        }

        // Emit event via TERRAIN Bridge if available
        if (!options.silent && typeof TERRAIN !== 'undefined' && TERRAIN.Bridge) {
            TERRAIN.Bridge.broadcast('tut:token-change', { name: tokenName, value });
        }

        // Auto-save to active theme
        if (!options.silent && typeof TUT_Themes !== 'undefined') {
            TUT_Themes.autoSave();
        }
    },

    /**
     * Get current value of a token
     */
    get: function(tokenName) {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue(tokenName).trim();
    },

    /**
     * Get all current token values
     */
    getAll: function() {
        const style = getComputedStyle(document.documentElement);
        const tokens = {};
        Object.keys(TUT_DEFAULT_TOKENS).forEach(token => {
            tokens[token] = style.getPropertyValue(token).trim();
        });
        return tokens;
    },

    /**
     * Reset all tokens to defaults
     */
    reset: function() {
        Object.entries(TUT_DEFAULT_TOKENS).forEach(([token, value]) => {
            this.update(token, value, { silent: true });
        });

        // Reset fonts
        TUT_Fonts.reset();

        // Reset metadata fields
        const fields = {
            'themeName': 'my-theme',
            'themeVersion': '1.0.0',
            'themeDescription': 'Custom theme',
            'themeAuthor': 'Designer'
        };
        Object.entries(fields).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });

        const btn = document.getElementById('resetTokensBtn');
        if (btn) tutShowFeedback(btn, 'Reset', 'success');
    },

    /**
     * Update section border style
     */
    updateSectionBorder: function(style) {
        const root = document.documentElement;
        switch(style) {
            case 'left':
                root.style.setProperty('--section-border-width', '0 0 0 4px');
                root.style.setProperty('--section-border-color', 'var(--accent-primary)');
                break;
            case 'full-muted':
                root.style.setProperty('--section-border-width', '1px');
                root.style.setProperty('--section-border-color', 'var(--border)');
                break;
            case 'full-accent':
                root.style.setProperty('--section-border-width', '1px');
                root.style.setProperty('--section-border-color', 'var(--accent-primary)');
                break;
            case 'none':
                root.style.setProperty('--section-border-width', '0');
                break;
        }
    },

    /**
     * Update section border radius
     */
    updateSectionRadius: function(value) {
        document.documentElement.style.setProperty('--section-border-radius', value + 'px');
        const display = document.getElementById('sectionRadiusValue');
        if (display) display.textContent = value + 'px';
    },

    /**
     * Initialize color pickers from current CSS values
     */
    initPickers: function() {
        const style = getComputedStyle(document.documentElement);

        Object.keys(TUT_DEFAULT_TOKENS).forEach(token => {
            const value = style.getPropertyValue(token).trim();
            const hex = tutRgbToHex(value);

            const picker = document.querySelector(`input[data-token="${token}"]`);
            if (picker) picker.value = hex;

            const displayId = 'token-' + token.replace('--', '');
            const displayEl = document.getElementById(displayId);
            if (displayEl) displayEl.textContent = hex;
        });

        // Bind event listeners to all data-token inputs
        document.querySelectorAll('input[data-token]').forEach(picker => {
            const tokenName = picker.getAttribute('data-token');
            picker.addEventListener('input', () => {
                this.update(tokenName, picker.value);
            });
        });
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/themes.js ===
/**
 * TUT Themes - LocalStorage theme management
 */

// Built-in themes (always available)
const TUT_BUILTIN_THEMES = {
    'default': {
        metadata: {
            name: 'default',
            version: '1.0.0',
            description: 'Default dark theme',
            author: 'TERRAIN',
            temperature: 'neutral',
            colorMode: 'dark'
        },
        tokens: {
            'bg-primary': { value: '#0a0a0a', cssVar: '--bg-primary' },
            'bg-secondary': { value: '#1a1a1a', cssVar: '--bg-secondary' },
            'bg-tertiary': { value: '#2a2a2a', cssVar: '--bg-tertiary' },
            'bg-hover': { value: '#3a3a3a', cssVar: '--bg-hover' },
            'border': { value: '#222222', cssVar: '--border' },
            'border-visible': { value: '#444444', cssVar: '--border-visible' },
            'border-active': { value: '#4a9eff', cssVar: '--border-active' },
            'text-primary': { value: '#ffffff', cssVar: '--text-primary' },
            'text-secondary': { value: '#aaaaaa', cssVar: '--text-secondary' },
            'text-muted': { value: '#666666', cssVar: '--text-muted' },
            'text-code': { value: '#00ffaa', cssVar: '--text-code' },
            'accent-primary': { value: '#4a9eff', cssVar: '--accent-primary' },
            'accent-secondary': { value: '#ff6b35', cssVar: '--accent-secondary' },
            'success': { value: '#00ff00', cssVar: '--success' },
            'error': { value: '#ff4444', cssVar: '--error' },
            'warning': { value: '#ffd700', cssVar: '--warning' }
        }
    },
    'electric': {
        metadata: {
            name: 'electric',
            version: '1.0.0',
            description: 'Vibrant electric neon theme',
            author: 'TERRAIN',
            temperature: 'cool',
            colorMode: 'dark'
        },
        tokens: {
            'bg-primary': { value: '#0a0014', cssVar: '--bg-primary' },
            'bg-secondary': { value: '#120024', cssVar: '--bg-secondary' },
            'bg-tertiary': { value: '#1a0030', cssVar: '--bg-tertiary' },
            'bg-hover': { value: '#2a0050', cssVar: '--bg-hover' },
            'border': { value: '#3d0066', cssVar: '--border' },
            'border-visible': { value: '#6600aa', cssVar: '--border-visible' },
            'border-active': { value: '#00ffff', cssVar: '--border-active' },
            'text-primary': { value: '#ffffff', cssVar: '--text-primary' },
            'text-secondary': { value: '#cc99ff', cssVar: '--text-secondary' },
            'text-muted': { value: '#8855bb', cssVar: '--text-muted' },
            'text-code': { value: '#00ffff', cssVar: '--text-code' },
            'accent-primary': { value: '#ff00ff', cssVar: '--accent-primary' },
            'accent-secondary': { value: '#00ffff', cssVar: '--accent-secondary' },
            'success': { value: '#00ff88', cssVar: '--success' },
            'error': { value: '#ff0066', cssVar: '--error' },
            'warning': { value: '#ffff00', cssVar: '--warning' }
        }
    }
};

const TUT_Themes = {
    _autoSaveTimeout: null,

    /**
     * Initialize theme system
     */
    init: function() {
        this.updateDropdown();

        // Load active theme if set
        const activeTheme = localStorage.getItem(TUT_ACTIVE_THEME_KEY);
        if (activeTheme) {
            const themes = this.getSaved();
            if (themes[activeTheme]) {
                this.apply(themes[activeTheme]);
                const dropdown = document.getElementById('themeSwitcher');
                if (dropdown) dropdown.value = activeTheme;
            }
        }
    },

    /**
     * Get all saved themes
     */
    getSaved: function() {
        try {
            return JSON.parse(localStorage.getItem(TUT_STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    },

    /**
     * Save theme to storage
     */
    save: function(theme) {
        const themes = this.getSaved();
        const themeName = theme.metadata.name;
        themes[themeName] = theme;
        localStorage.setItem(TUT_STORAGE_KEY, JSON.stringify(themes));
        localStorage.setItem(TUT_ACTIVE_THEME_KEY, themeName);
        this.updateDropdown();
        return themeName;
    },

    /**
     * Delete theme from storage
     */
    delete: function(themeName) {
        const themes = this.getSaved();
        delete themes[themeName];
        localStorage.setItem(TUT_STORAGE_KEY, JSON.stringify(themes));

        if (localStorage.getItem(TUT_ACTIVE_THEME_KEY) === themeName) {
            localStorage.removeItem(TUT_ACTIVE_THEME_KEY);
        }
        this.updateDropdown();
    },

    /**
     * Update theme dropdown
     */
    updateDropdown: function() {
        const dropdown = document.getElementById('themeSwitcher');
        if (!dropdown) return;

        const savedThemes = this.getSaved();
        const activeTheme = localStorage.getItem(TUT_ACTIVE_THEME_KEY);

        // Clear existing options except first
        while (dropdown.options.length > 1) {
            dropdown.remove(1);
        }

        // Add built-in themes first
        const builtinGroup = document.createElement('optgroup');
        builtinGroup.label = 'Built-in';
        Object.keys(TUT_BUILTIN_THEMES).forEach(name => {
            const option = document.createElement('option');
            option.value = `builtin:${name}`;
            option.textContent = name;
            if (activeTheme === `builtin:${name}`) option.selected = true;
            builtinGroup.appendChild(option);
        });
        dropdown.appendChild(builtinGroup);

        // Add saved themes
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

    /**
     * Switch to a theme
     */
    switch: function(themeName) {
        if (!themeName) {
            TUT_Tokens.reset();
            localStorage.removeItem(TUT_ACTIVE_THEME_KEY);
            return;
        }

        // Check for built-in theme
        if (themeName.startsWith('builtin:')) {
            const builtinName = themeName.replace('builtin:', '');
            if (TUT_BUILTIN_THEMES[builtinName]) {
                this.apply(TUT_BUILTIN_THEMES[builtinName]);
                localStorage.setItem(TUT_ACTIVE_THEME_KEY, themeName);
                return;
            }
        }

        // Check saved themes
        const themes = this.getSaved();
        if (themes[themeName]) {
            this.apply(themes[themeName]);
            localStorage.setItem(TUT_ACTIVE_THEME_KEY, themeName);
        }
    },

    /**
     * Apply a theme object
     */
    apply: function(theme) {
        // Apply metadata
        if (theme.metadata) {
            TUT_Panel.setMetadata(theme.metadata);
        }

        // Apply tokens
        if (theme.tokens) {
            Object.entries(theme.tokens).forEach(([tokenId, tokenData]) => {
                const cssVar = tokenData.cssVar || `--${tokenId}`;
                if (TUT_DEFAULT_TOKENS.hasOwnProperty(cssVar)) {
                    TUT_Tokens.update(cssVar, tokenData.value, { silent: true });
                }
            });
        }
    },

    /**
     * Auto-save current theme (debounced)
     */
    autoSave: function() {
        const activeTheme = localStorage.getItem(TUT_ACTIVE_THEME_KEY);
        if (!activeTheme) return;

        clearTimeout(this._autoSaveTimeout);
        this._autoSaveTimeout = setTimeout(() => {
            const theme = TUT_Export.buildThemeObject();
            const themes = this.getSaved();
            themes[activeTheme] = theme;
            localStorage.setItem(TUT_STORAGE_KEY, JSON.stringify(themes));
        }, 500);
    },

    /**
     * Save current theme (user action)
     */
    saveCurrent: function() {
        const theme = TUT_Export.buildThemeObject();
        const themeName = this.save(theme);

        const btn = document.getElementById('saveThemeBtn');
        if (btn) tutShowFeedback(btn, `Saved: ${themeName}`, 'success');
    },

    /**
     * Delete current theme (user action)
     */
    deleteCurrent: function() {
        const dropdown = document.getElementById('themeSwitcher');
        const themeName = dropdown?.value;

        if (!themeName) return;

        this.delete(themeName);
        dropdown.value = '';
        TUT_Tokens.reset();

        const btn = document.getElementById('deleteThemeBtn');
        if (btn) tutShowFeedback(btn, 'Deleted', 'success');
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/panel.js ===
/**
 * TUT Panel - Dynamic panel creation and UI controls
 */

const TUT_Panel = {
    // Token definitions derived from TUT_DEFAULT_TOKENS and TUT_TOKEN_GROUPS (core.js)
    _tokens: null,  // Lazily initialized

    /**
     * Get token definitions, deriving from core.js constants
     */
    _getTokens: function() {
        if (this._tokens) return this._tokens;

        this._tokens = {};
        for (const [group, vars] of Object.entries(TUT_TOKEN_GROUPS)) {
            this._tokens[group] = vars.map(cssVar => ({
                name: cssVar.replace('--', ''),
                var: cssVar,
                default: TUT_DEFAULT_TOKENS[cssVar]
            }));
        }
        return this._tokens;
    },

    _panelElement: null,
    _fabElement: null,

    // =========================================================================
    // DYNAMIC CREATION
    // =========================================================================

    /**
     * Create the FAB button
     * Adds to .fab-container if it exists, otherwise creates standalone
     */
    createFAB: function() {
        if (document.getElementById('designFab')) {
            this._fabElement = document.getElementById('designFab');
            return this._fabElement;
        }

        const fab = document.createElement('button');
        fab.id = 'designFab';
        fab.className = 'fab fab-design';
        fab.innerHTML = this._getFABIcon();
        fab.title = 'Design Tokens (TUT)';
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Add to fab-container if it exists, otherwise body
        const container = document.querySelector('.fab-container');
        if (container) {
            container.appendChild(fab);
        } else {
            // Fallback: create standalone FAB
            fab.style.position = 'fixed';
            fab.style.bottom = '16px';
            fab.style.right = '16px';
            fab.style.zIndex = '1001';
            document.body.appendChild(fab);
        }

        this._fabElement = fab;
        return fab;
    },

    /**
     * Create the full design panel
     * Replaces any existing design-panel from fab.js
     */
    create: function() {
        // Check for existing panels (TUT or fab.js)
        let existingPanel = document.getElementById('designPanel') || document.getElementById('design-panel');

        if (existingPanel) {
            // Replace existing panel content with rich TUT panel
            existingPanel.id = 'designPanel';
            existingPanel.innerHTML = this._buildPanelHTML();
            this._panelElement = existingPanel;
            this._bindEvents();
            return existingPanel;
        }

        // Create new panel if none exists
        const panel = document.createElement('div');
        panel.id = 'designPanel';
        panel.className = 'design-panel';
        panel.innerHTML = this._buildPanelHTML();

        document.body.appendChild(panel);
        this._panelElement = panel;

        // Bind events after panel is in DOM
        this._bindEvents();

        return panel;
    },

    /**
     * FAB icon SVG
     */
    _getFABIcon: function() {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28">
            <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.15"/>
            <rect x="25" y="30" width="18" height="18" rx="3" fill="var(--fab-accent-primary, #58a6ff)"/>
            <rect x="47" y="30" width="18" height="18" rx="3" fill="var(--fab-success, #3fb950)"/>
            <rect x="69" y="30" width="18" height="18" rx="3" fill="var(--fab-warning, #d29922)"/>
            <rect x="25" y="52" width="18" height="18" rx="3" fill="var(--fab-error, #f85149)"/>
            <rect x="47" y="52" width="18" height="18" rx="3" fill="var(--fab-text-primary, #c9d1d9)"/>
            <rect x="69" y="52" width="18" height="18" rx="3" fill="var(--fab-text-secondary, #8b949e)"/>
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2" opacity="0.8"/>
        </svg>`;
    },

    /**
     * Build the complete panel HTML
     */
    _buildPanelHTML: function() {
        return `
            <div class="design-panel-header">
                <span>Design Tokens</span>
                <span class="design-panel-close" data-action="close-panel">&times;</span>
            </div>
            <div class="design-panel-content">
                ${this._buildThemeSwitcherSection()}
                ${this._buildMetadataSection()}
                ${this._buildColorsSection()}
                ${this._buildLayoutSection()}
                ${this._buildTypographySection()}
                ${this._buildAnalysisSection()}
                ${this._buildExportSection()}
            </div>
        `;
    },

    /**
     * Theme Switcher Section
     */
    _buildThemeSwitcherSection: function() {
        return `
            <div class="token-section" data-section="switcher">
                <div class="token-section-header" data-action="toggle-section" data-target="switcher">
                    <span>Theme Switcher</span>
                    <span class="section-toggle">▼</span>
                </div>
                <div class="token-section-content">
                    <div class="metadata-field">
                        <label>Active Theme</label>
                        <select id="themeSwitcher" class="font-select mt-0" data-action="switch-theme">
                            <option value="">-- Select Theme --</option>
                        </select>
                    </div>
                    <div class="design-panel-buttons mt-half">
                        <button class="design-panel-btn design-panel-btn--primary flex-1" data-action="save-theme">
                            Save Current
                        </button>
                        <button class="design-panel-btn design-panel-btn--secondary flex-1" data-action="delete-theme">
                            Delete
                        </button>
                    </div>
                    <div id="themeFeedback" class="theme-feedback hidden"></div>
                </div>
            </div>
        `;
    },

    /**
     * Theme Metadata Section
     */
    _buildMetadataSection: function() {
        return `
            <div class="token-section collapsed" data-section="metadata">
                <div class="token-section-header" data-action="toggle-section" data-target="metadata">
                    <span>Theme Metadata</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="metadata-field">
                        <label>Name</label>
                        <input type="text" id="themeName" value="my-theme" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Version</label>
                        <input type="text" id="themeVersion" value="1.0.0" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Description</label>
                        <input type="text" id="themeDescription" value="Custom theme" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Author</label>
                        <input type="text" id="themeAuthor" value="Designer" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Temperature</label>
                        <select id="themeTemperature" class="font-select">
                            <option value="warm">Warm</option>
                            <option value="cool">Cool</option>
                            <option value="neutral" selected>Neutral</option>
                        </select>
                    </div>
                    <div class="metadata-field">
                        <label>Color Mode</label>
                        <select id="themeColorMode" class="font-select">
                            <option value="dark" selected>Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Colors Section - generates all token groups
     */
    _buildColorsSection: function() {
        return `
            <div class="token-section" data-section="colors">
                <div class="token-section-header" data-action="toggle-section" data-target="colors">
                    <span>Colors</span>
                    <span class="section-toggle">▼</span>
                </div>
                <div class="token-section-content">
                    ${this._buildTokenGroup('Background', this._getTokens().backgrounds)}
                    ${this._buildTokenGroup('Border', this._getTokens().borders)}
                    ${this._buildTokenGroup('Text', this._getTokens().text)}
                    ${this._buildTokenGroup('Accent & Status', this._getTokens().accents)}
                </div>
            </div>
        `;
    },

    /**
     * Build a token group with color pickers
     */
    _buildTokenGroup: function(title, tokens) {
        let html = `<div class="token-group"><div class="token-group-title">${title}</div>`;

        tokens.forEach(token => {
            const currentValue = this._getTokenValue(token.var) || token.default;
            html += `
                <div class="token-item">
                    <input type="color" class="token-picker" data-action="update-token" data-token="${token.var}" value="${currentValue}">
                    <div class="token-swatch" style="background: var(${token.var})"></div>
                    <div class="token-info">
                        <div class="token-name">${token.var}</div>
                        <div class="token-value" id="token-${token.name}">${currentValue}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    },

    /**
     * Layout Section
     */
    _buildLayoutSection: function() {
        return `
            <div class="token-section collapsed" data-section="layout">
                <div class="token-section-header" data-action="toggle-section" data-target="layout">
                    <span>Layout</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="token-group-title">Section Style</div>
                        <div class="control-group">
                            <label class="field-label">Border Style</label>
                            <select class="font-select mt-0" data-action="update-section-border" id="sectionBorderStyle">
                                <option value="left">Left accent (default)</option>
                                <option value="full-muted">Full border (muted)</option>
                                <option value="full-accent">Full border (accent)</option>
                                <option value="none">No border</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Corner Radius</label>
                            <input type="range" min="0" max="24" value="8" data-action="update-section-radius" id="sectionRadius">
                            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--fab-text-secondary);">
                                <span>Sharp</span>
                                <span id="sectionRadiusValue">8px</span>
                                <span>Round</span>
                            </div>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Sidebar Position</label>
                            <select class="font-select mt-0" data-action="update-sidebar-position" id="sidebarPosition">
                                <option value="right">Right (default)</option>
                                <option value="left">Left</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Typography Section
     */
    _buildTypographySection: function() {
        return `
            <div class="token-section collapsed" data-section="typography">
                <div class="token-section-header" data-action="toggle-section" data-target="typography">
                    <span>Typography</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="fab-card">
                            <label class="field-label">Add Google Font</label>
                            <textarea class="font-input" id="fontEmbedCode" placeholder="Paste Google Fonts embed code here..." style="height: 60px; resize: vertical;"></textarea>
                            <button class="add-font-btn" data-action="add-font">Add Font to Page</button>
                            <div class="font-example-toggle" data-action="toggle-font-example">
                                ▶ Show example
                            </div>
                            <div class="font-example-content" id="fontExampleContent">
                                <strong>How to add Google Fonts:</strong>
                                <ol>
                                    <li>Go to <a href="https://fonts.google.com" target="_blank">fonts.google.com</a></li>
                                    <li>Select fonts and click <strong>"Get font"</strong></li>
                                    <li>Click <strong>"Get embed code"</strong></li>
                                    <li>Copy the embed code and paste above</li>
                                </ol>
                                <div class="fab-tip">
                                    <strong>Tip:</strong> Mono fonts auto-assign to Code, sans fonts to Heading/Body.
                                </div>
                            </div>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Heading Font</label>
                            <select class="font-select mt-0" data-action="update-font" data-font-type="heading" id="headingFont">
                                <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">System (Default)</option>
                                <option value="'Courier New', monospace">Courier New</option>
                                <option value="Monaco, monospace">Monaco</option>
                                <option value="Georgia, serif">Georgia</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Body Font</label>
                            <select class="font-select mt-0" data-action="update-font" data-font-type="body" id="bodyFont">
                                <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">System (Default)</option>
                                <option value="'Courier New', monospace">Courier New</option>
                                <option value="Monaco, monospace">Monaco</option>
                                <option value="Georgia, serif">Georgia</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Code Font</label>
                            <select class="font-select mt-0" data-action="update-font" data-font-type="code" id="codeFont">
                                <option value="'Courier New', Monaco, monospace">Courier New (Default)</option>
                                <option value="Monaco, monospace">Monaco</option>
                                <option value="'Fira Code', monospace">Fira Code</option>
                                <option value="Consolas, monospace">Consolas</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Analysis Section - Usage and Deps integration
     */
    _buildAnalysisSection: function() {
        return `
            <div class="token-section collapsed" data-section="analysis">
                <div class="token-section-header" data-action="toggle-section" data-target="analysis">
                    <span>Analysis</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="token-group-title">Summary</div>
                        <div id="analysisSummary" class="help-text">
                            Click "Scan" to analyze token usage
                        </div>
                        <button class="design-panel-btn design-panel-btn--secondary mt-half" data-action="run-analysis">
                            Scan Tokens
                        </button>
                    </div>
                    <div class="token-group" id="analysisOrphans" style="display: none;">
                        <div class="token-group-title">Orphaned Tokens</div>
                        <div id="orphansList" class="help-text"></div>
                    </div>
                    <div class="token-group" id="analysisMissing" style="display: none;">
                        <div class="token-group-title">Missing Tokens</div>
                        <div id="missingList" class="help-text"></div>
                    </div>
                    <div class="token-group" id="analysisLayers" style="display: none;">
                        <div class="token-group-title">Dependency Layers</div>
                        <div id="layersList" class="help-text"></div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Export/Import Section
     */
    _buildExportSection: function() {
        return `
            <div class="token-section collapsed" data-section="export">
                <div class="token-section-header" data-action="toggle-section" data-target="export">
                    <span>Export / Import</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="token-group-title">Theme (tokens.json)</div>
                        <div class="design-panel-buttons mt-half">
                            <button class="design-panel-btn design-panel-btn--primary flex-1" data-action="export-theme">
                                Download
                            </button>
                            <button class="design-panel-btn design-panel-btn--secondary flex-1" data-action="import-theme">
                                Import
                            </button>
                        </div>
                        <p class="help-text">Full theme with metadata and TDS mapping</p>
                    </div>
                    <div class="token-group">
                        <div class="token-group-title">CSS Variables</div>
                        <div class="design-panel-buttons mt-half">
                            <button class="design-panel-btn design-panel-btn--secondary flex-1" data-action="copy-css">
                                Copy CSS
                            </button>
                            <button class="design-panel-btn design-panel-btn--danger flex-1" data-action="reset-tokens">
                                Reset All
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // =========================================================================
    // ANALYSIS
    // =========================================================================

    /**
     * Run usage and dependency analysis
     */
    runAnalysis: function() {
        if (typeof TUT_Usage === 'undefined' || typeof TUT_Deps === 'undefined') {
            document.getElementById('analysisSummary').textContent = 'Analysis modules not loaded';
            return;
        }

        // Run scans
        TUT_Usage.scan();
        TUT_Deps.build();

        // Get summary
        const summary = TUT_Usage.getSummary();
        document.getElementById('analysisSummary').innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem;">
                <span>Total tokens:</span><span>${summary.total}</span>
                <span>Defined:</span><span>${summary.defined}</span>
                <span>Used:</span><span>${summary.used}</span>
                <span>Orphaned:</span><span style="color: var(--fab-warning);">${summary.orphans}</span>
                <span>Missing:</span><span style="color: var(--fab-error);">${summary.missing}</span>
            </div>
        `;

        // Show orphaned tokens
        const orphans = TUT_Usage.getOrphans();
        const orphansDiv = document.getElementById('analysisOrphans');
        const orphansList = document.getElementById('orphansList');
        if (orphans.length > 0) {
            orphansDiv.style.display = 'block';
            orphansList.innerHTML = orphans.map(t => `<code>${t.name}</code>`).join(', ');
        } else {
            orphansDiv.style.display = 'none';
        }

        // Show missing tokens
        const missing = TUT_Usage.getMissing();
        const missingDiv = document.getElementById('analysisMissing');
        const missingList = document.getElementById('missingList');
        if (missing.length > 0) {
            missingDiv.style.display = 'block';
            missingList.innerHTML = missing.map(t => `<code>${t.name}</code>`).join(', ');
        } else {
            missingDiv.style.display = 'none';
        }

        // Show dependency layers
        const layers = TUT_Deps.getLayers();
        const layersDiv = document.getElementById('analysisLayers');
        const layersList = document.getElementById('layersList');
        const layerKeys = Object.keys(layers).sort((a, b) => parseInt(a) - parseInt(b));
        if (layerKeys.length > 0) {
            layersDiv.style.display = 'block';
            layersList.innerHTML = layerKeys.map(depth =>
                `<div><strong>Layer ${depth}:</strong> ${layers[depth].length} tokens</div>`
            ).join('');
        } else {
            layersDiv.style.display = 'none';
        }
    },

    // =========================================================================
    // EVENT BINDING
    // =========================================================================

    /**
     * Bind panel events
     */
    _bindEvents: function() {
        // Event binding now handled by TUT_Actions delegation in api.js
    },

    /**
     * Update a token value
     */
    _updateToken: function(varName, value) {
        document.documentElement.style.setProperty(varName, value);

        // Update display
        const tokenName = varName.replace('--', '');
        const valueEl = document.getElementById(`token-${tokenName}`);
        if (valueEl) valueEl.textContent = value;

        // Update swatch
        const picker = document.querySelector(`[data-token="${varName}"]`);
        if (picker) {
            const swatch = picker.parentElement.querySelector('.token-swatch');
            if (swatch) swatch.style.background = value;
        }

        // Notify TUT_Tokens if available
        if (typeof TUT_Tokens !== 'undefined' && TUT_Tokens.update) {
            TUT_Tokens.update(varName.replace('--', ''), value, { silent: true });
        }

        // Record in usage history if available
        if (typeof TUT_Usage !== 'undefined' && TUT_Usage.recordChange) {
            const oldValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            TUT_Usage.recordChange(varName, oldValue, value);
        }
    },

    /**
     * Get current token value from DOM
     */
    _getTokenValue: function(varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    },

    // =========================================================================
    // EXISTING METHODS (preserved)
    // =========================================================================

    /**
     * Toggle design panel visibility
     */
    toggle: function() {
        const panel = document.getElementById('designPanel') || document.getElementById('design-panel');
        if (panel) {
            panel.classList.toggle('visible');
        }
    },

    /**
     * Close the panel
     */
    close: function() {
        const panel = document.getElementById('designPanel') || document.getElementById('design-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
    },

    /**
     * Toggle a collapsible section
     */
    toggleSection: function(sectionName) {
        const section = document.querySelector(`[data-section="${sectionName}"]`);
        if (!section) return;

        section.classList.toggle('collapsed');
        const toggle = section.querySelector('.section-toggle');
        if (toggle) {
            toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        }
    },

    /**
     * Collapse all sections
     */
    collapseAll: function() {
        document.querySelectorAll('.token-section').forEach(section => {
            section.classList.add('collapsed');
            const toggle = section.querySelector('.section-toggle');
            if (toggle) toggle.textContent = '▶';
        });
    },

    /**
     * Get theme metadata from form fields
     */
    getMetadata: function() {
        return {
            name: document.getElementById('themeName')?.value || 'my-theme',
            version: document.getElementById('themeVersion')?.value || '1.0.0',
            description: document.getElementById('themeDescription')?.value || 'Custom theme',
            author: document.getElementById('themeAuthor')?.value || 'Designer',
            temperature: document.getElementById('themeTemperature')?.value || 'neutral',
            colorMode: document.getElementById('themeColorMode')?.value || 'dark'
        };
    },

    /**
     * Set theme metadata in form fields
     */
    setMetadata: function(metadata) {
        if (metadata.name) {
            const el = document.getElementById('themeName');
            if (el) el.value = metadata.name;
        }
        if (metadata.version) {
            const el = document.getElementById('themeVersion');
            if (el) el.value = metadata.version;
        }
        if (metadata.description) {
            const el = document.getElementById('themeDescription');
            if (el) el.value = metadata.description;
        }
        if (metadata.author) {
            const el = document.getElementById('themeAuthor');
            if (el) el.value = metadata.author;
        }
        if (metadata.temperature) {
            const el = document.getElementById('themeTemperature');
            if (el) el.value = metadata.temperature;
        }
        if (metadata.colorMode) {
            const el = document.getElementById('themeColorMode');
            if (el) el.value = metadata.colorMode;
        }
    },

    /**
     * Update sidebar position
     */
    updateSidebarPosition: function(position) {
        document.body.setAttribute('data-sidebar-position', position);
        localStorage.setItem('tut-sidebar-position', position);
    },

    /**
     * Restore sidebar position from localStorage
     */
    restoreSidebarPosition: function() {
        const saved = localStorage.getItem('tut-sidebar-position');
        const current = document.body.getAttribute('data-sidebar-position');
        const position = saved || current || 'right';

        document.body.setAttribute('data-sidebar-position', position);
        const select = document.getElementById('sidebarPosition');
        if (select) select.value = position;
    },

    /**
     * Setup click-outside to close panel
     */
    setupClickOutside: function() {
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('designPanel');
            const fab = document.getElementById('designFab');
            if (panel && panel.classList.contains('visible') &&
                !panel.contains(e.target) &&
                fab && !fab.contains(e.target)) {
                panel.classList.remove('visible');
            }
        });
    },

    /**
     * Get all token definitions
     */
    getTokenDefinitions: function() {
        return this._getTokens();
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/fonts.js ===
/**
 * TUT Fonts - Google Fonts integration
 */

const TUT_Fonts = {
    loaded: [],

    /**
     * Update font for a type (heading, body, code)
     */
    update: function(type, font) {
        switch(type) {
            case 'heading':
                document.querySelectorAll('h1, h2, h3, .step-number').forEach(el => {
                    el.style.fontFamily = font;
                });
                break;
            case 'body':
                document.body.style.fontFamily = font;
                break;
            case 'code':
                document.querySelectorAll('code, .command-hint, .terminal-content, .token-name, .token-value').forEach(el => {
                    el.style.fontFamily = font;
                });
                break;
        }
    },

    /**
     * Reset fonts to defaults
     */
    reset: function() {
        const headingFont = document.getElementById('headingFont');
        const bodyFont = document.getElementById('bodyFont');
        const codeFont = document.getElementById('codeFont');

        if (headingFont) headingFont.value = TUT_DEFAULT_FONTS.heading;
        if (bodyFont) bodyFont.value = TUT_DEFAULT_FONTS.body;
        if (codeFont) codeFont.value = TUT_DEFAULT_FONTS.code;

        this.update('heading', TUT_DEFAULT_FONTS.heading);
        this.update('body', TUT_DEFAULT_FONTS.body);
        this.update('code', TUT_DEFAULT_FONTS.code);
    },

    /**
     * Toggle font example visibility
     */
    toggleExample: function() {
        const content = document.getElementById('fontExampleContent');
        const toggle = document.querySelector('.font-example-toggle');

        if (content.classList.contains('expanded')) {
            content.classList.remove('expanded');
            toggle.innerHTML = '> Show example';
        } else {
            content.classList.add('expanded');
            toggle.innerHTML = 'v Hide example';
        }
    },

    /**
     * Parse Google Fonts embed code
     */
    parseEmbed: function(embedCode) {
        const hrefMatch = embedCode.match(/href=["']([^"']+fonts\.googleapis\.com\/css2[^"']+)["']/);
        if (!hrefMatch) return null;

        const cdnUrl = hrefMatch[1];
        const urlParams = new URL(cdnUrl).searchParams;
        const families = urlParams.getAll('family');

        if (families.length === 0) return null;

        const fonts = families.map(familyStr => {
            const [nameWithPlus] = familyStr.split(':');
            const fontName = decodeURIComponent(nameWithPlus.replace(/\+/g, ' '));

            const nameLower = fontName.toLowerCase();
            let fallback = 'sans-serif';
            let category = 'body';

            if (nameLower.includes('mono') || nameLower.includes('code') || nameLower.includes('cascadia')) {
                fallback = 'monospace';
                category = 'code';
            } else if (nameLower.includes('serif') && !nameLower.includes('sans')) {
                fallback = 'serif';
            }

            return {
                fontName,
                fontFamily: `'${fontName}', ${fallback}`,
                fallback,
                category
            };
        });

        return { cdnUrl, fonts };
    },

    /**
     * Add Google Font from embed code
     */
    add: function() {
        const embedCode = document.getElementById('fontEmbedCode').value.trim();
        const btn = document.querySelector('.add-font-btn');

        if (!embedCode) {
            if (btn) tutShowFeedback(btn, 'Paste embed code first', 'error');
            return;
        }

        // Add preconnect links
        const preconnects = [
            { href: 'https://fonts.googleapis.com', crossorigin: false },
            { href: 'https://fonts.gstatic.com', crossorigin: true }
        ];

        preconnects.forEach(({ href, crossorigin }) => {
            if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'preconnect';
                link.href = href;
                if (crossorigin) link.crossOrigin = 'anonymous';
                document.head.appendChild(link);
            }
        });

        const parsed = this.parseEmbed(embedCode);
        if (!parsed) {
            if (btn) tutShowFeedback(btn, 'Invalid embed code', 'error');
            return;
        }

        const { cdnUrl, fonts } = parsed;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cdnUrl;
        link.id = 'custom-font-' + Date.now();
        document.head.appendChild(link);

        link.onload = () => {
            fonts.forEach(font => {
                const { fontName, fontFamily, category } = font;

                // Track loaded font
                const existing = this.loaded.find(f => f.fontFamily === fontFamily);
                if (!existing) {
                    this.loaded.push({ cdnUrl, fontFamily, fontName });
                }

                // Add to all dropdowns
                ['headingFont', 'bodyFont', 'codeFont'].forEach(id => {
                    const select = document.getElementById(id);
                    if (!select) return;

                    const existingOption = Array.from(select.options).find(opt => opt.value === fontFamily);
                    if (!existingOption) {
                        const option = document.createElement('option');
                        option.value = fontFamily;
                        option.textContent = fontName + ' (Custom)';
                        select.insertBefore(option, select.firstChild);
                    }
                });
            });

            // Auto-assign fonts by category
            const monoFont = fonts.find(f => f.category === 'code');
            const sansFont = fonts.find(f => f.category === 'body' && f.fallback === 'sans-serif');

            if (monoFont) {
                const codeSelect = document.getElementById('codeFont');
                if (codeSelect) {
                    codeSelect.value = monoFont.fontFamily;
                    this.update('code', monoFont.fontFamily);
                }
            }

            if (sansFont) {
                const headingSelect = document.getElementById('headingFont');
                const bodySelect = document.getElementById('bodyFont');
                if (headingSelect) {
                    headingSelect.value = sansFont.fontFamily;
                    this.update('heading', sansFont.fontFamily);
                }
                if (bodySelect) {
                    bodySelect.value = sansFont.fontFamily;
                    this.update('body', sansFont.fontFamily);
                }
            }

            if (btn) tutShowFeedback(btn, `${fonts.length} font${fonts.length > 1 ? 's' : ''} added`, 'success');
            document.getElementById('fontEmbedCode').value = '';
        };

        link.onerror = () => {
            link.remove();
            if (btn) tutShowFeedback(btn, 'Failed to load', 'error');
        };
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/export.js ===
/**
 * TUT Export - Theme export/import functionality
 */

const TUT_Export = {
    /**
     * Build complete theme object from current state
     */
    buildThemeObject: function() {
        const style = getComputedStyle(document.documentElement);
        const metadata = TUT_Panel.getMetadata();

        // Build tokens object
        const tokens = {};
        Object.keys(TUT_DEFAULT_TOKENS).forEach(cssVar => {
            const value = style.getPropertyValue(cssVar).trim();
            const tokenId = cssVar.replace('--', '');
            const meta = TUT_TOKEN_METADATA[cssVar] || {};

            tokens[tokenId] = {
                value: value,
                type: meta.type || 'color',
                cssVar: cssVar,
                tdsToken: meta.tdsToken || '',
                description: meta.description || '',
                appliesTo: meta.appliesTo || [],
                ...(meta.contrastWith ? { contrastWith: meta.contrastWith } : {})
            };
        });

        return {
            "$schema": "./design-tokens.schema.json",
            metadata: metadata,
            tokens: tokens,
            groups: [
                { id: "backgrounds", name: "Background Colors", description: "Surface colors forming the visual depth hierarchy", tokens: ["bg-primary", "bg-secondary", "bg-tertiary"], order: 1 },
                { id: "text", name: "Text Colors", description: "Typography colors for content hierarchy", tokens: ["text-primary", "text-secondary"], order: 2 },
                { id: "accents", name: "Accent Colors", description: "Interactive and emphasis colors", tokens: ["accent-primary", "accent-secondary"], order: 3 },
                { id: "status", name: "Status Colors", description: "Feedback and state indication", tokens: ["success", "warning", "error"], order: 4 },
                { id: "structure", name: "Structural Colors", description: "Borders, dividers, and highlights", tokens: ["border", "highlight"], order: 5 }
            ],
            layout: {
                surfaces: {
                    page: { background: "bg-primary" },
                    panel: { background: "bg-secondary", border: "border" },
                    header: { background: "bg-tertiary", border: "border" }
                },
                typography: {
                    heading: { foreground: "text-primary", accent: "accent-primary" },
                    body: { foreground: "text-secondary" },
                    code: { background: "bg-tertiary", foreground: "accent-primary", border: "border" }
                },
                interactive: {
                    "button-primary": { background: "accent-secondary", foreground: "text-primary" },
                    link: { foreground: "accent-primary" }
                },
                feedback: {
                    "success-box": { border: "success", background: "bg-tertiary" },
                    "warning-box": { border: "warning", background: "bg-tertiary" },
                    "error-box": { border: "error", background: "bg-tertiary" }
                }
            },
            tdsMapping: {
                "--bg-primary": "structural.bg.primary",
                "--bg-secondary": "structural.bg.secondary",
                "--bg-tertiary": "structural.bg.tertiary",
                "--text-primary": "text.primary",
                "--text-secondary": "text.secondary",
                "--accent-primary": "interactive.link",
                "--accent-secondary": "structural.secondary",
                "--success": "status.success",
                "--warning": "status.warning",
                "--error": "status.error",
                "--border": "structural.separator",
                "--highlight": "interactive.hover"
            }
        };
    },

    /**
     * Export theme as JSON file download
     */
    toJSON: function() {
        const theme = this.buildThemeObject();
        const themeName = theme.metadata.name;
        const jsonOutput = JSON.stringify(theme, null, 2);

        const blob = new Blob([jsonOutput], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${themeName}.tokens.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const btn = document.getElementById('exportThemeBtn');
        if (btn) tutShowFeedback(btn, 'Downloaded', 'success');
    },

    /**
     * Copy CSS to clipboard
     */
    toCSS: function() {
        const tokens = Object.keys(TUT_DEFAULT_TOKENS);
        const style = getComputedStyle(document.documentElement);

        let cssOutput = ':root {\n';
        tokens.forEach(token => {
            const value = style.getPropertyValue(token).trim();
            cssOutput += `    ${token}: ${value};\n`;
        });
        cssOutput += '}\n';

        // Add Google Fonts CDN URLs
        if (TUT_Fonts.loaded.length > 0) {
            cssOutput += '\n/* Google Fonts */\n';
            TUT_Fonts.loaded.forEach(font => {
                cssOutput += `/* GoogleFont: ${font.fontFamily} | ${font.cdnUrl} */\n`;
            });
        }

        navigator.clipboard.writeText(cssOutput).then(() => {
            const btn = document.getElementById('copyCSSBtn');
            if (btn) tutShowFeedback(btn, 'Copied', 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            const btn = document.getElementById('copyCSSBtn');
            if (btn) tutShowFeedback(btn, 'Failed', 'error');
        });
    },

    /**
     * Import theme from JSON file
     */
    fromJSON: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const theme = JSON.parse(event.target.result);
                    TUT_Themes.apply(theme);
                    TUT_Themes.save(theme);

                    const btn = document.getElementById('importThemeBtn');
                    if (btn) tutShowFeedback(btn, `Loaded: ${theme.metadata?.name || 'theme'}`, 'success');
                } catch (err) {
                    console.error('Failed to parse theme:', err);
                    tutShowInlineError('importExportSection', 'Invalid JSON file format');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/inspector.js ===
/**
 * TUT Inspector - Element inspector (Shift-Hold)
 */

const TUT_Inspector = {
    longPressTimer: null,
    progressTimer: null,
    currentElement: null,
    progressOverlay: null,
    startTime: 0,
    LONG_PRESS_DURATION: 1000,

    /**
     * Initialize inspector
     */
    init: function() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePanel();
        });
        document.addEventListener('mousedown', this.handleShiftMouseDown.bind(this), true);
        document.addEventListener('mouseup', this.handleMouseUp.bind(this), true);
    },

    /**
     * Create progress overlay
     */
    createProgressOverlay: function() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 3px solid var(--accent-primary);
            border-radius: 4px;
            background: radial-gradient(circle, transparent 0%, rgba(88, 166, 255, 0.1) 100%);
            z-index: 10000;
            transition: opacity 0.2s;
        `;
        overlay.innerHTML = `
            <div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
                        background: var(--bg-secondary); border: 2px solid var(--accent-primary);
                        border-radius: 20px; padding: 4px 12px; font-size: 11px;
                        font-family: 'Courier New', monospace; color: var(--accent-primary); white-space: nowrap;">
                <span class="progress-text">0.0s / 1.0s</span>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    },

    /**
     * Update progress overlay position and progress
     */
    updateProgressOverlay: function(element, progress) {
        if (!this.progressOverlay) return;
        const rect = element.getBoundingClientRect();
        this.progressOverlay.style.left = rect.left + 'px';
        this.progressOverlay.style.top = rect.top + 'px';
        this.progressOverlay.style.width = rect.width + 'px';
        this.progressOverlay.style.height = rect.height + 'px';

        const elapsed = (progress * this.LONG_PRESS_DURATION / 100) / 1000;
        const progressText = this.progressOverlay.querySelector('.progress-text');
        if (progressText) progressText.textContent = `${elapsed.toFixed(1)}s / 1.0s`;

        const alpha = Math.min(0.3, progress / 100 * 0.3);
        this.progressOverlay.style.background = `radial-gradient(circle, rgba(88, 166, 255, ${alpha}) 0%, rgba(88, 166, 255, ${alpha * 0.3}) 100%)`;
    },

    /**
     * Get XPath for element
     */
    getXPath: function(element) {
        if (element.id) return `//*[@id="${element.id}"]`;
        if (element === document.body) return '/html/body';

        let ix = 0;
        const siblings = element.parentNode?.childNodes || [];
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                const parentPath = element.parentNode ? this.getXPath(element.parentNode) : '';
                return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
        }
        return '';
    },

    /**
     * Extract design tokens from element
     */
    extractTokens: function(element) {
        const computed = window.getComputedStyle(element);
        return {
            element: {
                tag: element.tagName.toLowerCase(),
                classes: Array.from(element.classList).join(', ') || 'none',
                id: element.id || 'none',
                xpath: this.getXPath(element)
            },
            colors: {
                background: computed.backgroundColor,
                color: computed.color,
                borderColor: computed.borderTopColor
            },
            typography: {
                fontFamily: computed.fontFamily,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                lineHeight: computed.lineHeight,
                letterSpacing: computed.letterSpacing
            },
            spacing: {
                padding: computed.padding,
                margin: computed.margin
            },
            border: {
                width: computed.borderWidth,
                style: computed.borderStyle,
                radius: computed.borderRadius
            },
            layout: {
                display: computed.display,
                width: computed.width,
                height: computed.height
            }
        };
    },

    /**
     * Display element tokens in inspector panel
     */
    displayTokens: function(element, tokens) {
        let panel = document.getElementById('elementInspectorPanel');
        if (!panel) panel = this.createPanel();
        this.populatePanel(panel, element, tokens);
        panel.classList.add('visible');
        panel.style.display = 'flex';
    },

    /**
     * Create inspector panel
     */
    createPanel: function() {
        const panel = document.createElement('div');
        panel.id = 'elementInspectorPanel';
        panel.innerHTML = `
            <div class="inspector-header">
                <span>Element Design Tokens
                    <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: normal;">(drag to move)</span>
                </span>
                <span class="close-inspector" style="cursor: pointer; color: var(--text-secondary); font-size: 1.5rem; padding: 0 0.5rem;">&times;</span>
            </div>
            <div class="inspector-content"></div>
        `;
        this.makeDraggable(panel);
        panel.querySelector('.close-inspector').addEventListener('click', () => this.closePanel());
        document.body.appendChild(panel);
        return panel;
    },

    /**
     * Make panel draggable
     */
    makeDraggable: function(panel) {
        const header = panel.querySelector('.inspector-header');
        let isDragging = false, initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-inspector')) return;
            isDragging = true;
            initialX = e.clientX - (parseInt(panel.style.left) || 0);
            initialY = e.clientY - (parseInt(panel.style.top) || 0);
            panel.style.transform = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                panel.style.left = (e.clientX - initialX) + 'px';
                panel.style.top = (e.clientY - initialY) + 'px';
            }
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    },

    /**
     * Close inspector panel
     */
    closePanel: function() {
        const panel = document.getElementById('elementInspectorPanel');
        if (panel) {
            panel.classList.remove('visible');
            panel.style.display = 'none';
        }
    },

    /**
     * Populate inspector panel with tokens
     */
    populatePanel: function(panel, element, tokens) {
        const content = panel.querySelector('.inspector-content');

        let html = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border);">
                <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 0.5rem;">Element Info</div>
                <div style="font-family: 'Courier New', monospace; color: var(--text-secondary); font-size: 0.8rem;">
                    <div style="margin-bottom: 0.5rem;"><strong>Tag:</strong> &lt;${tokens.element.tag}&gt;</div>
                    <div style="margin-bottom: 0.5rem;"><strong>ID:</strong> ${tokens.element.id}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>Classes:</strong> ${tokens.element.classes}</div>
                    <div style="margin-bottom: 0.5rem;"><strong>XPath:</strong>
                        <div style="background: var(--bg-secondary); padding: 0.5rem; border-radius: 3px;
                                    margin-top: 0.25rem; word-break: break-all; color: var(--accent-primary);
                                    font-size: 0.75rem; border: 1px solid var(--border); cursor: pointer;"
                             onclick="navigator.clipboard.writeText('${tokens.element.xpath}')"
                             title="Click to copy">${tokens.element.xpath}</div>
                    </div>
                </div>
            </div>
        `;

        html += this.createTokenSection('Colors', tokens.colors);
        html += this.createTokenSection('Typography', tokens.typography);
        html += this.createTokenSection('Spacing', tokens.spacing);
        html += this.createTokenSection('Border', tokens.border);
        html += this.createTokenSection('Layout', tokens.layout);

        content.innerHTML = html;
    },

    /**
     * Create token section HTML
     */
    createTokenSection: function(title, tokens) {
        let html = `
            <div style="margin-bottom: 1.5rem;">
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;
                            font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">${title}</div>
        `;

        for (const [key, value] of Object.entries(tokens)) {
            const isColor = title === 'Colors';
            const colorSwatch = isColor && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent'
                ? `<div style="width: 24px; height: 24px; background: ${value}; border: 1px solid var(--border); border-radius: 3px; flex-shrink: 0;"></div>`
                : '';

            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;
                            padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px;">
                    ${colorSwatch}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${key}</div>
                        <div style="font-family: 'Courier New', monospace; font-size: 0.7rem;
                                    color: var(--accent-primary); overflow: hidden; text-overflow: ellipsis;">${value}</div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    },

    /**
     * Handle shift+mousedown for long press
     */
    handleShiftMouseDown: function(e) {
        if (!e.shiftKey) return;
        if (e.target.closest('#designPanel') ||
            e.target.closest('#elementInspectorPanel') ||
            e.target.closest('.design-fab')) return;

        e.preventDefault();
        e.stopPropagation();

        this.currentElement = e.target;
        this.startTime = Date.now();
        this.progressOverlay = this.createProgressOverlay();
        this.updateProgressOverlay(this.currentElement, 0);

        let progress = 0;
        this.progressTimer = setInterval(() => {
            progress = ((Date.now() - this.startTime) / this.LONG_PRESS_DURATION) * 100;
            this.updateProgressOverlay(this.currentElement, progress);
            if (progress >= 100) clearInterval(this.progressTimer);
        }, 50);

        this.longPressTimer = setTimeout(() => {
            this.longPressTimer = null;
            const tokens = this.extractTokens(this.currentElement);
            this.displayTokens(this.currentElement, tokens);

            if (this.progressTimer) {
                clearInterval(this.progressTimer);
                this.progressTimer = null;
            }
            if (this.progressOverlay) {
                this.progressOverlay.remove();
                this.progressOverlay = null;
            }
        }, this.LONG_PRESS_DURATION);
    },

    /**
     * Handle mouseup to cancel long press
     */
    handleMouseUp: function(e) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        if (this.progressOverlay) {
            this.progressOverlay.remove();
            this.progressOverlay = null;
        }
        this.currentElement = null;
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/usage.js ===
/**
 * TUT Usage - Token usage tracking and analytics
 *
 * Scans DOM and stylesheets to build a map of where tokens are used,
 * tracks changes over time, and identifies orphaned/missing tokens.
 */

const TUT_Usage = {
    // Token usage registry
    _registry: {},

    // Scan configuration
    _config: {
        scanInterval: null,
        autoScan: false,
        trackHistory: true,
        maxHistory: 50
    },

    /**
     * Initialize usage tracking
     */
    init: function() {
        this._registry = {};
        this.scan();
        console.log('[TUT.Usage] Initialized');
    },

    /**
     * Full scan - analyze DOM and stylesheets for token usage
     */
    scan: function() {
        const startTime = performance.now();

        // Reset counts (keep history)
        Object.keys(this._registry).forEach(token => {
            this._registry[token].references = [];
            this._registry[token].elements = 0;
            this._registry[token].stylesheets = [];
        });

        // Scan all defined tokens
        this._scanDefinitions();

        // Scan DOM for computed style usage
        this._scanDOM();

        // Scan stylesheets for references
        this._scanStylesheets();

        // Calculate derived metrics
        this._calculateMetrics();

        const elapsed = (performance.now() - startTime).toFixed(2);
        console.log(`[TUT.Usage] Scan complete: ${Object.keys(this._registry).length} tokens in ${elapsed}ms`);

        // Emit event
        if (typeof TERRAIN !== 'undefined' && TERRAIN.Events) {
            TERRAIN.Events.emit('tut:usage:scan', {
                tokens: Object.keys(this._registry).length,
                elapsed
            });
        }

        return this._registry;
    },

    /**
     * Scan :root for token definitions
     */
    _scanDefinitions: function() {
        const root = document.documentElement;
        const rootStyles = getComputedStyle(root);

        // Get all custom properties from stylesheets
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules || []) {
                    if (rule.selectorText === ':root' && rule.style) {
                        for (let i = 0; i < rule.style.length; i++) {
                            const prop = rule.style[i];
                            if (prop.startsWith('--')) {
                                this._ensureToken(prop);
                                this._registry[prop].defined = true;
                                this._registry[prop].value = rootStyles.getPropertyValue(prop).trim();
                                this._registry[prop].source = sheet.href || 'inline';
                            }
                        }
                    }
                }
            } catch (e) {
                // Cross-origin stylesheet, skip
            }
        }
    },

    /**
     * Scan DOM elements for token usage in computed styles
     */
    _scanDOM: function() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            this._scanElement(node);
        }
    },

    /**
     * Scan a single element for token usage
     */
    _scanElement: function(el) {
        // Skip script, style, and hidden elements
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return;

        const computed = getComputedStyle(el);
        const inline = el.style;

        // Check inline styles for var() references
        for (let i = 0; i < inline.length; i++) {
            const prop = inline[i];
            const value = inline.getPropertyValue(prop);
            this._extractTokenRefs(value, el, prop, 'inline');
        }

        // Track which tokens this element's computed style resolves to
        // by checking known token values
        Object.keys(this._registry).forEach(token => {
            const tokenValue = this._registry[token].value;
            if (!tokenValue) return;

            // Check common properties that use tokens
            const propsToCheck = [
                'background-color', 'color', 'border-color',
                'border-top-color', 'border-right-color',
                'border-bottom-color', 'border-left-color',
                'fill', 'stroke', 'box-shadow'
            ];

            propsToCheck.forEach(prop => {
                const computedValue = computed.getPropertyValue(prop);
                if (computedValue && computedValue.includes(tokenValue)) {
                    this._addReference(token, el, prop, 'computed');
                }
            });
        });
    },

    /**
     * Extract var(--token) references from a CSS value
     */
    _extractTokenRefs: function(value, el, prop, type) {
        const varRegex = /var\(\s*(--[\w-]+)/g;
        let match;
        while ((match = varRegex.exec(value)) !== null) {
            const token = match[1];
            this._ensureToken(token);
            this._addReference(token, el, prop, type);
        }
    },

    /**
     * Scan stylesheets for var() references
     */
    _scanStylesheets: function() {
        for (const sheet of document.styleSheets) {
            try {
                const href = sheet.href || 'inline';
                this._scanRules(sheet.cssRules, href);
            } catch (e) {
                // Cross-origin stylesheet
            }
        }
    },

    /**
     * Recursively scan CSS rules
     */
    _scanRules: function(rules, source) {
        if (!rules) return;

        for (const rule of rules) {
            if (rule.cssRules) {
                // @media, @supports, etc.
                this._scanRules(rule.cssRules, source);
            } else if (rule.style) {
                for (let i = 0; i < rule.style.length; i++) {
                    const prop = rule.style[i];
                    const value = rule.style.getPropertyValue(prop);

                    const varRegex = /var\(\s*(--[\w-]+)/g;
                    let match;
                    while ((match = varRegex.exec(value)) !== null) {
                        const token = match[1];
                        this._ensureToken(token);

                        if (!this._registry[token].stylesheets.includes(source)) {
                            this._registry[token].stylesheets.push(source);
                        }

                        this._registry[token].cssRules = (this._registry[token].cssRules || 0) + 1;
                    }
                }
            }
        }
    },

    /**
     * Ensure token exists in registry
     */
    _ensureToken: function(token) {
        if (!this._registry[token]) {
            this._registry[token] = {
                name: token,
                defined: false,
                value: null,
                source: null,
                references: [],
                elements: 0,
                stylesheets: [],
                cssRules: 0,
                history: [],
                firstSeen: Date.now(),
                lastChanged: null
            };
        }
    },

    /**
     * Add a reference to a token
     */
    _addReference: function(token, el, prop, type) {
        this._ensureToken(token);

        this._registry[token].references.push({
            element: el.tagName.toLowerCase(),
            id: el.id || null,
            classes: Array.from(el.classList).slice(0, 3),
            property: prop,
            type: type
        });

        this._registry[token].elements++;
    },

    /**
     * Calculate derived metrics
     */
    _calculateMetrics: function() {
        Object.values(this._registry).forEach(token => {
            // Components (unique class combinations)
            const components = new Set();
            token.references.forEach(ref => {
                if (ref.classes.length > 0) {
                    components.add(ref.classes[0]);
                }
            });
            token.components = Array.from(components);

            // Orphan detection
            token.isOrphan = token.defined && token.elements === 0 && token.cssRules === 0;

            // Missing detection (referenced but not defined)
            token.isMissing = !token.defined && (token.elements > 0 || token.cssRules > 0);
        });
    },

    /**
     * Record a value change in history
     */
    recordChange: function(token, oldValue, newValue) {
        this._ensureToken(token);

        if (this._config.trackHistory) {
            this._registry[token].history.unshift({
                from: oldValue,
                to: newValue,
                timestamp: Date.now()
            });

            // Trim history
            if (this._registry[token].history.length > this._config.maxHistory) {
                this._registry[token].history.pop();
            }
        }

        this._registry[token].lastChanged = Date.now();
        this._registry[token].value = newValue;
    },

    // =========================================================================
    // Query API
    // =========================================================================

    /**
     * Get usage data for a specific token
     */
    get: function(token) {
        return this._registry[token] || null;
    },

    /**
     * Get all tokens
     */
    getAll: function() {
        return { ...this._registry };
    },

    /**
     * Get tokens sorted by usage count
     */
    getByUsage: function() {
        return Object.values(this._registry)
            .sort((a, b) => b.elements - a.elements);
    },

    /**
     * Get orphaned tokens (defined but never used)
     */
    getOrphans: function() {
        return Object.values(this._registry)
            .filter(t => t.isOrphan);
    },

    /**
     * Get missing tokens (used but not defined)
     */
    getMissing: function() {
        return Object.values(this._registry)
            .filter(t => t.isMissing);
    },

    /**
     * Get tokens by component/class usage
     */
    getByComponent: function(component) {
        return Object.values(this._registry)
            .filter(t => t.components.includes(component));
    },

    /**
     * Get recently changed tokens
     */
    getRecentlyChanged: function(since = Date.now() - 3600000) {
        return Object.values(this._registry)
            .filter(t => t.lastChanged && t.lastChanged > since)
            .sort((a, b) => b.lastChanged - a.lastChanged);
    },

    /**
     * Get usage summary statistics
     */
    getSummary: function() {
        const tokens = Object.values(this._registry);
        return {
            total: tokens.length,
            defined: tokens.filter(t => t.defined).length,
            used: tokens.filter(t => t.elements > 0 || t.cssRules > 0).length,
            orphans: tokens.filter(t => t.isOrphan).length,
            missing: tokens.filter(t => t.isMissing).length,
            totalReferences: tokens.reduce((sum, t) => sum + t.elements, 0),
            mostUsed: tokens.sort((a, b) => b.elements - a.elements)[0]?.name || null
        };
    },

    /**
     * Find all elements using a specific token
     */
    findElements: function(token) {
        const elements = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const inline = node.style.cssText;
            if (inline.includes(token)) {
                elements.push(node);
            }
        }

        return elements;
    },

    /**
     * Highlight elements using a token (visual debugging)
     */
    highlight: function(token, color = 'rgba(255, 0, 0, 0.3)') {
        this.clearHighlights();

        const elements = this.findElements(token);
        elements.forEach(el => {
            el.dataset.tutHighlight = 'true';
            el.style.outline = `2px solid ${color}`;
            el.style.outlineOffset = '2px';
        });

        return elements.length;
    },

    /**
     * Clear all highlights
     */
    clearHighlights: function() {
        document.querySelectorAll('[data-tut-highlight]').forEach(el => {
            delete el.dataset.tutHighlight;
            el.style.outline = '';
            el.style.outlineOffset = '';
        });
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/deps.js ===
/**
 * TUT Deps - Token dependency graph
 *
 * Builds a graph of how tokens reference each other via var() fallbacks
 * and inheritance patterns. Enables impact analysis for token changes.
 */

const TUT_Deps = {
    // Dependency graph: token -> { dependsOn: [], dependents: [] }
    _graph: {},

    /**
     * Initialize dependency tracking
     */
    init: function() {
        this._graph = {};
        this.build();
        console.log('[TUT.Deps] Initialized');
    },

    /**
     * Build dependency graph from stylesheets
     */
    build: function() {
        this._graph = {};

        // Scan all stylesheets for var() with fallbacks
        for (const sheet of document.styleSheets) {
            try {
                this._scanRules(sheet.cssRules);
            } catch (e) {
                // Cross-origin stylesheet
            }
        }

        // Also scan inline styles
        document.querySelectorAll('[style]').forEach(el => {
            this._parseValue(el.style.cssText);
        });

        console.log(`[TUT.Deps] Built graph: ${Object.keys(this._graph).length} tokens`);
        return this._graph;
    },

    /**
     * Recursively scan CSS rules
     */
    _scanRules: function(rules) {
        if (!rules) return;

        for (const rule of rules) {
            if (rule.cssRules) {
                this._scanRules(rule.cssRules);
            } else if (rule.style) {
                for (let i = 0; i < rule.style.length; i++) {
                    const prop = rule.style[i];
                    const value = rule.style.getPropertyValue(prop);

                    // Check if this is a token definition
                    if (prop.startsWith('--')) {
                        this._ensureToken(prop);
                        // Check if the value references other tokens
                        this._parseValue(value, prop);
                    } else {
                        // Regular property using tokens
                        this._parseValue(value);
                    }
                }
            }
        }
    },

    /**
     * Parse a CSS value for var() references and build dependencies
     */
    _parseValue: function(value, definingToken = null) {
        // Match var(--token) and var(--token, fallback)
        // Handles nested: var(--a, var(--b, var(--c, default)))
        const tokens = this._extractTokens(value);

        if (definingToken && tokens.length > 0) {
            // This token depends on others
            this._ensureToken(definingToken);
            tokens.forEach(dep => {
                this._ensureToken(dep);
                this._addDependency(definingToken, dep);
            });
        }
    },

    /**
     * Extract all token names from a CSS value
     */
    _extractTokens: function(value) {
        const tokens = [];
        const regex = /var\(\s*(--[\w-]+)/g;
        let match;
        while ((match = regex.exec(value)) !== null) {
            tokens.push(match[1]);
        }
        return tokens;
    },

    /**
     * Ensure token exists in graph
     */
    _ensureToken: function(token) {
        if (!this._graph[token]) {
            this._graph[token] = {
                name: token,
                dependsOn: [],    // Tokens this one uses
                dependents: [],   // Tokens that use this one
                depth: 0          // Distance from root (no dependencies)
            };
        }
    },

    /**
     * Add a dependency relationship
     */
    _addDependency: function(token, dependsOn) {
        if (!this._graph[token].dependsOn.includes(dependsOn)) {
            this._graph[token].dependsOn.push(dependsOn);
        }
        if (!this._graph[dependsOn].dependents.includes(token)) {
            this._graph[dependsOn].dependents.push(token);
        }
    },

    // =========================================================================
    // Query API
    // =========================================================================

    /**
     * Get dependency info for a token
     */
    get: function(token) {
        return this._graph[token] || null;
    },

    /**
     * Get all tokens this one depends on (direct)
     */
    getDependencies: function(token) {
        return this._graph[token]?.dependsOn || [];
    },

    /**
     * Get all tokens that depend on this one (direct)
     */
    getDependents: function(token) {
        return this._graph[token]?.dependents || [];
    },

    /**
     * Get full dependency chain (recursive, all ancestors)
     */
    getFullDependencies: function(token, visited = new Set()) {
        if (visited.has(token)) return []; // Cycle detection
        visited.add(token);

        const direct = this.getDependencies(token);
        const all = [...direct];

        direct.forEach(dep => {
            all.push(...this.getFullDependencies(dep, visited));
        });

        return [...new Set(all)];
    },

    /**
     * Get full dependent chain (recursive, all descendants)
     */
    getFullDependents: function(token, visited = new Set()) {
        if (visited.has(token)) return [];
        visited.add(token);

        const direct = this.getDependents(token);
        const all = [...direct];

        direct.forEach(dep => {
            all.push(...this.getFullDependents(dep, visited));
        });

        return [...new Set(all)];
    },

    /**
     * Get impact analysis for changing a token
     * Returns all tokens and approximate element count affected
     */
    getImpact: function(token) {
        const affected = this.getFullDependents(token);
        affected.unshift(token); // Include self

        let totalElements = 0;
        if (typeof TUT_Usage !== 'undefined') {
            affected.forEach(t => {
                const usage = TUT_Usage.get(t);
                if (usage) totalElements += usage.elements;
            });
        }

        return {
            token,
            affectedTokens: affected,
            affectedCount: affected.length,
            estimatedElements: totalElements,
            risk: affected.length > 10 ? 'high' : affected.length > 3 ? 'medium' : 'low'
        };
    },

    /**
     * Get root tokens (no dependencies, foundation of design system)
     */
    getRoots: function() {
        return Object.values(this._graph)
            .filter(t => t.dependsOn.length === 0)
            .map(t => t.name);
    },

    /**
     * Get leaf tokens (nothing depends on them)
     */
    getLeaves: function() {
        return Object.values(this._graph)
            .filter(t => t.dependents.length === 0)
            .map(t => t.name);
    },

    /**
     * Detect circular dependencies
     */
    findCycles: function() {
        const cycles = [];
        const visited = new Set();
        const stack = new Set();

        const dfs = (token, path) => {
            if (stack.has(token)) {
                const cycleStart = path.indexOf(token);
                cycles.push(path.slice(cycleStart));
                return;
            }
            if (visited.has(token)) return;

            visited.add(token);
            stack.add(token);
            path.push(token);

            (this._graph[token]?.dependsOn || []).forEach(dep => {
                dfs(dep, [...path]);
            });

            stack.delete(token);
        };

        Object.keys(this._graph).forEach(token => {
            dfs(token, []);
        });

        return cycles;
    },

    /**
     * Get tokens grouped by depth (layers of abstraction)
     */
    getLayers: function() {
        const layers = {};

        // Calculate depth for each token
        const calculateDepth = (token, visited = new Set()) => {
            if (visited.has(token)) return 0;
            visited.add(token);

            const deps = this._graph[token]?.dependsOn || [];
            if (deps.length === 0) return 0;

            return 1 + Math.max(...deps.map(d => calculateDepth(d, visited)));
        };

        Object.keys(this._graph).forEach(token => {
            const depth = calculateDepth(token);
            this._graph[token].depth = depth;

            if (!layers[depth]) layers[depth] = [];
            layers[depth].push(token);
        });

        return layers;
    },

    /**
     * Export graph as DOT format (for visualization)
     */
    toDOT: function() {
        let dot = 'digraph TokenDeps {\n';
        dot += '  rankdir=TB;\n';
        dot += '  node [shape=box, style=rounded];\n\n';

        Object.entries(this._graph).forEach(([token, data]) => {
            const label = token.replace('--', '');
            dot += `  "${label}";\n`;

            data.dependsOn.forEach(dep => {
                const depLabel = dep.replace('--', '');
                dot += `  "${depLabel}" -> "${label}";\n`;
            });
        });

        dot += '}\n';
        return dot;
    },

    /**
     * Export as JSON for external tools
     */
    toJSON: function() {
        return JSON.stringify(this._graph, null, 2);
    }
};


// === /Users/mricos/src/devops/tetra/bash/terrain/../tut/src/api.js ===
/**
 * TUT API - Public interface and TERRAIN registration
 */

const TUT = {
    version: '1.0.0',
    _initialized: false,

    // Sub-modules (exposed for direct access)
    Tokens: TUT_Tokens,
    Themes: TUT_Themes,
    Panel: TUT_Panel,
    Fonts: TUT_Fonts,
    Export: TUT_Export,
    Inspector: TUT_Inspector,
    Usage: TUT_Usage,
    Deps: TUT_Deps,

    /**
     * Initialize TUT
     * @param {Object} options - Configuration options
     */
    init: function(options = {}) {
        if (this._initialized) {
            console.warn('[TUT] Already initialized');
            return this;
        }

        console.log('[TUT] Initializing v' + this.version);

        // Create FAB and Panel dynamically (if not already present)
        TUT_Panel.createFAB();
        TUT_Panel.create();

        // Initialize color pickers (for any existing pickers in DOM)
        TUT_Tokens.initPickers();

        // Initialize theme system
        TUT_Themes.init();

        // Restore sidebar position
        TUT_Panel.restoreSidebarPosition();

        // Collapse sections (except Theme Switcher and Colors)
        // Theme Switcher and Colors stay open by default

        // Setup click-outside handling
        TUT_Panel.setupClickOutside();

        // Initialize inspector
        TUT_Inspector.init();

        // Initialize usage tracking and dependency graph
        TUT_Usage.init();
        TUT_Deps.init();

        // Setup TERRAIN Bridge listeners
        this._setupBridge();

        // Setup event delegation for data-action attributes
        initTUTEventDelegation();

        this._initialized = true;

        // Emit init event
        if (typeof TERRAIN !== 'undefined' && TERRAIN.Events) {
            TERRAIN.Events.emit('tut:init');
        }

        console.log('[TUT] Initialized');
        return this;
    },

    /**
     * Destroy TUT instance
     */
    destroy: function() {
        if (!this._initialized) return;

        // Cleanup...
        this._initialized = false;

        if (typeof TERRAIN !== 'undefined' && TERRAIN.Events) {
            TERRAIN.Events.emit('tut:destroy');
        }
    },

    /**
     * Setup TERRAIN Bridge listeners for cross-iframe sync
     */
    _setupBridge: function() {
        if (typeof TERRAIN === 'undefined' || !TERRAIN.Bridge) return;

        // Listen for token changes from other frames
        TERRAIN.Bridge.on('tut:token-change', (data) => {
            if (data && data.name && data.value) {
                TUT_Tokens.update(data.name, data.value, { silent: true });
            }
        });

        // Listen for theme changes
        TERRAIN.Bridge.on('tut:theme-apply', (data) => {
            if (data && data.theme) {
                TUT_Themes.apply(data.theme);
            }
        });
    },

    // =========================================================================
    // Public API Methods
    // =========================================================================

    /**
     * Get a token value
     */
    getToken: function(name) {
        return TUT_Tokens.get(name);
    },

    /**
     * Set a token value
     */
    setToken: function(name, value, options) {
        TUT_Tokens.update(name, value, options);
    },

    /**
     * Get all token values
     */
    getAllTokens: function() {
        return TUT_Tokens.getAll();
    },

    /**
     * Reset all tokens to defaults
     */
    resetTokens: function() {
        TUT_Tokens.reset();
    },

    /**
     * Toggle design panel
     */
    togglePanel: function() {
        TUT_Panel.toggle();
    },

    /**
     * Export theme as JSON
     */
    exportJSON: function() {
        TUT_Export.toJSON();
    },

    /**
     * Export theme as CSS
     */
    exportCSS: function() {
        TUT_Export.toCSS();
    },

    /**
     * Import theme from file
     */
    importJSON: function() {
        TUT_Export.fromJSON();
    },

    /**
     * Build theme object
     */
    buildTheme: function() {
        return TUT_Export.buildThemeObject();
    },

    /**
     * Apply a theme object
     */
    applyTheme: function(theme) {
        TUT_Themes.apply(theme);
    },

    /**
     * Save current theme
     */
    saveTheme: function() {
        TUT_Themes.saveCurrent();
    },

    /**
     * Broadcast token change to other frames
     */
    broadcastToken: function(name, value) {
        if (typeof TERRAIN !== 'undefined' && TERRAIN.Bridge) {
            TERRAIN.Bridge.broadcast('tut:token-change', { name, value });
        }
    },

    /**
     * Broadcast theme to other frames
     */
    broadcastTheme: function(theme) {
        if (typeof TERRAIN !== 'undefined' && TERRAIN.Bridge) {
            TERRAIN.Bridge.broadcast('tut:theme-apply', { theme });
        }
    }
};

// =========================================================================
// Event Delegation - Single handler for all TUT actions
// Uses data-action attributes instead of individual onclick handlers
// =========================================================================

const TUT_Actions = {
    // Panel controls
    'toggle-panel': () => TUT.togglePanel(),
    'toggle-section': (el) => TUT_Panel.toggleSection(el.dataset.target),
    'close-panel': () => TUT_Panel.close(),

    // Token updates
    'update-token': (el) => TUT_Tokens.update(el.dataset.token, el.value),
    'update-section-border': (el) => TUT_Tokens.updateSectionBorder(el.value),
    'update-section-radius': (el) => TUT_Tokens.updateSectionRadius(el.value),
    'update-sidebar-position': (el) => TUT_Panel.updateSidebarPosition(el.value),
    'update-font': (el) => TUT_Fonts.update(el.dataset.fontType, el.value),
    'reset-tokens': () => TUT_Tokens.reset(),

    // Theme management
    'switch-theme': (el) => TUT_Themes.switch(el.value),
    'save-theme': () => TUT_Themes.saveCurrent(),
    'delete-theme': () => TUT_Themes.deleteCurrent(),

    // Export/Import
    'export-theme': () => TUT_Export.toJSON(),
    'copy-css': () => TUT_Export.toCSS(),
    'import-theme': () => TUT_Export.fromJSON(),

    // Fonts
    'add-font': () => TUT_Fonts.add(),
    'toggle-font-example': () => TUT_Fonts.toggleExample(),

    // Analysis
    'run-analysis': () => TUT_Panel.runAnalysis()
};

/**
 * Initialize event delegation for TUT actions
 */
function initTUTEventDelegation() {
    document.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action && TUT_Actions[action]) {
            e.preventDefault();
            TUT_Actions[action](e.target);
        }
    });

    document.addEventListener('change', (e) => {
        const action = e.target.dataset.action;
        if (action && TUT_Actions[action]) {
            TUT_Actions[action](e.target);
        }
    });

    document.addEventListener('input', (e) => {
        const action = e.target.dataset.action;
        if (action && TUT_Actions[action]) {
            TUT_Actions[action](e.target);
        }
    });
}

// =========================================================================
// Auto-initialization based on URL param
// =========================================================================

(function() {
    const params = new URLSearchParams(window.location.search);

    if (!params.has('design')) {
        // Hide FAB and panel if design mode not enabled
        const style = document.createElement('style');
        style.textContent = '.design-fab, .design-panel, #elementInspectorPanel { display: none !important; }';
        document.head.appendChild(style);
    } else {
        // Design mode enabled - auto-init on DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => TUT.init());
        } else {
            TUT.init();
        }
    }
})();
    // === END MODULE ===

    // Register with TERRAIN
    TERRAIN.register('TUT', TUT);

})(window.TERRAIN);
