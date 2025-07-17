/**
 * client/thunks/pluginThunks.js
 * Plugin thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';

// Helper for logging within this module
function logPlugin(message, level = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, 'PLUGIN');
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[PLUGIN] ${message}`);
    }
}

export const pluginThunks = {
    /**
     * Thunk for initializing plugins
     * @returns {Function} Thunk function
     */
    initializePlugins: () => async (dispatch, getState) => {
        try {
            logPlugin('Initializing plugins...');
            
            const state = getState();
            const plugins = state.plugins || {};
            
            // Load plugin state from localStorage
            try {
                const storedPlugins = localStorage.getItem('pluginsFullState');
                if (storedPlugins) {
                    const parsedPlugins = JSON.parse(storedPlugins);
                    logPlugin('Loaded plugin state from localStorage');
                    
                    // Dispatch plugin state update
                    dispatch({ 
                        type: ActionTypes.PLUGINS_SET_STATE, 
                        payload: parsedPlugins 
                    });
                }
            } catch (e) {
                logPlugin(`Failed to load plugin state: ${e.message}`, 'warning');
            }
            
            logPlugin('Plugins initialized successfully');
            return true;
        } catch (error) {
            logPlugin(`Error initializing plugins: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for updating plugin settings
     * @param {string} pluginId - Plugin ID
     * @param {object} settings - Plugin settings
     * @returns {Function} Thunk function
     */
    updatePluginSettings: (pluginId, settings) => async (dispatch, getState) => {
        try {
            logPlugin(`Updating settings for plugin: ${pluginId}`);
            
            dispatch({ 
                type: ActionTypes.PLUGINS_UPDATE_SETTINGS, 
                payload: { pluginId, settings } 
            });
            
            // Persist to localStorage
            try {
                const state = getState();
                const plugins = state.plugins || {};
                localStorage.setItem('pluginsFullState', JSON.stringify(plugins));
                logPlugin(`Plugin settings persisted to localStorage`);
            } catch (e) {
                logPlugin(`Failed to persist plugin settings: ${e.message}`, 'warning');
            }
            
            return settings;
        } catch (error) {
            logPlugin(`Error updating plugin settings: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for toggling plugin enabled state
     * @param {string} pluginId - Plugin ID
     * @returns {Function} Thunk function
     */
    togglePluginEnabled: (pluginId) => async (dispatch, getState) => {
        try {
            logPlugin(`Toggling enabled state for plugin: ${pluginId}`);
            
            const state = getState();
            const plugin = state.plugins?.[pluginId];
            const currentEnabled = plugin?.settings?.enabled || false;
            const newEnabled = !currentEnabled;
            
            dispatch({ 
                type: ActionTypes.PLUGINS_UPDATE_SETTINGS, 
                payload: { 
                    pluginId, 
                    settings: { ...plugin?.settings, enabled: newEnabled } 
                } 
            });
            
            // Persist to localStorage
            try {
                const updatedPlugins = { ...state.plugins };
                updatedPlugins[pluginId] = {
                    ...updatedPlugins[pluginId],
                    settings: { ...updatedPlugins[pluginId]?.settings, enabled: newEnabled }
                };
                localStorage.setItem('pluginsFullState', JSON.stringify(updatedPlugins));
                logPlugin(`Plugin enabled state persisted to localStorage: ${newEnabled}`);
            } catch (e) {
                logPlugin(`Failed to persist plugin enabled state: ${e.message}`, 'warning');
            }
            
            return newEnabled;
        } catch (error) {
            logPlugin(`Error toggling plugin enabled: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for loading plugin module
     * @param {string} pluginId - Plugin ID
     * @param {string} modulePath - Module path
     * @returns {Function} Thunk function
     */
    loadPluginModule: (pluginId, modulePath) => async (dispatch, getState) => {
        try {
            logPlugin(`Loading plugin module: ${modulePath} for plugin: ${pluginId}`);
            
            // Load the module dynamically
            const module = await import(modulePath);
            
            logPlugin(`Plugin module loaded successfully: ${pluginId}`);
            
            // Dispatch module loaded action
            dispatch({ 
                type: ActionTypes.PLUGINS_MODULE_LOADED, 
                payload: { pluginId, module } 
            });
            
            return module;
        } catch (error) {
            logPlugin(`Error loading plugin module: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for registering plugin
     * @param {string} pluginId - Plugin ID
     * @param {object} pluginConfig - Plugin configuration
     * @returns {Function} Thunk function
     */
    registerPlugin: (pluginId, pluginConfig) => async (dispatch, getState) => {
        try {
            logPlugin(`Registering plugin: ${pluginId}`);
            
            dispatch({ 
                type: ActionTypes.PLUGINS_REGISTER, 
                payload: { pluginId, config: pluginConfig } 
            });
            
            return pluginConfig;
        } catch (error) {
            logPlugin(`Error registering plugin: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for unregistering plugin
     * @param {string} pluginId - Plugin ID
     * @returns {Function} Thunk function
     */
    unregisterPlugin: (pluginId) => async (dispatch, getState) => {
        try {
            logPlugin(`Unregistering plugin: ${pluginId}`);
            
            dispatch({ 
                type: ActionTypes.PLUGINS_UNREGISTER, 
                payload: { pluginId } 
            });
            
            return true;
        } catch (error) {
            logPlugin(`Error unregistering plugin: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for saving plugin state
     * @returns {Function} Thunk function
     */
    savePluginState: () => async (dispatch, getState) => {
        try {
            logPlugin('Saving plugin state to localStorage...');
            
            const state = getState();
            const plugins = state.plugins || {};
            
            localStorage.setItem('pluginsFullState', JSON.stringify(plugins));
            logPlugin('Plugin state saved to localStorage');
            
            return plugins;
        } catch (error) {
            logPlugin(`Error saving plugin state: ${error.message}`, 'error');
            throw error;
        }
    }
}; 