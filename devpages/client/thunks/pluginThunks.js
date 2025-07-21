/**
 * client/thunks/pluginThunks.js
 * Plugin thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('PluginThunks');

export const pluginThunks = {
    /**
     * Thunk for initializing plugins
     * @returns {Function} Thunk function
     */
    initializePlugins: () => async (dispatch, getState) => {
        try {
            log.info('PLUGIN', 'INIT_START', 'Initializing plugins...');
            
            const state = getState();
            const plugins = state.plugins || {};
            
            // Load plugin state from localStorage
            try {
                const storedPlugins = localStorage.getItem('pluginsFullState');
                if (storedPlugins) {
                    const parsedPlugins = JSON.parse(storedPlugins);
                    log.info('PLUGIN', 'LOAD_STATE_SUCCESS', 'Loaded plugin state from localStorage');
                    
                    // Dispatch plugin state update
                    dispatch({ 
                        type: ActionTypes.PLUGINS_SET_STATE, 
                        payload: parsedPlugins 
                    });
                }
            } catch (e) {
                log.warn('PLUGIN', 'LOAD_STATE_FAILED', `Failed to load plugin state: ${e.message}`, e);
            }
            
            log.info('PLUGIN', 'INIT_SUCCESS', 'Plugins initialized successfully');
            return true;
        } catch (error) {
            log.error('PLUGIN', 'INIT_ERROR', `Error initializing plugins: ${error.message}`, error);
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
            log.info('PLUGIN', 'UPDATE_SETTINGS', `Updating settings for plugin: ${pluginId}`);
            
            dispatch({ 
                type: ActionTypes.PLUGINS_UPDATE_SETTINGS, 
                payload: { pluginId, settings } 
            });
            
            // Persist to localStorage
            try {
                const state = getState();
                const plugins = state.plugins || {};
                localStorage.setItem('pluginsFullState', JSON.stringify(plugins));
                log.info('PLUGIN', 'PERSIST_SETTINGS_SUCCESS', `Plugin settings persisted to localStorage`);
            } catch (e) {
                log.warn('PLUGIN', 'PERSIST_SETTINGS_FAILED', `Failed to persist plugin settings: ${e.message}`, e);
            }
            
            return settings;
        } catch (error) {
            log.error('PLUGIN', 'UPDATE_SETTINGS_ERROR', `Error updating plugin settings: ${error.message}`, error);
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
            log.info('PLUGIN', 'TOGGLE_ENABLED', `Toggling enabled state for plugin: ${pluginId}`);
            
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
                log.info('PLUGIN', 'PERSIST_ENABLED_STATE_SUCCESS', `Plugin enabled state persisted to localStorage: ${newEnabled}`);
            } catch (e) {
                log.warn('PLUGIN', 'PERSIST_ENABLED_STATE_FAILED', `Failed to persist plugin enabled state: ${e.message}`, e);
            }
            
            return newEnabled;
        } catch (error) {
            log.error('PLUGIN', 'TOGGLE_ENABLED_ERROR', `Error toggling plugin enabled: ${error.message}`, error);
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
            log.info('PLUGIN', 'LOAD_MODULE', `Loading plugin module: ${modulePath} for plugin: ${pluginId}`);
            
            // Load the module dynamically
            const module = await import(modulePath);
            
            log.info('PLUGIN', 'LOAD_MODULE_SUCCESS', `Plugin module loaded successfully: ${pluginId}`);
            
            // Dispatch module loaded action
            dispatch({ 
                type: ActionTypes.PLUGINS_MODULE_LOADED, 
                payload: { pluginId, module } 
            });
            
            return module;
        } catch (error) {
            log.error('PLUGIN', 'LOAD_MODULE_ERROR', `Error loading plugin module: ${error.message}`, error);
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
            log.info('PLUGIN', 'REGISTER', `Registering plugin: ${pluginId}`);
            
            dispatch({ 
                type: ActionTypes.PLUGINS_REGISTER, 
                payload: { pluginId, config: pluginConfig } 
            });
            
            return pluginConfig;
        } catch (error) {
            log.error('PLUGIN', 'REGISTER_ERROR', `Error registering plugin: ${error.message}`, error);
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
            log.info('PLUGIN', 'UNREGISTER', `Unregistering plugin: ${pluginId}`);
            
            dispatch({ 
                type: ActionTypes.PLUGINS_UNREGISTER, 
                payload: { pluginId } 
            });
            
            return true;
        } catch (error) {
            log.error('PLUGIN', 'UNREGISTER_ERROR', `Error unregistering plugin: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Thunk for saving plugin state
     * @returns {Function} Thunk function
     */
    savePluginState: () => async (dispatch, getState) => {
        try {
            log.info('PLUGIN', 'SAVE_STATE', 'Saving plugin state to localStorage...');
            
            const state = getState();
            const plugins = state.plugins || {};
            
            localStorage.setItem('pluginsFullState', JSON.stringify(plugins));
            log.info('PLUGIN', 'SAVE_STATE_SUCCESS', 'Plugin state saved to localStorage');
            
            return plugins;
        } catch (error) {
            log.error('PLUGIN', 'SAVE_STATE_ERROR', `Error saving plugin state: ${error.message}`, error);
            throw error;
        }
    }
}; 