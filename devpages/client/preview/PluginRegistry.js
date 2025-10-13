/**
 * PluginRegistry - Centralized plugin lifecycle management
 * Singleton registry with initialization, state tracking, and cleanup
 */

const log = window.APP?.services?.log?.createLogger('PluginRegistry') || console;

/**
 * Plugin Registry with lifecycle management
 */
export class PluginRegistry {
  constructor() {
    this.plugins = new Map(); // id -> { class, instance, config }
    this.builtInPlugins = {
      'mermaid': () => import('./plugins/mermaid/index.js').then(m => m.MermaidPlugin),
      'katex': () => import('./plugins/katex.js').then(m => m.KaTeXPlugin),
      'highlight': () => import('./plugins/highlight.js').then(m => m.HighlightPlugin),
      'audioMD': () => import('./plugins/audio-md.js').then(m => m.AudioMDPlugin),
      'graphviz': () => import('./plugins/graphviz.js').then(m => m.GraphvizPlugin),
      'css': () => import('./plugins/css.js')
    };
  }

  /**
   * Register a plugin class
   * @param {string} id - Unique plugin identifier
   * @param {Function|Object} PluginClassOrModule - Plugin class or module
   * @returns {boolean} Success status
   */
  register(id, PluginClassOrModule) {
    try {
      if (!id || typeof id !== 'string') {
        log.error?.('PLUGIN_REGISTRY', 'INVALID_ID', `Invalid plugin ID: ${id}`);
        return false;
      }

      this.plugins.set(id, {
        class: PluginClassOrModule,
        instance: null,
        config: {},
        initialized: false
      });

      log.info?.('PLUGIN_REGISTRY', 'REGISTERED', `Registered plugin: ${id}`);
      return true;
    } catch (error) {
      log.error?.('PLUGIN_REGISTRY', 'REGISTER_ERROR', `Failed to register plugin ${id}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Initialize specific plugins
   * @param {Array<string>} pluginIds - Plugin IDs to initialize
   * @param {Object} config - Configuration for plugins
   * @returns {Promise<Map>} Map of initialized plugin instances
   */
  async initialize(pluginIds = [], config = {}) {
    log.info?.('PLUGIN_REGISTRY', 'INIT_START', `Initializing plugins: ${pluginIds.join(', ')}`);

    for (const id of pluginIds) {
      await this.initializePlugin(id, config);
    }

    return this.getEnabledPlugins();
  }

  /**
   * Initialize a single plugin
   * @param {string} id - Plugin ID
   * @param {Object} config - Plugin configuration
   * @returns {Promise<boolean>} Success status
   */
  async initializePlugin(id, config = {}) {
    try {
      // Check if plugin is already registered
      let pluginEntry = this.plugins.get(id);

      // If not registered, try to load from built-in plugins
      if (!pluginEntry && this.builtInPlugins[id]) {
        try {
          const PluginClass = await this.builtInPlugins[id]();
          this.register(id, PluginClass);
          pluginEntry = this.plugins.get(id);
        } catch (error) {
          log.error?.('PLUGIN_REGISTRY', 'LOAD_FAILED', `Failed to load built-in plugin ${id}: ${error.message}`, error);
          return false;
        }
      }

      if (!pluginEntry) {
        log.warn?.('PLUGIN_REGISTRY', 'NOT_FOUND', `Plugin ${id} not found`);
        return false;
      }

      // Skip if already initialized
      if (pluginEntry.initialized && pluginEntry.instance) {
        log.info?.('PLUGIN_REGISTRY', 'ALREADY_INITIALIZED', `Plugin ${id} already initialized`);
        return true;
      }

      // Handle module-based plugins (like CSS)
      const PluginClassOrModule = pluginEntry.class;

      if (typeof PluginClassOrModule === 'object' && PluginClassOrModule.init) {
        // Module-based plugin
        await PluginClassOrModule.init(config);
        pluginEntry.instance = PluginClassOrModule;
        pluginEntry.config = config;
        pluginEntry.initialized = true;
        log.info?.('PLUGIN_REGISTRY', 'MODULE_INIT', `Module plugin ${id} initialized`);
        return true;
      }

      // Class-based plugin
      if (typeof PluginClassOrModule === 'function') {
        const instance = new PluginClassOrModule();

        if (typeof instance.init === 'function') {
          const initialized = await instance.init(config);

          if (initialized) {
            instance.id = id; // Ensure plugin knows its ID
            pluginEntry.instance = instance;
            pluginEntry.config = config;
            pluginEntry.initialized = true;
            log.info?.('PLUGIN_REGISTRY', 'CLASS_INIT', `Class plugin ${id} initialized`);
            return true;
          } else {
            log.warn?.('PLUGIN_REGISTRY', 'INIT_FAILED', `Plugin ${id} init() returned false`);
            return false;
          }
        }
      }

      log.error?.('PLUGIN_REGISTRY', 'INVALID_PLUGIN', `Plugin ${id} is neither module nor class with init()`);
      return false;

    } catch (error) {
      log.error?.('PLUGIN_REGISTRY', 'INIT_ERROR', `Error initializing plugin ${id}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Get all enabled (initialized) plugin instances
   * @returns {Array} Array of enabled plugin instances
   */
  getEnabledPlugins() {
    const enabled = [];

    for (const [id, entry] of this.plugins.entries()) {
      if (entry.initialized && entry.instance) {
        // Ensure plugin has helper methods
        const plugin = entry.instance;

        if (!plugin.id) {
          plugin.id = id;
        }

        if (!plugin.isEnabled) {
          plugin.isEnabled = () => entry.initialized;
        }

        enabled.push(plugin);
      }
    }

    return enabled;
  }

  /**
   * Get a specific plugin instance
   * @param {string} id - Plugin ID
   * @returns {Object|null} Plugin instance or null
   */
  getPlugin(id) {
    const entry = this.plugins.get(id);
    return entry?.instance || null;
  }

  /**
   * Check if a plugin is enabled (initialized)
   * @param {string} id - Plugin ID
   * @returns {boolean} Whether plugin is enabled
   */
  isPluginEnabled(id) {
    const entry = this.plugins.get(id);
    return entry?.initialized || false;
  }

  /**
   * Disable (cleanup) a specific plugin
   * @param {string} id - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async disablePlugin(id) {
    const entry = this.plugins.get(id);

    if (!entry || !entry.initialized) {
      return true; // Already disabled
    }

    try {
      // Call cleanup if available
      if (entry.instance && typeof entry.instance.cleanup === 'function') {
        await entry.instance.cleanup();
      }

      entry.initialized = false;
      entry.instance = null;

      log.info?.('PLUGIN_REGISTRY', 'DISABLED', `Disabled plugin: ${id}`);
      return true;
    } catch (error) {
      log.error?.('PLUGIN_REGISTRY', 'DISABLE_ERROR', `Error disabling plugin ${id}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Cleanup all plugins
   */
  async cleanup() {
    log.info?.('PLUGIN_REGISTRY', 'CLEANUP_START', 'Cleaning up all plugins');

    for (const [id] of this.plugins.entries()) {
      await this.disablePlugin(id);
    }

    log.info?.('PLUGIN_REGISTRY', 'CLEANUP_COMPLETE', 'All plugins cleaned up');
  }

  /**
   * Get plugin info for debugging
   * @returns {Array} Array of plugin info objects
   */
  getPluginInfo() {
    return Array.from(this.plugins.entries()).map(([id, entry]) => ({
      id,
      initialized: entry.initialized,
      hasInstance: !!entry.instance,
      config: entry.config
    }));
  }

  /**
   * Process enabled plugins on an element
   * @param {HTMLElement} element - Element to process
   * @returns {Promise<void>}
   */
  async processEnabledPlugins(element) {
    const plugins = this.getEnabledPlugins();

    for (const plugin of plugins) {
      if (typeof plugin.process === 'function') {
        try {
          await plugin.process(element);
          log.info?.('PLUGIN_REGISTRY', 'PROCESSED', `Processed plugin: ${plugin.id}`);
        } catch (error) {
          log.error?.('PLUGIN_REGISTRY', 'PROCESS_ERROR', `Error processing plugin ${plugin.id}: ${error.message}`, error);
        }
      }
    }
  }
}

// Create singleton instance
export const pluginRegistry = new PluginRegistry();

// Export for window.APP integration
export default pluginRegistry;
