/**
 * LogEntry.js - Core log entry structure
 * Represents a single log entry with metadata
 * Implements the unified logging structure with triple-timestamp support
 */

/**
 * LogEntry class for structured logging
 */
export class LogEntry {
  constructor(level, message, type = 'GENERAL', origin = null, payload = null) {
    const timestamp = new Date();
    
    // Core fields
    this.level = level.toUpperCase();
    this.type = type.toUpperCase();
    this.origin = origin; // Compound source (format: "actor.module" or hierarchical)
    this.message = message;
    this.ts = timestamp.toISOString(); // Log creation timestamp (ISO 8601)
    
    // Payload handling
    this.payload = payload || {};
    
    // If payload contains API data, ensure it has the triple-timestamp structure
    if (this.payload && this.payload.to && this.payload.from) {
      this.payload = {
        ...this.payload,
        originateTime: this.payload.originateTime || this.ts,
        receiveTime: this.payload.receiveTime || null,
        transmitTime: this.payload.transmitTime || null
      };
    }
    
    // Sequence for ordering
    this.sequence = LogEntry.nextSequence();
  }

  /**
   * Format the entry for console output
   * Format: [TYPE] message [LEVEL] (origin) (timing)
   * @param {boolean} showTimestamps - Whether to include timestamps
   * @returns {Array} - Arguments array for console methods
   */
  formatForConsole(showTimestamps = false) {
    // Build the log prefix with type
    let prefix = `[${this.type}]`;
    
    // Get the actual message content
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
    
    // Add origin info if present
    let originInfo = this.origin ? ` (${this.origin})` : '';
    
    // Add timing info when enabled
    let timingInfo = '';
    if (showTimestamps) {
      if (this.payload && this.payload.originateTime) {
        const duration = this.payload.transmitTime ? 
          new Date(this.payload.transmitTime) - new Date(this.payload.originateTime) : 
          null;
        timingInfo = ` [${duration ? duration.toFixed(2) + 'ms' : 'pending'}]`;
      } else {
        timingInfo = ` (${new Date(this.ts).toLocaleTimeString()})`;
      }
    }
    
    // Create the final log message
    const formattedMessage = `${prefix} ${displayMessage}${levelSuffix}${originInfo}${timingInfo}`;
    
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
      overrides.origin || this.origin,
      overrides.payload || this.payload
    );
    
    // Override specific properties
    Object.keys(overrides).forEach(key => {
      if (key !== 'sequence') { // Don't override sequence
        newEntry[key] = overrides[key];
      }
    });
    
    return newEntry;
  }

  /**
   * Convert to a plain object for serialization
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      level: this.level,
      type: this.type,
      origin: this.origin,
      message: this.message,
      ts: this.ts,
      payload: this.payload,
      sequence: this.sequence
    };
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