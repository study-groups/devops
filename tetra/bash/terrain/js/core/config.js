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
            // Fixed scale (no zoom)
            scale: 1.0,
            baseGridSize: 50
        },

        stacking: {
            spacing: 8,
            stop: 0
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
        }
    };

    // Export to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Config = TerrainConfig;

})();
