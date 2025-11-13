/**
 * ServiceInitializer - Initializes and registers all application services
 * Sets up window.APP.services with all core services
 */

import { pluginRegistry } from '../preview/PluginRegistry.js';
import { markdownRenderingService } from '../preview/MarkdownRenderingService.js';
import { systemInfoAPI } from '../services/SystemInfoAPI.js';
import { zIndexManager } from '../utils/ZIndexManager.js';
import { panelStateManager } from './PanelStateManager.js';
import { panelEventBus } from './PanelEventBus.js';
import { publish, subscribe } from '../pubsub.js';

// Phase 2: Inspector Utilities
import devPagesDetector from '../utils/DevPagesDetector.js';
import elementPicker from '../utils/ElementPicker.js';
import boxModelRenderer from '../utils/BoxModelRenderer.js';

const log = console; // Logger not available yet during initialization

/**
 * ServiceInitializer - Manages service registration and initialization
 */
export class ServiceInitializer {
  constructor() {
    this.initialized = false;
    this.services = new Map();
  }

  /**
   * Initialize all services
   * Call this after window.APP is set up
   */
  async initialize() {
    if (this.initialized) {
      log.warn('[ServiceInitializer] Already initialized');
      return;
    }

    try {
      log.info('[ServiceInitializer] Starting service initialization...');

      // Ensure window.APP.services exists
      if (!window.APP) {
        throw new Error('window.APP not initialized');
      }

      if (!window.APP.services) {
        window.APP.services = {};
      }

      // Register pubsub first (panelEventBus depends on it)
      const pubsub = { publish, subscribe };
      this.registerService('pubsub', pubsub);

      // Initialize PanelEventBus with pubsub
      panelEventBus.initialize(pubsub);

      // Register core services
      this.registerService('pluginRegistry', pluginRegistry);
      this.registerService('markdownRenderingService', markdownRenderingService);
      this.registerService('system', systemInfoAPI);
      this.registerService('zIndexManager', zIndexManager);
      this.registerService('panelStateManager', panelStateManager);

      // Register panel event bus in window.APP.panels
      if (!window.APP.panels) {
        window.APP.panels = {};
      }
      window.APP.panels.eventBus = panelEventBus;

      // Register inspector utilities in window.APP.utils
      if (!window.APP.utils) {
        window.APP.utils = {};
      }
      window.APP.utils.devPagesDetector = devPagesDetector;
      window.APP.utils.elementPicker = elementPicker;
      window.APP.utils.boxModelRenderer = boxModelRenderer;

      log.info('[ServiceInitializer] Registered inspector utilities');

      // Initialize SystemInfoAPI
      systemInfoAPI.init();

      this.initialized = true;
      log.info('[ServiceInitializer] Service initialization complete');

    } catch (error) {
      log.error('[ServiceInitializer] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register a service in window.APP.services
   * @param {string} name - Service name
   * @param {Object} service - Service instance
   */
  registerService(name, service) {
    if (!name || !service) {
      log.warn(`[ServiceInitializer] Invalid service registration: ${name}`);
      return false;
    }

    // Add to window.APP.services
    window.APP.services[name] = service;

    // Track in local map
    this.services.set(name, service);

    log.info(`[ServiceInitializer] Registered service: ${name}`);
    return true;
  }

  /**
   * Get a registered service
   * @param {string} name - Service name
   * @returns {Object|null} Service instance
   */
  getService(name) {
    return this.services.get(name) || window.APP?.services?.[name] || null;
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean} Whether service is registered
   */
  hasService(name) {
    return this.services.has(name) || (window.APP?.services?.[name] != null);
  }

  /**
   * Get all registered service names
   * @returns {Array<string>} Service names
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * Get initialization status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      serviceCount: this.services.size,
      services: this.getServiceNames()
    };
  }
}

// Create singleton instance
export const serviceInitializer = new ServiceInitializer();

/**
 * Initialize services (to be called from app bootstrap)
 */
export async function initializeServices() {
  await serviceInitializer.initialize();
  return serviceInitializer;
}

export default serviceInitializer;
