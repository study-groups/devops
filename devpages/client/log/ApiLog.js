/**
 * ApiLog.js - API communication logging for Pixeljam Arcade Game API
 * Based on pjaSdk.module.js gameTypes as actions
 * 
 * ApiLog format is pure communication protocol:
 * - action: (was gameType - e.g., GAME_LOADED, SUBMIT_SCORE)
 * - to: <HOST,CLIENT,SERVER>
 * - from: <HOST,CLIENT,SERVER>  
 * - ttime: transmit time (ms precision, set at send time)
 * - rtime: receive time (ms precision, set at RX)
 * 
 * This integrates with ConsoleLog/AppLog as message data, not as standalone logs
 */

// Game API Actions (from pjaSdk.module.js gameTypes)
export const GAME_API_ACTIONS = {
  // Lifecycle actions
  GAME_IDLE: "GAME_IDLE",
  GAME_LOADING: "GAME_LOADING", 
  GAME_LOADED: "GAME_LOADED",
  GAME_STARTED: "GAME_STARTED",
  GAME_ENDED: "GAME_ENDED",
  
  // Game state actions
  GAME_STATE_UPDATE: "GAME_STATE_UPDATE",
  PLAYER_ACTION: "PLAYER_ACTION",
  SUBMIT_SCORE: "SUBMIT_SCORE",
  
  // Control actions
  SET_VOLUME: "SET_VOLUME",
  PLAY_GAME: "PLAY_GAME", 
  PAUSE_GAME: "PAUSE_GAME",
  
  // Data actions
  GET_SCORE: "GET_SCORE",
  GET_USER: "GET_USER",
  SET_USER: "SET_USER",
  
  // Auth actions
  AUTHENTICATE: "AUTHENTICATE"
};

// API endpoints/targets
export const API_TARGETS = {
  HOST: "HOST",
  CLIENT: "CLIENT", 
  SERVER: "SERVER"
};

/**
 * ApiLogEntry - Pure API communication data
 * Implements the triple-timestamp structure for API events
 */
export class ApiLogEntry {
  constructor(action, from, to, data = null) {
    this.action = action;
    this.from = from;
    this.to = to;
    this.data = data;
    
    // Triple-timestamp structure
    this.originateTime = new Date().toISOString(); // When sender transmits
    this.receiveTime = null;  // When receiver receives
    this.transmitTime = null; // When receiver transmits response
    
    this.id = ApiLogEntry.nextId();
  }
  
  /**
   * Mark as received (sets receiveTime)
   */
  markReceived() {
    this.receiveTime = new Date().toISOString();
    return this;
  }
  
  /**
   * Mark as transmitted (sets transmitTime)
   */
  markTransmitted() {
    this.transmitTime = new Date().toISOString();
    return this;
  }
  
  /**
   * Get transmission duration (if received)
   */
  getDuration() {
    if (!this.receiveTime) return null;
    return new Date(this.receiveTime) - new Date(this.originateTime);
  }
  
  /**
   * Get processing duration (if transmitted)
   */
  getProcessingDuration() {
    if (!this.transmitTime || !this.receiveTime) return null;
    return new Date(this.transmitTime) - new Date(this.receiveTime);
  }
  
  /**
   * Format for display in container logs
   */
  formatForDisplay() {
    const duration = this.getDuration();
    const processingDuration = this.getProcessingDuration();
    const durationText = duration !== null ? ` (${duration.toFixed(2)}ms)` : '';
    const processingText = processingDuration !== null ? ` [proc: ${processingDuration.toFixed(2)}ms]` : '';
    return `${this.from}→${this.to}: ${this.action}${durationText}${processingText}`;
  }
  
  /**
   * Convert to LogEntry payload format
   */
  toLogPayload() {
    return {
      to: this.to,
      from: this.from,
      action: this.action,
      data: this.data,
      originateTime: this.originateTime,
      receiveTime: this.receiveTime,
      transmitTime: this.transmitTime
    };
  }
  
  /**
   * Create a LogEntry from this API entry
   * @param {string} level - Log level
   * @param {string} type - Log type
   * @returns {LogEntry} - New log entry
   */
  toLogEntry(level = 'INFO', type = 'PJA_GAME') {
    const origin = `${this.from}.Api`;
    const message = this.formatForDisplay();
    const payload = this.toLogPayload();
    
    return new LogEntry(level, message, type, origin, payload);
  }
  
  // Static ID counter
  static _idCounter = 0;
  static nextId() {
    return ++ApiLogEntry._idCounter;
  }
}

/**
 * ApiLogBuffer - Stores API communication entries
 */
export class ApiLogBuffer {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.callbacks = new Set();
  }
  
  add(apiEntry) {
    this.buffer.unshift(apiEntry);
    
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(0, this.maxSize);
    }
    
    this.notifyCallbacks(apiEntry);
    return this;
  }
  
  getEntries() {
    return [...this.buffer];
  }
  
  clear() {
    this.buffer = [];
    this.notifyCallbacks();
    return this;
  }
  
  size() {
    return this.buffer.length;
  }
  
  registerCallback(callback) {
    if (typeof callback === 'function') {
      this.callbacks.add(callback);
    }
    return this;
  }
  
  unregisterCallback(callback) {
    this.callbacks.delete(callback);
    return this;
  }
  
  notifyCallbacks(apiEntry) {
    this.callbacks.forEach(callback => {
      try {
        callback(apiEntry);
      } catch (e) {
        console.error('[API_LOG_BUFFER] Error in callback:', e);
      }
    });
  }
  
  /**
   * Get statistics about API communication
   */
  getStats() {
    const stats = {
      totalMessages: this.buffer.length,
      actionCounts: {},
      routeCounts: {},
      averageDuration: 0,
      unreceived: 0
    };
    
    let totalDuration = 0;
    let receivedCount = 0;
    
    this.buffer.forEach(entry => {
      // Count by action
      stats.actionCounts[entry.action] = (stats.actionCounts[entry.action] || 0) + 1;
      
      // Count by route
      const route = `${entry.from}→${entry.to}`;
      stats.routeCounts[route] = (stats.routeCounts[route] || 0) + 1;
      
      // Calculate duration stats
      const duration = entry.getDuration();
      if (duration !== null) {
        totalDuration += duration;
        receivedCount++;
      } else {
        stats.unreceived++;
      }
    });
    
    if (receivedCount > 0) {
      stats.averageDuration = totalDuration / receivedCount;
    }
    
    return stats;
  }
}

const allGameApiManagers = [];

export function getAllGameApiManagers() {
    return allGameApiManagers;
}

/**
 * GameApiManager - Manages PJA Game API communication
 * Inspired by pjaSdk.module.js but focused on logging
 */
export class GameApiManager {
  constructor(options = {}) {
    this.buffer = new ApiLogBuffer(options.bufferSize || 1000);
    this.role = options.role || 'UNKNOWN'; // HOST, CLIENT, SERVER
    this.debug = options.debug || false;
    this.callbacks = new Map();
    allGameApiManagers.push(this);
  }
  
  /**
   * Send API message (creates ApiLogEntry)
   */
  send(action, to, data = null) {
    if (!GAME_API_ACTIONS[action]) {
      console.warn(`[GameApiManager] Unknown action: ${action}`);
    }
    
    if (!API_TARGETS[to]) {
      console.warn(`[GameApiManager] Unknown target: ${to}`);
    }
    
    const apiEntry = new ApiLogEntry(action, this.role, to, data);
    this.buffer.add(apiEntry);
    
    if (this.debug) {
      console.log(`[GameApiManager] Sending: ${apiEntry.formatForDisplay()}`, data);
    }
    
    return apiEntry;
  }
  
  /**
   * Receive API message (marks existing entry as received or creates new)
   */
  receive(action, from, data = null, existingEntryId = null) {
    let apiEntry;
    
    if (existingEntryId) {
      // Find existing entry and mark as received
      apiEntry = this.buffer.getEntries().find(e => e.id === existingEntryId);
      if (apiEntry) {
        apiEntry.markReceived();
      }
    } else {
      // Create new received entry
      apiEntry = new ApiLogEntry(action, from, this.role, data);
      apiEntry.markReceived();
      this.buffer.add(apiEntry);
    }
    
    if (this.debug && apiEntry) {
      console.log(`[GameApiManager] Received: ${apiEntry.formatForDisplay()}`, data);
    }
    
    return apiEntry;
  }
  
  /**
   * Get API buffer
   */
  getBuffer() {
    return this.buffer;
  }
  
  /**
   * Get API statistics
   */
  getStats() {
    return this.buffer.getStats();
  }
  
  /**
   * Clear API buffer
   */
  clear() {
    this.buffer.clear();
    return this;
  }

  destroy() {
    this.buffer.clear();
    const index = allGameApiManagers.indexOf(this);
    if (index > -1) {
        allGameApiManagers.splice(index, 1);
    }
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  window.GameApiManager = GameApiManager;
  window.GAME_API_ACTIONS = GAME_API_ACTIONS;
  window.API_TARGETS = API_TARGETS;
}

console.log('[API_LOG] Pixeljam Arcade Game API logging system loaded'); 