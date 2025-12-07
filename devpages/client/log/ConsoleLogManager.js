/**
 * @file ConsoleLogManager.js
 * @description Manages the console logging functionality for the application.
 * This service is exposed globally via the `window.APP.services.consoleLogManager` namespace.
 *
 * NOTE: This service no longer maintains its own buffer. It reads from Redux store instead,
 * providing a facade over the centralized log state.
 */

// Import the consolidated BaseLogEntry class
import { BaseLogEntry } from './BaseLogEntry.js';

// Establish the global namespace
window.APP = window.APP || {};
window.APP.services = window.APP.services || {};

class ConsoleLogFilter {
  constructor(config = {}) {
    this.config = { enabled: true, ...config };
  }

  setEnabled(enabled) {
    this.config.enabled = enabled;
  }

  shouldDisplay(entry) {
    return this.config.enabled;
  }
}

/**
 * Core console log management class that orchestrates the console logging system.
 * Acts as a facade over Redux store for log entries.
 */
export class ConsoleLogManager {
  constructor(options = {}) {
    this.filter = new ConsoleLogFilter();
    this.enabled = true;
    this.showTimestamps = false;
    // DO NOT intercept console - let native console work normally
    this.interceptConsole = false;
    this.originalConsole = null;
    this.proxiedConsole = null;
    this.showStackTraces = false;
    this.showCompactStack = true;
    // Store reference to appStore when available
    this.store = null;
  }

  /**
   * Initialize the console log manager
   */
  initialize(options = {}) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedSettings = window.localStorage.getItem('consoleLogSettings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          if (settings.enabled !== undefined) {
            this.enabled = settings.enabled;
          }
          if (settings.showTimestamps !== undefined) {
            this.showTimestamps = settings.showTimestamps;
          }
        }
      } catch (e) {
        console.error('Error loading console log settings from localStorage:', e);
      }
    }
    
    this.enabled = true;
    return this;
  }

  /**
   * Expose console log manager to window for global access
   */
  exposeToWindow() {
    if (typeof window !== 'undefined') {
      // Store reference to original console methods
      if (!window.originalConsoleForDebug) {
        window.originalConsoleForDebug = {
          log: console.log.bind(console),
          info: console.info.bind(console),
          debug: console.debug.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console)
        };
      }

      // Create the window.config object if it doesn't exist
      if (!window.config) {
        window.config = {
          enabled: this.enabled,
          showTimestamps: this.showTimestamps,
          typeFilters: { include: [], exclude: [] },
          levelFilters: { include: [], exclude: [] },
          keywordFilters: { include: '', exclude: '' }
        };
      }
      
      // Expose via APP.services instead of global window
      window.APP = window.APP || {};
      window.APP.services = window.APP.services || {};
      window.APP.log = window.APP.log || {};
      
      // Core manager instance - standardized on window.APP.services
      window.APP.services.consoleLogManager = this;

      // Convenience methods on window.APP.services for easy access
      window.APP.services.isConsoleLoggingEnabled = () => this.isLoggingEnabled();
      window.APP.services.enableConsoleLogging = (persist) => this.enableLogging(persist);
      window.APP.services.disableConsoleLogging = (persist) => this.disableLogging(persist);
      window.APP.services.getLogBuffer = () => this.getLogBuffer();
      window.APP.services.getLogBufferSize = () => this.getLogBufferSize();
      window.APP.services.clearLogBuffer = () => this.clearLogBuffer();
      
      // Signal that config is ready
      window.__logConfigReady = true;
      window.dispatchEvent(new CustomEvent('logConfigReady'));
    }
    return this;
  }

  /**
   * Enable console logging
   */
  enableLogging(persist = false) {
    this.enabled = true;
    this.filter.setEnabled(true);
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLoggingEnabled', 'true');
      } catch (e) {
        console.error('Error saving console logging state:', e);
      }
    }
    
    return this;
  }

  /**
   * Disable console logging
   */
  disableLogging(persist = false) {
    this.enabled = false;
    this.filter.setEnabled(false);
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLoggingEnabled', 'false');
      } catch (e) {
        console.error('Error saving console logging state:', e);
      }
    }
    
    return this;
  }

  /**
   * Check if console logging is enabled
   */
  isLoggingEnabled() {
    return this.enabled && this.filter.config.enabled;
  }

  /**
   * Get the current console log buffer from Redux store
   */
  getLogBuffer() {
    // Read from Redux store instead of local buffer
    if (!this.store && typeof window !== 'undefined' && window.APP?.services?.store) {
      this.store = window.APP.services.store;
    }

    if (this.store) {
      const state = this.store.getState();
      return state.log?.entries || [];
    }

    return [];
  }

  /**
   * Clear the console log buffer in Redux store
   */
  clearLogBuffer() {
    if (!this.store && typeof window !== 'undefined' && window.APP?.services?.store) {
      this.store = window.APP.services.store;
    }

    if (this.store) {
      // Import clearEntries action dynamically to avoid circular dependency
      import('./../../store/slices/logSlice.js').then(({ clearEntries }) => {
        this.store.dispatch(clearEntries());
      });
    }

    return this;
  }

  /**
   * Get the current buffer size from Redux store
   */
  getLogBufferSize() {
    return this.getLogBuffer().length;
  }
} 