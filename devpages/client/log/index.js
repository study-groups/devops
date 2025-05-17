// client/log/index.js
// log/index.js – public re-exports for all modules

import {
    log,
    logDebug,
    logInfo,
    logWarn,
    logError,
    legacyPositional as logMessage, // Import the legacy shim and RENAME it to logMessage for export
    setLogPanelInstance
} from './core.js';
import { LogPanel } from './LogPanel.js';
import { timeFunction, createTimer } from '/client/utils.js'; // Import from utils.js instead

// Console override functionality
// Store the original console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
};

// Check URL for logging flag
const urlParams = new URLSearchParams(window.location.search);
const CONSOLE_LOGGING_ENABLED = urlParams.has('console_log') || localStorage.getItem('consoleLoggingEnabled') === 'true';

// Track the current state
let isLoggingEnabled = CONSOLE_LOGGING_ENABLED;

// Add functions to toggle console logging
function enableConsoleLogging(persist = false) {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    
    if (persist) {
        localStorage.setItem('consoleLoggingEnabled', 'true');
    }
    
    isLoggingEnabled = true;
    
    // Use the original console.log to confirm it's working
    originalConsole.log('Console logging enabled');
    return true;
}

function disableConsoleLogging(persist = false) {
    // Save references to core functions we still want to work
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = function() {};
    console.info = function() {};
    console.debug = function() {};
    
    // Optionally keep warnings and errors
    // console.warn = function() {};
    // console.error = function() {};
    
    if (persist) {
        localStorage.setItem('consoleLoggingEnabled', 'false');
    }
    
    isLoggingEnabled = false;
    
    // Use the original to confirm the change (this will be the last message)
    originalConsole.log('Console logging disabled');
    return false;
}

// Initialize on load
if (CONSOLE_LOGGING_ENABLED) {
    originalConsole.log('Console logging is enabled');
    enableConsoleLogging();
} else {
    originalConsole.log('Console logging disabled - this is the last message you will see');
    disableConsoleLogging();
}

// Check URL for performance logging flag
const PERFORMANCE_LOGGING_ENABLED = urlParams.has('perf_log') || localStorage.getItem('performanceLoggingEnabled') === 'true';
const DETAILED_PERFORMANCE_LOG = urlParams.has('detailed_perf') || localStorage.getItem('detailedPerformanceLog') === 'true';

// Track the current performance logging state
let isPerformanceLoggingEnabled = PERFORMANCE_LOGGING_ENABLED;
let isDetailedPerformanceLogEnabled = DETAILED_PERFORMANCE_LOG;

// Functions to control performance logging
function enablePerformanceLogging(detailed = false, persist = false) {
    isPerformanceLoggingEnabled = true;
    
    if (detailed) {
        isDetailedPerformanceLogEnabled = true;
        if (persist) {
            localStorage.setItem('detailedPerformanceLog', 'true');
        }
    }
    
    if (persist) {
        localStorage.setItem('performanceLoggingEnabled', 'true');
    }
    
    // Use the original console.log to confirm it's working
    originalConsole.log('Performance logging enabled' + (detailed ? ' (detailed mode)' : ''));
    return true;
}

function disablePerformanceLogging(persist = false) {
    isPerformanceLoggingEnabled = false;
    isDetailedPerformanceLogEnabled = false;
    
    if (persist) {
        localStorage.setItem('performanceLoggingEnabled', 'false');
        localStorage.setItem('detailedPerformanceLog', 'false');
    }
    
    // Use the original to confirm the change
    originalConsole.log('Performance logging disabled');
    return false;
}

// Initialize performance logging on load
if (PERFORMANCE_LOGGING_ENABLED) {
    originalConsole.log('Performance logging is enabled' + (DETAILED_PERFORMANCE_LOG ? ' (detailed mode)' : ''));
    enablePerformanceLogging(DETAILED_PERFORMANCE_LOG);
} else {
    disablePerformanceLogging();
}

// IMPORTANT: Explicitly attach these functions to the window object so they can be called from anywhere
window.enableConsoleLogging = enableConsoleLogging;
window.disableConsoleLogging = disableConsoleLogging;
window.isConsoleLoggingEnabled = () => isLoggingEnabled;
window.enablePerformanceLogging = enablePerformanceLogging;
window.disablePerformanceLogging = disablePerformanceLogging;
window.isPerformanceLoggingEnabled = () => isPerformanceLoggingEnabled;
window.isDetailedPerformanceLogEnabled = () => isDetailedPerformanceLogEnabled;
window.timeFunction = timeFunction;

// Re-export everything
export {
    log,
    logDebug,
    logInfo,
    logWarn,
    logError,
    logMessage,
    LogPanel,
    setLogPanelInstance,
    // Console control functions
    enableConsoleLogging,
    disableConsoleLogging,
    isLoggingEnabled,
    // Performance monitoring functions
    enablePerformanceLogging,
    disablePerformanceLogging,
    isPerformanceLoggingEnabled,
    isDetailedPerformanceLogEnabled,
    // Timing utilities
    timeFunction,
    createTimer
};

// Test logging
console.log('Console logging test - should be visible'); 