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

// Import the TRUE logging control functions that ConsoleLogPanel will use via window globals.
// These are set up by ConsoleLogManager.js, which imports them from ConsoleTiming.js.
// We list them here primarily if this module (log/index.js) needs to EXPORT them directly.
import {
    enableConsoleLogging as trueEnableConsoleLogging,
    disableConsoleLogging as trueDisableConsoleLogging,
    // isConsoleLoggingEnabled is usually window.isConsoleLoggingEnabled from ConsoleLogManager
    enablePerformanceLogging as trueEnablePerformanceLogging,
    disablePerformanceLogging as trueDisablePerformanceLogging,
    isPerformanceLoggingEnabled as trueIsPerformanceLoggingEnabled,
    isDetailedTimingEnabled as trueIsDetailedTimingEnabled, // Note: ConsoleTiming calls it isDetailedTimingEnabled
    createTimer, // This one was from /client/utils.js, but ConsoleTiming also provides one.
                 // Assuming ConsoleTiming.js is the primary source for all logging/timing utilities now.
    timeFunction // Also from ConsoleTiming.js
} from './ConsoleLogManager.js'; // Or directly from './ConsoleTiming.js' if preferred, but CLM is the global setter.

// Store the original console methods (still useful for this module if it needs to bypass)
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
};

// Check URL for console_log flag (this specific init can stay if needed for this module's own very early decisions)
const urlParams = new URLSearchParams(window.location.search);
const CONSOLE_LOGGING_ENABLED_BY_PARAM_OR_STORAGE = urlParams.has('console_log') || localStorage.getItem('consoleLoggingEnabled') === 'true';

// Local state for this module if it needs to make decisions before full ConsoleLogManager might be ready
// However, for functions exposed to window, ConsoleLogManager should be the source of truth.
let localIsLoggingEnabled = CONSOLE_LOGGING_ENABLED_BY_PARAM_OR_STORAGE;

// Local console enabling/disabling for THIS MODULE, if it needs to operate independently early on.
// These DO NOT get attached to window anymore, to avoid conflict.
function localEnableConsoleLogging() {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    localIsLoggingEnabled = true;
    originalConsole.log('[log/index.js] Local console methods restored.');
}

function localDisableConsoleLogging() {
    const noop = function() {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    // Keep warn/error by default from originalConsole
    localIsLoggingEnabled = false;
    originalConsole.log('[log/index.js] Local console methods (log,info,debug) nooped. (Last message from originalConsole.log)');
}

if (CONSOLE_LOGGING_ENABLED_BY_PARAM_OR_STORAGE) {
    localEnableConsoleLogging();
} else {
    localDisableConsoleLogging();
}

// Performance logging related setup REMOVED from here.
// ConsoleLogManager.js and ConsoleTiming.js are the source of truth.
// const PERFORMANCE_LOGGING_ENABLED = ...
// const DETAILED_PERFORMANCE_LOG = ...
// let isPerformanceLoggingEnabled = ...
// let isDetailedPerformanceLogEnabled = ...
// function enablePerformanceLogging(...) { ... }
// function disablePerformanceLogging(...) { ... }
// if (PERFORMANCE_LOGGING_ENABLED) { ... } else { ... }

// REMOVED: Explicit window attachments from this file.
// ConsoleLogManager.js is responsible for setting up window.enable/disable/is... functions.
// window.enableConsoleLogging = enableConsoleLogging; (Removed)
// window.disableConsoleLogging = disableConsoleLogging; (Removed)
// window.isConsoleLoggingEnabled = () => isLoggingEnabled; (Removed - CLM provides this)
// window.enablePerformanceLogging = enablePerformanceLogging; (Removed)
// window.disablePerformanceLogging = disablePerformanceLogging; (Removed)
// window.isPerformanceLoggingEnabled = () => isPerformanceLoggingEnabled; (Removed - CLM provides this)
// window.isDetailedPerformanceLogEnabled = () => isDetailedPerformanceLogEnabled; // (Removed - CLM provides window.isDetailedTimingEnabled)
// window.timeFunction = timeFunction; // (Removed - CLM provides this from ConsoleTiming)

// Re-export core functionalities and TRUE control functions if other modules import them from 'client/log'.
export {
    log,
    logDebug,
    logInfo,
    logWarn,
    logError,
    logMessage,
    LogPanel,
    setLogPanelInstance,
    // Exporting the true, globally managed versions for programmatic use by other modules:
    trueEnableConsoleLogging as enableConsoleLogging, // Renamed for export
    trueDisableConsoleLogging as disableConsoleLogging, // Renamed for export
    // Modules should use window.isConsoleLoggingEnabled for UI, but if they need a direct import:
    // trueIsConsoleLoggingEnabled, // This would need to be imported from CLM if CLM exports its () => config.enabled

    trueEnablePerformanceLogging as enablePerformanceLogging, // Renamed for export
    trueDisablePerformanceLogging as disablePerformanceLogging, // Renamed for export
    trueIsPerformanceLoggingEnabled as isPerformanceLoggingEnabled, // Renamed for export
    trueIsDetailedTimingEnabled as isDetailedTimingEnabled, // Renamed for export
    
    createTimer, // From ConsoleTiming via ConsoleLogManager
    timeFunction // From ConsoleTiming via ConsoleLogManager
};

// Test logging - this will use the locally configured console from this file's init.
console.log('[log/index.js] Console logging test - visibility depends on localEnable/Disable above.'); 