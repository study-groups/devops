/**
 * Plugin Management System
 * 
 * Responsible for loading, registering, and managing preview plugins
 */

import { logMessage } from '../../log/index.js';

// Plugin registry
const plugins = new Map();
const enabledPlugins = new Map();

// Built-in plugins with their classes
const builtInPlugins = {
  'mermaid': async () => (await import('./mermaid.js')).MermaidPlugin,
  'katex': async () => (await import('./katex.js')).KaTeXPlugin,
  'highlight': async () => (await import('./highlight.js')).HighlightPlugin,
  'audioMD': async () => (await import('./audio-md.js')).AudioMDPlugin
};

/**
 * Initialize plugins
 * @param {Array<String>} pluginNames Names of plugins to enable
 * @param {Object} options Configuration options
 * @returns {Promise<Map>} Map of initialized plugins
 */
export async function initPlugins(pluginNames = [], options = {}) {
  try {
    logMessage('[PREVIEW] Initializing plugins:', pluginNames);
    enabledPlugins.clear();

    for (const name of pluginNames) {
      if (!builtInPlugins[name]) {
        logMessage(`[PREVIEW WARNING] Plugin "${name}" not found`);
        continue;
      }

      try {
        // Get the plugin class and verify it exists
        const PluginClass = await builtInPlugins[name]();
        if (typeof PluginClass !== 'function') {
          throw new Error(`Plugin ${name} did not return a valid class`);
        }

        // Create instance and initialize
        const plugin = new PluginClass();
        const initialized = await plugin.init(options);
        
        if (initialized) {
          enabledPlugins.set(name, plugin);
          logMessage(`[PREVIEW] Plugin "${name}" initialized`);
        } else {
          logMessage(`[PREVIEW WARNING] Plugin "${name}" initialization failed`);
        }
      } catch (error) {
        logMessage(`[PREVIEW ERROR] Failed to initialize plugin "${name}": ${error.message}`);
        console.error(`[PREVIEW ERROR] Plugin "${name}":`, error);
      }
    }

    return enabledPlugins;
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Plugin initialization failed: ${error.message}`);
    console.error('[PREVIEW ERROR] Plugin system:', error);
    return new Map();
  }
}

/**
 * Register a custom plugin
 * @param {String} name Plugin name
 * @param {Object} plugin Plugin object
 * @returns {Boolean} Whether registration was successful
 */
export function registerPlugin(name, plugin) {
  try {
    if (!name || typeof name !== 'string') {
      logMessage(`[PREVIEW ERROR] Invalid plugin name: ${name}`);
      return false;
    }
    
    if (!plugin || typeof plugin !== 'object') {
      logMessage(`[PREVIEW ERROR] Invalid plugin object for ${name}`);
      return false;
    }
    
    // Required plugin interface
    const requiredProps = ['init'];
    for (const prop of requiredProps) {
      if (typeof plugin[prop] !== 'function') {
        logMessage(`[PREVIEW ERROR] Plugin ${name} missing required function: ${prop}`);
        return false;
      }
    }
    
    // Register the plugin
    plugins.set(name, plugin);
    logMessage(`[PREVIEW] Registered plugin: ${name}`);
    return true;
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to register plugin ${name}: ${error.message}`);
    console.error(`[PREVIEW ERROR] Plugin ${name}:`, error);
    return false;
  }
}

/**
 * Get all enabled plugins
 * @returns {Map} Map of enabled plugins
 */
export function getEnabledPlugins() {
  return enabledPlugins;
}

/**
 * Get a specific plugin by name
 * @param {String} name Plugin name
 * @returns {Object|null} Plugin object or null if not found
 */
export function getPlugin(name) {
  return plugins.get(name) || null;
}

/**
 * Check if a plugin is enabled
 * @param {String} name Plugin name
 * @returns {Boolean} Whether the plugin is enabled
 */
export function isPluginEnabled(name) {
  return enabledPlugins.has(name);
} 