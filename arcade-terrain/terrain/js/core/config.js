/**
 * Terrain Configuration Module
 * Feature flags and application defaults
 */
(function() {
    'use strict';

    // Parse URL parameters
    function getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    // Determine design mode from URL or config
    function resolveDesignMode(configDefault) {
        const urlParam = getUrlParam('design');
        if (urlParam === 'true') return true;
        if (urlParam === 'false') return false;
        return configDefault;
    }

    const TerrainConfig = {
        version: '1.0.0',

        features: {
            // Google Fonts support
            fonts: true,

            // Design token FAB - hidden by default, ?design=true to enable
            designMode: resolveDesignMode(false),

            // Toast panels enabled
            toasts: true
        },

        canvas: {
            scale: 1.0,
            minScale: 0.001,
            maxScale: 10,
            baseGridSize: 50
        },

        stacking: {
            spacing: 8,
            stop: 0
        },

        // Centralized UI constants (previously scattered as magic numbers)
        constants: {
            // Node dimensions
            FAB_HEIGHT: 64,
            TITLE_ONLY_HEIGHT: 22,
            NODE_MIN_WIDTH: 200,
            NODE_MAX_WIDTH: 600,
            NODE_DEFAULT_WIDTH: 320,

            // Grid rendering
            GRID_MIN_CELL_SIZE: 5,
            GRID_MAX_CELL_SIZE: 200,
            GRID_LINE_OPACITY: 0.1,
            GRID_LINE_WIDTH: 1,
            GRID_AXIS_OPACITY: 0.3,
            GRID_AXIS_WIDTH: 2,

            // Animation timing (ms)
            FADE_DURATION: 400,
            TOAST_DURATION: 3000,
            DEBOUNCE_DELAY: 150,

            // Zoom factors
            ZOOM_IN_FACTOR: 1.1,
            ZOOM_OUT_FACTOR: 0.9,

            // Panel dimensions
            CONFIG_PANEL_WIDTH: 300,
            INSPECTOR_WIDTH: 280,

            // Z-index layers
            Z_GRID: 0,
            Z_CANVAS: 1,
            Z_NODES: 10,
            Z_PANELS: 100,
            Z_TOASTS: 500,
            Z_OVERLAY: 9999
        },

        data: {
            source: 'static',
            defaultsPath: 'data/defaults.json'
        },

        ui: {
            nodes: true,
            grid: true
        },

        fonts: {
            primary: {
                cdn: '',
                family: "'SF Mono', 'Monaco', 'Courier New', monospace"
            },
            secondary: {
                cdn: '',
                family: "'SF Mono', 'Monaco', 'Courier New', monospace"
            },
            code: {
                cdn: '',
                family: "'Courier New', monospace"
            }
        },

        // Get a config value by dot-notation path
        get: function(path) {
            return path.split('.').reduce((obj, key) => obj && obj[key], this);
        },

        // Set a config value by dot-notation path
        set: function(path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => obj[key], this);
            if (target) {
                target[lastKey] = value;
            }
        },

        // Initialize from merged config (mode + app overrides)
        init: function(config) {
            // Deep merge config into this object
            const merge = (target, source) => {
                for (const key in source) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        target[key] = target[key] || {};
                        merge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            };
            merge(this, config);
            console.log('[Terrain.Config] Initialized with merged config');
        }
    };

    // Export to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Config = TerrainConfig;

})();
