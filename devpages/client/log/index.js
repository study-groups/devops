// log/index.js - Exports the globally defined logging function and LogPanel component

// Define the logMessage function to safely access the global one
// This ensures modules can import it reliably.
import { globalLogMessageHandler, setLogPanelInstance } from './core.js';
import { LogPanel } from './LogPanel.js';

/**
 * The primary logging function to be imported and used by other modules.
 * @param {string} messageContent - The core message string.
 * @param {string} [level='info'] - The log level (e.g., 'debug', 'info', 'warn', 'error').
 * @param {string} [componentType='GENERAL'] - The component or system generating the log. This becomes the filter tag.
 */
export function logMessage(messageContent, level = 'info', componentType = 'GENERAL') {
    // Directly call the core handler.
    globalLogMessageHandler(messageContent, level, componentType);
}

// Re-export LogPanel and the instance setter for bootstrapping.
export { LogPanel, setLogPanelInstance }; 