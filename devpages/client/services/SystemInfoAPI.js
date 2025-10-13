/**
 * SystemInfoAPI - System information and utilities
 * Extends window.APP.services with system info, file operations, and publishing
 */

import { appStore } from '/client/appState.js';

const log = window.APP?.services?.log?.createLogger('SystemInfoAPI') || console;

/**
 * SystemInfoAPI - Exposes system information and operations
 */
export class SystemInfoAPI {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the API
   */
  init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    log.info?.('SYSTEM_API', 'INITIALIZED', 'SystemInfoAPI initialized');
  }

  /**
   * Get application version
   */
  get version() {
    return window.APP?.version || '0.0.0-dev';
  }

  /**
   * Get current file information
   */
  get currentFile() {
    const state = appStore.getState();
    return state.file?.currentFile?.pathname || null;
  }

  /**
   * Get current file object
   */
  get currentFileObject() {
    const state = appStore.getState();
    return state.file?.currentFile || null;
  }

  /**
   * Get environment information
   */
  get environment() {
    const state = appStore.getState();

    return {
      nodeEnv: state.file?.environment || 'development',
      pdDir: this.getPDDir(),
      publishEndpoint: '/api/publish',
      spacesEndpoint: '/api/spaces',
      plugins: this.getPluginInfo(),
      mode: this.getMode()
    };
  }

  /**
   * Get PData directory
   */
  getPDDir() {
    const state = appStore.getState();
    return state.file?.pdataDir || null;
  }

  /**
   * Get current mode (preview/edit)
   */
  getMode() {
    const state = appStore.getState();
    return state.ui?.activeView || 'preview';
  }

  /**
   * Get plugin information
   */
  getPluginInfo() {
    if (!window.APP?.services?.pluginRegistry) {
      return [];
    }

    return window.APP.services.pluginRegistry.getPluginInfo();
  }

  /**
   * Read a file from the server
   * @param {string} pathname - File pathname
   * @returns {Promise<string>} File content
   */
  async readFile(pathname) {
    try {
      const url = `/api/files/content?pathname=${encodeURIComponent(pathname)}`;
      const response = await this.fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      log.info?.('SYSTEM_API', 'FILE_READ', `Read file: ${pathname} (${content.length} chars)`);

      return content;
    } catch (error) {
      log.error?.('SYSTEM_API', 'FILE_READ_ERROR', `Failed to read file ${pathname}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Write a file to the server
   * @param {string} pathname - File pathname
   * @param {string} content - File content
   * @returns {Promise<Object>} Result object
   */
  async writeFile(pathname, content) {
    try {
      const response = await this.fetch('/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname, content })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      log.info?.('SYSTEM_API', 'FILE_WRITTEN', `Wrote file: ${pathname} (${content.length} chars)`);

      return result;
    } catch (error) {
      log.error?.('SYSTEM_API', 'FILE_WRITE_ERROR', `Failed to write file ${pathname}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * List files in a directory
   * @param {string} pathname - Directory pathname
   * @returns {Promise<Array>} Array of file objects
   */
  async listFiles(pathname = '') {
    try {
      const url = `/api/files/list?pathname=${encodeURIComponent(pathname)}`;
      const response = await this.fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.files || [];
    } catch (error) {
      log.error?.('SYSTEM_API', 'LIST_ERROR', `Failed to list files in ${pathname}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Publish a file
   * @param {string} pathname - File pathname
   * @param {Object} options - Publishing options
   * @returns {Promise<Object>} Publish result
   */
  async publish(pathname, options = {}) {
    try {
      // Use PublishService if available
      if (window.APP?.services?.publishService) {
        return await window.APP.services.publishService.publishFile(pathname, options);
      }

      // Fallback to direct API call
      const response = await this.fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname, ...options })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      log.info?.('SYSTEM_API', 'PUBLISHED', `Published: ${pathname} -> ${result.url}`);

      return result;
    } catch (error) {
      log.error?.('SYSTEM_API', 'PUBLISH_ERROR', `Failed to publish ${pathname}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Unpublish a file
   * @param {string} pathname - File pathname
   * @returns {Promise<Object>} Result
   */
  async unpublish(pathname) {
    try {
      const response = await this.fetch('/api/publish', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      log.info?.('SYSTEM_API', 'UNPUBLISHED', `Unpublished: ${pathname}`);

      return result;
    } catch (error) {
      log.error?.('SYSTEM_API', 'UNPUBLISH_ERROR', `Failed to unpublish ${pathname}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get publish status of a file
   * @param {string} pathname - File pathname
   * @returns {Promise<Object>} Publish status
   */
  async getPublishStatus(pathname) {
    try {
      const url = `/api/publish?pathname=${encodeURIComponent(pathname)}`;
      const response = await this.fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      log.error?.('SYSTEM_API', 'STATUS_ERROR', `Failed to get publish status for ${pathname}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Render markdown to HTML
   * @param {string} content - Markdown content
   * @param {string} filePath - Source file path
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Render result
   */
  async renderMarkdown(content, filePath, options = {}) {
    if (!window.APP?.services?.markdownRenderingService) {
      throw new Error('MarkdownRenderingService not available');
    }

    return await window.APP.services.markdownRenderingService.render(content, filePath, options.mode || 'preview', options);
  }

  /**
   * Get enabled plugins
   * @returns {Array} Array of enabled plugin instances
   */
  getEnabledPlugins() {
    if (!window.APP?.services?.pluginRegistry) {
      return [];
    }

    return window.APP.services.pluginRegistry.getEnabledPlugins();
  }

  /**
   * Check if a plugin is enabled
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} Whether plugin is enabled
   */
  isPluginEnabled(pluginId) {
    if (!window.APP?.services?.pluginRegistry) {
      return false;
    }

    return window.APP.services.pluginRegistry.isPluginEnabled(pluginId);
  }

  /**
   * Get Redux store state
   * @returns {Object} Current state
   */
  getState() {
    return appStore.getState();
  }

  /**
   * Dispatch Redux action
   * @param {Object} action - Redux action
   */
  dispatch(action) {
    appStore.dispatch(action);
  }

  /**
   * Subscribe to Redux store changes
   * @param {Function} listener - Listener function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    return appStore.subscribe(listener);
  }

  /**
   * Fetch wrapper (uses globalFetch if available)
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async fetch(url, options = {}) {
    if (window.APP?.services?.globalFetch) {
      return await window.APP.services.globalFetch(url, options);
    }

    return await fetch(url, options);
  }

  /**
   * Get panel registry
   * @returns {Object} Panel registry
   */
  get panels() {
    return window.APP?.panels || null;
  }

  /**
   * Get all services
   * @returns {Object} Services object
   */
  get services() {
    return window.APP?.services || {};
  }

  /**
   * Create a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
   * @param {Object} options - Additional options
   */
  notify(message, type = 'info', options = {}) {
    if (window.APP?.services?.notifications) {
      window.APP.services.notifications.show(message, type, options);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get system information summary
   * @returns {Object} System info
   */
  getSystemInfo() {
    return {
      version: this.version,
      currentFile: this.currentFile,
      environment: this.environment,
      plugins: this.getPluginInfo(),
      services: Object.keys(this.services),
      initialized: this.initialized
    };
  }
}

// Create singleton instance
export const systemInfoAPI = new SystemInfoAPI();

export default systemInfoAPI;
