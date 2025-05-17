/**
 * ConsoleTiming.js - Manages performance timing and history for console logs and functions.
 * Works in conjunction with ConsoleLogManager.
 */

// Assume originalConsole is available or passed in if needed,
// or access it via window if it's globally exposed by ConsoleLogManager.
// For now, let's assume originalConsole is globally available via ConsoleLogManager's setup.
// In a cleaner refactor, originalConsole might be passed in during initialization.
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error
};


// Configuration properties related to timing
const timingConfig = {
  performanceTiming: localStorage.getItem('performanceLoggingEnabled') === 'true',
  detailedTiming: localStorage.getItem('detailedPerformanceLog') === 'true',
  startTime: performance.now(), // Timestamp of manager initialization or last reset
  lastLogTime: performance.now(), // Timestamp of the most recent log entry

  maxTimingHistory: 1000, // Max number of entries in timingHistory
  maxTimingAge: 30 * 60 * 1000 // Max age in ms (30 minutes) for timing history
};

// Timing history buffer to store timer/function durations
const timingHistory = {
  entries: [],

  add(entry) {
    if (!entry.timestamp) {
      entry.timestamp = performance.now();
    }
    this.entries.unshift(entry); // Add newest first
    // Trim by count
    if (this.entries.length > timingConfig.maxTimingHistory) {
      this.entries = this.entries.slice(0, timingConfig.maxTimingHistory);
    }
    // Trim by age
    const cutoffTime = performance.now() - timingConfig.maxTimingAge;
    this.entries = this.entries.filter(e => e.timestamp >= cutoffTime);
    return entry;
  },

  getAll() { return [...this.entries]; },

  get(options = {}) {
    const { type, label, limit } = options;
    let result = this.entries;
    if (type) result = result.filter(e => e.type === type);
    if (label) result = result.filter(e => e.label && e.label.includes(label)); // Partial label match
    if (limit && limit > 0) result = result.slice(0, limit);
    return result;
  },

  clear() { this.entries = []; return true; },

  generateReport(options = {}) {
      const entries = this.get(options);
      if (entries.length === 0) return "No timing data available";

      const byType = {};
      entries.forEach(entry => {
        if (!byType[entry.type]) byType[entry.type] = [];
        byType[entry.type].push(entry);
      });

      let report = "=== TIMING REPORT ===\n\n";
      Object.keys(byType).forEach(type => {
        report += `== ${type.toUpperCase()} ==\n`;
        const typeEntries = byType[type];
        typeEntries.sort((a, b) => b.duration - a.duration); // Sort by duration descending
        typeEntries.forEach(entry => {
          report += `${entry.label}: ${entry.duration.toFixed(2)}ms\n`;
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
 * Prepends performance metrics to log messages and records in history.
 * NOTE: This function is tightly coupled with log message formatting.
 * It might be better placed in ConsoleLogManager, receiving timing info.
 * For now, keeping it here, assuming it's called by ConsoleLogManager.
 * @param {Array} args - Arguments to log
 * @param {function} argsToMessageString - Function from ConsoleLogManager to convert args to string
 * @returns {Array} - Arguments with timing info prepended
 */
function addPerformanceInfoToLog(args, argsToMessageString) {
  const now = performance.now();
  const sinceLast = now - timingConfig.lastLogTime;
  const sinceStart = now - timingConfig.startTime;
  timingConfig.lastLogTime = now; // Update last log time

  // Record console log entry in history
  // Use the first arg or a generic label
  const label = typeof args[0] === 'string' ? args[0].substring(0, 100) : 'unlabeled';
  timingHistory.add({
    type: 'console',
    label: label,
    timestamp: now,
    sinceLast: sinceLast,
    sinceStart: sinceStart,
    duration: sinceLast // Duration since last log
  });

  // Only prepend if performance timing is explicitly enabled via timing config
  if (!timingConfig.performanceTiming) return args;

  // Format timing data
  let timingPrefix = timingConfig.detailedTiming
    ? `[+${sinceLast.toFixed(2)}ms | total: ${sinceStart.toFixed(2)}ms]`
    : `[+${sinceLast.toFixed(0)}ms]`;

  return [timingPrefix, ...args]; // Prepend timing info
}


// --- Timing Utilities ---

/**
 * Creates a timer for measuring code block execution time.
 * @param {string} label - Label for the timer
 * @param {Object} options - Configuration options ({ logLevel, thresholdMs, includeStackTrace, recordHistory })
 * @returns {Object} - Timer object with current(), checkpoint(), end() methods
 */
function createTimer(label, options = {}) {
  const {
    logLevel = 'log',
    thresholdMs = 0, // Only log if duration >= thresholdMs
    includeStackTrace = false, // Include call stack on end
    recordHistory = true // Record in timing history
  } = options;

  const start = performance.now();
  const timerEntry = recordHistory ? {
    type: 'timer',
    label: label,
    timestamp: start,
    sinceStart: start - timingConfig.startTime,
    checkpoints: []
  } : null;

  // Use original console methods for timer logs themselves to avoid recursion/double timing
  const timerLogFunc =
    logLevel === 'error' ? originalConsole.error :
    logLevel === 'warn' ? originalConsole.warn :
    logLevel === 'debug' ? originalConsole.debug :
    logLevel === 'info' ? originalConsole.info :
    originalConsole.log;

  // Optional: Log start time if detailed timing is enabled
  if (timingConfig.performanceTiming && timingConfig.detailedTiming) {
       // Timer logs are generally not subject to the main grep/word filters
       // Use call() to ensure 'this' context is correct (console)
       timerLogFunc.call(console, `[TIMER-START] ${label}`);
  }

  return {
    current() { return performance.now() - start; }, // Get current duration

    checkpoint(checkpointName) {
      const current = performance.now();
      const duration = current - start;

      if (recordHistory && timerEntry) {
        timerEntry.checkpoints.push({ name: checkpointName, timestamp: current, duration: duration });
      }

       if (timingConfig.performanceTiming && duration >= thresholdMs) {
         // Use call() to ensure 'this' context is correct (console)
         timerLogFunc.call(console, `[TIMER-CHECKPOINT] ${label} > ${checkpointName}: ${duration.toFixed(2)}ms`);
       }
      return duration; // Duration from timer start to checkpoint
    },

    end() {
      const duration = performance.now() - start;

      if (recordHistory && timerEntry) {
        timerEntry.duration = duration;
        timingHistory.add(timerEntry); // Add completed timer to history
      }

       if (timingConfig.performanceTiming && duration >= thresholdMs) {
         let message = `[TIMER-END] ${label}: ${duration.toFixed(2)}ms`;
         if (includeStackTrace) {
           const stack = new Error().stack.split('\n').slice(2).join('\n'); // Get stack trace (excluding this function)
           message += `\n${stack}`;
         }
         // Use call() to ensure 'this' context is correct (console)
         timerLogFunc.call(console, message);
       }
      return duration; // Total duration of the timer
    }
  };
}

/**
 * Creates a wrapper function that measures execution time of another function.
 * @param {Function} fn - The function to measure.
 * @param {Object} options - Configuration ({ name, logLevel, thresholdMs, includeStackTrace, recordHistory })
 * @returns {Function} - A new function that wraps the original and times its execution.
 */
function timeFunction(fn, options = {}) {
  const {
    name = fn.name || 'anonymous', // Use function name or default
    logLevel = 'log',
    thresholdMs = 0,
    includeStackTrace = false,
    recordHistory = true
  } = options;

  const timerLogFunc = // Use original console for timing logs
    logLevel === 'error' ? originalConsole.error :
    logLevel === 'warn' ? originalConsole.warn :
    logLevel === 'debug' ? originalConsole.debug :
    logLevel === 'info' ? originalConsole.info :
    originalConsole.log;


  return async function(...args) { // Return an async function to handle async fn
     // Skip timing if performance logging is disabled AND not recording history
     // Still execute the original function
    if (!timingConfig.performanceTiming && !recordHistory) {
      return await fn.apply(this, args);
    }

    if (timingConfig.detailedTiming) {
       // Use call() to ensure 'this' context is correct (console)
       timerLogFunc.call(console, `[TIMING-START] ${name}`);
    }

    const start = performance.now();
    try {
      return await fn.apply(this, args); // Execute the original function
    } finally {
      const duration = performance.now() - start;

      if (recordHistory) {
        timingHistory.add({
          type: 'function',
          label: name,
          timestamp: start,
          duration: duration,
          sinceStart: start - timingConfig.startTime
        });
      }

       if (timingConfig.performanceTiming && duration >= thresholdMs) {
         let message = `[TIMING] ${name}: ${duration.toFixed(2)}ms`;
         if (includeStackTrace) {
           const stack = new Error().stack.split('\n').slice(2).join('\n');
           message += `\n${stack}`;
         }
         // Use call() to ensure 'this' context is correct (console)
         timerLogFunc.call(console, message);
       }
    }
  };
}

/**
 * Reset timing base (startTime) and clear history.
 */
function resetTimers() {
  timingConfig.startTime = performance.now();
  timingConfig.lastLogTime = performance.now();
  timingHistory.clear(); // Clear history on reset
  originalConsole.log('[CONSOLE-TIMING] Timers and timing history reset');
  return true;
}

/**
 * Get timing history entries.
 * @param {object} options - Filtering/limit options for history.
 * @returns {Array} - Array of timing entries.
 */
function getTimingHistory(options) {
  return timingHistory.get(options);
}

/**
 * Clear all timing history entries.
 */
function clearTimingHistory() {
  return timingHistory.clear();
}

/**
 * Generate a report from timing history.
 * @param {object} options - Filtering/grouping options for the report.
 * @returns {string} - Formatted report string.
 */
function getTimingReport(options) {
  return timingHistory.generateReport(options);
}

/**
 * Get current performance time relative to timing start.
 * @returns {number} - Time in ms.
 */
function getCurrentPerformanceTime() {
    return performance.now() - timingConfig.startTime;
}


// --- Performance Logging Control ---

/**
 * Enable performance timing - adds timing prefixes to logs.
 * @param {boolean} persist - Whether to save setting to localStorage.
 */
function enablePerformanceLogging(persist = false) {
  timingConfig.performanceTiming = true;
  if (persist) localStorage.setItem('performanceLoggingEnabled', 'true');
  originalConsole.log('[CONSOLE-TIMING] Performance timing enabled');
  return true;
}

/**
 * Disable performance timing - removes timing prefixes from logs.
 * @param {boolean} persist - Whether to save setting to localStorage.
 */
function disablePerformanceLogging(persist = false) {
  timingConfig.performanceTiming = false;
  if (persist) localStorage.setItem('performanceLoggingEnabled', 'false');
  originalConsole.log('[CONSOLE-TIMING] Performance timing disabled');
  return false;
}

/**
 * Enable detailed performance timing - shows full milliseconds and total time.
 * @param {boolean} persist - Whether to save setting to localStorage.
 */
function enableDetailedTiming(persist = false) {
  timingConfig.detailedTiming = true;
  if (persist) localStorage.setItem('detailedPerformanceLog', 'true');
  originalConsole.log('[CONSOLE-TIMING] Detailed performance timing enabled');
  return true;
}

/**
 * Disable detailed performance timing - shows rounded milliseconds only.
 * @param {boolean} persist - Whether to save setting to localStorage.
 */
function disableDetailedTiming(persist = false) {
  timingConfig.detailedTiming = false;
  if (persist) localStorage.setItem('detailedPerformanceLog', 'false');
  originalConsole.log('[CONSOLE-TIMING] Detailed performance timing disabled');
  return false;
}

// --- Initialization ---
// This function can be called by ConsoleLogManager to initialize timing
// and potentially expose timing functions globally.
function initializeTiming() {
    // Initial state is loaded from localStorage via timingConfig definition
    // No additional setup needed here beyond defining functions and config.

    // Optional: Expose timing functions globally if needed separately from ConsoleLogManager exports
    window.resetTimers = resetTimers;
    window.getTimingHistory = getTimingHistory;
    window.clearTimingHistory = clearTimingHistory;
    window.getTimingReport = getTimingReport;
    window.createTimer = createTimer;
    window.timeFunction = timeFunction;
    window.getCurrentPerformanceTime = getCurrentPerformanceTime;
    window.enablePerformanceLogging = enablePerformanceLogging;
    window.disablePerformanceLogging = disablePerformanceLogging;
    window.enableDetailedTiming = enableDetailedTiming;
    window.disableDetailedTiming = disableDetailedTiming;

    originalConsole.log('[CONSOLE-TIMING] Timing module initialized.');
}


// =================================================================================
// MODULE EXPORTS
// =================================================================================
export {
  timingConfig, // Export config if ConsoleLogManager needs to read/write it
  timingHistory, // Export history if ConsoleLogManager needs direct access
  addPerformanceInfoToLog, // Export this helper for ConsoleLogManager to use
  createTimer,
  timeFunction,
  resetTimers,
  getTimingHistory,
  clearTimingHistory,
  getTimingReport,
  getCurrentPerformanceTime,
  enablePerformanceLogging,
  disablePerformanceLogging,
  enableDetailedTiming,
  disableDetailedTiming,
  initializeTiming // Export initialization function
};
