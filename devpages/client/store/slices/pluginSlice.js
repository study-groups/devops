/**
 * @file pluginSlice.js
 * @description Plugin state management slice.
 *
 * ARCHITECTURE BLUEPRINT: This slice follows the clean, refactored Redux pattern.
 * 1.  **Pure Reducers:** All reducers are pure functions that only modify the state.
 * 2.  **No Side Effects:** There are NO calls to `localStorage` or other APIs inside the slice.
 * 3.  **Centralized Persistence:** State persistence is handled declaratively by the `persistenceMiddleware`.
 *     Actions that should trigger a save are added to the middleware's whitelist.
 * 4.  **Thunks for Async Logic:** Thunks are used for asynchronous operations like dynamically loading modules.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    plugins: {
        mermaid: {
            enabled: true,
            settings: {
                theme: 'default',
                zoomEnabled: true,
                panEnabled: true,
                resizeEnabled: true,
                defaultWidth: 800,
                defaultHeight: 600
            },
            isLoaded: false
        },
        katex: {
            enabled: true,
            settings: {
                displayMode: false,
                trust: true,
                strict: false
            },
            isLoaded: false
        },
        highlight: {
            enabled: true,
            settings: {},
            isLoaded: false
        },
        svg: {
            enabled: true,
            settings: {
                inlineEnabled: true,
                sanitize: true,
                maxSize: 2
            },
            isLoaded: true  // SVG is built-in, no library to load
        },
        graphviz: {
            enabled: false,  // Disabled by default - viz.js library needs to be installed
            settings: {},
            isLoaded: false
        }
    },
    status: 'idle', // 'idle', 'loading', 'ready', 'error'
    error: null,
};

const pluginSlice = createSlice({
    name: 'plugins',
    initialState,
    reducers: {
        /**
         * Replaces the entire plugin state. Used for initializing from persisted state.
         * The persistence middleware will automatically save this change on next update.
         */
        setPluginsState(state, action) {
            state.plugins = action.payload;
            state.status = 'ready';
        },

        /**
         * Updates the settings for a specific plugin.
         * The persistence middleware will automatically save this change.
         */
        updatePluginSettings(state, action) {
            const { pluginId, settings } = action.payload;
            if (state.plugins[pluginId]) {
                state.plugins[pluginId].settings = { 
                    ...state.plugins[pluginId].settings, 
                    ...settings 
                };
            }
        },

        /**
         * Registers a new plugin with its initial configuration.
         * The persistence middleware will automatically save this change.
         */
        registerPlugin(state, action) {
            const { pluginId, config } = action.payload;
            if (!state.plugins[pluginId]) {
                state.plugins[pluginId] = { ...config, isLoaded: false };
            }
        },

        /**
         * Removes a plugin from the state.
         * The persistence middleware will automatically save this change.
         */
        unregisterPlugin(state, action) {
            const { pluginId } = action.payload;
            delete state.plugins[pluginId];
        },

        /**
         * Marks a plugin's module as successfully loaded.
         * The persistence middleware will automatically save this change.
         */
        setModuleLoaded(state, action) {
            const { pluginId } = action.payload;
            if (state.plugins[pluginId]) {
                state.plugins[pluginId].isLoaded = true;
            }
        },

        /**
         * Sets the enabled state for a plugin.
         * The persistence middleware will automatically save this change.
         */
        setPluginEnabled(state, action) {
            const { pluginId, enabled } = action.payload;
            if (state.plugins[pluginId]) {
                state.plugins[pluginId].enabled = enabled;
            } else {
                // Auto-register if plugin doesn't exist
                state.plugins[pluginId] = {
                    enabled,
                    settings: {},
                    isLoaded: false
                };
            }
        },

        /**
         * Resets the plugin state to its initial default.
         * The persistence middleware will automatically save the reset state.
         */
        resetPluginState: () => initialState,
    }
});

export const {
    setPluginsState,
    updatePluginSettings,
    registerPlugin,
    unregisterPlugin,
    setModuleLoaded,
    setPluginEnabled,
    resetPluginState,
} = pluginSlice.actions;

export const pluginReducer = pluginSlice.reducer;
export default pluginReducer;

// =================================================================
// THUNKS (for async and complex logic)
// =================================================================

export const pluginThunks = {
    /**
     * Toggles the 'enabled' status of a plugin.
     * This is a thunk because it needs to read the current state to flip the boolean.
     */
    togglePluginEnabled: (pluginId) => (dispatch, getState) => {
        const plugin = getState().plugins?.plugins[pluginId];
        if (plugin) {
            const currentEnabled = plugin.settings?.enabled || false;
            dispatch(updatePluginSettings({
                pluginId,
                settings: { enabled: !currentEnabled }
            }));
        }
    },

    /**
     * Dynamically loads a plugin's module from a given path.
     * Updates the state once the module is loaded.
     */
    loadPluginModule: (pluginId, modulePath) => async (dispatch) => {
        try {
            const module = await import(modulePath);
            dispatch(setModuleLoaded({ pluginId, module }));
            console.log(`[PluginSlice] Successfully loaded module for plugin: ${pluginId}`);
            return module;
        } catch (error) {
            console.error(`[PluginSlice] Error loading plugin module for ${pluginId}:`, error);
            throw error;
        }
    },
};

console.log('[PluginSlice] ✅ Refactored plugin slice ready.');
