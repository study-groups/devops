/**
 * logContext.js - Context-specific logging utility
 * Provides a simple logging function for components that need context-aware logging
 */

const log = window.APP.services.log.createLogger('logContext');

/**
 * Log a message with context information
 * @param {string} message - The message to log
 * @param {string} level - Log level ('info', 'error', 'warn', 'debug')
 * @param {string} subtype - Optional subtype for categorization
 */
export function logContext(message, level = 'info', subtype = 'CONTEXT') {
    const type = 'PATH_MANAGER';
    
    switch (level) {
        case 'error':
            log.error(type, subtype, message);
            break;
        case 'warn':
            log.warn(type, subtype, message);
            break;
        case 'debug':
            log.debug(type, subtype, message);
            break;
        case 'info':
        default:
            log.info(type, subtype, message);
            break;
    }
} 