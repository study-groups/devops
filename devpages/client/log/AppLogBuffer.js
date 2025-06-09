/**
 * AppLogBuffer.js - Buffer for application log entries
 * Renamed from LogBuffer.js and simplified by removing subtype functionality
 */

/**
 * AppLogBuffer class to manage application log entries in memory
 */
export class AppLogBuffer {
  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.callbacks = new Set();
    this.discoveredTypes = new Set();
  }

  /**
   * Add an entry to the buffer
   * @param {Object} entry - Application log entry to add
   */
  add(entry) {
    // Add entry to buffer (at the beginning for faster access to recent logs)
    this.buffer.unshift(entry);
    
    // Track discovered types
    if (entry.type) {
      this.discoveredTypes.add(entry.type);
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
   * Get all entries
   * @returns {Array} - Array of all application log entries
   */
  getAll() {
    return [...this.buffer];
  }

  /**
   * Get recent entries (default: last 100)
   * @param {number} count - Number of recent entries to get
   * @returns {Array} - Array of recent application log entries
   */
  getRecent(count = 100) {
    return this.buffer.slice(0, Math.min(count, this.buffer.length));
  }

  /**
   * Clear all entries
   */
  clear() {
    this.buffer = [];
    this.discoveredTypes.clear();
    return this;
  }

  /**
   * Get entries matching filter
   * @param {Function} filterFn - Filter function that takes an entry and returns boolean
   * @returns {Array} - Filtered application log entries
   */
  filter(filterFn) {
    return this.buffer.filter(filterFn);
  }

  /**
   * Get buffer size
   * @returns {number} - Current number of entries in buffer
   */
  size() {
    return this.buffer.length;
  }

  /**
   * Get max buffer size
   * @returns {number} - Maximum number of entries the buffer can hold
   */
  getMaxSize() {
    return this.maxSize;
  }

  /**
   * Set max buffer size
   * @param {number} size - New maximum size
   */
  setMaxSize(size) {
    this.maxSize = size;
    // Trim if current buffer exceeds new max size
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(0, this.maxSize);
    }
    return this;
  }

  /**
   * Register callback for when entries are added
   * @param {Function} callback - Function to call when entries are added
   */
  onEntryAdded(callback) {
    if (typeof callback === 'function') {
      this.callbacks.add(callback);
    }
    return this;
  }

  /**
   * Unregister callback
   * @param {Function} callback - Function to unregister
   */
  removeCallback(callback) {
    this.callbacks.delete(callback);
    return this;
  }

  /**
   * Notify all callbacks about new entry
   * @param {Object} entry - Application log entry that was added
   */
  notifyCallbacks(entry) {
    this.callbacks.forEach(callback => {
      try {
        callback(entry);
      } catch (error) {
        console.error('Error in AppLogBuffer callback:', error);
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
   * Get summary statistics
   * @returns {Object} - Buffer statistics
   */
  getStats() {
    const stats = {
      totalEntries: this.buffer.length,
      maxSize: this.maxSize,
      discoveredTypes: this.getDiscoveredTypes(),
      levelCounts: {},
      typeCounts: {}
    };

    // Count entries by level and type
    this.buffer.forEach(entry => {
      // Count by level
      stats.levelCounts[entry.level] = (stats.levelCounts[entry.level] || 0) + 1;
      
      // Count by type
      stats.typeCounts[entry.type] = (stats.typeCounts[entry.type] || 0) + 1;
    });

    return stats;
  }

} 