/**
 * ConsoleLogManager.js - Manages browser console logging with structured filtering and performance timing.
 * Redesigned to align with LogPanel style using [Type] [SubType] format.
 */

// Import timing features from ConsoleTiming.js
import {
  timingConfig,
  timingHistory,
  addPerformanceInfoToLog,
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
  initializeTiming,
  isDetailedTimingEnabled,
  isPerformanceLoggingEnabled
} from './ConsoleTiming.js';

// Store original console methods before any patching
const originalConsole = (typeof window.__earlyOriginalConsole === 'object' && window.__earlyOriginalConsole !== null)
  ? window.__earlyOriginalConsole
  : { // Fallback if early one isn't there (shouldn't happen in normal flow)
      log: console.log,
      info: console.info,
      debug: console.debug,
      warn: console.warn,
      error: console.error
    };

// Make original console available for debugging in case of issues
// This will now be based on the potentially corrected originalConsole above.
window.originalConsoleForDebug = Object.assign({}, originalConsole);

// Log Buffer
const MAX_BUFFER_SIZE = 2000; // Configurable: Max number of log entries in the buffer
let logBuffer = [];
let onBufferUpdateCallbacks = []; // For live updates
let logSequenceNumber = 0; // Global sequence for all logs processed by addToBuffer

// Configuration
const config = {
  enabled: true, // Placeholder, will be properly set in initialize()
  typeFilters: {
    include: JSON.parse(localStorage.getItem('consoleLogIncludeTypes') || '[]'),
    exclude: JSON.parse(localStorage.getItem('consoleLogExcludeTypes') || '[]')
  },
  subtypeFilters: {
    include: JSON.parse(localStorage.getItem('consoleLogIncludeSubtypes') || '[]'),
    exclude: JSON.parse(localStorage.getItem('consoleLogExcludeSubtypes') || '[]')
  },
  levelFilters: {
    include: JSON.parse(localStorage.getItem('consoleLogIncludeLevels') || '[]'),
    exclude: JSON.parse(localStorage.getItem('consoleLogExcludeLevels') || '[]')
  },
  keywordFilters: {
    include: localStorage.getItem('consoleLogIncludeKeywords') || '',
    exclude: localStorage.getItem('consoleLogExcludeKeywords') || ''
  },
  showTimestamps: localStorage.getItem('consoleLogShowTimestamps') !== 'false'
};

// Discovered categories for filter UI
let discoveredTypes = new Set(JSON.parse(localStorage.getItem('consoleLogDiscoveredTypes') || '[]'));
let discoveredSubtypes = new Set(JSON.parse(localStorage.getItem('consoleLogDiscoveredSubtypes') || '[]'));

// --- Helper Functions ---

/**
 * Formats arguments into structured log entry
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR, TIMING)
 * @param {Array} args - Arguments passed to console
 * @returns {Object} - Structured log entry
 */
function formatLogEntry(level, args) {
  const timestamp = new Date();
  
  // Default values
  let message = '';
  let type = 'GENERAL';
  let subtype = null;
  let details = null;
  
  // Process arguments based on type
  if (args.length === 0) {
    message = '';
  } else if (typeof args[0] === 'object' && args[0] !== null && 'message' in args[0] && 'type' in args[0]) {
    // Object-based structured logging: {message, type, subtype, ...}
    const logObj = args[0];
    message = logObj.message;
    type = logObj.type || type;
    subtype = logObj.subtype || null;
    
    // Check if level is specified in the object
    if (logObj.level) {
      level = normalizeLevel(logObj.level);
    }
    
    details = args.length > 1 ? args.slice(1) : null;
  } else {
    // Parse traditional string format with pattern: [TYPE] [SUBTYPE] message
    if (typeof args[0] === 'string') {
      // Try to detect level from prefix like [DEBUG]
      const levelMatch = args[0].match(/^\s*\[(DEBUG|INFO|WARN|WARNING|ERROR|TIMING)\]\s*(.*)/i);
      if (levelMatch) {
        level = normalizeLevel(levelMatch[1]);
        args[0] = levelMatch[2]; // Remove level prefix for further parsing
      }
      
      const typeMatch = args[0].match(/^\s*\[([A-Z0-9_-]+)\](?:\s*\[([A-Z0-9_-]+)\])?\s*(.*)/i);
      if (typeMatch) {
        type = typeMatch[1].toUpperCase();
        subtype = typeMatch[2] ? typeMatch[2].toUpperCase() : null;
        message = typeMatch[3] || '';
        details = args.length > 1 ? args.slice(1) : null;
      } else {
        // No pattern match, use full string as message
        message = args[0];
        details = args.length > 1 ? args.slice(1) : null;
      }
    } else {
      // Non-string first argument
      message = argsToMessageString(args);
    }
  }
  
  // Handle special case for Error objects
  if (message instanceof Error) {
    details = details || [];
    details.push(message.stack);
    message = message.message;
  }
  
  // Track discovered types and subtypes
  if (type) {
    discoveredTypes.add(type);
    persistDiscoveredTypes();
  }
  if (subtype) {
    discoveredSubtypes.add(subtype);
    persistDiscoveredSubtypes();
  }
  
  return {
    ts: timestamp.getTime(),
    timestamp: timestamp.toISOString(),
    displayTime: timestamp.toLocaleTimeString(),
    level,
    type,
    subtype,
    message,
    details,
    sequence: logSequenceNumber++
  };
}

/**
 * Normalizes log level strings to standard formats
 * @param {string} level - Raw level string
 * @returns {string} - Normalized level (DEBUG, INFO, WARN, ERROR, TIMING)
 */
function normalizeLevel(level) {
  if (!level) return 'INFO';
  
  const upperLevel = level.toUpperCase();
  
  if (upperLevel === 'WARNING') return 'WARN';
  if (['DEBUG', 'INFO', 'WARN', 'ERROR', 'TIMING'].includes(upperLevel)) {
    return upperLevel;
  }
  
  return 'INFO'; // Default to INFO for unknown levels
}

// Converts log arguments array into a single string
function argsToMessageString(args) {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message;
    try { return JSON.stringify(arg); }
    catch (e) { return String(arg); }
  }).join(' ');
}

// Persist discovered types and subtypes
function persistDiscoveredTypes() {
  localStorage.setItem('consoleLogDiscoveredTypes', JSON.stringify([...discoveredTypes]));
}

function persistDiscoveredSubtypes() {
  localStorage.setItem('consoleLogDiscoveredSubtypes', JSON.stringify([...discoveredSubtypes]));
}

// --- Filtering Logic ---

/**
 * Determines whether a log entry should be displayed based on filtering criteria
 * @param {Object} entry - Structured log entry
 * @returns {boolean} - True if the entry should be displayed
 */
function shouldDisplayEntry(entry) {
  // Special handling for TIMING level
  if (entry.level === 'TIMING') {
    const detailedTiming = isDetailedTimingEnabled();
    originalConsole.log(`[CLM_DEBUG] shouldDisplayEntry for TIMING: Detailed Timing Enabled = ${detailedTiming}. Entry:`, entry);
    if (!detailedTiming) {
      originalConsole.log('[CLM_DEBUG] TIMING log hidden: Detailed timing is OFF.');
      return false;
    }
    // If detailed timing IS enabled, it will proceed to the generic level filters below.
    // We explicitly want to allow TIMING logs to be muted even if detailed timing is on.
  }
  
  // 1. Level filtering
  if (config.levelFilters.exclude.length > 0 && 
      config.levelFilters.exclude.includes(entry.level)) {
    if (entry.level === 'TIMING') {
        originalConsole.log(`[CLM_DEBUG] TIMING log hidden: Found in config.levelFilters.exclude. Filters:`, JSON.parse(JSON.stringify(config.levelFilters)));
    }
    return false;
  }
  
  if (config.levelFilters.include.length > 0 && 
      !config.levelFilters.include.includes(entry.level)) {
    if (entry.level === 'TIMING') {
        originalConsole.log(`[CLM_DEBUG] TIMING log hidden: Not found in config.levelFilters.include (when include has items). Filters:`, JSON.parse(JSON.stringify(config.levelFilters)));
    }
    return false;
  }
  
  // 2. Type filtering
  if (config.typeFilters.exclude.length > 0 && 
      config.typeFilters.exclude.includes(entry.type)) {
    return false;
  }
  
  if (config.typeFilters.include.length > 0 && 
      !config.typeFilters.include.includes(entry.type)) {
    return false;
  }
  
  // 3. Subtype filtering
  if (entry.subtype && config.subtypeFilters.exclude.length > 0 && 
      config.subtypeFilters.exclude.includes(entry.subtype)) {
    return false;
  }
  
  if (config.subtypeFilters.include.length > 0 && 
      !(entry.subtype && config.subtypeFilters.include.includes(entry.subtype))) {
    return false;
  }
  
  // 4. Keyword filtering
  if (config.keywordFilters.exclude) {
    const excludeTerms = config.keywordFilters.exclude.toLowerCase().split(/\s+/).filter(Boolean);
    const messageStr = String(entry.message).toLowerCase();
    
    if (excludeTerms.some(term => messageStr.includes(term))) {
      return false;
    }
  }
  
  if (config.keywordFilters.include) {
    const includeTerms = config.keywordFilters.include.toLowerCase().split(/\s+/).filter(Boolean);
    const messageStr = String(entry.message).toLowerCase();
    
    if (includeTerms.length > 0 && !includeTerms.every(term => messageStr.includes(term))) {
      return false;
    }
  }
  
  return true; // Pass all filters
}

/**
 * Formats a structured log entry for console output
 * @param {Object} entry - Structured log entry
 * @returns {Array} - Arguments to pass to console
 */
function formatEntryForConsole(entry) {
  const parts = [];
  
  // Add timestamp if enabled
  if (config.showTimestamps) {
    parts.push(entry.displayTime);
  }
  
  // Add level and type tags
  parts.push(`[${entry.level}] [${entry.type}]${entry.subtype ? ` [${entry.subtype}]` : ''}`);
  
  // Add message
  parts.push(entry.message);
  
  // Add performance info if enabled
  const consoleArgs = [parts.join(' ')];
  
  // Add any details
  if (entry.details) {
    if (Array.isArray(entry.details)) {
      consoleArgs.push(...entry.details);
    } else {
      consoleArgs.push(entry.details);
    }
  }
  
  return isPerformanceLoggingEnabled() 
    ? addPerformanceInfoToLog(consoleArgs, argsToMessageString) 
    : consoleArgs;
}

// --- Buffer Management ---

/**
 * Adds a log entry to the buffer
 * @param {Object} entry - Structured log entry
 */
function addToBuffer(entry) {
  // Add to front of buffer
  logBuffer.unshift(entry);
  
  // Trim buffer if needed
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer = logBuffer.slice(0, MAX_BUFFER_SIZE);
  }
  
  // Notify callbacks
  onBufferUpdateCallbacks.forEach(callback => {
    try {
      callback(entry);
    } catch (e) {
      originalConsole.error('[CONSOLE_MANAGER] Error in buffer update callback:', e);
    }
  });
}

/**
 * Creates a silent timer for measuring performance without console output
 * Similar to createTimer but doesn't log to console by default
 * @param {string} label - Label for the timer
 * @param {Object} options - Configuration options
 * @returns {Object} - Timer object with current(), checkpoint(), end() methods
 */
function createSilentTimer(label, options = {}) {
  const {
    recordHistory = true,
    thresholdMs = 0
  } = options;
  
  const start = performance.now();
  const timerEntry = recordHistory ? {
    type: 'timer',
    label: label,
    timestamp: start,
    sinceStart: start - timingConfig.startTime,
    checkpoints: []
  } : null;

  return {
    current() { return performance.now() - start; },

    checkpoint(checkpointName) {
      const current = performance.now();
      const duration = current - start;

      if (recordHistory && timerEntry) {
        timerEntry.checkpoints.push({ name: checkpointName, timestamp: current, duration: duration });
      }
      
      return duration;
    },

    end() {
      const duration = performance.now() - start;

      if (recordHistory && timerEntry) {
        timerEntry.duration = duration;
        timingHistory.add(timerEntry); // Add to history without console output
      }

      return duration;
    },
    
    // Log the result to console with TIMING level (only if threshold is met)
    log() {
      const duration = performance.now() - start;
      
      if (duration >= thresholdMs) {
        // Use the TIMING level for output
        proxiedConsole.log({
          message: `[TIMER] ${label}: ${duration.toFixed(2)}ms`,
          level: 'TIMING',
          type: 'TIMER'
        });
      }
      
      return duration;
    }
  };
}

// --- Console Method Proxies ---

// Create proxied console methods
const proxiedConsole = {
  log: function(...args) {
    // Determine level - default to INFO for console.log
    let level = 'INFO';
    
    // If first arg is object with level property, use that
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && args[0].level) {
      level = normalizeLevel(args[0].level);
    }
    
    const entry = formatLogEntry(level, args);
    
    // Always add to buffer if logging is enabled
    if (config.enabled) {
      addToBuffer(entry);
    }
    
    // Display in console if filters pass
    if (config.enabled && shouldDisplayEntry(entry)) {
      originalConsole.log(...formatEntryForConsole(entry));
    }
  },
  
  info: function(...args) {
    const entry = formatLogEntry('INFO', args);
    
    if (config.enabled) {
      addToBuffer(entry);
    }
    
    if (config.enabled && shouldDisplayEntry(entry)) {
      originalConsole.info(...formatEntryForConsole(entry));
    }
  },
  
  debug: function(...args) {
    const entry = formatLogEntry('DEBUG', args);
    
    if (config.enabled) {
      addToBuffer(entry);
    }
    
    if (config.enabled && shouldDisplayEntry(entry)) {
      originalConsole.debug(...formatEntryForConsole(entry));
    }
  },
  
  warn: function(...args) {
    const entry = formatLogEntry('WARN', args);
    
    if (config.enabled) {
      addToBuffer(entry);
    }
    
    if (config.enabled && shouldDisplayEntry(entry)) {
      originalConsole.warn(...formatEntryForConsole(entry));
    } else if (!config.enabled) {
      // Always show warnings when logging is disabled
      originalConsole.warn(...args);
    }
  },
  
  error: function(...args) {
    const entry = formatLogEntry('ERROR', args);
    
    if (config.enabled) {
      addToBuffer(entry);
    }
    
    if (config.enabled && shouldDisplayEntry(entry)) {
      originalConsole.error(...formatEntryForConsole(entry));
    } else if (!config.enabled) {
      // Always show errors when logging is disabled
      originalConsole.error(...args);
    }
  },
  
  // Add a timing-specific method that creates entries with TIMING level
  timing: function(...args) {
    const entry = formatLogEntry('TIMING', args);
    
    if (config.enabled) {
      addToBuffer(entry);
    }
    
    // Only show in console if detailed timing is enabled and display filter passes
    if (config.enabled && isDetailedTimingEnabled() && shouldDisplayEntry(entry)) {
      originalConsole.log(...formatEntryForConsole(entry));
    }
  }
};

// --- Public API Functions ---

/**
 * Enables console logging with proxied methods
 * @param {boolean} persist - Whether to save setting to localStorage
 * @returns {boolean} - The new enabled state
 */
function enableConsoleLogging(persist = false) {
  originalConsole.log('[CONSOLE] Enabling console logging... config before:', config.enabled);
  
  config.enabled = true;
  console.log = proxiedConsole.log;
  console.info = proxiedConsole.info;
  console.debug = proxiedConsole.debug;
  console.warn = proxiedConsole.warn;
  console.error = proxiedConsole.error;
  
  if (persist) {
    localStorage.setItem('consoleLoggingEnabled', 'true');
    originalConsole.log('[CONSOLE] Persisted console logging enabled setting to localStorage');
  }
  
  originalConsole.log('[CONSOLE] Logging enabled.');
  // Notify panel to update its display directly
  if (typeof window.devPages?.ui?.updateConsoleLogPanelStatus === 'function') {
    window.devPages.ui.updateConsoleLogPanelStatus();
  }
  return true;
}

/**
 * Disables console logging and restores original methods
 * @param {boolean} persist - Whether to save setting to localStorage
 * @returns {boolean} - The new enabled state
 */
function disableConsoleLogging(persist = false) {
  originalConsole.log('[CONSOLE] Disabling console logging... config before:', config.enabled);
  
  config.enabled = false;
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  
  if (persist) {
    localStorage.setItem('consoleLoggingEnabled', 'false');
    originalConsole.log('[CONSOLE] Persisted console logging disabled setting to localStorage');
  }
  
  originalConsole.log('[CONSOLE] Logging disabled. Original console methods restored.');
  // Notify panel to update its display directly
  if (typeof window.devPages?.ui?.updateConsoleLogPanelStatus === 'function') {
    window.devPages.ui.updateConsoleLogPanelStatus();
  }
  return false;
}

/**
 * Checks if console logging is enabled
 * @returns {boolean} - Current enabled state
 */
function isConsoleLoggingEnabled() {
  // The authoritative state is this manager's config.enabled
  return config.enabled;
}

// --- Timestamp Control ---

/**
 * Enables displaying timestamps in console logs
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function enableTimestamps(persist = false) {
  config.showTimestamps = true;
  if (persist) {
    localStorage.setItem('consoleLogShowTimestamps', 'true');
  }
}

/**
 * Disables displaying timestamps in console logs
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function disableTimestamps(persist = false) {
  config.showTimestamps = false;
  if (persist) {
    localStorage.setItem('consoleLogShowTimestamps', 'false');
  }
}

/**
 * Checks if timestamps are enabled
 * @returns {boolean} - Current timestamp display state
 */
function areTimestampsEnabled() {
  return config.showTimestamps;
}

// --- Type/Subtype Filtering ---

/**
 * Sets the types to include in console logs
 * @param {Array} types - Array of type strings to include
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setIncludeTypes(types, persist = false) {
  config.typeFilters.include = Array.isArray(types) ? types : [];
  
  if (persist) {
    localStorage.setItem('consoleLogIncludeTypes', JSON.stringify(config.typeFilters.include));
  }
}

/**
 * Sets the types to exclude from console logs
 * @param {Array} types - Array of type strings to exclude
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setExcludeTypes(types, persist = false) {
  config.typeFilters.exclude = Array.isArray(types) ? types : [];
  
  if (persist) {
    localStorage.setItem('consoleLogExcludeTypes', JSON.stringify(config.typeFilters.exclude));
  }
}

/**
 * Sets the subtypes to include in console logs
 * @param {Array} subtypes - Array of subtype strings to include
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setIncludeSubtypes(subtypes, persist = false) {
  config.subtypeFilters.include = Array.isArray(subtypes) ? subtypes : [];
  
  if (persist) {
    localStorage.setItem('consoleLogIncludeSubtypes', JSON.stringify(config.subtypeFilters.include));
  }
}

/**
 * Sets the subtypes to exclude from console logs
 * @param {Array} subtypes - Array of subtype strings to exclude
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setExcludeSubtypes(subtypes, persist = false) {
  config.subtypeFilters.exclude = Array.isArray(subtypes) ? subtypes : [];
  
  if (persist) {
    localStorage.setItem('consoleLogExcludeSubtypes', JSON.stringify(config.subtypeFilters.exclude));
  }
}

/**
 * Sets the log levels to include in console logs
 * @param {Array} levels - Array of level strings to include (DEBUG, INFO, WARN, ERROR)
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setIncludeLevels(levels, persist = false) {
  config.levelFilters.include = Array.isArray(levels) ? levels : [];
  
  if (persist) {
    localStorage.setItem('consoleLogIncludeLevels', JSON.stringify(config.levelFilters.include));
  }
}

/**
 * Sets the log levels to exclude from console logs
 * @param {Array} levels - Array of level strings to exclude (DEBUG, INFO, WARN, ERROR)
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setExcludeLevels(levels, persist = false) {
  config.levelFilters.exclude = Array.isArray(levels) ? levels : [];
  
  if (persist) {
    localStorage.setItem('consoleLogExcludeLevels', JSON.stringify(config.levelFilters.exclude));
  }
}

// --- Keyword Filtering ---

/**
 * Sets keywords to include in logs (space-separated)
 * @param {string} keywords - Space-separated keywords to include
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setIncludeKeywords(keywords, persist = false) {
  config.keywordFilters.include = keywords || '';
  
  if (persist) {
    if (keywords) {
      localStorage.setItem('consoleLogIncludeKeywords', keywords);
    } else {
      localStorage.removeItem('consoleLogIncludeKeywords');
    }
  }
}

/**
 * Sets keywords to exclude from logs (space-separated)
 * @param {string} keywords - Space-separated keywords to exclude
 * @param {boolean} persist - Whether to save setting to localStorage
 */
function setExcludeKeywords(keywords, persist = false) {
  config.keywordFilters.exclude = keywords || '';
  
  if (persist) {
    if (keywords) {
      localStorage.setItem('consoleLogExcludeKeywords', keywords);
    } else {
      localStorage.removeItem('consoleLogExcludeKeywords');
    }
  }
}

/**
 * Clears all filters
 * @param {boolean} persist - Whether to save settings to localStorage
 */
function clearAllFilters(persist = true) {
  setIncludeTypes([], persist);
  setExcludeTypes([], persist);
  setIncludeSubtypes([], persist);
  setExcludeSubtypes([], persist);
  setIncludeLevels([], persist);
  setExcludeLevels([], persist);
  setIncludeKeywords('', persist);
  setExcludeKeywords('', persist);
  
  originalConsole.log('[CONSOLE] All filters cleared.');
}

// --- Buffer Management ---

/**
 * Gets the current log buffer
 * @returns {Array} - Array of log entries
 */
function getLogBuffer() {
  return [...logBuffer];
}

/**
 * Clears the log buffer
 */
function clearLogBuffer() {
  logBuffer = [];
  originalConsole.log('[CONSOLE] Log buffer cleared.');
}

/**
 * Gets the current size of the log buffer
 * @returns {number} - Number of entries in the buffer
 */
function getLogBufferSize() {
  return logBuffer.length;
}

/**
 * Registers a callback for when the buffer is updated
 * @param {Function} callback - Function to call when buffer is updated
 */
function registerOnBufferUpdate(callback) {
  if (typeof callback === 'function' && !onBufferUpdateCallbacks.includes(callback)) {
    onBufferUpdateCallbacks.push(callback);
  }
}

/**
 * Unregisters a buffer update callback
 * @param {Function} callback - Function to unregister
 */
function unregisterOnBufferUpdate(callback) {
  onBufferUpdateCallbacks = onBufferUpdateCallbacks.filter(cb => cb !== callback);
}

/**
 * Gets all discovered log types
 * @returns {Array} - Array of type strings
 */
function getDiscoveredTypes() {
  return [...discoveredTypes];
}

/**
 * Gets all discovered log subtypes
 * @returns {Array} - Array of subtype strings
 */
function getDiscoveredSubtypes() {
  return [...discoveredSubtypes];
}

/**
 * Initializes the console manager
 * Automatically called on module load
 */
function initialize() {
  // Initialize timing functionality
  initializeTiming();
  
  let clmInitialEnabledState = true; // Default if nothing else sets it
  const lsValue = localStorage.getItem('consoleLoggingEnabled');

  // Priority 1: Check for a signal from earlyInit.js
  if (typeof window.__initialConsoleLoggingEnabledByEarlyInit !== 'undefined') {
    clmInitialEnabledState = window.__initialConsoleLoggingEnabledByEarlyInit;
    originalConsole.log(`[CONSOLE_MANAGER_INIT] Using state from earlyInit: ${clmInitialEnabledState}`);
    // Clean up the global hint after reading it
    try {
        delete window.__initialConsoleLoggingEnabledByEarlyInit;
    } catch (e) { /*ignore*/ }

    // Ensure localStorage is consistent with the earlyInit signal
    // earlyInit.js should already do this if a URL param was used, but this is a safeguard.
    if (lsValue !== (clmInitialEnabledState ? 'true' : 'false')) {
        localStorage.setItem('consoleLoggingEnabled', clmInitialEnabledState ? 'true' : 'false');
        originalConsole.log(`[CONSOLE_MANAGER_INIT] Synced localStorage to earlyInit signal: ${clmInitialEnabledState}`);
    }
  } else if (lsValue !== null) {
    // Priority 2: Use localStorage if no earlyInit signal
    clmInitialEnabledState = lsValue === 'true';
    originalConsole.log(`[CONSOLE_MANAGER_INIT] Using state from localStorage: ${clmInitialEnabledState}`);
  } else {
    // Priority 3: Default (true), and persist this default to localStorage
    clmInitialEnabledState = true; // Default to true if no signal and no localStorage
    localStorage.setItem('consoleLoggingEnabled', 'true');
    originalConsole.log(`[CONSOLE_MANAGER_INIT] No signal or localStorage. Defaulting to enabled: ${clmInitialEnabledState} and persisting.`);
  }

  config.enabled = clmInitialEnabledState;
  originalConsole.log(`[CONSOLE_MANAGER_INIT] Final initial config.enabled: ${config.enabled}`);

  // Apply initial console method patching based on the determined config.enabled state
  if (config.enabled) {
    // Call enableConsoleLogging WITHOUT persist, as the state is already from localStorage (or default)
    // This will patch the console methods.
    enableConsoleLogging(false); 
    originalConsole.log('[CONSOLE_MANAGER_INIT] Console logging is initially ENABLED. Proxied methods applied.');
  } else {
    // Ensure original console methods are active if logging is initially disabled.
    // disableConsoleLogging(false) would also work but is more verbose.
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    originalConsole.log('[CONSOLE_MANAGER_INIT] Console logging is initially DISABLED. Original methods ensured.');
  }
  
  // Make API available globally
  if (typeof window !== 'undefined') {
    // Console control
    window.enableConsoleLogging = enableConsoleLogging;
    window.disableConsoleLogging = disableConsoleLogging;
    window.isConsoleLoggingEnabled = isConsoleLoggingEnabled;
    
    // Expose the internal config object for the panel to read current filter states
    window.config = config; 
    
    // Timestamp control
    window.enableTimestamps = enableTimestamps;
    window.disableTimestamps = disableTimestamps;
    window.areTimestampsEnabled = areTimestampsEnabled;
    
    // Type/Subtype filtering
    window.setIncludeTypes = setIncludeTypes;
    window.setExcludeTypes = setExcludeTypes;
    window.setIncludeSubtypes = setIncludeSubtypes;
    window.setExcludeSubtypes = setExcludeSubtypes;
    window.setIncludeLevels = setIncludeLevels;
    window.setExcludeLevels = setExcludeLevels;
    window.getDiscoveredTypes = getDiscoveredTypes;
    window.getDiscoveredSubtypes = getDiscoveredSubtypes;
    
    // Keyword filtering
    window.setIncludeKeywords = setIncludeKeywords;
    window.setExcludeKeywords = setExcludeKeywords;
    window.clearAllFilters = clearAllFilters;
    
    // Buffer management
    window.getLogBuffer = getLogBuffer;
    window.clearLogBuffer = clearLogBuffer;
    window.getLogBufferSize = getLogBufferSize;
    window.registerOnBufferUpdate = registerOnBufferUpdate;
    window.unregisterOnBufferUpdate = unregisterOnBufferUpdate;
    
    // Performance timing (re-export from ConsoleTiming and add new functions)
    window.createTimer = createTimer;
    window.createSilentTimer = createSilentTimer;
    window.timeFunction = timeFunction;
    window.resetTimers = resetTimers;
    window.getTimingHistory = getTimingHistory;
    window.clearTimingHistory = clearTimingHistory;
    window.getTimingReport = getTimingReport;
    window.getCurrentPerformanceTime = getCurrentPerformanceTime;
    window.enablePerformanceLogging = enablePerformanceLogging;
    window.disablePerformanceLogging = disablePerformanceLogging;
    window.enableDetailedTiming = enableDetailedTiming;
    window.disableDetailedTiming = disableDetailedTiming;
    window.isPerformanceLoggingEnabled = isPerformanceLoggingEnabled;
    window.isDetailedTimingEnabled = isDetailedTimingEnabled;
    
    // Expose console.timing method
    console.timing = proxiedConsole.timing;
  }
}

// Initialize on module load
initialize();

// Export all public API functions
export {
  // Console control
  enableConsoleLogging,
  disableConsoleLogging,
  isConsoleLoggingEnabled,
  
  // Timestamp control
  enableTimestamps,
  disableTimestamps,
  areTimestampsEnabled,
  
  // Type/Subtype filtering
  setIncludeTypes,
  setExcludeTypes,
  setIncludeSubtypes,
  setExcludeSubtypes,
  setIncludeLevels,
  setExcludeLevels,
  getDiscoveredTypes,
  getDiscoveredSubtypes,
  
  // Keyword filtering
  setIncludeKeywords,
  setExcludeKeywords,
  clearAllFilters,
  
  // Buffer management
  getLogBuffer,
  clearLogBuffer,
  getLogBufferSize,
  registerOnBufferUpdate,
  unregisterOnBufferUpdate,
  
  // Re-export from ConsoleTiming
  timingConfig,
  timingHistory,
  createTimer,
  createSilentTimer,
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
  isPerformanceLoggingEnabled,
  isDetailedTimingEnabled
};
