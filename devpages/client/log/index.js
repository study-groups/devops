/**
 * log/index.js – Unified logging system
 * Exports all logging utilities for the application
 */

import { LogManager } from './LogManager.js';
import { LogEntry } from './LogEntry.js';
import { LogFilter } from './LogFilter.js';
import { LogBuffer } from './LogBuffer.js';
import { CallerInfo } from './CallerInfo.js';

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

// Create and initialize the global log manager instance
const logManager = new LogManager();
logManager.initialize().exposeToWindow();

// Legacy compatibility function (matches the old logMessage signature)
function legacyPositional(message, level = 'debug', type = 'GENERAL', subtype = null) {
  const normalizedLevel = level.toUpperCase();
  
  // Use the appropriate console method based on level
  switch (normalizedLevel) {
    case 'DEBUG':
      console.debug({ message, type, subtype, level: normalizedLevel });
      break;
    case 'INFO':
      console.info({ message, type, subtype, level: normalizedLevel });
      break;
    case 'WARN':
    case 'WARNING':
      console.warn({ message, type, subtype, level: 'WARN' });
      break;
    case 'ERROR':
      console.error({ message, type, subtype, level: normalizedLevel });
      break;
    default:
      console.log({ message, type, subtype, level: 'INFO' });
  }
}

// Helper function to create a pre-configured logger
function createLogger(type, options = {}) {
  const subtype = options.subtype || null;
  
  return {
    debug: (message, ...details) => {
      console.debug({ message, type, subtype, level: 'DEBUG', details: details.length ? details : undefined });
    },
    info: (message, ...details) => {
      console.info({ message, type, subtype, level: 'INFO', details: details.length ? details : undefined });
    },
    warn: (message, ...details) => {
      console.warn({ message, type, subtype, level: 'WARN', details: details.length ? details : undefined });
    },
    error: (message, ...details) => {
      console.error({ message, type, subtype, level: 'ERROR', details: details.length ? details : undefined });
    },
    timing: (message, ...details) => {
      console.timing({ message, type, subtype, level: 'TIMING', details: details.length ? details : undefined });
    }
  };
}

// Create standard log functions with different levels
function log(message, type = 'GENERAL', subtype = null, details = null) {
  console.log({ message, type, subtype, level: 'INFO', details });
}

function logDebug(message, type = 'GENERAL', subtype = null, details = null) {
  console.debug({ message, type, subtype, level: 'DEBUG', details });
}

function logInfo(message, type = 'GENERAL', subtype = null, details = null) {
  console.info({ message, type, subtype, level: 'INFO', details });
}

function logWarn(message, type = 'GENERAL', subtype = null, details = null) {
  console.warn({ message, type, subtype, level: 'WARN', details });
}

function logError(message, type = 'GENERAL', subtype = null, details = null) {
  console.error({ message, type, subtype, level: 'ERROR', details });
}

// Legacy function to set log panel instance (for backward compatibility)
function setLogPanelInstance(instance) {
  if (typeof window !== 'undefined') {
    window.logPanelInstance = instance;
  }
}

// Export all functions and classes
export {
  // Main manager instance
  logManager,
  
  // Legacy functions for backward compatibility
  legacyPositional as logMessage,
  setLogPanelInstance,
  
  // Modern logging functions
  log,
  logDebug,
  logInfo,
  logWarn,
  logError,
  createLogger,
  
  // Classes for custom usage
  LogManager,
  LogEntry,
  LogFilter,
  LogBuffer,
  CallerInfo,
  
  // Timing exports re-exported from ConsoleTiming
  timingConfig,
  timingHistory,
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
  isDetailedTimingEnabled,
  isPerformanceLoggingEnabled
}; 