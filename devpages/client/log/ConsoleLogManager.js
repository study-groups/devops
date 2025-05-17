/**
 * ConsoleLogManager.js - Manages browser console logging with performance timing and simplified keyword filtering.
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
  initializeTiming
} from './ConsoleTiming.js';


// Store original console methods before any patching
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error
};

// Simplified Configuration
const config = {
  enabled: localStorage.getItem('consoleLoggingEnabled') === 'true',
  includeKeywords: localStorage.getItem('consoleLogIncludeKeywords') || '',
  excludeKeywords: localStorage.getItem('consoleLogExcludeKeywords') || '',
};

// --- Helper Functions ---

// Converts log arguments array into a single string
function argsToMessageString(args) {
     return args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.message;
        try { return JSON.stringify(arg); }
        catch (e) { return String(arg); }
     }).join(' ');
}

// Helper to normalize text (lowercase, remove punctuation) for histogram
function normalizeText(text) {
    return text.toLowerCase().replace(/[.,!?;:"'()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
}


// --- Simplified Core Logging & Filtering Logic ---
function shouldLog(level, args) {
    const messageString = argsToMessageString(args);
    const lowerMessage = messageString.toLowerCase();

    // Extract all bracketed content: e.g., "[debug] [auth] message" -> ["debug", "auth"]
    const bracketedContent = [];
    const regex = /\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(messageString)) !== null) {
        bracketedContent.push(match[1].toLowerCase());
    }

    // 1. Exclude (takes precedence)
    if (config.excludeKeywords) {
        const excludeTerms = config.excludeKeywords.toLowerCase().split(/\s+/).filter(term => term);
        if (excludeTerms.length > 0) {
            for (const term of excludeTerms) {
                if (lowerMessage.includes(term) || bracketedContent.some(b => b.includes(term))) {
                    return false; // Exclude if any exclude term is found
                }
            }
        }
    }

    // 2. Include (all terms must be present if specified)
    if (config.includeKeywords) {
        const includeTerms = config.includeKeywords.toLowerCase().split(/\s+/).filter(term => term);
        if (includeTerms.length > 0) {
            const allIncludesFound = includeTerms.every(term =>
                lowerMessage.includes(term) || bracketedContent.some(b => b.includes(term))
            );
            if (!allIncludesFound) {
                return false; // Don't include if not all include terms are found
            }
        }
    }
    return true; // Default to log if no restrictive rules apply or filters are empty
}


const proxiedConsole = {
  log: function(...args) {
    if (!config.enabled) return;
    if (shouldLog('log', args)) {
      originalConsole.log(...addPerformanceInfoToLog(args, argsToMessageString));
    }
  },
  info: function(...args) {
    if (!config.enabled) return;
    if (shouldLog('info', args)) {
      originalConsole.info(...addPerformanceInfoToLog(args, argsToMessageString));
    }
  },
  debug: function(...args) {
    if (!config.enabled) return;
    if (shouldLog('debug', args)) {
      originalConsole.debug(...addPerformanceInfoToLog(args, argsToMessageString));
    }
  },
  warn: function(...args) {
    if (shouldLog('warn', args)) {
      originalConsole.warn(...addPerformanceInfoToLog(args, argsToMessageString));
    } else if (!config.enabled) { // Show unfiltered warnings if main logging is off
        originalConsole.warn(...args);
    }
  },
  error: function(...args) {
    if (shouldLog('error', args)) {
      originalConsole.error(...addPerformanceInfoToLog(args, argsToMessageString));
    } else if (!config.enabled) { // Show unfiltered errors if main logging is off
        originalConsole.error(...args);
    }
  }
};


// --- Console Control Functions ---
function enableConsoleLogging(persist = false) {
  config.enabled = true;
  console.log = proxiedConsole.log;
  console.info = proxiedConsole.info;
  console.debug = proxiedConsole.debug;
  console.warn = proxiedConsole.warn;
  console.error = proxiedConsole.error;
  if (persist) localStorage.setItem('consoleLoggingEnabled', 'true');
  originalConsole.log('[CONSOLE] Logging enabled (simplified).');
  return true;
}

function disableConsoleLogging(persist = false) {
  config.enabled = false;
  // Restore original console methods directly for maximum simplicity when disabled
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  if (persist) localStorage.setItem('consoleLoggingEnabled', 'false');
  originalConsole.log('[CONSOLE] Logging disabled (simplified). Original console methods restored.');
  return false;
}

// --- Simplified Filter Control ---
function setIncludeKeywords(keywords, persist = false) {
    config.includeKeywords = keywords || '';
    if (persist) {
        if (keywords) localStorage.setItem('consoleLogIncludeKeywords', keywords);
        else localStorage.removeItem('consoleLogIncludeKeywords');
    }
    originalConsole.log(`[CONSOLE] Include Keywords set: "${config.includeKeywords}"`);
}

function setExcludeKeywords(keywords, persist = false) {
    config.excludeKeywords = keywords || '';
    if (persist) {
        if (keywords) localStorage.setItem('consoleLogExcludeKeywords', keywords);
        else localStorage.removeItem('consoleLogExcludeKeywords');
    }
    originalConsole.log(`[CONSOLE] Exclude Keywords set: "${config.excludeKeywords}"`);
}

function clearLogFilter(persist = true) {
    setIncludeKeywords('', persist);
    setExcludeKeywords('', persist);
    originalConsole.log('[CONSOLE] All keyword filters cleared.');
}


// --- Console Interaction (REMOVED) ---
function initConsoleInteraction() {
    originalConsole.log('[CONSOLE] Interactive console features (clickable messages) have been REMOVED.');
    // All previous code for enhanceMessages, context menus, CSS injection is removed.
}

// --- Keyword Histogram (Gutted stopWords) ---
function generateLogKeywordHistogram() {
    if (!timingHistory || typeof timingHistory.get !== 'function') {
        originalConsole.error('[CONSOLE] Timing history is not available for histogram.');
        return {};
    }
    const consoleEntries = timingHistory.get({ type: 'console' });
    if (!consoleEntries || consoleEntries.length === 0) {
        originalConsole.log('[CONSOLE] No console log entries in history for histogram generation.');
        return {};
    }
    const keywordCounts = {};
    consoleEntries.forEach(entry => {
        const message = typeof entry.label === 'string' ? entry.label : '';
        const normalizedMessage = normalizeText(message); // Lowercase, remove punctuation
        const words = normalizedMessage.split(/\s+/).filter(word => word.length > 2); // Min word length 3

        words.forEach(word => {
            keywordCounts[word] = (keywordCounts[word] || 0) + 1;
        });
    });
    return keywordCounts;
}

// =================================================================================
// FINAL INITIALIZATION CALLS
// =================================================================================
initializeTiming();

if (config.enabled) {
  enableConsoleLogging(false);
} else {
  disableConsoleLogging(false);
}
initConsoleInteraction(); // Will just log that features are removed

// =================================================================================
// GLOBAL EXPOSURES
// =================================================================================
window.enableConsoleLogging = enableConsoleLogging;
window.disableConsoleLogging = disableConsoleLogging;
window.isConsoleLoggingEnabled = () => config.enabled;

// Simplified Filter Globals
window.setIncludeKeywords = setIncludeKeywords;
window.setExcludeKeywords = setExcludeKeywords;
window.getIncludeKeywords = () => config.includeKeywords;
window.getExcludeKeywords = () => config.excludeKeywords;
window.clearLogFilter = clearLogFilter; // This now clears the simple keyword filters

// Histogram Global
window.generateLogKeywordHistogram = generateLogKeywordHistogram;

// Timing globals are exposed by ConsoleTiming.js's initializeTiming

// =================================================================================
// MODULE EXPORTS
// =================================================================================
export {
  enableConsoleLogging,
  disableConsoleLogging,
  setIncludeKeywords,
  setExcludeKeywords,
  clearLogFilter,
  generateLogKeywordHistogram,
  config as consoleConfig, // Export the ConsoleLogManager config object
  resetTimers,
  createTimer,
  timeFunction,
  getTimingHistory,
  clearTimingHistory,
  getTimingReport,
  getCurrentPerformanceTime,
  enablePerformanceLogging,
  disablePerformanceLogging,
  enableDetailedTiming,
  disableDetailedTiming
};
