/**
 * @file LogConsoleOutput.js
 * @description Console output formatting and rendering for log entries
 */

/**
 * Console output handler for log entries
 */
export class LogConsoleOutput {
  constructor() {
    this.enabled = true;
  }

  /**
   * Check if console logging is enabled
   * @returns {boolean} True if console logging is enabled
   */
  isEnabled() {
    if (typeof window === 'undefined') {
      return false;
    }

    if (typeof window.APP?.services?.isConsoleLoggingEnabled === 'function') {
      return window.APP.services.isConsoleLoggingEnabled();
    }

    return this.enabled;
  }

  /**
   * Set console logging enabled state
   * @param {boolean} enabled - Whether to enable console logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Format a log entry for console output
   * Format: [SOURCE][TYPE][MODULE][ACTION] message [LEVEL]
   *
   * @param {Object} entry - Log entry object
   * @param {string} entry.source - Log source (CLIENT, SERVER, etc.)
   * @param {string} entry.type - Log type (REDUX, API, etc.)
   * @param {string} entry.module - Log module (optional)
   * @param {string} entry.action - Log action (optional)
   * @param {string} entry.message - Log message
   * @param {string} entry.level - Log level (DEBUG, INFO, WARN, ERROR)
   * @returns {string} Formatted message
   */
  formatMessage(entry) {
    const { source, type, module, action, message, level } = entry;
    let prefix = '';

    // Add system location (CLIENT/SERVER) if specified
    if (source && ['CLIENT', 'SERVER'].includes(source)) {
      prefix += `[${source}]`;
    }

    // Always add type
    if (type) {
      prefix += `[${type}]`;
    }

    // Add module if specified
    if (module) {
      prefix += `[${module}]`;
    }

    // Add action if specified
    if (action) {
      prefix += `[${action}]`;
    }

    return `${prefix} ${message} [${level}]`;
  }

  /**
   * Output a log entry to the console
   * @param {Object} entry - Log entry object
   * @param {boolean} forceOutput - Force output even if console logging is disabled
   */
  output(entry, forceOutput = false) {
    if (!forceOutput && !this.isEnabled()) {
      return;
    }

    const formattedMessage = this.formatMessage(entry);
    const { level, details } = entry;

    switch (level) {
      case 'DEBUG':
        console.debug(formattedMessage, details);
        break;
      case 'INFO':
        console.info(formattedMessage, details);
        break;
      case 'WARN':
        console.warn(formattedMessage, details);
        break;
      case 'ERROR':
        console.error(formattedMessage, details);
        break;
      default:
        console.log(formattedMessage, details);
    }
  }
}

// Create and export singleton instance
export const logConsoleOutput = new LogConsoleOutput();
