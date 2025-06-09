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

// Helper for logging within this module
function logPlugins(message, level = 'debug', type='PLUGINS') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

/**
 * Initialize plugins
 * @param {Array<String>} pluginNames Names of plugins to enable
 * @param {Object} options Configuration options
 * @returns {Promise<Map>} Map of initialized plugins
 */
export async function initPlugins(pluginNames = [], config = {}) {
  console.log('[PLUGINS DIAG] initPlugins called with pluginNames:', pluginNames, 'config:', config); // DIAGNOSTIC LOG
  try {
    console.log('*** initPlugins called with:', pluginNames);
    logPlugins(`[PREVIEW] Initializing plugins: ${pluginNames.join(', ')}`);
    
    // Is 'css' even in the pluginNames list?
    console.log('Is CSS plugin requested?', pluginNames.includes('css'));
    console.log('Available plugin modules:', Object.keys(pluginModules));
    
    enabledPlugins.clear();

    for (const name of pluginNames) {
      console.log(`*** Processing plugin: ${name}`);
      
      if (!builtInPlugins[name] && !pluginModules[name]) {
        console.log(`*** Plugin ${name} not found in builtIn or modules!`);
        logPlugins(`[PREVIEW WARNING] Plugin "${name}" not found`);
        continue;
      }

      try {
        console.log(`*** Starting initialization for: ${name}`);
        
        // Use a simplified approach - handle both module and class-based plugins
        if (name === 'css') {
          // Special handling for CSS plugin
          try {
            const cssPlugin = pluginModules[name];
            if (cssPlugin && typeof cssPlugin.init === 'function') {
              await cssPlugin.init(config);
              enabledPlugins.set(name, cssPlugin);
              logPlugins(`[PREVIEW] CSS plugin initialized successfully`);
            }
          } catch (error) {
            logPlugins(`[PREVIEW] Failed to initialize CSS plugin: ${error.message}`, 'error');
          }
        } else if (pluginModules[name]) {
          console.log(`*** Initializing module plugin: ${name}`);
          const modulePlugin = pluginModules[name];
          console.log(`*** Module structure:`, Object.keys(modulePlugin));
          
          if (typeof modulePlugin.init === 'function') {
            await modulePlugin.init(config);
            console.log(`*** Adding ${name} to enabledPlugins`);
            enabledPlugins.set(name, modulePlugin);
            console.log(`*** After adding, enabledPlugins has:`, [...enabledPlugins.keys()]);
            logPlugins(`[PREVIEW] Module plugin "${name}" initialized`);
          }
        } else if (builtInPlugins[name]) {
          console.log(`*** Initializing class plugin: ${name}`);
          // Class-based plugins
          let PluginClass = await builtInPlugins[name]();
          const plugin = new PluginClass();
          const initialized = await plugin.init(config);
          
          if (initialized) {
            enabledPlugins.set(name, plugin);
            logPlugins(`[PREVIEW] Plugin "${name}" initialized`);
          } else {
            logPlugins(`[PREVIEW WARNING] Plugin "${name}" initialization failed`);
          }
        }
      } catch (error) {
        console.log(`*** Error initializing ${name}:`, error);
        logPlugins(`[PREVIEW ERROR] Failed to initialize plugin "${name}": ${error.message}`);
        console.error(`[PREVIEW ERROR] Plugin "${name}":`, error);
      }
    }
    
    console.log('*** After all initialization, enabledPlugins has:', [...enabledPlugins.keys()]);
    return enabledPlugins;
  } catch (error) {
    logPlugins(`[PREVIEW ERROR] Plugin initialization failed: ${error.message}`);
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
      logPlugins(`[PREVIEW ERROR] Invalid plugin name: ${name}`);
      return false;
    }
    
    if (!plugin || typeof plugin !== 'object') {
      logPlugins(`[PREVIEW ERROR] Invalid plugin object for ${name}`);
      return false;
    }
    
    // Required plugin interface
    const requiredProps = ['init'];
    for (const prop of requiredProps) {
      if (typeof plugin[prop] !== 'function') {
        logPlugins(`[PREVIEW ERROR] Plugin ${name} missing required function: ${prop}`);
        return false;
      }
    }
    
    // Register the plugin
    plugins.set(name, plugin);
    logPlugins(`[PREVIEW] Registered plugin: ${name}`);
    return true;
  } catch (error) {
    logPlugins(`[PREVIEW ERROR] Failed to register plugin ${name}: ${error.message}`);
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
  const result = enabledPlugins.has(name);
  console.log(`[PLUGINS DIAG] isPluginEnabled("${name}") returning:`, result); // DIAGNOSTIC LOG
  return result;
}

/**
 * Initialize all registered plugins.
 * @param {HTMLElement} previewElement - The preview container element.
 */
export function initializePlugins(previewElement) {
    logPlugins(`Initializing ${plugins.length} plugins...`);
    plugins.forEach(plugin => {
        try {
            if (typeof plugin.initialize === 'function') {
                plugin.initialize(previewElement);
                logPlugins(`Initialized plugin: ${plugin.constructor.name}`);
            }
        } catch (error) {
             logPlugins(`Error initializing plugin ${plugin.constructor.name}: ${error.message}`, 'error');
             console.error(error); // Log full error object
        }
    });
    logPlugins('All plugins initialized.');
}

/**
 * Execute the processing logic for all registered plugins after rendering.
 * @param {HTMLElement} previewElement - The preview container element.
 */
export function processPlugins(previewElement) {
    logPlugins(`Processing ${plugins.length} plugins...`);
    plugins.forEach(plugin => {
        try {
            if (typeof plugin.process === 'function') {
                plugin.process(previewElement);
                logPlugins(`Processed plugin: ${plugin.constructor.name}`);
            }
        } catch (error) {
             logPlugins(`Error processing plugin ${plugin.constructor.name}: ${error.message}`, 'error');
             console.error(error); // Log full error object
        }
    });
    logPlugins('All plugins processed.');
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