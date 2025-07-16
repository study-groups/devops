/**
 * ConsoleLogManager.js - Main controller class for the console logging system
 * This is the renamed and refactored version of LogManager.js to align with ConsoleLogPanel.js
 */

import { ConsoleLogEntry } from './ConsoleLogEntry.js';
import { ConsoleLogFilter } from './ConsoleLogFilter.js';
import { ConsoleLogBuffer } from './ConsoleLogBuffer.js';
import { ConsoleCallerInfo } from './ConsoleCallerInfo.js';
import FilterManager from '../settings/utils/FilterManager.js';

/**
 * Core console log management class that orchestrates the console logging system
 */
export class ConsoleLogManager {
  constructor(options = {}) {
    // Create default elements with Console prefixed classes
    this.buffer = new ConsoleLogBuffer(options.bufferSize || 2000);
    this.filter = new ConsoleLogFilter();
    this.enabled = true;
    this.showTimestamps = false;
    this.interceptConsole = options.interceptConsole !== false;
    this.originalConsole = null;
    this.proxiedConsole = null;
    this.showStackTraces = false;
    this.showCompactStack = true;
    
    // Bind the method that was missing
    this._boundUpdateFiltersAndStatus = this._updateFiltersAndStatus.bind(this);
    this.enabled = true;
  }

  /**
   * Update filters and status from configuration
   * @private
   */
  _updateFiltersAndStatus() {
    if (typeof window !== 'undefined' && window.config) {
      // Update filter configuration from window.config
      if (window.config.typeFilters) {
        this.filter.setIncludeTypes(window.config.typeFilters.include || []);
        this.filter.setExcludeTypes(window.config.typeFilters.exclude || []);
      }
      

      
      if (window.config.levelFilters) {
        this.filter.setIncludeLevels(window.config.levelFilters.include || []);
        this.filter.setExcludeLevels(window.config.levelFilters.exclude || []);
      }
      
      if (window.config.keywordFilters) {
        this.filter.setIncludeKeywords(window.config.keywordFilters.include || '');
        this.filter.setExcludeKeywords(window.config.keywordFilters.exclude || '');
      }
      
      // Update enabled status if available
      if (typeof window.config.enabled === 'boolean') {
        this.enabled = window.config.enabled;
      }
      
      console.log('[ConsoleLogManager] Updated filters and status from window.config');
    }
  }

  /**
   * Initialize the console log manager
   * @param {Object} options - Configuration options
   * @returns {ConsoleLogManager} - This instance for chaining
   */
  initialize(options = {}) {
    // Use filterConfig from options if provided, otherwise fall back to localStorage
    let filterConfig = options.filterConfig;

    if (!filterConfig && typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedSettings = window.localStorage.getItem('consoleLogSettings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          if (settings.filterConfig) {
            filterConfig = settings.filterConfig;
          }
        }
      } catch (e) {
        console.error('Error loading console log settings from localStorage:', e);
      }
    }

    if (filterConfig) {
      this.filter = new ConsoleLogFilter(filterConfig);
    } else {
      this.filter = new ConsoleLogFilter();
    }
    
    // Initialize settings from local storage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedSettings = window.localStorage.getItem('consoleLogSettings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          
          // Apply stored settings
          if (settings.enabled !== undefined) {
            this.enabled = settings.enabled;
          }
          
          if (settings.showTimestamps !== undefined) {
            this.showTimestamps = settings.showTimestamps;
          }
          
          // ==> FIX: Explicitly check for the correct 'consoleLoggingEnabled' key
          // This overrides any 'enabled' value from the 'consoleLogSettings' object
          // to ensure the state from the toggle is respected.
          const enabledFromStorage = window.localStorage.getItem('consoleLoggingEnabled');
          if (enabledFromStorage !== null) {
              this.enabled = enabledFromStorage === 'true';
          }
        }
      } catch (e) {
        console.error('Error loading console log settings from localStorage:', e);
      }
    }
    
    // ==> FIX: After loading state, explicitly update the UI panel if it exists
    if (window.devPages?.ui?.updateConsoleLogPanelStatus) {
        window.devPages.ui.updateConsoleLogPanelStatus();
    }
    
    // Set up console interception if enabled
    if (this.interceptConsole) {
      this.interceptConsoleOutput();
    }
    
    // Check if config is ready, or listen for the event
    if (window.__logConfigReady) {
        console.log('Console log config already ready, updating status and filters immediately.');
        this._boundUpdateFiltersAndStatus();
    } else {
        console.log('Console log config not yet ready, adding event listener for "logConfigReady".');
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
        this.showStackTraces = localStorage.getItem('consoleLogStackTracesEnabled') === 'true';
      } catch (e) {
        // Ignore any localStorage errors
      }
    }
    
    // Initialize compact stack mode
    this.showCompactStack = true; // Default to compact mode
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Only disable if explicitly set to false
        if (localStorage.getItem('consoleLogCompactStackEnabled') === 'false') {
          this.showCompactStack = false;
        }
      } catch (e) {
        // Ignore any localStorage errors
      }
    }
    
    this.enabled = true;
    return this;
  }

  /**
   * Expose console log manager to window for global access and ConsoleLogPanel integration
   */
  exposeToWindow() {
    if (typeof window !== 'undefined') {
      // Store reference to original console methods for ConsoleLogPanel
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
      
      // Initialize discovery sets on window
      window.discoveredTypes = new Set();
      
      // Expose the consoleLogManager globally
      window.consoleLogManager = this;
      window.logManager = this; // Maintain backward compatibility
      
      // === ConsoleLogPanel.js Integration Functions ===
      
      // Console logging control functions
      window.isConsoleLoggingEnabled = () => this.isLoggingEnabled();
      window.enableConsoleLogging = (persist) => this.enableLogging(persist);
      window.disableConsoleLogging = (persist) => this.disableLogging(persist);
      
      // Emergency control functions for reliable state management
      window.forceReEnableLogging = () => {
        this.enabled = true;
        this.filter.setEnabled(true);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('consoleLoggingEnabled', 'true');
          } catch (e) {
            console.error('Error saving console logging state:', e);
          }
        }
        return this;
      };
      
      window.emergencyDisableLogging = () => {
        this.enabled = false;
        this.filter.setEnabled(false);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('consoleLoggingEnabled', 'false');
          } catch (e) {
            console.error('Error saving console logging state:', e);
          }
        }
        return this;
      };
      
      // Performance logging functions (implemented via ConsoleTiming integration)
      window.isPerformanceLoggingEnabled = () => {
        return typeof window !== 'undefined' && 
               window.localStorage && 
               localStorage.getItem('performanceLoggingEnabled') === 'true';
      };
      
      window.enablePerformanceLogging = (persist) => {
        if (persist && typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('performanceLoggingEnabled', 'true');
          } catch (e) {
            console.error('Error saving performance logging state:', e);
          }
        }
        return this;
      };
      
      window.disablePerformanceLogging = (persist) => {
        if (persist && typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('performanceLoggingEnabled', 'false');
          } catch (e) {
            console.error('Error saving performance logging state:', e);
          }
        }
        return this;
      };
      
      // Detailed timing functions
      window.isDetailedTimingEnabled = () => this.filter.config.detailedTimingEnabled !== false;
      window.enableDetailedTiming = (persist) => {
        this.filter.setDetailedTimingEnabled(true);
        if (persist && typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('detailedTimingEnabled', 'true');
          } catch (e) {
            console.error('Error saving detailed timing state:', e);
          }
        }
        return this;
      };
      
      window.disableDetailedTiming = (persist) => {
        this.filter.setDetailedTimingEnabled(false);
        if (persist && typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('detailedTimingEnabled', 'false');
          } catch (e) {
            console.error('Error saving detailed timing state:', e);
          }
        }
        return this;
      };
      
      // Buffer management functions
      window.getLogBuffer = () => this.getLogBuffer();
      window.getLogBufferSize = () => this.getLogBufferSize();
      window.clearLogBuffer = () => this.clearLogBuffer();
      
      // Buffer update callback management
      window.registerOnBufferUpdate = (callback) => this.registerOnBufferUpdate(callback);
      window.unregisterOnBufferUpdate = (callback) => this.unregisterOnBufferUpdate(callback);
      
      // Type/subtype discovery functions
      window.getDiscoveredTypes = () => this.getDiscoveredTypes();
      window.getDiscoveredSubtypes = () => this.getDiscoveredSubtypes();
      
      // Filter management functions
      window.setIncludeTypes = (types) => this.filter.setIncludeTypes(types);
      window.setExcludeTypes = (types) => this.filter.setExcludeTypes(types);
      window.setIncludeSubtypes = (subtypes) => this.filter.setIncludeSubtypes(subtypes);
      window.setExcludeSubtypes = (subtypes) => this.filter.setExcludeSubtypes(subtypes);
      window.setIncludeLevels = (levels) => this.filter.setIncludeLevels(levels);
      window.setExcludeLevels = (levels) => this.filter.setExcludeLevels(levels);
      window.setIncludeKeywords = (keywords) => this.filter.setIncludeKeywords(keywords);
      window.setExcludeKeywords = (keywords) => this.filter.setExcludeKeywords(keywords);
      window.clearAllFilters = () => this.filter.clearAllFilters();
      
      // Signal that config is ready
      window.__logConfigReady = true;
      window.dispatchEvent(new CustomEvent('logConfigReady'));
    }
    return this;
  }

  /**
   * Create a console log entry from various input formats
   * @param {string} level - Log level
   * @param {*} args - Message arguments (string, object, or array)
   * @param {Object} caller - Optional caller information
   * @returns {ConsoleLogEntry} - Created console log entry
   */
  createLogEntry(level, args, caller = null) {
    // Normalize level to uppercase
    const normalizedLevel = this.normalizeLevel(level);
    
    // Get caller information if not provided
    if (!caller) {
      caller = ConsoleCallerInfo.capture(1);
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
    
    // Create and return the console log entry
    return new ConsoleLogEntry(normalizedLevel, message, type, subtype, caller, details);
  }

  /**
   * Normalize log level to standard format
   * @param {string} level - Input level
   * @returns {string} - Normalized level
   */
  normalizeLevel(level) {
    if (typeof level !== 'string') return 'INFO';
    
    const upperLevel = level.toUpperCase();
    const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'TIMING'];
    
    if (validLevels.includes(upperLevel)) {
      return upperLevel;
    }
    
    // Map common variations
    const levelMap = {
      'LOG': 'INFO',
      'WARNING': 'WARN',
      'ERR': 'ERROR',
      'TRACE': 'DEBUG'
    };
    
    return levelMap[upperLevel] || 'INFO';
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
        if (typeof arg === 'function') {
          // Handle functions and class constructors - just show the name
          return `[${arg.name || 'Function'}]`;
        }
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
      return 'Error converting console log arguments: ' + e.message;
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
   * Intercept console output to run it through the console log manager
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
      // Extract type from message if present
      let type = 'GENERAL';
      let level = this.normalizeLevel(method);
      let message = '';
      let details = null;
      let entry = null;
      
      // First, extract any structured info - safely check if method exists
      if (typeof this.extractStructuredInfo === 'function') {
        const structInfo = this.extractStructuredInfo(args);
        if (structInfo) {
          type = structInfo.type || type;
          level = structInfo.level || level;
        }
      }
      
      // Convert args to a string message
      if (args.length > 0) {
        // Check if this is already a ConsoleLogEntry
        if (args[0] instanceof ConsoleLogEntry) {
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
      
      // Create console log entry with extracted information
      entry = new ConsoleLogEntry(level, message, type, null, details);
      
      // Add to buffer
      this.buffer.add(entry);
      
      // Pass to console if enabled and passes filters
      if (this.enabled && this.filter.shouldDisplay(entry)) {
        const formattedArgs = entry.formatForConsole(this.showTimestamps);
        
        // Only add stack traces if explicitly enabled
        if (this.showStackTraces && 
            typeof console.groupCollapsed === 'function' && 
            typeof console.trace === 'function' && 
            typeof console.groupEnd === 'function') {
            
          // Use the group-trace-groupEnd pattern when stack traces are enabled
          console.groupCollapsed.apply(console, formattedArgs);
          console.trace();
          console.groupEnd();
        } else {
          // Normal logging without stack traces
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
      // Use originalConsole.log to avoid recursive error handling
      this.originalConsole.log('[ConsoleLogManager] Non-recursive Error in console log manager:', e);
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
   * Enable console logging
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableLogging(persist = false) {
    console.log('[ConsoleLogManager] Enabling console logging');
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
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableLogging(persist = false) {
    console.log('[ConsoleLogManager] Disabling console logging');
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
   * @returns {boolean} - True if enabled
   */
  isLoggingEnabled() {
    return this.enabled && this.filter.config.enabled;
  }

  /**
   * Enable timestamps in console output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableTimestamps(persist = false) {
    this.showTimestamps = true;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLogTimestampsEnabled', 'true');
      } catch (e) {
        console.error('Error saving timestamp setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Disable timestamps in console output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableTimestamps(persist = false) {
    this.showTimestamps = false;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLogTimestampsEnabled', 'false');
      } catch (e) {
        console.error('Error saving timestamp setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Check if timestamps are enabled
   * @returns {boolean} - True if timestamps are enabled
   */
  areTimestampsEnabled() {
    return this.showTimestamps;
  }

  /**
   * Save current settings to localStorage
   */
  saveSettings() {
    if (typeof window === 'undefined' || !window.localStorage) return this;
    
    try {
      const settings = {
        enabled: this.enabled,
        showTimestamps: this.showTimestamps,
        filterConfig: this.filter.getConfig()
      };
      
      localStorage.setItem('consoleLogSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving console log settings:', e);
    }
    
    return this;
  }

  /**
   * Get the current console log buffer
   * @returns {Array} - Array of console log entries
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
   * Unregister a buffer update callback
   * @param {Function} callback - Callback to remove
   */
  unregisterOnBufferUpdate(callback) {
    this.buffer.unregisterCallback(callback);
    return this;
  }

  /**
   * Get all discovered types
   * @returns {Array} - Array of discovered types
   */
  getDiscoveredTypes() {
    return this.buffer.getDiscoveredTypes();
  }

  /**
   * Create a silent timer (for performance tracking)
   * @param {string} label - Timer label
   * @param {Object} options - Timer options
   * @returns {Object} - Timer object
   */
  createSilentTimer(label, options = {}) {
    const startTime = performance.now();
    
    return {
      label,
      startTime,
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (!options.silent) {
          const entry = new ConsoleLogEntry(
            'TIMING',
            `${label}: ${duration.toFixed(2)}ms`,
            'PERFORMANCE'
          );
          
          this.buffer.add(entry);
          
          if (this.enabled && this.filter.shouldDisplay(entry)) {
            const formattedArgs = entry.formatForConsole(this.showTimestamps);
            this.originalConsole.info.apply(console, formattedArgs);
          }
        }
        
        return duration;
      }
    };
  }

  /**
   * Extract structured info from console log arguments
   * @param {Array} args - Console arguments
   * @returns {Object|null} - Extracted structured info or null
   */
  extractStructuredInfo(args) {
    if (!args || args.length === 0) return null;
    
    const firstArg = args[0];
    
    // Check if first argument is an object with structured log properties
    if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg)) {
      // Look for structured log format with type, level, etc.
      if (firstArg.type || firstArg.level || firstArg.message !== undefined) {
        return {
          type: firstArg.type,
          level: firstArg.level,
          message: firstArg.message
        };
      }
    }
    
    // Check if first argument is a string with [TYPE] format
    if (typeof firstArg === 'string') {
      // Simple regex to extract [TYPE]
      const typeMatch = firstArg.match(/^\s*\[([^\]]+)\]\s*(.*)/);
      if (typeMatch) {
        const [, type, message] = typeMatch;
        // Return the structured info with remaining text as the message
        return {
          type: type || 'GENERAL',
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
   * Enable stack traces in console log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableStackTraces(persist = false) {
    this.showStackTraces = true;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLogStackTracesEnabled', 'true');
      } catch (e) {
        this.originalConsole.error('Error saving stack trace setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Disable stack traces in console log output
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableStackTraces(persist = false) {
    this.showStackTraces = false;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLogStackTracesEnabled', 'false');
      } catch (e) {
        this.originalConsole.error('Error saving stack trace setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Check if stack traces are enabled
   * @returns {boolean} - True if stack traces are enabled
   */
  areStackTracesEnabled() {
    return this.showStackTraces;
  }

  /**
   * Enable compact stack trace mode
   * @param {boolean} persist - Whether to persist to localStorage
   */
  enableCompactStack(persist = false) {
    this.showCompactStack = true;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLogCompactStackEnabled', 'true');
      } catch (e) {
        this.originalConsole.error('Error saving compact stack setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Disable compact stack trace mode
   * @param {boolean} persist - Whether to persist to localStorage
   */
  disableCompactStack(persist = false) {
    this.showCompactStack = false;
    
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('consoleLogCompactStackEnabled', 'false');
      } catch (e) {
        this.originalConsole.error('Error saving compact stack setting:', e);
      }
    }
    
    return this;
  }

  /**
   * Check if compact stack trace mode is enabled
   * @returns {boolean} - True if compact stack is enabled
   */
  isCompactStackEnabled() {
    return this.showCompactStack;
  }
} 