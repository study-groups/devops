/**
 * BaseLogEntry.js - Core log entry structure
 * Represents a single log entry with metadata
 * Consolidated from AppLogEntry and ConsoleLogEntry classes
 */

/**
 * BaseLogEntry class for structured logging
 * Can be used for both application and console logging
 */
export class BaseLogEntry {
  constructor(level, message, type = 'GENERAL', caller = null, details = null) {
    const timestamp = new Date();
    
    this.ts = timestamp.getTime();
    this.timestamp = timestamp.toISOString();
    this.displayTime = timestamp.toLocaleTimeString();
    this.level = level;
    this.type = type;
    this.message = message;
    this.details = details;
    this.caller = caller;
    this.sequence = BaseLogEntry.nextSequence();
  }

  /**
   * Format the entry for console output with [TYPE] message [LEVEL]
   * @param {boolean} showTimestamps - Whether to include timestamps
   * @returns {Array} - Arguments array for console methods
   */
  formatForConsole(showTimestamps = false) {
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
    
    // Check if the message is already formatted (contains [DEVPAGES] or similar)
    const isAlreadyFormatted = typeof displayMessage === 'string' && 
                              displayMessage.match(/^\[[\w\-_]+\]/);
    
    if (isAlreadyFormatted) {
      // Message is already formatted by logMessage, return as-is
      let finalMessage = displayMessage;
      
      // Add timing info when enabled
      if (showTimestamps) {
        finalMessage += ` (${this.displayTime})`;
      }
      
      return [finalMessage];
    } else {
      // Build the log prefix with type for unformatted messages
      let prefix = `[${this.type}]`;
      
      // Level goes at the end
      let levelSuffix = ` [${this.level}]`;
      
      // Add timing info when enabled
      let timingInfo = '';
      if (showTimestamps) {
        timingInfo = ` (${this.displayTime})`;
      }
      
      // Create the final log message in the format:
      // [TYPE] message [LEVEL] (timing)
      const formattedMessage = `${prefix} ${displayMessage}${levelSuffix}${timingInfo}`;
      
      return [formattedMessage];
    }
  }

  /**
   * Create a clone of this entry with modified properties
   * @param {Object} overrides - Properties to override
   * @returns {BaseLogEntry} - New log entry
   */
  clone(overrides = {}) {
    const newEntry = new BaseLogEntry(
      overrides.level || this.level,
      overrides.message || this.message,
      overrides.type || this.type,
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
    return BaseLogEntry._sequenceCounter++;
  }
  
  /**
   * Reset sequence counter (mainly for testing)
   */
  static resetSequence() {
    BaseLogEntry._sequenceCounter = 0;
  }
}

// Initialize static counter
BaseLogEntry._sequenceCounter = 0;