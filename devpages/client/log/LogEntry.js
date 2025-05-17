/**
 * LogEntry.js - Core log entry structure
 * Represents a single log entry with metadata
 */

/**
 * LogEntry class for structured logging
 */
export class LogEntry {
  constructor(level, message, type = 'GENERAL', subtype = null, caller = null, details = null) {
    const timestamp = new Date();
    
    this.ts = timestamp.getTime();
    this.timestamp = timestamp.toISOString();
    this.displayTime = timestamp.toLocaleTimeString();
    this.level = level;
    this.type = type;
    this.subtype = subtype;
    this.message = message;
    this.details = details;
    this.caller = caller;
    this.sequence = LogEntry.nextSequence();
  }

  /**
   * Format the entry for console output with [TYPE][SUBTYPE] [message] [LEVEL]
   * @param {boolean} showTimestamps - Whether to include timestamps
   * @returns {Array} - Arguments array for console methods
   */
  formatForConsole(showTimestamps = false) {
    // Build the log prefix with type and optional subtype
    let prefix = `[${this.type}]`;
    
    // Add subtype if present
    if (this.subtype) {
      prefix += `[${this.subtype}]`;
    }
    
    // Get the actual message content, stripping any JSON structure if detected
    let displayMessage = this.message;
    
    // Parse JSON if the message appears to be a stringified object
    if (typeof displayMessage === 'string' && 
        displayMessage.trim().startsWith('{') && 
        displayMessage.trim().endsWith('}')) {
      try {
        const parsedMsg = JSON.parse(displayMessage);
        // If it contains a message property, use that instead
        if (parsedMsg && typeof parsedMsg.message === 'string') {
          displayMessage = parsedMsg.message;
        }
      } catch (e) {
        // If JSON parsing fails, keep the original message
      }
    }
    
    // Level goes at the end
    let levelSuffix = ` [${this.level}]`;
    
    // Add timing info when enabled
    let timingInfo = '';
    if (showTimestamps) {
      timingInfo = ` (${this.displayTime})`;
    }
    
    // Create the final log message in the format:
    // [TYPE][SUBTYPE] message [LEVEL] (timing)
    const formattedMessage = `${prefix} ${displayMessage}${levelSuffix}${timingInfo}`;
    
    return [formattedMessage];
  }

  /**
   * Create a clone of this entry with modified properties
   * @param {Object} overrides - Properties to override
   * @returns {LogEntry} - New log entry
   */
  clone(overrides = {}) {
    const newEntry = new LogEntry(
      overrides.level || this.level,
      overrides.message || this.message,
      overrides.type || this.type,
      overrides.subtype || this.subtype,
      overrides.caller || this.caller,
      overrides.details || this.details
    );
    
    // Override specific properties
    Object.keys(overrides).forEach(key => {
      if (key !== 'sequence') { // Don't override sequence
        newEntry[key] = overrides[key];
      }
    });
    
    return newEntry;
  }

  // Static sequence counter
  static _sequenceCounter = 0;
  
  /**
   * Get next sequence number
   * @returns {number} - Next sequence number
   */
  static nextSequence() {
    return LogEntry._sequenceCounter++;
  }
  
  /**
   * Reset sequence counter (mainly for testing)
   */
  static resetSequence() {
    LogEntry._sequenceCounter = 0;
  }
} 