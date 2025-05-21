const LOG_LEVEL = process.env.PD_LOG_LEVEL || 'INFO';

// Simple mapping of log levels to numeric values
const LEVELS = {
  'ERROR': 0,
  'WARN': 1,
  'INFO': 2,
  'DEBUG': 3,
  'TRACE': 4
};

// Get numeric value of current log level
const currentLevel = LEVELS[LOG_LEVEL] || LEVELS.INFO;

// Simple logger that only logs if level is at or below current level
const logger = {
  error: (...args) => currentLevel >= LEVELS.ERROR && console.error(...args),
  warn: (...args) => currentLevel >= LEVELS.WARN && console.warn(...args),
  info: (...args) => currentLevel >= LEVELS.INFO && console.log(...args),
  debug: (...args) => currentLevel >= LEVELS.DEBUG && console.log(...args),
  trace: (...args) => currentLevel >= LEVELS.TRACE && console.log(...args)
};

export default logger; 