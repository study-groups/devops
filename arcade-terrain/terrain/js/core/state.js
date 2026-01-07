/**
 * Terrain State Module
 * Central state management with change notifications
 */
(function() {
    'use strict';

    // Get dependencies
    const Config = window.Terrain.Config;
    const Events = window.Terrain.Events;

    // Internal state object
    const state = {
        canvas: {
            translateX: 0,
            translateY: 0,
            scale: Config.canvas.scale,
            minScale: Config.canvas.minScale,
            maxScale: Config.canvas.maxScale,
            baseGridSize: Config.canvas.baseGridSize
        },
        stacking: {
            spacing: Config.stacking.spacing,
            stop: Config.stacking.stop
        },
        ui: Object.assign({}, Config.ui),
        fonts: JSON.parse(JSON.stringify(Config.fonts)),
        nodes: [],
        toastPresets: {
            fav1: null,
            fav2: null
        },
        panelPosition: {
            x: null,
            y: null
        },
        configSections: {
            allCollapsed: true
        }
    };

    const TerrainState = {
        /**
         * Get a state value by dot-notation path
         * @param {string} path - Path like 'canvas.translateX'
         * @returns {*} The value
         */
        get: function(path) {
            if (!path) return state;
            return path.split('.').reduce((obj, key) => obj && obj[key], state);
        },

        /**
         * Set a state value and emit change event
         * @param {string} path - Path like 'canvas.translateX'
         * @param {*} value - New value
         */
        set: function(path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => obj[key], state);

            if (target) {
                const oldValue = target[lastKey];
                target[lastKey] = value;

                Events.emit(Events.STATE_CHANGE, {
                    path: path,
                    oldValue: oldValue,
                    newValue: value
                });
            }
        },

        /**
         * Update multiple state values at once
         * @param {Object} updates - Object with path:value pairs
         */
        update: function(updates) {
            Object.keys(updates).forEach(path => {
                this.set(path, updates[path]);
            });
        },

        /**
         * Get the entire state object (for serialization)
         * @returns {Object} Deep copy of state
         */
        getAll: function() {
            return JSON.parse(JSON.stringify(state));
        },

        /**
         * Replace entire state (for loading saved state)
         * @param {Object} newState - New state object
         */
        replaceAll: function(newState) {
            // Merge carefully, preserving structure
            if (newState.canvas) Object.assign(state.canvas, newState.canvas);
            if (newState.stacking) Object.assign(state.stacking, newState.stacking);
            if (newState.ui) Object.assign(state.ui, newState.ui);
            if (newState.fonts) state.fonts = JSON.parse(JSON.stringify(newState.fonts));
            if (newState.nodes) state.nodes = JSON.parse(JSON.stringify(newState.nodes));
            // Backwards compat: support loading old 'projects' key
            if (newState.projects && !newState.nodes) state.nodes = JSON.parse(JSON.stringify(newState.projects));
            if (newState.toastPresets) Object.assign(state.toastPresets, newState.toastPresets);
            if (newState.panelPosition) Object.assign(state.panelPosition, newState.panelPosition);
            if (newState.configSections) Object.assign(state.configSections, newState.configSections);

            Events.emit(Events.STATE_LOADED, state);
        },

        /**
         * Reset state to defaults
         */
        reset: function() {
            state.canvas = {
                translateX: 0,
                translateY: 0,
                scale: Config.canvas.scale,
                minScale: Config.canvas.minScale,
                maxScale: Config.canvas.maxScale,
                baseGridSize: Config.canvas.baseGridSize
            };
            state.stacking = {
                spacing: Config.stacking.spacing,
                stop: Config.stacking.stop
            };
            state.ui = Object.assign({}, Config.ui);
            state.fonts = JSON.parse(JSON.stringify(Config.fonts));
            state.nodes = [];
            state.toastPresets = { fav1: null, fav2: null };
            state.panelPosition = { x: null, y: null };
            state.configSections = { allCollapsed: true };

            Events.emit(Events.STATE_CHANGE, { path: '*', reset: true });
        },

        // Convenience accessors
        canvas: {
            get translateX() { return state.canvas.translateX; },
            set translateX(v) { TerrainState.set('canvas.translateX', v); },
            get translateY() { return state.canvas.translateY; },
            set translateY(v) { TerrainState.set('canvas.translateY', v); },
            get scale() { return state.canvas.scale; },
            get baseGridSize() { return state.canvas.baseGridSize; }
        },

        stacking: {
            get spacing() { return state.stacking.spacing; },
            set spacing(v) { TerrainState.set('stacking.spacing', v); },
            get stop() { return state.stacking.stop; },
            set stop(v) { TerrainState.set('stacking.stop', v); }
        },

        ui: state.ui,
        fonts: state.fonts,

        // Nodes array operations
        nodes: {
            getAll: function() { return state.nodes; },
            get: function(index) { return state.nodes[index]; },
            add: function(node) {
                state.nodes.push(node);
                Events.emit(Events.NODE_ADD, node);
            },
            update: function(index, updates) {
                Object.assign(state.nodes[index], updates);
                Events.emit(Events.NODE_UPDATE, { index, node: state.nodes[index] });
            },
            remove: function(index) {
                const removed = state.nodes.splice(index, 1)[0];
                Events.emit(Events.NODE_DELETE, { index, node: removed });
            },
            setAll: function(nodes) {
                state.nodes = nodes;
            }
        },

        // Backwards compat alias
        get projects() {
            console.warn('[State] projects is deprecated, use nodes');
            return this.nodes;
        }
    };

    // Export to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.State = TerrainState;

})();
