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

        // Clear all options and optgroups except first option
        const firstOption = dropdown.options[0];
        dropdown.innerHTML = '';
        if (firstOption) dropdown.appendChild(firstOption);

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
     * Prompts for name, prevents overwriting built-in themes
     */
    saveCurrent: function() {
        const theme = TUT_Export.buildThemeObject();
        const currentName = theme.metadata?.name || '';
        const isBuiltin = TUT_BUILTIN_THEMES.hasOwnProperty(currentName);

        // Generate default name for prompt
        let defaultName = currentName;
        if (isBuiltin || !currentName) {
            defaultName = currentName ? `${currentName}-custom` : 'my-theme';
        }

        // Prompt for theme name
        const newName = prompt('Save theme as:', defaultName);
        if (!newName) return; // User cancelled

        // Prevent overwriting built-in themes
        if (TUT_BUILTIN_THEMES.hasOwnProperty(newName)) {
            alert(`Cannot overwrite built-in theme "${newName}". Choose a different name.`);
            return;
        }

        // Update theme name and save
        theme.metadata.name = newName;
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
