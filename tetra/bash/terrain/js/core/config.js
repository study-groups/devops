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
