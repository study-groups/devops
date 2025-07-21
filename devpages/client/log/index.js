/**
 * log/index.js – Unified logging system
 * Exports all logging utilities for the application
 * Updated to use LogCore.js and AppLog* variants without subtype functionality
 * 
 * HARMONIZED: Now includes UnifiedLogging.js that implements standards from:
 * - 005.5.md: DevPages API, SDK & Logging Standards
 * - 006.md: Namespace breakdown and refactoring  
 * - 007.md: PJA Games unified logging approach
 * 
 * NOTE: Managers are NOT auto-initialized here - they are initialized in bootstrap.js
 * with proper filter configuration
 */

// === NEW UNIFIED LOGGING SYSTEM (HARMONIZED) ===
import { 
  Logger as UnifiedLogger,
  createLogger as createUnifiedLogger,
  setupControls,
  typeHandlers,
  pjaGameApi
} from './UnifiedLogging.js';

// === API LOGGING SYSTEM (NEW) ===
import {
  ApiLogEntry,
  ApiLogBuffer, 
  GameApiManager,
  GAME_API_ACTIONS,
  API_TARGETS
} from './ApiLog.js';

// Console Logging System (Console* prefixed)
import { ConsoleLogManager } from './ConsoleLogManager.js';
import { ConsoleLogEntry } from './ConsoleLogEntry.js';
import { ConsoleLogFilter } from './ConsoleLogFilter.js';
import { ConsoleLogBuffer } from './ConsoleLogBuffer.js';
import { ConsoleCallerInfo } from './ConsoleCallerInfo.js';

// Application Logging System (AppLog* prefixed for UI/application specific)
import { AppLogEntry } from './AppLogEntry.js';
import { AppLogFilter } from './AppLogFilter.js';
import { AppLogBuffer } from './AppLogBuffer.js';
// Note: Keep the old names for backward compatibility with UI components
import { LogManager } from './LogManager.js';
import { LogEntry } from './LogEntry.js';
import { LogFilter } from './LogFilter.js';
import { LogBuffer } from './LogBuffer.js';
import { CallerInfo } from './CallerInfo.js';

// Central logging functions (from LogCore.js, renamed from core.js)
import { 
  log, 
  logDebug, 
  logInfo, 
  logWarn, 
  logError,
  createLogger,
  setLogPanelInstance,
  LEVELS,
  canonicalLevel,
  canonicalType
} from './LogCore.js';

/**
 * @deprecated Use `log({ message, level, type })` instead.
 */
function logMessage(message, level = 'info', type = 'GENERAL') {
  log({ message, level, type });
}


// Console Performance Timing
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

// REMOVED: Auto-initialization of managers - this is now handled in bootstrap.js
// with proper filter configuration from FilterManager
//
// const consoleLogManager = new ConsoleLogManager();
// consoleLogManager.initialize().exposeToWindow();
//
// const logManager = new LogManager();
// logManager.initialize().exposeToWindow();

// Export console logging classes (Console* prefixed)
export {
  ConsoleLogManager,
  ConsoleLogEntry,
  ConsoleLogFilter,
  ConsoleLogBuffer,
  ConsoleCallerInfo
};

// Export application logging classes (AppLog* prefixed and legacy)
export {
  AppLogEntry,
  AppLogFilter,
  AppLogBuffer,
  // Maintain backward compatibility exports (classes only, not instances)
  LogManager,
  LogEntry,
  LogFilter,
  LogBuffer,
  CallerInfo
};

// === UNIFIED LOGGING EXPORTS (RECOMMENDED FOR NEW CODE) ===
export {
  UnifiedLogger as Logger,
  createUnifiedLogger as createLogger,  // Primary export for new code
  setupControls,
  typeHandlers,
  pjaGameApi
};

// === API LOGGING EXPORTS (NEW) ===
export {
  ApiLogEntry,
  ApiLogBuffer,
  GameApiManager,
  GAME_API_ACTIONS,
  API_TARGETS
};

// === LEGACY EXPORTS (MAINTAINED FOR COMPATIBILITY) ===
export {
  log,
  logDebug,
  logInfo,
  logWarn,
  logError,
  createLogger as createLogCoreLogger,  // Renamed to avoid conflict
  setLogPanelInstance,
  LEVELS,
  canonicalLevel,
  canonicalType
};

// Export the deprecated logMessage function for backward compatibility
export {
  logMessage
};

// Export console timing functions
export {
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
}; 