/**
 * Plugin Management System
 * 
 * Responsible for loading, registering, and managing preview plugins
 */

// client/preview/plugins/index.js - Manages preview plugins

// REMOVED incorrect static imports for MermaidPlugin and HighlightPlugin
// They are loaded dynamically via builtInPlugins map below.

// Plugin registry
const plugins = new Map();
const enabledPlugins = new Map();

// Built-in plugins with their classes
const builtInPlugins = {
  'mermaid': async () => (await import('./mermaid.js')).MermaidPlugin,
  // 'katex': async () => (await import('./katex.js')).KaTeXPlugin, // <-- Disable custom plugin
  'highlight': async () => (await import('./highlight.js')).HighlightPlugin,
  'audioMD': async () => (await import('./audio-md.js')).AudioMDPlugin,
  'graphviz': async () => (await import('./graphviz.js')).GraphvizPlugin
};

// Helper for logging within this module
function logPlugins(message, level = 'text') {
    const prefix = '[PLUGINS]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

/**
 * Initialize plugins
 * @param {Array<String>} pluginNames Names of plugins to enable
 * @param {Object} options Configuration options
 * @returns {Promise<Map>} Map of initialized plugins
 */
export async function initPlugins(pluginNames = [], options = {}) {
  try {
    logPlugins(`[PREVIEW] Initializing plugins: ${pluginNames.join(', ')}`);
    enabledPlugins.clear();

    for (const name of pluginNames) {
      if (!builtInPlugins[name]) {
        logPlugins(`[PREVIEW WARNING] Plugin "${name}" not found`);
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
          logPlugins(`[PREVIEW] Plugin "${name}" initialized`);
        } else {
          logPlugins(`[PREVIEW WARNING] Plugin "${name}" initialization failed`);
        }
      } catch (error) {
        logPlugins(`[PREVIEW ERROR] Failed to initialize plugin "${name}": ${error.message}`);
        console.error(`[PREVIEW ERROR] Plugin "${name}":`, error);
      }
    }

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
  return enabledPlugins.has(name);
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