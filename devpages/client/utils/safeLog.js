/**
 * Safe logging utility that prevents "APP.log is not a function" errors
 * 
 * This utility provides a reliable way to log throughout the application lifecycle,
 * whether the logging system is fully initialized or not.
 */

/**
 * Safe logging function with fallback support
 * @param {Object} logData - Log data object
 * @param {string} logData.message - The log message
 * @param {string} [logData.source='CLIENT'] - Log source
 * @param {string} [logData.level='INFO'] - Log level
 * @param {string} [logData.type='GENERAL'] - Log type/category  
 * @param {string} [logData.module] - Module name
 * @param {string} [logData.action] - Action being performed
 * @param {Object} [logData.details] - Additional details
 */
export function safeLog(logData) {
  try {
    // Try to use the full logging system if available
    if (window.APP && typeof window.APP.log === 'function') {
      window.APP.log(logData);
      return;
    }
    
    // Fallback to structured console logging
    const { 
      level = 'INFO', 
      source = 'CLIENT',
      type = 'GENERAL', 
      module = 'UNKNOWN', 
      action = 'LOG', 
      message = '' 
    } = logData;
    
    console.log(`[${level}][${source}][${type}][${module}][${action}] ${message}`);
    
  } catch (error) {
    // Ultimate fallback - basic console logging
    console.log(`[SAFE_LOG] ${logData.message || 'Log error'}`);
  }
}

/**
 * Create a module-specific safe logger
 * @param {string} module - Module name
 * @param {string} [source='CLIENT'] - Log source
 * @returns {Object} Logger with level methods
 */
export function createSafeLogger(module, source = 'CLIENT') {
  return {
    info: (action, message, details) => safeLog({
      message, source, level: 'INFO', type: module.toUpperCase(), 
      module, action, details
    }),
    
    warn: (action, message, details) => safeLog({
      message, source, level: 'WARN', type: module.toUpperCase(),
      module, action, details
    }),
    
    error: (action, message, details) => safeLog({
      message, source, level: 'ERROR', type: module.toUpperCase(),
      module, action, details
    }),
    
    debug: (action, message, details) => safeLog({
      message, source, level: 'DEBUG', type: module.toUpperCase(),
      module, action, details
    }),
    
    // Generic log method
    log: (logData) => safeLog({
      source,
      type: module.toUpperCase(),
      module,
      ...logData
    })
  };
}

export default safeLog;