/**
 * Base Plugin Interface
 * All plugins should extend this or implement these methods
 */

export class BasePlugin {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.initialized = false;
    this.ready = false;
  }

  /**
   * Initialize the plugin (load external libraries, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async init() {
    throw new Error(`Plugin ${this.name} must implement init() method`);
  }

  /**
   * Check if plugin is ready for use
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }

  /**
   * Check if plugin is enabled in current context
   * @returns {boolean}
   */
  isEnabled() {
    return this.config.enabled !== false;
  }

  /**
   * Process content during rendering
   * @param {string} content - Content to process
   * @param {Object} context - Rendering context
   * @returns {Promise<string>} Processed content
   */
  async process(content, context = {}) {
    return content; // Default: no processing
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.initialized = false;
    this.ready = false;
  }

  /**
   * Get plugin capabilities/manifest
   * @returns {Object}
   */
  getManifest() {
    return {
      name: this.name,
      version: '1.0.0',
      settings: []
    };
  }
} 