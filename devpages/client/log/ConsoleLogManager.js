/**
 * ConsoleLogManager.js - Manages browser console logging with performance timing
 * 
 * Features:
 * - Control console logging (enable/disable)
 * - Performance timing for functions and blocks
 * - Natural language filtering for console output
 * - Integration with settings panel
 * - Timing history for later reporting
 */

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error
};

// Configuration - loaded from localStorage
const config = {
  enabled: localStorage.getItem('consoleLoggingEnabled') === 'true',
  performanceTiming: localStorage.getItem('performanceLoggingEnabled') === 'true',
  detailedTiming: localStorage.getItem('detailedPerformanceLog') === 'true',
  filter: localStorage.getItem('consoleLogFilter') || '',
  startTime: performance.now(),
  lastLogTime: performance.now(),
  
  // NEW: Maximum number of timing entries to keep in history
  maxTimingHistory: 1000,
  
  // NEW: Maximum age of timing entries in milliseconds (30 minutes)
  maxTimingAge: 30 * 60 * 1000
};

// Cache for NLP filter queries
const filterCache = new Map();

// NEW: Timing history buffer
const timingHistory = {
  // Store entries even when console is disabled
  entries: [],
  
  // Add a timing entry to history
  add(entry) {
    // Add timestamp if not present
    if (!entry.timestamp) {
      entry.timestamp = performance.now();
    }
    
    // Add to beginning of array (newest first)
    this.entries.unshift(entry);
    
    // Trim history to config.maxTimingHistory entries
    if (this.entries.length > config.maxTimingHistory) {
      this.entries = this.entries.slice(0, config.maxTimingHistory);
    }
    
    // Also remove entries older than maxTimingAge
    const cutoffTime = performance.now() - config.maxTimingAge;
    this.entries = this.entries.filter(e => e.timestamp >= cutoffTime);
    
    return entry;
  },
  
  // Get all timing entries
  getAll() {
    return [...this.entries];
  },
  
  // Get entries filtered by type and/or label
  get(options = {}) {
    const { type, label, limit } = options;
    
    let result = this.entries;
    
    // Filter by type if specified
    if (type) {
      result = result.filter(e => e.type === type);
    }
    
    // Filter by label if specified (partial match)
    if (label) {
      result = result.filter(e => e.label && e.label.includes(label));
    }
    
    // Apply limit if specified
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }
    
    return result;
  },
  
  // Clear all timing entries
  clear() {
    this.entries = [];
    return true;
  },
  
  // Generate a report of timing entries
  generateReport(options = {}) {
    const entries = this.get(options);
    
    if (entries.length === 0) {
      return "No timing data available";
    }
    
    // Group by type
    const byType = {};
    entries.forEach(entry => {
      if (!byType[entry.type]) {
        byType[entry.type] = [];
      }
      byType[entry.type].push(entry);
    });
    
    // Generate report
    let report = "=== TIMING REPORT ===\n\n";
    
    Object.keys(byType).forEach(type => {
      report += `== ${type.toUpperCase()} ==\n`;
      
      const typeEntries = byType[type];
      
      // Sort by duration (longest first)
      typeEntries.sort((a, b) => b.duration - a.duration);
      
      typeEntries.forEach(entry => {
        report += `${entry.label}: ${entry.duration.toFixed(2)}ms\n`;
        
        // Add checkpoints if available
        if (entry.checkpoints && entry.checkpoints.length > 0) {
          entry.checkpoints.forEach(cp => {
            report += `  → ${cp.name}: ${cp.duration.toFixed(2)}ms\n`;
          });
        }
      });
      
      report += "\n";
    });
    
    return report;
  }
};

/**
 * Applies filter to log message
 * @param {string} level - Log level (log, info, warn, error, debug)
 * @param {Array} args - Arguments passed to console method
 * @returns {boolean} - Whether the message should be logged
 */
function shouldLog(level, args) {
  if (!config.filter) return true;
  
  // If filter is active, apply NLP-inspired filtering
  const message = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message;
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(' ');
  
  // Get cached result or compute new one
  let result = filterCache.get(config.filter + level + message);
  if (result !== undefined) return result;
  
  // Process filter
  const filterTerms = config.filter.toLowerCase().split(/\s+/);
  
  // Check each term
  result = filterTerms.every(term => {
    // Negation with '-' prefix
    if (term.startsWith('-')) {
      const negatedTerm = term.substring(1);
      return !message.toLowerCase().includes(negatedTerm);
    }
    
    // Level filter with 'level:' prefix
    if (term.startsWith('level:')) {
      const targetLevel = term.substring(6);
      return level.toLowerCase() === targetLevel;
    }
    
    // Type/category with 'type:' prefix
    if (term.startsWith('type:')) {
      const targetType = term.substring(5);
      return message.toLowerCase().includes(`[${targetType.toLowerCase()}]`);
    }
    
    // Default case - term must be in message
    return message.toLowerCase().includes(term);
  });
  
  // Cache result
  filterCache.set(config.filter + level + message, result);
  return result;
}

/**
 * Prepends performance metrics to log messages
 * @param {Array} args - Arguments to log
 * @returns {Array} - Arguments with timing info prepended
 */
function addPerformanceInfo(args) {
  if (!config.performanceTiming) return args;
  
  const now = performance.now();
  const sinceLast = now - config.lastLogTime;
  const sinceStart = now - config.startTime;
  config.lastLogTime = now;
  
  // NEW: Record timing in history
  timingHistory.add({
    type: 'console',
    label: args[0] || 'unlabeled',
    timestamp: now,
    sinceLast: sinceLast,
    sinceStart: sinceStart,
    duration: sinceLast
  });
  
  // Format timing data
  let timingPrefix = '';
  if (config.detailedTiming) {
    timingPrefix = `[+${sinceLast.toFixed(2)}ms | total: ${sinceStart.toFixed(2)}ms]`;
  } else {
    timingPrefix = `[+${sinceLast.toFixed(0)}ms]`;
  }
  
  // Add timing to args
  return [timingPrefix, ...args];
}

/**
 * Console proxy functions
 */
const proxiedConsole = {
  log: function(...args) {
    if (!config.enabled) return;
    if (shouldLog('log', args)) {
      originalConsole.log(...addPerformanceInfo(args));
    }
  },
  
  info: function(...args) {
    if (!config.enabled) return;
    if (shouldLog('info', args)) {
      originalConsole.info(...addPerformanceInfo(args));
    }
  },
  
  debug: function(...args) {
    if (!config.enabled) return;
    if (shouldLog('debug', args)) {
      originalConsole.debug(...addPerformanceInfo(args));
    }
  },
  
  warn: function(...args) {
    // Always show warnings, even if main logging is disabled
    if (shouldLog('warn', args)) {
      originalConsole.warn(...addPerformanceInfo(args));
    }
  },
  
  error: function(...args) {
    // Always show errors, even if main logging is disabled
    if (shouldLog('error', args)) {
      originalConsole.error(...addPerformanceInfo(args));
    }
  }
};

/**
 * Creates a timer for measuring code block execution time
 * @param {string} label - Label for the timer
 * @param {Object} options - Configuration options
 * @returns {Object} - Timer object with end() method
 */
function createTimer(label, options = {}) {
  const {
    logLevel = 'log',
    thresholdMs = 0,
    includeStackTrace = false,
    recordHistory = true // NEW: option to record in history
  } = options;
  
  const start = performance.now();
  const timerEntry = recordHistory ? {
    type: 'timer',
    label: label,
    timestamp: start,
    sinceStart: start - config.startTime,
    checkpoints: []
  } : null;
  
  // Get correct log function
  const logFunc = 
    logLevel === 'error' ? originalConsole.error :
    logLevel === 'warn' ? originalConsole.warn :
    logLevel === 'debug' ? originalConsole.debug :
    logLevel === 'info' ? originalConsole.info :
    originalConsole.log;
  
  // Only log start if detailed timing is enabled
  if (config.enabled && config.performanceTiming && config.detailedTiming) {
    logFunc(`[TIMER-START] ${label}`);
  }
  
  return {
    // Get current duration without ending timer
    current() {
      return performance.now() - start;
    },
    
    // Create checkpoint within the timer
    checkpoint(checkpointName) {
      const current = performance.now();
      const duration = current - start;
      
      // NEW: Record checkpoint in history
      if (recordHistory && timerEntry) {
        timerEntry.checkpoints.push({
          name: checkpointName,
          timestamp: current,
          duration: duration
        });
      }
      
      if (config.enabled && config.performanceTiming && duration >= thresholdMs) {
        logFunc(`[TIMER-CHECKPOINT] ${label} > ${checkpointName}: ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    },
    
    // End the timer and return the duration
    end() {
      const duration = performance.now() - start;
      
      // NEW: Complete timer entry and add to history
      if (recordHistory && timerEntry) {
        timerEntry.duration = duration;
        timingHistory.add(timerEntry);
      }
      
      if (config.enabled && config.performanceTiming && duration >= thresholdMs) {
        let message = `[TIMER-END] ${label}: ${duration.toFixed(2)}ms`;
        
        if (includeStackTrace) {
          const stack = new Error().stack
            .split('\n')
            .slice(2)
            .join('\n');
          message += `\n${stack}`;
        }
        
        logFunc(message);
      }
      
      return duration;
    }
  };
}

/**
 * Creates a wrapper function that measures execution time
 * @param {Function} fn - Function to measure
 * @param {Object} options - Configuration options
 * @returns {Function} - Wrapped function
 */
function timeFunction(fn, options = {}) {
  const {
    name = fn.name || 'anonymous',
    logLevel = 'log',
    thresholdMs = 0,
    includeStackTrace = false,
    recordHistory = true // NEW: option to record in history
  } = options;
  
  // Get correct log function
  const logFunc = 
    logLevel === 'error' ? originalConsole.error :
    logLevel === 'warn' ? originalConsole.warn :
    logLevel === 'debug' ? originalConsole.debug :
    logLevel === 'info' ? originalConsole.info :
    originalConsole.log;
  
  return async function(...args) {
    // Skip timing if performance logging is disabled
    if (!config.enabled && !config.performanceTiming && !recordHistory) {
      return await fn.apply(this, args);
    }
    
    // Log start time if detailed timing is enabled
    if (config.detailedTiming && config.enabled) {
      logFunc(`[TIMING-START] ${name}`);
    }
    
    const start = performance.now();
    try {
      return await fn.apply(this, args);
    } finally {
      const duration = performance.now() - start;
      
      // NEW: Record in history
      if (recordHistory) {
        timingHistory.add({
          type: 'function',
          label: name,
          timestamp: start,
          duration: duration,
          sinceStart: start - config.startTime
        });
      }
      
      if (config.enabled && config.performanceTiming && duration >= thresholdMs) {
        let message = `[TIMING] ${name}: ${duration.toFixed(2)}ms`;
        
        if (includeStackTrace) {
          const stack = new Error().stack
            .split('\n')
            .slice(2)
            .join('\n');
          message += `\n${stack}`;
        }
        
        logFunc(message);
      }
    }
  };
}

/**
 * Enable console logging
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function enableConsoleLogging(persist = false) {
  // Enable logging
  config.enabled = true;
  
  // Update console methods
  console.log = proxiedConsole.log;
  console.info = proxiedConsole.info;
  console.debug = proxiedConsole.debug;
  console.warn = proxiedConsole.warn;
  console.error = proxiedConsole.error;
  
  // Save to localStorage if requested
  if (persist) {
    localStorage.setItem('consoleLoggingEnabled', 'true');
  }
  
  // Confirmation message
  originalConsole.log('[CONSOLE] Logging enabled');
  
  return true;
}

/**
 * Disable console logging
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function disableConsoleLogging(persist = false) {
  // Disable logging
  config.enabled = false;
  
  // Update console methods - keep warn and error enabled
  console.log = function() {};
  console.info = function() {};
  console.debug = function() {};
  console.warn = proxiedConsole.warn;  // Keep warnings
  console.error = proxiedConsole.error; // Keep errors
  
  // Save to localStorage if requested
  if (persist) {
    localStorage.setItem('consoleLoggingEnabled', 'false');
  }
  
  // Confirmation message
  originalConsole.log('[CONSOLE] Logging disabled (this is the last message)');
  
  return false;
}

/**
 * Enable performance timing in console logs
 * @param {boolean} detailed - Whether to show detailed timing
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function enablePerformanceLogging(detailed = false, persist = false) {
  // Enable performance timing
  config.performanceTiming = true;
  config.detailedTiming = detailed;
  
  // Save to localStorage if requested
  if (persist) {
    localStorage.setItem('performanceLoggingEnabled', 'true');
    localStorage.setItem('detailedPerformanceLog', detailed ? 'true' : 'false');
  }
  
  // Reset timer
  config.lastLogTime = performance.now();
  
  // Confirmation message
  originalConsole.log(`[CONSOLE] Performance timing ${detailed ? '(detailed)' : ''} enabled`);
  
  return true;
}

/**
 * Disable performance timing in console logs
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function disablePerformanceLogging(persist = false) {
  // Disable performance timing
  config.performanceTiming = false;
  config.detailedTiming = false;
  
  // Save to localStorage if requested
  if (persist) {
    localStorage.setItem('performanceLoggingEnabled', 'false');
    localStorage.setItem('detailedPerformanceLog', 'false');
  }
  
  // Confirmation message
  originalConsole.log('[CONSOLE] Performance timing disabled');
  
  return false;
}

/**
 * Set console log filter
 * @param {string} filter - Filter string
 * @param {boolean} persist - Whether to save to localStorage
 */
function setConsoleFilter(filter, persist = false) {
  // Set filter
  config.filter = filter || '';
  
  // Clear filter cache
  filterCache.clear();
  
  // Save to localStorage if requested
  if (persist) {
    if (filter) {
      localStorage.setItem('consoleLogFilter', filter);
    } else {
      localStorage.removeItem('consoleLogFilter');
    }
  }
  
  // Confirmation message
  if (filter) {
    originalConsole.log(`[CONSOLE] Filter set: "${filter}"`);
  } else {
    originalConsole.log('[CONSOLE] Filter cleared');
  }
  
  return true;
}

/**
 * Get help text for console filter syntax
 * @returns {string} - Help text
 */
function getFilterHelp() {
  return `
Console Filter Syntax:
- Simple text: Shows logs containing this text
- Multiple terms: Shows logs containing ALL terms (logical AND)
- Exclusion: Use -term to hide logs containing 'term'
- Log level: Use level:info, level:error, etc.
- Log type: Use type:bootstrap, type:ui, etc.

Examples:
  error bootstrap   -> Show bootstrap errors
  user -error       -> Show 'user' logs excluding errors
  level:warn        -> Show only warnings
  type:ui level:info -> Show UI info logs
`;
}

/**
 * Reset all timers
 */
function resetTimers() {
  config.startTime = performance.now();
  config.lastLogTime = performance.now();
  originalConsole.log('[CONSOLE] Timers reset');
}

// Initialize based on localStorage settings
if (config.enabled) {
  enableConsoleLogging();
} else {
  disableConsoleLogging();
}

// Expose methods globally
window.enableConsoleLogging = enableConsoleLogging;
window.disableConsoleLogging = disableConsoleLogging;
window.enablePerformanceLogging = enablePerformanceLogging;
window.disablePerformanceLogging = disablePerformanceLogging;
window.setConsoleFilter = setConsoleFilter;
window.getConsoleFilterHelp = getFilterHelp;
window.resetConsoleTimers = resetTimers;
window.isConsoleLoggingEnabled = () => config.enabled;
window.isPerformanceLoggingEnabled = () => config.performanceTiming;
window.isDetailedTimingEnabled = () => config.detailedTiming;
window.getConsoleFilter = () => config.filter;
window.createTimer = createTimer;
window.timeFunction = timeFunction;

// NEW: Functions to access the timing history
function getTimingHistory(options) {
  return timingHistory.get(options);
}

function clearTimingHistory() {
  return timingHistory.clear();
}

function getTimingReport(options) {
  return timingHistory.generateReport(options);
}

// Expose timing history methods globally
window.getTimingHistory = getTimingHistory;
window.clearTimingHistory = clearTimingHistory;
window.getTimingReport = getTimingReport;

// Export for module use
export {
  enableConsoleLogging,
  disableConsoleLogging,
  enablePerformanceLogging,
  disablePerformanceLogging,
  setConsoleFilter,
  getFilterHelp,
  resetTimers,
  createTimer,
  timeFunction,
  config as consoleConfig,
  getTimingHistory,
  clearTimingHistory,
  getTimingReport,
  timingHistory
};
