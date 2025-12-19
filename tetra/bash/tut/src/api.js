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
