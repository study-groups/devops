/**
 * LogManager.js - Main controller class for the logging system
 */

import { LogEntry } from './LogEntry.js';
import { LogFilter } from './LogFilter.js';
import { LogBuffer } from './LogBuffer.js';
import { CallerInfo } from './CallerInfo.js';
import FilterManager from '../settings/FilterManager.js';

/**
 * Core log management class that orchestrates the logging system
 */
export class LogManager {
  constructor(options = {}) {
    // Create default elements
    this.buffer = new LogBuffer(options.bufferSize || 2000);
    this.filter = new LogFilter();
    this.enabled = true;
    this.showTimestamps = false;
    this.interceptConsole = options.interceptConsole !== false;
    this.originalConsole = null;
    this.proxiedConsole = null;
    this.showStackTraces = false;
    this.showCompactStack = true;
  }

  /**
   * Initialize the log manager
   * @param {Object} options - Configuration options
   * @returns {LogManager} - This instance for chaining
   */
  initialize(options = {}) {
    // Use filterConfig from options if provided, otherwise fall back to localStorage
    let filterConfig = options.filterConfig;

    if (!filterConfig && typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedSettings = window.localStorage.getItem('logSettings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          if (settings.filterConfig) {
            filterConfig = settings.filterConfig;
          }
        }
      } catch (e) {
        console.error('Error loading log settings from localStorage:', e);
      }
    }

    if (filterConfig) {
      this.filter = new LogFilter(filterConfig);
    } else {
      this.filter = new LogFilter();
    }
    
    // Initialize settings from local storage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedSettings = window.localStorage.getItem('logSettings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          
          // Apply stored settings
          if (settings.enabled !== undefined) {
            this.enabled = settings.enabled;
          }
          
          if (settings.showTimestamps !== undefined) {
            this.showTimestamps = settings.showTimestamps;
          }
        }
      } catch (e) {
        console.error('Error loading log settings from localStorage:', e);
      }
    }
    
    // Set up console interception if enabled
    if (this.interceptConsole) {
      this.interceptConsoleOutput();
    }
    
    // Check if config is ready, or listen for the event
    if (window.__logConfigReady) {
        console.log('Log config already ready, updating status and filters immediately.');
        this._boundUpdateFiltersAndStatus();
    } else {
        console.log('Log config not yet ready, adding event listener for "logConfigReady".');
        window.addEventListener('logConfigReady', this._boundUpdateFiltersAndStatus);
    }
    
    // Process any queued entries once initialization is complete
    if (this._queuedEntries && this._queuedEntries.length > 0) {
        setTimeout(() => {
            this._queuedEntries.forEach(entry => {
                this.addEntry(entry.entryData, entry.legacyTypeArgument);
            });
            this._queuedEntries = [];
        }, 0);
    }
    
    // Add a custom "stackable" console method that creates a clickable link to the source
    this.addConsoleStackMethod();
    
    // After loading other settings from localStorage
    this.showStackTraces = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        this.showStackTraces = localStorage.getItem('logStackTracesEnabled') === 'true';
      } catch (e) {
        // Ignore any localStorage errors
      }
    }
    
    // Initialize compact stack mode
    this.showCompactStack = true; // Default to compact mode
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Only disable if explicitly set to false
        if (localStorage.getItem('logCompactStackEnabled') === 'false') {
          this.showCompactStack = false;
        }
      } catch (e) {
        // Ignore any localStorage errors
      }
    }
    
    return this;
  }

  /**
   * Expose log manager to window for global access
   */
  exposeToWindow() {
    if (typeof window !== 'undefined') {
      // Create the window.config object if it doesn't exist
      if (!window.config) {
        window.config = {
          enabled: this.enabled,
          showTimestamps: this.showTimestamps,
          typeFilters: { include: [], exclude: [] },
          subtypeFilters: { include: [], exclude: [] },
          levelFilters: { include: [], exclude: [] },
          keywordFilters: { include: '', exclude: '' }
        };
      }
      
      // Initialize discovery sets on window
      window.discoveredTypes = new Set();
      window.discoveredSubtypes = new Set();
      
      // Expose the logManager globally
      window.logManager = this;
      
      // Expose global utility functions for self-discovery
      window.getDiscoveredTypes = () => this.getDiscoveredTypes();
      window.getDiscoveredSubtypes = () => this.getDiscoveredSubtypes();
      
      // Expose filter functions
      window.setIncludeTypes = (types) => this.filter.setIncludeTypes(types);
      window.setExcludeTypes = (types) => this.filter.setExcludeTypes(types);
      window.setIncludeSubtypes = (subtypes) => this.filter.setIncludeSubtypes(subtypes);
      window.setExcludeSubtypes = (subtypes) => this.filter.setExcludeSubtypes(subtypes);
      window.setIncludeLevels = (levels) => this.filter.setIncludeLevels(levels);
      window.setExcludeLevels = (levels) => this.filter.setExcludeLevels(levels);
      
      // Signal that config is ready
      window.__logConfigReady = true;
      window.dispatchEvent(new CustomEvent('logConfigReady'));
    }
    return this;
  }

  /**
   * Create a log entry from various input formats
   * @param {string} level - Log level
   * @param {*} args - Message arguments (string, object, or array)
   * @param {Object} caller - Optional caller information
   * @returns {LogEntry} - Created log entry
   */
  createLogEntry(level, args, caller = null) {
    // Normalize level to uppercase
    const normalizedLevel = this.normalizeLevel(level);
    
    // Get caller information if not provided
    if (!caller) {
      caller = CallerInfo.capture(1);
    }
    
    let message, type = 'GENERAL', subtype = null, details = null;
    
    // Handle different input formats
    if (args && typeof args === 'object') {
      if (Array.isArray(args)) {
        // Handle array of arguments (old style)
        message = this.argsToMessageString(args);
      } else if (args.message !== undefined) {
        // Handle structured log object (new style)
        message = args.message;
        type = args.type || 'GENERAL';
        subtype = args.subtype || null;
        details = args.details || null;
      } else {
        // Handle plain object
        message = this.argsToMessageString([args]);
      }
    } else {
      // Handle primitive values
      message = this.argsToMessageString([args]);
    }
    
    // Create and return the log entry
    return new LogEntry(normalizedLevel, message, type, subtype, caller, details);
  }

  /**
   * Normalize log level to a standard format
   * @param {string} level - Input log level
   * @returns {string} - Normalized level
   */
  normalizeLevel(level) {
    if (!level) return 'INFO';
    
    const upperLevel = String(level).toUpperCase();
    
    // Map similar levels
    switch (upperLevel) {
      case 'LOG':
      case 'DEBUG':
      case 'VERBOSE':
        return 'DEBUG';
      case 'INFORMATION':
        return 'INFO';
      case 'WARNING':
        return 'WARN';
      case 'DANGER':
      case 'FATAL':
        return 'ERROR';
      case 'PERFORMANCE':
      case 'TIMER':
        return 'TIMING';
      default:
        return upperLevel;
    }
  }

  /**
   * Convert console arguments to a string
   * @param {Array} args - Console arguments
   * @returns {string} - String representation
   */
  argsToMessageString(args) {
    if (!args || args.length === 0) return '';
    
    try {
      // Handle single string
      if (args.length === 1 && typeof args[0] === 'string') {
        return args[0];
      }
      
      // For large objects in state updates, just show a summary
      if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('State updating:')) {
        return 'State updating';
      }
      
      // Handle format strings
      if (args.length > 1 && typeof args[0] === 'string' && args[0].includes('%')) {
        try {
          return this.formatWithFormatSpecifiers(args);
        } catch (e) {
          // Fall back
        }
      }
      
      // Convert each arg to string and join, but handle objects specially
      return args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            // Try to use JSON.stringify for simple objects
            if (arg instanceof Error) {
              return arg.toString();
            } else if (Array.isArray(arg)) {
              if (arg.length > 10) {
                return `Array(${arg.length})`;
              } else {
                return JSON.stringify(arg);
              }
            } else if (arg instanceof Date) {
              return arg.toString();
            } else if (arg instanceof RegExp) {
              return arg.toString();
            } else if (arg instanceof Element || arg instanceof HTMLDocument) {
              return arg.tagName ? `<${arg.tagName.toLowerCase()}>` : String(arg);
            } else if (arg instanceof Event) {
              return `${arg.type} event`;
            } else {
              // For regular objects
              const jsonString = JSON.stringify(arg);
              if (jsonString === '{}') {
                // For empty objects, check if it has a name or constructor name
                const constructor = arg.constructor ? arg.constructor.name : 'Object';
                return constructor !== 'Object' ? `[${constructor}]` : '{}';
              } else if (jsonString === '[[object Object]]' || jsonString.length > 200) {
                // For long objects or objects that stringify poorly
                const keys = Object.keys(arg);
                const className = arg.constructor ? arg.constructor.name : 'Object';
                return `${className}{${keys.slice(0, 3).join(',')}${keys.length > 3 ? ',...' : ''}}`;
              }
              return jsonString;
            }
          } catch (e) {
            // If JSON fails, try to get a sensible string representation
            const constructor = arg.constructor ? arg.constructor.name : 'Object';
            try {
              // Try to get key names for objects
              const keys = Object.keys(arg);
              if (keys.length) {
                return `${constructor}{${keys.slice(0, 3).join(',')}${keys.length > 3 ? ',...' : ''}}`;
              }
            } catch (e2) {
              // Last resort
            }
            return `[${constructor}]`;
          }
        }
        return String(arg);
      }).join(' ');
    } catch (e) {
      return 'Error converting log arguments: ' + e.message;
    }
  }

  /**
   * Format a string with format specifiers like console.log
   */
  formatWithFormatSpecifiers(args) {
    const format = args[0];
    const values = args.slice(1);
    let index = 0;
    
    return format.replace(/%([sdifjoO%])/g, (match, specifier) => {
      if (specifier === '%') return '%';
      if (index >= values.length) return match;
      
      const value = values[index++];
      
      switch (specifier) {
        case 's': return String(value);
        case 'd':
        case 'i': return parseInt(value, 10);
        case 'f': return parseFloat(value);
        case 'j':
        case 'o':
        case 'O':
          try {
            return JSON.stringify(value);
          } catch (e) {
            return String(value);
          }
        default: return match;
      }
    });
  }

  /**
   * Intercept console output to run it through the log manager
   */
  interceptConsoleOutput() {
    if (typeof window === 'undefined' || !window.console) return this;
    
    // Save original console
    this.originalConsole = {
      log: window.console.log,
      debug: window.console.debug,
      info: window.console.info,
      warn: window.console.warn,
      error: window.console.error,
      // Add grouping methods if available
      groupCollapsed: window.console.groupCollapsed || null,
      groupEnd: window.console.groupEnd || null,
      // Add trace method if available
      trace: window.console.trace || window.console.log,
      // Add custom timing method
      timing: window.console.timing || function() {}
    };
    
    // Create proxied console methods
    this.proxiedConsole = {
      log: (...args) => this.handleConsoleMethod('log', args),
      debug: (...args) => this.handleConsoleMethod('debug', args),
      info: (...args) => this.handleConsoleMethod('info', args),
      warn: (...args) => this.handleConsoleMethod('warn', args),
      error: (...args) => this.handleConsoleMethod('error', args),
      timing: (...args) => this.handleConsoleMethod('timing', args)
    };
    
    // Apply proxied methods
    window.console.log = this.proxiedConsole.log;
    window.console.debug = this.proxiedConsole.debug;
    window.console.info = this.proxiedConsole.info;
    window.console.warn = this.proxiedConsole.warn;
    window.console.error = this.proxiedConsole.error;
    window.console.timing = this.proxiedConsole.timing;
    
    return this;
  }

  /**
   * Handle intercepted console method calls
   * @param {string} method - Console method name
   * @param {Array} args - Console arguments
   */
  handleConsoleMethod(method, args) {
    try {
      // Extract type/subtype from message if present
      let type = 'GENERAL';
      let subtype = null;
      let level = this.normalizeLevel(method);
      let message = '';
      let details = null;
      let entry = null;
      
      // First, extract any structured info - safely check if method exists
      if (typeof this.extractStructuredInfo === 'function') {
        const structInfo = this.extractStructuredInfo(args);
        if (structInfo) {
          type = structInfo.type || type;
          subtype = structInfo.subtype || subtype;
          level = structInfo.level || level;
        }
      }
      
      // Convert args to a string message
      if (args.length > 0) {
        // Check if this is already a LogEntry
        if (args[0] instanceof LogEntry) {
          entry = args[0];
        } else {
          // Check for format specifiers
          if (typeof args[0] === 'string' && args.length > 1 && args[0].includes('%')) {
            message = this.formatWithFormatSpecifiers(args);
          } else {
            message = this.argsToMessageString(args);
          }
        }
      }
      
      // Create log entry with extracted information
      entry = new LogEntry(level, message, type, subtype, null, details);
      
      // Add to buffer
      this.buffer.add(entry);
      
      // Pass to console if enabled and passes filters
      if (this.enabled && this.filter.shouldDisplay(entry)) {
        const formattedArgs = entry.formatForConsole(this.showTimestamps);
        
        // Check if we have groupCollapsed and trace available
        if (typeof console.groupCollapsed === 'function' && 
            typeof console.trace === 'function' && 
            typeof console.groupEnd === 'function') {
            
          // Use the group-trace-groupEnd pattern
          console.groupCollapsed.apply(console, formattedArgs);
          console.trace();
          console.groupEnd();
        } else {
          // Fallback to normal logging if groupCollapsed isn't available
          if (method in this.originalConsole) {
            this.originalConsole[method].apply(console, formattedArgs);
          } else {
            this.originalConsole.log.apply(console, formattedArgs);
          }
        }
        
        // Add any details as separate log entries
        if (entry.details) {
          if (Array.isArray(entry.details)) {
            entry.details.forEach(detail => {
              this.originalConsole[method].apply(console, [detail]);
            });
          } else {
            this.originalConsole[method].apply(console, [entry.details]);
          }
        }
      }
    } catch (e) {
      // Ensure console always works even if our handling fails
      this.originalConsole.error('Error in log manager:', e);
      this.originalConsole[method].apply(console, args);
    }
  }

  /**
   * Restore original console methods
   */
  restoreConsole() {
    if (typeof window === 'undefined' || !window.console || !this.originalConsole) return this;
    
    // Restore original methods
    window.console.log = this.originalConsole.log;
    window.console.debug = this.originalConsole.debug;
    window.console.info = this.originalConsole.info;
    window.console.warn = this.originalConsole.warn;
    window.console.error = this.originalConsole.error;
    
    // Only restore timing if it existed
    if (this.originalConsole.timing) {
      window.console.timing = this.originalConsole.timing;
    } else {
      delete window.console.timing;
    }
    
    return this;
  }

  /**
   * Enable logging
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableLogging(persist = false) {
    this.enabled = true;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      this.saveSettings();
    }
    
    return this;
  }

  /**
   * Disable logging
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableLogging(persist = false) {
    this.enabled = false;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      this.saveSettings();
    }
    
    return this;
  }

  /**
   * Check if logging is enabled
   * @returns {boolean} - Whether logging is enabled
   */
  isLoggingEnabled() {
    return this.enabled;
  }

  /**
   * Enable timestamps in log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableTimestamps(persist = false) {
    this.showTimestamps = true;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      this.saveSettings();
    }
    
    return this;
  }

  /**
   * Disable timestamps in log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableTimestamps(persist = false) {
    this.showTimestamps = false;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      this.saveSettings();
    }
    
    return this;
  }

  /**
   * Check if timestamps are enabled
   * @returns {boolean} - Whether timestamps are enabled
   */
  areTimestampsEnabled() {
    return this.showTimestamps;
  }

  /**
   * Save current settings to localStorage
   */
  saveSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const settings = {
        enabled: this.enabled,
        showTimestamps: this.showTimestamps,
        filterConfig: this.filter.getConfig(),
        showStackTraces: this.showStackTraces,
        showCompactStack: this.showCompactStack
      };
      
      window.localStorage.setItem('logSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving log settings to localStorage:', e);
    }
  }

  /**
   * Get the current log buffer
   * @returns {Array} - Array of log entries
   */
  getLogBuffer() {
    return this.buffer.getEntries();
  }

  /**
   * Clear the log buffer
   */
  clearLogBuffer() {
    this.buffer.clear();
    return this;
  }

  /**
   * Get the current log buffer size
   * @returns {number} - Number of entries in buffer
   */
  getLogBufferSize() {
    return this.buffer.size();
  }

  /**
   * Register a callback for buffer updates
   * @param {Function} callback - Function to call when buffer is updated
   */
  registerOnBufferUpdate(callback) {
    this.buffer.registerCallback(callback);
    return this;
  }

  /**
   * Unregister a callback for buffer updates
   * @param {Function} callback - Function to remove
   */
  unregisterOnBufferUpdate(callback) {
    this.buffer.unregisterCallback(callback);
    return this;
  }

  /**
   * Get all discovered log types
   * @returns {Array} - Array of log types
   */
  getDiscoveredTypes() {
    return this.buffer.getDiscoveredTypes();
  }

  /**
   * Get all discovered log subtypes
   * @returns {Array} - Array of log subtypes
   */
  getDiscoveredSubtypes() {
    return this.buffer.getDiscoveredSubtypes();
  }

  /**
   * Create a silent timer that doesn't log
   * @param {string} label - Timer label
   * @param {Object} options - Timer options
   * @returns {Object} - Timer object
   */
  createSilentTimer(label, options = {}) {
    const startTime = performance.now();
    const timer = {
      label,
      start: startTime,
      lastMark: startTime,
      options,
      elapsed: () => performance.now() - startTime,
      mark: (markLabel = 'Mark') => {
        const now = performance.now();
        const elapsed = now - timer.lastMark;
        timer.lastMark = now;
        return elapsed;
      },
      end: () => {
        const endTime = performance.now();
        const elapsed = endTime - startTime;
        return elapsed;
      }
    };
    
    return timer;
  }

  /**
   * Extract structured info from log arguments
   * @param {Array} args - Console arguments
   * @returns {Object|null} - Extracted structured info or null
   */
  extractStructuredInfo(args) {
    if (!args || args.length === 0) return null;
    
    const firstArg = args[0];
    
    // Check if first argument is an object with structured log properties
    if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg)) {
      // Look for structured log format with type, subtype, etc.
      if (firstArg.type || firstArg.subtype || firstArg.level || firstArg.message !== undefined) {
        return {
          type: firstArg.type,
          subtype: firstArg.subtype,
          level: firstArg.level,
          message: firstArg.message
        };
      }
    }
    
    // Check if first argument is a string with [TYPE] or [TYPE][SUBTYPE] format
    if (typeof firstArg === 'string') {
      // Simple regex to extract [TYPE] and optionally [SUBTYPE]
      const typeMatch = firstArg.match(/^\s*\[([^\]]+)\](?:\[([^\]]+)\])?\s*(.*)/);
      if (typeMatch) {
        const [, type, subtype, message] = typeMatch;
        // Return the structured info with remaining text as the message
        return {
          type: type || 'GENERAL',
          subtype: subtype || null,
          message: message || ''
        };
      }
    }
    
    return null;
  }

  /**
   * Add a custom "stackable" console method that creates a clickable link to the source
   */
  addConsoleStackMethod() {
    // Don't modify if we're not in a browser
    if (typeof window === 'undefined' || !window.console) return this;
    
    // Create a new method 'stack' that captures and displays the call stack
    window.console.stack = (message, ...args) => {
      // Create an error to get the stack
      const err = new Error();
      // Get the original stack
      const stack = err.stack;
      
      // Log the message normally
      this.originalConsole.log(message, ...args);
      
      // Log the stack trace in a collapsed group
      this.originalConsole.groupCollapsed('Call Stack');
      this.originalConsole.log(stack);
      this.originalConsole.groupEnd();
    };
    
    return this;
  }

  /**
   * Enable stack traces in log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableStackTraces(persist = false) {
    this.showStackTraces = true;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('logStackTracesEnabled', 'true');
      } catch (e) {
        this.originalConsole.error('Error saving stack trace setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Disable stack traces in log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableStackTraces(persist = false) {
    this.showStackTraces = false;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('logStackTracesEnabled', 'false');
      } catch (e) {
        this.originalConsole.error('Error saving stack trace setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Check if stack traces are enabled
   * @returns {boolean} - Whether stack traces are enabled
   */
  areStackTracesEnabled() {
    return this.showStackTraces;
  }

  /**
   * Enable compact stack traces in log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableCompactStack(persist = false) {
    this.showCompactStack = true;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('logCompactStackEnabled', 'true');
      } catch (e) {
        this.originalConsole.error('Error saving compact stack setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Disable compact stack traces in log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableCompactStack(persist = false) {
    this.showCompactStack = false;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('logCompactStackEnabled', 'false');
      } catch (e) {
        this.originalConsole.error('Error saving compact stack setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Check if compact stack traces are enabled
   * @returns {boolean} - Whether compact stack traces are enabled
   */
  isCompactStackEnabled() {
    return this.showCompactStack;
  }
} 