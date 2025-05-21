/**
 * Simple logging utility with configurable log levels
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 0,   // Only errors
  WARN: 1,    // Errors and warnings
  INFO: 2,    // Normal operational information
  DEBUG: 3,   // Detailed information for debugging
  TRACE: 4    // Most verbose, trace-level information
};

// Default to INFO level unless configured otherwise
let currentLogLevel = process.env.PD_LOG_LEVEL ? 
  (LOG_LEVELS[process.env.PD_LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO) : 
  LOG_LEVELS.INFO;

// Set log level
const setLogLevel = (level) => {
  if (typeof level === 'string' && LOG_LEVELS[level.toUpperCase()] !== undefined) {
    currentLogLevel = LOG_LEVELS[level.toUpperCase()];
  } else if (typeof level === 'number' && level >= 0 && level <= 4) {
    currentLogLevel = level;
  }
};

// Logging functions
const error = (prefix, message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    console.error(`${prefix}`, message, ...args);
  }
};

const warn = (prefix, message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(`${prefix}`, message, ...args);
  }
};

const info = (prefix, message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(`${prefix}`, message, ...args);
  }
};

const debug = (prefix, message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`${prefix}`, message, ...args);
  }
};

const trace = (prefix, message, ...args) => {
  if (currentLogLevel >= LOG_LEVELS.TRACE) {
    console.log(`${prefix}`, message, ...args);
  }
};

export default {
  LOG_LEVELS,
  setLogLevel,
  error,
  warn,
  info,
  debug,
  trace
};
