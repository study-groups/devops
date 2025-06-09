/**
 * Data-Driven Plugin Loader
 * Generic plugin loading system based on configuration
 */

import { appStore } from '/client/appState.js';
import { getIsPluginEnabled, getAllPlugins } from '/client/store/selectors.js';
import { defaultPluginsConfig } from '/client/appState.js';

// Helper for logging
function logPluginLoader(message, level = 'info') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(`[PluginLoader] ${message}`, level, 'PLUGIN_LOADER');
    } else {
        console.log(`[PluginLoader] ${message}`);
    }
}

// Global plugin instance cache
const pluginInstances = new Map();

/**
 * Get plugin configuration from app state
 * @param {string} pluginId - Plugin identifier
 * @returns {Object} Plugin configuration
 */
export function getPluginConfig(pluginId) {
    // Get the static configuration from defaultPluginsConfig
    const staticConfig = defaultPluginsConfig[pluginId];
    if (!staticConfig) {
        throw new Error(`Plugin config not found in defaultPluginsConfig: ${pluginId}`);
    }
    
    // Get the runtime settings from state
    const state = appStore.getState();
    const allPlugins = getAllPlugins(state);
    const pluginStateData = allPlugins[pluginId];
    
    if (!pluginStateData) {
        throw new Error(`Plugin state not found: ${pluginId}`);
    }
    
    // Merge static config with runtime state
    return {
        ...staticConfig,
        ...pluginStateData
    };
}

/**
 * Get current plugin settings from state
 * @param {string} pluginId - Plugin identifier
 * @returns {Object} Current plugin settings
 */
export function getCurrentPluginSettings(pluginId) {
    const state = appStore.getState();
    const allPlugins = getAllPlugins(state);
    return allPlugins[pluginId]?.settings || {};
}

/**
 * Check if plugin is enabled in current state
 * @param {string} pluginId - Plugin identifier
 * @returns {boolean} Whether plugin is enabled
 */
export function isPluginCurrentlyEnabled(pluginId) {
    const state = appStore.getState();
    return getIsPluginEnabled(state, pluginId);
}

/**
 * Load plugin instance using data-driven configuration
 * @param {string} pluginId - Plugin identifier
 * @param {Object} config - Plugin configuration from defaultPluginsConfig
 * @returns {Promise<Object|null>} Plugin instance or null
 */
export async function loadPluginFromConfig(pluginId, config) {
    // Return cached instance if available
    if (pluginInstances.has(pluginId)) {
        return pluginInstances.get(pluginId);
    }

    logPluginLoader(`Loading plugin: ${pluginId}`);

    try {
        let pluginInstance = null;
        const currentSettings = getCurrentPluginSettings(pluginId);

        if (config.module && config.exportName) {
            // Modern class-based loading
            logPluginLoader(`Loading module: ${config.module}, export: ${config.exportName}`);
            const module = await import(config.module);
            const PluginClass = module[config.exportName];
            
            if (!PluginClass) {
                throw new Error(`Export '${config.exportName}' not found in module '${config.module}'`);
            }

            pluginInstance = new PluginClass(currentSettings);
            
            // Initialize if method exists
            if (typeof pluginInstance.init === 'function') {
                await pluginInstance.init();
            }
            
        } else if (config.legacyInitFunction) {
            // Legacy function-based loading (backwards compatibility)
            logPluginLoader(`Using legacy init function: ${config.legacyInitFunction}`);
            const initFunction = window[config.legacyInitFunction];
            
            if (typeof initFunction === 'function') {
                pluginInstance = await initFunction(currentSettings);
            } else {
                throw new Error(`Legacy init function '${config.legacyInitFunction}' not found`);
            }
        } else {
            throw new Error(`No loading method specified for plugin: ${pluginId}`);
        }

        if (pluginInstance) {
            pluginInstances.set(pluginId, pluginInstance);
            logPluginLoader(`Successfully loaded plugin: ${pluginId}`);
        }

        return pluginInstance;
    } catch (error) {
        logPluginLoader(`Failed to load plugin ${pluginId}: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Get plugin instance (with lazy loading)
 * @param {string} pluginId - Plugin identifier
 * @returns {Promise<Object|null>} Plugin instance or null
 */
export async function getPlugin(pluginId) {
    // Check if plugin is enabled
    if (!isPluginCurrentlyEnabled(pluginId)) {
        return null;
    }

    // Return cached instance
    if (pluginInstances.has(pluginId)) {
        return pluginInstances.get(pluginId);
    }

    // Load plugin using configuration
    const config = getPluginConfig(pluginId);
    return await loadPluginFromConfig(pluginId, config);
}

/**
 * Get plugin instance synchronously (no loading)
 * @param {string} pluginId - Plugin identifier
 * @returns {Object|null} Plugin instance or null
 */
export function getPluginSync(pluginId) {
    return pluginInstances.get(pluginId) || null;
}

/**
 * Unload plugin instance
 * @param {string} pluginId - Plugin identifier
 */
export function unloadPlugin(pluginId) {
    const plugin = pluginInstances.get(pluginId);
    if (plugin && typeof plugin.destroy === 'function') {
        plugin.destroy();
    }
    pluginInstances.delete(pluginId);
    logPluginLoader(`Unloaded plugin: ${pluginId}`);
}

/**
 * Reload plugin with updated settings
 * @param {string} pluginId - Plugin identifier
 * @returns {Promise<Object|null>} New plugin instance
 */
export async function reloadPlugin(pluginId) {
    unloadPlugin(pluginId);
    return await getPlugin(pluginId);
}

/**
 * Get all currently loaded plugins
 * @returns {Map} Map of plugin ID to instance
 */
export function getAllLoadedPlugins() {
    return new Map(pluginInstances);
}

/**
 * Process all enabled plugins for an element
 * @param {HTMLElement} element - Element to process
 */
export async function processEnabledPlugins(element) {
    logPluginLoader('processEnabledPlugins called');
    
    const state = appStore.getState();
    const allPlugins = getAllPlugins(state);
    
    for (const pluginId in allPlugins) {
        const isEnabled = getIsPluginEnabled(state, pluginId);
        
        if (isEnabled) {
            const plugin = await getPlugin(pluginId);
            
            if (plugin && typeof plugin.process === 'function') {
                try {
                    await plugin.process(element);
                    logPluginLoader(`Processed element with plugin: ${pluginId}`);
                } catch (error) {
                    logPluginLoader(`Error processing with plugin ${pluginId}: ${error.message}`, 'error');
                }
            }
        }
    }
    
    logPluginLoader('processEnabledPlugins completed');
}
