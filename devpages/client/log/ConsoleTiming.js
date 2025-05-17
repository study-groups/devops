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

const originalConsoleDebug = console.debug; // Store it before any potential patching

// Ensure originalConsole is safely available for debugging within this module
// If console might be patched later, define a stable original console for debugging.
const stableDebug = console.debug; // Or console.log if debug is also patched early

// Configuration properties related to timing
stableDebug('[CONSOLE_TIMING_MODULE_LOAD] ConsoleTiming.js module loading/evaluating.');

const timingConfig = {
  performanceTiming: (() => {
    const val = localStorage.getItem('performanceLoggingEnabled') === 'true';
    stableDebug('[CONSOLE_TIMING_INIT] Reading performanceLoggingEnabled from localStorage:', val);
    return val;
  })(),
  detailedTiming: (() => {
    const val = localStorage.getItem('detailedPerformanceLog') === 'true';
    stableDebug('[CONSOLE_TIMING_INIT] Reading detailedPerformanceLog from localStorage:', val);
    return val;
  })(),
  startTime: performance.now(), // Timestamp of manager initialization or last reset
  lastLogTime: performance.now(), // Timestamp of the most recent log entry

  maxTimingHistory: 1000, // Max number of entries in timingHistory
  maxTimingAge: 30 * 60 * 1000 // Max age in ms (30 minutes) for timing history
};
stableDebug('[CONSOLE_TIMING_INIT] Initial timingConfig object:', JSON.parse(JSON.stringify(timingConfig)));

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
  // stableDebug('[TIMING_addPerformanceInfoToLog] Called. Current timingConfig.performanceTiming:', timingConfig.performanceTiming);
  if (!timingConfig.performanceTiming) {
    return args; // No change if performance logging is off
  }

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

  // Format timing data
  let timingPrefix = '';
  if (timingConfig.detailedTiming) {
    timingPrefix = `[ detailed: ${sinceLast.toFixed(2)}ms | Event: ${label} ]`;
  } else {
    timingPrefix = `[${sinceLast.toFixed(0)}ms]`;
  }

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

// Helper function to calculate mean
function calculateMean(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + (val || 0), 0);
  return sum / numbers.length;
}

// Helper function to calculate standard deviation
function calculateStdDev(numbers, mean) {
  if (!numbers || numbers.length === 0) return 0;
  const variance = numbers.reduce((acc, val) => acc + Math.pow((val || 0) - mean, 2), 0) / numbers.length;
  return Math.sqrt(variance);
}

// Helper function to get base label (e.g., "LogPanel.addEntry" from "LogPanel.addEntry-123")
function getBaseLabel(label) {
  if (typeof label !== 'string') return 'unknown_label';
  const parts = label.split('-');
  if (parts.length > 1) {
    // Remove the last part if it's numeric (like an ID) or a common suffix
    const lastPart = parts[parts.length - 1];
    if (!isNaN(parseFloat(lastPart)) && isFinite(lastPart)) { // Check if it's a number
        return parts.slice(0, -1).join('-');
    }
    // Add other generic suffixes to strip if needed, e.g. common guids or timestamps
  }
  return label; // Fallback to full label if no clear numeric suffix
}

/**
 * Generate a report from timing history.
 * @param {object} options - Filtering/grouping options for the report.
 * @returns {string} - Formatted report string.
 */
function getTimingReport(options) {
  let report = "=== TIMING REPORT ===\n";

  // --- CONSOLE Section ---
  // This section's detail should heavily depend on the 'detailed' flag
  if (timingConfig.performanceTiming) {
    report += "\n== CONSOLE MESSAGES (Timed via console.* calls) ==\n";
    if (timingHistory && typeof timingHistory.get === 'function') {
      const consoleEntries = timingHistory.get({ type: 'console' }); // Assuming type 'console'
      if (consoleEntries && consoleEntries.length > 0) {
        // Sort by duration, descending
        consoleEntries.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        
        if (timingConfig.detailedTiming) {
          consoleEntries.forEach(entry => {
            report += `${entry.label || 'Unknown Console Log'}: ${(entry.duration || 0).toFixed(2)}ms\n`;
          });
        } else {
          // Non-detailed: Maybe just a summary or top N
          report += `Total console messages logged with timing: ${consoleEntries.length}\n`;
          report += `Top 5 longest (if available):\n`;
          consoleEntries.slice(0, 5).forEach(entry => {
            report += `  - ${ (entry.label || 'Unknown Log').substring(0,70)}: ${(entry.duration || 0).toFixed(0)}ms\n`;
          });
          if(consoleEntries.length > 5) report += "  ... and more.\n"
        }
      } else {
        report += "No console messages with performance timing recorded in history.\n";
      }
    } else {
      report += "Timing history for console messages not available.\n";
    }
  } else {
     report += "\n== CONSOLE MESSAGES ==\nPerformance logging for console messages is disabled.\n";
  }

  // --- TIMER Section (for createTimer() instances) ---
  report += "\n== EXPLICIT TIMERS (Created via createTimer) ==\n";
  if (timingHistory && typeof timingHistory.get === 'function') {
    const timerEntries = timingHistory.get({ type: 'timer' });
    if (timerEntries && timerEntries.length > 0) {
      const groupedTimers = {};

      timerEntries.forEach(entry => {
        const baseLabel = getBaseLabel(entry.label);
        if (!groupedTimers[baseLabel]) {
          groupedTimers[baseLabel] = {
            entries: [],
            totalDurations: [], // For the main timer duration
            checkpointStats: {} // To hold stats for each checkpoint name
          };
        }
        groupedTimers[baseLabel].entries.push(entry);
        groupedTimers[baseLabel].totalDurations.push(entry.duration || 0);

        if (entry.checkpoints && entry.checkpoints.length > 0) {
          entry.checkpoints.forEach(cp => {
            if (!groupedTimers[baseLabel].checkpointStats[cp.name]) {
              groupedTimers[baseLabel].checkpointStats[cp.name] = {
                durations: [],
                count: 0
              };
            }
            groupedTimers[baseLabel].checkpointStats[cp.name].durations.push(cp.duration || 0);
            groupedTimers[baseLabel].checkpointStats[cp.name].count++;
          });
        }
      });

      // Sort base labels alphabetically for consistent report order
      Object.keys(groupedTimers).sort().forEach(baseLabel => {
        const group = groupedTimers[baseLabel];
        const count = group.entries.length;
        const meanDuration = calculateMean(group.totalDurations);
        const stdDevDuration = calculateStdDev(group.totalDurations, meanDuration);

        report += `\n--- ${baseLabel} (Count: ${count}, Avg Total: ${meanDuration.toFixed(2)}ms, StdDev Total: ${stdDevDuration.toFixed(2)}ms) ---\n`;

        // Checkpoint Summaries
        Object.keys(group.checkpointStats).sort().forEach(cpName => {
          const cpStat = group.checkpointStats[cpName];
          const cpMean = calculateMean(cpStat.durations);
          const cpStdDev = calculateStdDev(cpStat.durations, cpMean);
          report += `  → Checkpoint '${cpName}' (Count: ${cpStat.count}, Avg: ${cpMean.toFixed(2)}ms, StdDev: ${cpStdDev.toFixed(2)}ms)\n`;
        });
      });
    } else {
      report += "No explicit timers recorded in history.\n";
    }
  } else {
    report += "Timing history for explicit timers not available.\n";
  }

  // --- FUNCTION Section (for timeFunction() instances) ---
  // (Assuming a similar structure might be wanted for 'function' type if it exists and is used)
  report += "\n== TIMED FUNCTIONS (Wrapped via timeFunction) ==\n";
  if (timingHistory && typeof timingHistory.get === 'function') {
    const funcEntries = timingHistory.get({ type: 'function' });
    if (funcEntries && funcEntries.length > 0) {
        // Similar grouping and stats could be applied here if desired
        funcEntries.sort((a,b) => (b.duration || 0) - (a.duration||0));
        funcEntries.forEach(entry => {
            report += `${entry.label}: ${(entry.duration || 0).toFixed(2)}ms\n`;
        });
    } else {
        report += "No timed functions recorded in history.\n";
    }
  } else {
    report += "Timing history for timed functions not available.\n";
  }


  return report;
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
  stableDebug(`[CONSOLE_TIMING] enablePerformanceLogging called. Persist: ${persist}. Current value: ${timingConfig.performanceTiming}`);
  timingConfig.performanceTiming = true;
  if (persist) {
    localStorage.setItem('performanceLoggingEnabled', 'true');
    stableDebug('[CONSOLE_TIMING] Saved performanceLoggingEnabled=true to localStorage');
  }
  console.log('[CONSOLE_TIMING] Performance logging ENABLED.'); // User-visible confirmation
  return true;
}

/**
 * Disable performance timing - removes timing prefixes from logs.
 * @param {boolean} persist - Whether to save setting to localStorage.
 */
function disablePerformanceLogging(persist = false) {
  stableDebug(`[CONSOLE_TIMING] disablePerformanceLogging called. Persist: ${persist}. Current value: ${timingConfig.performanceTiming}`);
  timingConfig.performanceTiming = false;
  if (persist) {
    localStorage.setItem('performanceLoggingEnabled', 'false');
    stableDebug('[CONSOLE_TIMING] Saved performanceLoggingEnabled=false to localStorage');
  }
  console.log('[CONSOLE_TIMING] Performance logging DISABLED.'); // User-visible confirmation
  return false;
}

/**
 * Enable detailed performance timing - shows full milliseconds and total time.
 * @param {boolean} persist - Whether to save setting to localStorage.
 */
function enableDetailedTiming(persist = false) {
  stableDebug(`[CONSOLE_TIMING] enableDetailedTiming called. Persist: ${persist}. Current value: ${timingConfig.detailedTiming}`);
  timingConfig.detailedTiming = true;
  if (persist) {
    localStorage.setItem('detailedPerformanceLog', 'true');
    stableDebug('[CONSOLE_TIMING] Saved detailedPerformanceLog=true to localStorage');
  }
  console.log('[CONSOLE_TIMING] Detailed performance metrics ENABLED.'); // User-visible confirmation
  return true;
}

/**
 * Disable detailed performance timing - shows rounded milliseconds only.
 * @param {boolean} persist - Whether to save setting to localStorage.
 */
function disableDetailedTiming(persist = false) {
  stableDebug(`[CONSOLE_TIMING] disableDetailedTiming called. Persist: ${persist}. Current value: ${timingConfig.detailedTiming}`);
  timingConfig.detailedTiming = false;
  if (persist) {
    localStorage.setItem('detailedPerformanceLog', 'false');
    stableDebug('[CONSOLE_TIMING] Saved detailedPerformanceLog=false to localStorage');
  }
  console.log('[CONSOLE_TIMING] Detailed performance metrics DISABLED.'); // User-visible confirmation
  return false;
}

// Added for completeness based on previous suggestions, ensure these exist
function isPerformanceLoggingEnabled() {
  stableDebug('[CONSOLE_TIMING] isPerformanceLoggingEnabled check. Returning:', timingConfig.performanceTiming, 'Full timingConfig:', JSON.parse(JSON.stringify(timingConfig)));
  return timingConfig.performanceTiming;
}

function isDetailedTimingEnabled() {
  stableDebug('[CONSOLE_TIMING] isDetailedTimingEnabled check. Returning:', timingConfig.detailedTiming, 'Full timingConfig:', JSON.parse(JSON.stringify(timingConfig)));
  return timingConfig.detailedTiming;
}

// --- Initialization ---
// This function can be called by ConsoleLogManager to initialize timing
// and potentially expose timing functions globally.
function initializeTiming() {
    stableDebug('[CONSOLE_TIMING] initializeTiming() called.');
    const perfEnabled = localStorage.getItem('performanceLoggingEnabled') === 'true';
    const detailedEnabled = localStorage.getItem('detailedPerformanceLog') === 'true';

    timingConfig.performanceTiming = perfEnabled;
    timingConfig.detailedTiming = detailedEnabled;

    timingConfig.startTime = performance.now();
    timingConfig.lastLogTime = performance.now();
    stableDebug(`[CONSOLE_TIMING] Initialized/Re-initialized. Performance: ${perfEnabled}, Detailed: ${detailedEnabled}. Full timingConfig:`, JSON.parse(JSON.stringify(timingConfig)));
}

// Call initializeTiming at the end of the module to ensure it runs after everything is defined.
// This will also re-sync with localStorage if the module is ever re-evaluated.
initializeTiming();


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
  initializeTiming, // Export initialization function
  isPerformanceLoggingEnabled,
  isDetailedTimingEnabled
};
