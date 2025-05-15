let logPanelInstance = null;

/**
 * Stores the LogPanel instance for the global logger to use.
 * @param {object} instance - The LogPanel instance.
 */
export function setLogPanelInstance(instance) {
    if (instance && typeof instance.addEntry === 'function') {
        logPanelInstance = instance;
    } else {
        console.error('[LogCore] Invalid instance provided to setLogPanelInstance. Must have addEntry method.');
        logPanelInstance = null; // Ensure it's reset if invalid
    }
}

/**
 * Global logging function. All modules should aim to use this via the exported `logMessage`.
 * It ensures that the componentType is correctly passed to LogPanel for tagging.
 * @param {string} messageContent - The core message string.
 * @param {string} [level='info'] - The log level (e.g., 'debug', 'info', 'warn', 'error').
 * @param {string} [componentType='GENERAL'] - The component or system generating the log. This becomes the filter tag.
 */
export function globalLogMessageHandler(messageContent, level = 'info', componentType = 'GENERAL') {
    const effectiveLevel = level || 'info';
    const effectiveComponentType = componentType || 'GENERAL';

    // Construct the message that will be displayed in the log panel entry.
    // Example: "[INFO] [MY_COMPONENT] This is the message."
    const displayString = `[${effectiveLevel.toUpperCase()}] [${effectiveComponentType.toUpperCase()}] ${messageContent}`;

    if (logPanelInstance) {
        // Call LogPanel.addEntry, passing the componentType as the second argument for tagging.
        logPanelInstance.addEntry(displayString, effectiveComponentType);
    } else {
        // Fallback to console if LogPanel isn't ready or properly set.
        console.warn(`[LOG FALLBACK]${displayString}`); // displayString already contains level and component
    }
}

// Assign to window.logMessage. Modules should prefer importing `logMessage` from `client/log/index.js`
// but this ensures a global fallback and a single point of definition for the global logger.
if (typeof window !== 'undefined') {
    window.logMessage = globalLogMessageHandler;
} else {
    console.warn('[LogCore] window object not found; window.logMessage not set. (Expected in browser env)');
}
