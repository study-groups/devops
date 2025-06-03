/**
 * Plugin Manager - Centralized plugin lifecycle management
 * Replaces the window globals approach with proper dependency injection
 */

export class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.loadedLibraries = new Map();
    this.initializationPromises = new Map();
  }

  /**
   * Load and initialize a plugin
   * @param {string} pluginName - Name of the plugin
   * @param {Object} config - Plugin configuration
   * @returns {Promise<Object|null>} Plugin instance or null if failed
   */
  async loadPlugin(pluginName, config = {}) {
    // Return existing plugin if already loaded
    if (this.plugins.has(pluginName)) {
      return this.plugins.get(pluginName);
    }

    // Return existing initialization promise if in progress
    if (this.initializationPromises.has(pluginName)) {
      return await this.initializationPromises.get(pluginName);
    }

    // Start initialization
    const initPromise = this._initializePlugin(pluginName, config);
    this.initializationPromises.set(pluginName, initPromise);

    try {
      const plugin = await initPromise;
      this.plugins.set(pluginName, plugin);
      this.initializationPromises.delete(pluginName);
      return plugin;
    } catch (error) {
      this.initializationPromises.delete(pluginName);
      console.error(`[PluginManager] Failed to load plugin ${pluginName}:`, error);
      return null;
    }
  }

  /**
   * Get a loaded plugin instance
   * @param {string} pluginName - Name of the plugin
   * @returns {Object|null} Plugin instance or null if not loaded
   */
  getPlugin(pluginName) {
    return this.plugins.get(pluginName) || null;
  }

  /**
   * Check if a plugin is loaded and ready
   * @param {string} pluginName - Name of the plugin
   * @returns {boolean}
   */
  isPluginReady(pluginName) {
    const plugin = this.plugins.get(pluginName);
    return plugin && plugin.isReady();
  }

  /**
   * Unload a plugin
   * @param {string} pluginName - Name of the plugin
   */
  unloadPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (plugin && typeof plugin.destroy === 'function') {
      plugin.destroy();
    }
    this.plugins.delete(pluginName);
  }

  /**
   * Get all loaded plugins
   * @returns {Map} Map of plugin name to plugin instance
   */
  getAllPlugins() {
    return new Map(this.plugins);
  }

  /**
   * Initialize a specific plugin
   * @private
   */
  async _initializePlugin(pluginName, config) {
    switch (pluginName) {
      case 'highlight':
        return await this._initializeHighlightPlugin(config);
      case 'mermaid':
        return await this._initializeMermaidPlugin(config);
      case 'katex':
        return await this._initializeKatexPlugin(config);
      case 'audio-md':
        return await this._initializeAudioPlugin(config);
      default:
        throw new Error(`Unknown plugin: ${pluginName}`);
    }
  }

  /**
   * Initialize Highlight.js plugin
   * @private
   */
  async _initializeHighlightPlugin(config) {
    const { HighlightPlugin } = await import('/client/preview/plugins/highlight.js');
    const plugin = new HighlightPlugin(config);
    await plugin.init();
    return plugin;
  }

  /**
   * Initialize Mermaid plugin
   * @private
   */
  async _initializeMermaidPlugin(config) {
    const { MermaidPlugin } = await import('/client/preview/plugins/mermaid.js');
    const plugin = new MermaidPlugin(config);
    await plugin.init();
    return plugin;
  }

  /**
   * Initialize KaTeX plugin
   * @private
   */
  async _initializeKatexPlugin(config) {
    const { KaTeXPlugin } = await import('/client/preview/plugins/katex.js');
    const plugin = new KaTeXPlugin(config);
    await plugin.init();
    return plugin;
  }

  /**
   * Initialize Audio plugin
   * @private
   */
  async _initializeAudioPlugin(config) {
    const { AudioMDPlugin } = await import('/client/preview/plugins/audio-md.js');
    const plugin = new AudioMDPlugin(config);
    await plugin.init();
    return plugin;
  }
}

// Export singleton instance
export const pluginManager = new PluginManager(); 