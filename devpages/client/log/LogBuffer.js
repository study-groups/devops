/**
 * LogBuffer.js - Buffer management for log entries
 */

/**
 * LogBuffer class for storing and managing log entries
 */
export class LogBuffer {
  /**
   * Create a new log buffer
   * @param {number} maxSize - Maximum number of entries to store
   */
  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.callbacks = new Set();
    this.discoveredTypes = new Set();
    this.discoveredSubtypes = new Set();
  }

  /**
   * Add an entry to the buffer
   * @param {Object} entry - Log entry to add
   */
  add(entry) {
    // Add entry to buffer (at the beginning for faster access to recent logs)
    this.buffer.unshift(entry);
    
    // Track discovered types and subtypes
    if (entry.type) {
      this.discoveredTypes.add(entry.type);
    }
    
    if (entry.subtype) {
      this.discoveredSubtypes.add(entry.subtype);
    }
    
    // Trim buffer if it exceeds max size
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(0, this.maxSize);
    }
    
    // Notify callbacks
    this.notifyCallbacks(entry);
    
    return this;
  }

  /**
   * Get all entries from the buffer
   * @returns {Array} - Array of log entries
   */
  getEntries() {
    return [...this.buffer];
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = [];
    return this;
  }

  /**
   * Get the number of entries in the buffer
   * @returns {number} - Buffer size
   */
  size() {
    return this.buffer.length;
  }

  /**
   * Set the maximum buffer size
   * @param {number} size - New maximum size
   */
  setMaxSize(size) {
    if (typeof size === 'number' && size > 0) {
      this.maxSize = size;
      
      // Trim buffer if needed
      if (this.buffer.length > this.maxSize) {
        this.buffer = this.buffer.slice(0, this.maxSize);
      }
    }
    
    return this;
  }

  /**
   * Register a callback for buffer updates
   * @param {Function} callback - Function to call when buffer is updated
   */
  registerCallback(callback) {
    if (typeof callback === 'function') {
      this.callbacks.add(callback);
    }
    
    return this;
  }

  /**
   * Unregister a callback
   * @param {Function} callback - Callback to remove
   */
  unregisterCallback(callback) {
    this.callbacks.delete(callback);
    return this;
  }

  /**
   * Notify all registered callbacks about a new entry
   * @param {Object} entry - The new log entry
   */
  notifyCallbacks(entry) {
    this.callbacks.forEach(callback => {
      try {
        callback(entry);
      } catch (e) {
        console.error('[LOG_BUFFER] Error in callback:', e);
      }
    });
  }

  /**
   * Get all discovered types
   * @returns {Array} - Array of discovered types
   */
  getDiscoveredTypes() {
    return [...this.discoveredTypes];
  }

  /**
   * Get all discovered subtypes
   * @returns {Array} - Array of discovered subtypes
   */
  getDiscoveredSubtypes() {
    return [...this.discoveredSubtypes];
  }
} 