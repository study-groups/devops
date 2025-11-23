/**
 * PluginRegistry v2 - Unified plugin management with Redux integration
 * Consolidates: PluginManager.js, PluginLoader.js, PluginRegistry.js
 * Single source of truth for plugin lifecycle
 */

import { appStore } from '/client/appState.js';
import { getAllPlugins, getIsPluginEnabled } from '/client/store/selectors.js';

const log = window.APP?.services?.log?.createLogger('PluginRegistry') || console;

/**
 * Plugin Registry - Centralized plugin lifecycle management
 */
export class PluginRegistry {
    constructor() {
        // Single Map for plugin instances (replaces 5 different Maps!)
        this.instances = new Map();

        // Built-in plugin loaders
        this.builtInPlugins = {
            'mermaid': () => import('./plugins/mermaid/index.js').then(m => m.MermaidPlugin),
            'katex': () => import('./plugins/katex.js').then(m => m.KaTeXPlugin),
            'highlight': () => import('./plugins/highlight.js').then(m => m.HighlightPlugin),
            'audioMD': () => import('./plugins/audio-md.js').then(m => m.AudioMDPlugin),
            'graphviz': () => import('./plugins/graphviz.js').then(m => m.GraphvizPlugin),
            'css': () => import('./plugins/css.js'),
            // SVG is built into MarkdownRenderingService, no separate plugin needed
            'svg': () => Promise.resolve({
                init: () => true,
                id: 'svg',
                builtIn: true
            })
        };

        // Track initialization promises to prevent duplicate loading
        this.initPromises = new Map();
    }

    /**
     * Get plugin configuration from Redux store
     * @param {string} pluginId - Plugin identifier
     * @returns {Object|null} Plugin configuration or null
     */
    getPluginConfig(pluginId) {
        const state = appStore.getState();
        const allPlugins = getAllPlugins(state);
        return allPlugins[pluginId] || null;
    }

    /**
     * Check if plugin is enabled in Redux store
     * @param {string} pluginId - Plugin identifier
     * @returns {boolean} Whether plugin is enabled
     */
    isPluginEnabled(pluginId) {
        const state = appStore.getState();
        return getIsPluginEnabled(state, pluginId);
    }

    /**
     * Get all enabled plugin configs from Redux
     * @returns {Array<Object>} Array of enabled plugin configs
     */
    getEnabledPluginConfigs() {
        const state = appStore.getState();
        const allPlugins = getAllPlugins(state);

        return Object.entries(allPlugins)
            .filter(([id, config]) => config.enabled !== false)
            .map(([id, config]) => ({ id, ...config }));
    }

    /**
     * Initialize a plugin
     * @param {string} pluginId - Plugin identifier
     * @param {Object} customConfig - Optional config override
     * @returns {Promise<Object|null>} Plugin instance or null
     */
    async initializePlugin(pluginId, customConfig = null) {
        // Check if plugin is enabled
        if (!this.isPluginEnabled(pluginId)) {
            log.info?.('PLUGIN', 'DISABLED', `Plugin ${pluginId} is disabled in store`);
            return null;
        }

        // Return existing instance if already initialized
        if (this.instances.has(pluginId)) {
            const instance = this.instances.get(pluginId);
            if (instance.initialized) {
                log.info?.('PLUGIN', 'CACHED', `Using cached instance: ${pluginId}`);
                return instance.plugin;
            }
        }

        // Return existing initialization promise if in progress
        if (this.initPromises.has(pluginId)) {
            log.info?.('PLUGIN', 'WAITING', `Waiting for initialization: ${pluginId}`);
            return await this.initPromises.get(pluginId);
        }

        // Start initialization
        const initPromise = this._initPlugin(pluginId, customConfig);
        this.initPromises.set(pluginId, initPromise);

        try {
            const plugin = await initPromise;
            return plugin;
        } finally {
            this.initPromises.delete(pluginId);
        }
    }

    /**
     * Internal plugin initialization
     * @private
     */
    async _initPlugin(pluginId, customConfig) {
        try {
            log.info?.('PLUGIN', 'INIT_START', `Initializing plugin: ${pluginId}`);

            // Get plugin config from store or use custom
            const config = customConfig || this.getPluginConfig(pluginId) || {};

            // Load plugin class/module
            if (!this.builtInPlugins[pluginId]) {
                log.error?.('PLUGIN', 'NOT_FOUND', `Plugin not found: ${pluginId}`);
                return null;
            }

            const PluginClassOrModule = await this.builtInPlugins[pluginId]();

            let plugin = null;

            // Handle module-based plugins (like CSS)
            if (typeof PluginClassOrModule === 'object' && PluginClassOrModule.init) {
                await PluginClassOrModule.init(config.settings || {});
                plugin = PluginClassOrModule;
                plugin.id = pluginId;
                plugin.isModuleBased = true;
                log.info?.('PLUGIN', 'MODULE_INIT', `Module plugin initialized: ${pluginId}`);
            }
            // Handle class-based plugins
            else if (typeof PluginClassOrModule === 'function') {
                plugin = new PluginClassOrModule();
                plugin.id = pluginId;

                if (typeof plugin.init === 'function') {
                    const initialized = await plugin.init(config.settings || {});
                    if (!initialized) {
                        log.warn?.('PLUGIN', 'INIT_FAILED', `Plugin init() returned false: ${pluginId}`);
                        return null;
                    }
                }

                log.info?.('PLUGIN', 'CLASS_INIT', `Class plugin initialized: ${pluginId}`);
            } else {
                log.error?.('PLUGIN', 'INVALID_TYPE', `Invalid plugin type: ${pluginId}`);
                return null;
            }

            // Store instance
            this.instances.set(pluginId, {
                plugin,
                config,
                initialized: true,
                loadedAt: Date.now()
            });

            log.info?.('PLUGIN', 'INIT_SUCCESS', `Plugin initialized successfully: ${pluginId}`);
            return plugin;

        } catch (error) {
            log.error?.('PLUGIN', 'INIT_ERROR', `Plugin initialization failed: ${pluginId}`, error);
            return null;
        }
    }

    /**
     * Initialize all enabled plugins
     * @returns {Promise<Array<Object>>} Array of initialized plugin instances
     */
    async initializeAllEnabled() {
        const enabledConfigs = this.getEnabledPluginConfigs();
        log.info?.('PLUGIN', 'INIT_ALL', `Initializing ${enabledConfigs.length} enabled plugins`);

        const plugins = await Promise.all(
            enabledConfigs.map(config => this.initializePlugin(config.id))
        );

        return plugins.filter(p => p !== null);
    }

    /**
     * Get initialized plugin instance
     * @param {string} pluginId - Plugin identifier
     * @returns {Object|null} Plugin instance or null
     */
    getPlugin(pluginId) {
        const entry = this.instances.get(pluginId);
        return entry?.initialized ? entry.plugin : null;
    }

    /**
     * Get all initialized plugin instances
     * @returns {Array<Object>} Array of plugin instances
     */
    getAllPlugins() {
        const plugins = [];

        for (const [id, entry] of this.instances.entries()) {
            if (entry.initialized) {
                plugins.push(entry.plugin);
            }
        }

        return plugins;
    }

    /**
     * Process enabled plugins on an element
     * This is the main integration point for post-render plugin processing
     *
     * @param {HTMLElement} element - Element to process
     * @returns {Promise<void>}
     */
    async processEnabledPlugins(element) {
        log.info?.('PLUGIN', 'PROCESS_START', 'Processing enabled plugins');

        if (!element) {
            log.warn?.('PLUGIN', 'NO_ELEMENT', 'No element provided for processing');
            return;
        }

        // Get enabled plugin IDs from Redux
        const state = appStore.getState();
        const allPlugins = getAllPlugins(state);

        for (const pluginId in allPlugins) {
            const isEnabled = getIsPluginEnabled(state, pluginId);

            if (isEnabled) {
                // Plugin enabled - initialize if needed and process
                let plugin = this.getPlugin(pluginId);

                if (!plugin) {
                    plugin = await this.initializePlugin(pluginId);
                }

                if (plugin && typeof plugin.process === 'function') {
                    try {
                        await plugin.process(element);
                        log.info?.('PLUGIN', 'PROCESSED', `Processed: ${pluginId}`);
                    } catch (error) {
                        log.error?.('PLUGIN', 'PROCESS_ERROR', `Error processing ${pluginId}`, error);
                    }
                }
            } else {
                // Plugin disabled - cleanup if instance exists
                const plugin = this.getPlugin(pluginId);

                if (plugin && typeof plugin.cleanup === 'function') {
                    try {
                        plugin.cleanup(element);
                        log.info?.('PLUGIN', 'CLEANUP', `Cleaned up: ${pluginId}`);
                    } catch (error) {
                        log.error?.('PLUGIN', 'CLEANUP_ERROR', `Error cleaning up ${pluginId}`, error);
                    }
                }
            }
        }

        log.info?.('PLUGIN', 'PROCESS_COMPLETE', 'Plugin processing complete');
    }

    /**
     * Reload a plugin (useful when settings change)
     * @param {string} pluginId - Plugin identifier
     * @returns {Promise<Object|null>} New plugin instance
     */
    async reloadPlugin(pluginId) {
        log.info?.('PLUGIN', 'RELOAD', `Reloading plugin: ${pluginId}`);

        // Cleanup existing instance
        await this.unloadPlugin(pluginId);

        // Reinitialize
        return await this.initializePlugin(pluginId);
    }

    /**
     * Unload a plugin
     * @param {string} pluginId - Plugin identifier
     */
    async unloadPlugin(pluginId) {
        const entry = this.instances.get(pluginId);

        if (!entry) {
            return;
        }

        try {
            // Call cleanup if available
            if (entry.plugin && typeof entry.plugin.cleanup === 'function') {
                await entry.plugin.cleanup();
            }

            this.instances.delete(pluginId);
            log.info?.('PLUGIN', 'UNLOADED', `Plugin unloaded: ${pluginId}`);
        } catch (error) {
            log.error?.('PLUGIN', 'UNLOAD_ERROR', `Error unloading ${pluginId}`, error);
        }
    }

    /**
     * Cleanup all plugins
     */
    async cleanup() {
        log.info?.('PLUGIN', 'CLEANUP_ALL', 'Cleaning up all plugins');

        const pluginIds = Array.from(this.instances.keys());

        for (const pluginId of pluginIds) {
            await this.unloadPlugin(pluginId);
        }

        log.info?.('PLUGIN', 'CLEANUP_COMPLETE', 'All plugins cleaned up');
    }

    /**
     * Get diagnostic info for debugging
     * @returns {Array<Object>} Array of plugin info
     */
    getDebugInfo() {
        const state = appStore.getState();
        const allPlugins = getAllPlugins(state);

        return Object.keys(allPlugins).map(pluginId => {
            const entry = this.instances.get(pluginId);
            const config = allPlugins[pluginId];

            return {
                id: pluginId,
                enabledInStore: config.enabled !== false,
                initialized: entry?.initialized || false,
                hasInstance: !!entry?.plugin,
                loadedAt: entry?.loadedAt || null,
                settings: config.settings || {}
            };
        });
    }
}

// Create and export singleton instance
export const pluginRegistry = new PluginRegistry();

export default pluginRegistry;
