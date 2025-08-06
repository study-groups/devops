/**
 * @file ConsoleLogManager.js
 * @description Manages the console logging functionality for the application.
 * This service is exposed globally via the `window.APP.services.console` namespace.
 */

// Establish the global namespace
window.APP = window.APP || {};
window.APP.services = window.APP.services || {};

// Simple implementations for missing classes
class ConsoleLogEntry {
  constructor(level, message, type = 'GENERAL', caller = null, details = null) {
    this.level = level;
    this.message = message;
    this.type = type;
    this.caller = caller;
    this.details = details;
    this.timestamp = Date.now();
  }
}

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

class ConsoleLogBuffer {
  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
    this.entries = [];
  }
  
  add(entry) {
    this.entries.unshift(entry);
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(0, this.maxSize);
    }
  }
  
  getEntries() {
    return this.entries;
  }
  
  clear() {
    this.entries = [];
  }
  
  size() {
    return this.entries.length;
  }
}

class ConsoleCallerInfo {
  static capture(skipFrames = 0) {
    return { file: 'unknown', line: 0, function: 'unknown' };
  }
}

/**
 * Core console log management class that orchestrates the console logging system
 */
export class ConsoleLogManager {
  constructor(options = {}) {
    this.buffer = new ConsoleLogBuffer(options.bufferSize || 2000);
    this.filter = new ConsoleLogFilter();
    this.enabled = true;
    this.showTimestamps = false;
    // DO NOT intercept console - let native console work normally
    this.interceptConsole = false;
    this.originalConsole = null;
    this.proxiedConsole = null;
    this.showStackTraces = false;
    this.showCompactStack = true;
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
      window.APP.logging = window.APP.logging || {};
      
      // Core manager instances
      window.APP.services.consoleLogManager = this;
      window.APP.services.logManager = this; // Legacy alias
      
      // Console logging control functions
      window.APP.logging.isEnabled = () => this.isLoggingEnabled();
      window.APP.logging.enable = (persist) => this.enableLogging(persist);
      window.APP.logging.disable = (persist) => this.disableLogging(persist);
      
      // Buffer management functions
      window.APP.logging.getBuffer = () => this.getLogBuffer();
      window.APP.logging.getBufferSize = () => this.getLogBufferSize();
      window.APP.logging.clearBuffer = () => this.clearLogBuffer();
      
      // Legacy window functions for backwards compatibility (deprecated)
      window.discoveredTypes = new Set();
      window.consoleLogManager = this;
      window.logManager = this;
      window.isConsoleLoggingEnabled = () => this.isLoggingEnabled();
      window.enableConsoleLogging = (persist) => this.enableLogging(persist);
      window.disableConsoleLogging = (persist) => this.disableLogging(persist);
      window.getLogBuffer = () => this.getLogBuffer();
      window.getLogBufferSize = () => this.getLogBufferSize();
      window.clearLogBuffer = () => this.clearLogBuffer();
      
      // Type discovery sets (legacy - prefer using consoleLogManager.buffer methods)
      // window.getDiscoveredTypes = () => Array.from(window.discoveredTypes || new Set());
      
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
   * Get the current console log buffer
   */
  getLogBuffer() {
    return this.buffer.getEntries();
  }

  /**
   * Clear the console log buffer
   */
  clearLogBuffer() {
    this.buffer.clear();
    return this;
  }

  /**
   * Get the current buffer size
   */
  getLogBufferSize() {
    return this.buffer.size();
  }
} 

// Expose the console logging service via the new, standardized namespace
window.APP.services.console = new ConsoleLogManager(); 