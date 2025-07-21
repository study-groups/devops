/**
 * Plugin Management System
 * 
 * Responsible for loading, registering, and managing preview plugins
 */

// client/preview/plugins/index.js - Manages preview plugins

// Plugin registry
const plugins = new Map();
const enabledPlugins = new Map();

// Built-in plugins with their classes
const builtInPlugins = {
  'mermaid': async () => (await import('./mermaid/index.js')).MermaidPlugin,
   'katex': async () => (await import('./katex.js')).KaTeXPlugin,
  'highlight': async () => (await import('./highlight.js')).HighlightPlugin,
  'audioMD': async () => (await import('./audio-md.js')).AudioMDPlugin,
  'graphviz': async () => (await import('./graphviz.js')).GraphvizPlugin
};

import * as CssPlugin from './css.js';

const pluginModules = {
  'css': CssPlugin,
};

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('PluginManager');

/**
 * Initialize plugins
 * @param {Array<String>} pluginNames Names of plugins to enable
 * @param {Object} options Configuration options
 * @returns {Promise<Map>} Map of initialized plugins
 */
export async function initPlugins(pluginNames = [], config = {}) {
  try {
    log.info('PLUGINS', 'INIT_START', `[PREVIEW] Initializing plugins: ${pluginNames.join(', ')}`);
    
    enabledPlugins.clear();

    for (const name of pluginNames) {
      if (!builtInPlugins[name] && !pluginModules[name]) {
        log.warn('PLUGINS', 'PLUGIN_NOT_FOUND', `[PREVIEW WARNING] Plugin "${name}" not found`);
        continue;
      }

      try {
        // Use a simplified approach - handle both module and class-based plugins
        if (name === 'css') {
          // Special handling for CSS plugin
          try {
            const cssPlugin = pluginModules[name];
            if (cssPlugin && typeof cssPlugin.init === 'function') {
              await cssPlugin.init(config);
              enabledPlugins.set(name, cssPlugin);
              log.info('PLUGINS', 'CSS_PLUGIN_INIT_SUCCESS', `[PREVIEW] CSS plugin initialized successfully`);
            }
          } catch (error) {
            log.error('PLUGINS', 'CSS_PLUGIN_INIT_FAILED', `[PREVIEW] Failed to initialize CSS plugin: ${error.message}`, error);
          }
        } else if (pluginModules[name]) {
          const modulePlugin = pluginModules[name];
          
          if (typeof modulePlugin.init === 'function') {
            await modulePlugin.init(config);
            enabledPlugins.set(name, modulePlugin);
            log.info('PLUGINS', 'MODULE_PLUGIN_INIT_SUCCESS', `[PREVIEW] Module plugin "${name}" initialized`);
          }
        } else if (builtInPlugins[name]) {
          // Class-based plugins
          let PluginClass = await builtInPlugins[name]();
          const plugin = new PluginClass();
          const initialized = await plugin.init(config);
          
          if (initialized) {
            enabledPlugins.set(name, plugin);
            log.info('PLUGINS', 'CLASS_PLUGIN_INIT_SUCCESS', `[PREVIEW] Plugin "${name}" initialized`);
          } else {
            log.warn('PLUGINS', 'CLASS_PLUGIN_INIT_FAILED', `[PREVIEW WARNING] Plugin "${name}" initialization failed`);
          }
        }
      } catch (error) {
        log.error('PLUGINS', 'PLUGIN_INIT_FAILED', `[PREVIEW ERROR] Failed to initialize plugin "${name}": ${error.message}`, error);
      }
    }
    
    return enabledPlugins;
  } catch (error) {
    log.error('PLUGINS', 'INIT_PLUGINS_FAILED', `[PREVIEW ERROR] Plugin initialization failed: ${error.message}`, error);
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
      log.error('PLUGINS', 'INVALID_PLUGIN_NAME', `[PREVIEW ERROR] Invalid plugin name: ${name}`);
      return false;
    }
    
    if (!plugin || typeof plugin !== 'object') {
      log.error('PLUGINS', 'INVALID_PLUGIN_OBJECT', `[PREVIEW ERROR] Invalid plugin object for ${name}`);
      return false;
    }
    
    // Required plugin interface
    const requiredProps = ['init'];
    for (const prop of requiredProps) {
      if (typeof plugin[prop] !== 'function') {
        log.error('PLUGINS', 'MISSING_REQUIRED_FUNCTION', `[PREVIEW ERROR] Plugin ${name} missing required function: ${prop}`);
        return false;
      }
    }
    
    // Register the plugin
    plugins.set(name, plugin);
    log.info('PLUGINS', 'PLUGIN_REGISTERED', `[PREVIEW] Registered plugin: ${name}`);
    return true;
  } catch (error) {
    log.error('PLUGINS', 'PLUGIN_REGISTRATION_FAILED', `[PREVIEW ERROR] Failed to register plugin ${name}: ${error.message}`, error);
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
  const result = enabledPlugins.has(name);
  console.log(`[PLUGINS DIAG] isPluginEnabled("${name}") returning:`, result); // DIAGNOSTIC LOG
  return result;
}

/**
 * Initialize all registered plugins.
 * @param {HTMLElement} previewElement - The preview container element.
 */
export function initializePlugins(previewElement) {
    log.info('PLUGINS', 'INITIALIZING_ALL', `Initializing ${plugins.length} plugins...`);
    plugins.forEach(plugin => {
        try {
            if (typeof plugin.initialize === 'function') {
                plugin.initialize(previewElement);
                log.info('PLUGINS', 'PLUGIN_INITIALIZED', `Initialized plugin: ${plugin.constructor.name}`);
            }
        } catch (error) {
             log.error('PLUGINS', 'PLUGIN_INITIALIZATION_ERROR', `Error initializing plugin ${plugin.constructor.name}: ${error.message}`, error);
        }
    });
    log.info('PLUGINS', 'ALL_PLUGINS_INITIALIZED', 'All plugins initialized.');
}

/**
 * Execute the processing logic for all registered plugins after rendering.
 * @param {HTMLElement} previewElement - The preview container element.
 */
export function processPlugins(previewElement) {
    log.info('PLUGINS', 'PROCESSING_ALL', `Processing ${plugins.length} plugins...`);
    plugins.forEach(plugin => {
        try {
            if (typeof plugin.process === 'function') {
                plugin.process(previewElement);
                log.info('PLUGINS', 'PLUGIN_PROCESSED', `Processed plugin: ${plugin.constructor.name}`);
            }
        } catch (error) {
             log.error('PLUGINS', 'PLUGIN_PROCESSING_ERROR', `Error processing plugin ${plugin.constructor.name}: ${error.message}`, error);
        }
    });
    log.info('PLUGINS', 'ALL_PLUGINS_PROCESSED', 'All plugins processed.');
}

/**
 * Get the names of enabled plugins (useful for debugging).
 * @returns {string[]} Array of enabled plugin names.
 */
export function getEnabledPluginNames() {
    // Simple implementation: return constructor names
    return plugins.map(p => p.constructor.name);
}

// --- Export specific function for CSS ---
export async function applyCssStyles() {
    console.log("*** Entering applyCssStyles directly");
    
    // BYPASS THE ENABLEDPLUGINS CHECK - Call CSS functions directly
    try {
        // Import and call CSS module functions directly
        const cssModule = await import('./css.js');
        console.log("*** CSS module imported:", Object.keys(cssModule));
        
        if (typeof cssModule.applyStyles === 'function') {
            console.log("*** Calling applyStyles directly");
            await cssModule.applyStyles();
            console.log("*** Direct applyStyles call completed");
        } else {
            console.error("*** No applyStyles function found in CSS module");
        }
    } catch (error) {
        console.error('[DIRECT CSS Apply Error]', error);
    }
} 