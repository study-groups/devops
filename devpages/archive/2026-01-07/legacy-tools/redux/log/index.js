/**
 * Redux Logging Utility
 * Simplified logging for Redux components without client dependencies
 */

/**
 * Simple log message function for Redux components
 * @param {string} message - Log message
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} type - Log type/category
 */
export function logMessage(message, level = 'info', type = 'REDUX') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${type}]`;
    
    switch (level) {
        case 'error':
            console.error(prefix, message);
            break;
        case 'warn':
            console.warn(prefix, message);
            break;
        case 'debug':
            console.debug(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }
}

/**
 * Create a logger for a specific component
 * @param {string} componentName - Name of the component
 * @returns {Function} Logger function
 */
export function createLogger(componentName) {
    return (message, level = 'info') => {
        logMessage(message, level, componentName);
    };
}

// Export default logMessage for backward compatibility
export default logMessage; 