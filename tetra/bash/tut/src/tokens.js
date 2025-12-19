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
