/**
 * logContext.js - Context-specific logging utility
 * Provides a simple logging function for components that need context-aware logging
 */

/**
 * Log a message with context information
 * @param {string} message - The message to log
 * @param {string} level - Log level ('info', 'error', 'warn', 'debug')
 * @param {string} subtype - Optional subtype for categorization
 */
export function logContext(message, level = 'info', subtype = 'CONTEXT') {
  const type = 'PATH_MANAGER';
  
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type, subtype);
  } else {
    // Fallback to console if window.logMessage is not available
    console.log(`[${type}:${subtype}] ${message}`);
  }
} 