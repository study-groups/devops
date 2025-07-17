/**
 * LogManager.js - Minimal implementation for backward compatibility
 */

// Simple implementations for missing classes
class LogEntry {
  constructor(level, message, type = 'GENERAL', origin = null, payload = null) {
    this.level = level;
    this.message = message;
    this.type = type;
    this.origin = origin;
    this.payload = payload;
    this.timestamp = Date.now();
  }
}

class LogFilter {
  constructor(config = {}) {
    this.config = { enabled: true, ...config };
  }
  
  setEnabled(enabled) {
    this.config.enabled = enabled;
  }
}

class LogBuffer {
  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
    this.entries = [];
  }
  
  add(entry) {
    this.entries.unshift(entry);
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(0, this.maxSize);
    }
  }
  
  getEntries() {
    return this.entries;
  }
  
  clear() {
    this.entries = [];
  }
}

class CallerInfo {
  static capture(skipFrames = 0) {
    return { file: 'unknown', line: 0, function: 'unknown' };
  }
}

export class LogManager {
  constructor(options = {}) {
    this.buffer = new LogBuffer(options.bufferSize || 2000);
    this.filter = new LogFilter();
    this.enabled = true;
    this.showTimestamps = false;
    this.interceptConsole = false;
  }

  initialize() {
    this.enabled = true;
    return this;
  }

  exposeToWindow() {
    if (typeof window !== 'undefined') {
      window.logManager = this;
    }
    return this;
  }

  isLoggingEnabled() {
    return this.enabled;
  }

  enableLogging(persist = false) {
    this.enabled = true;
    return this;
  }

  disableLogging(persist = false) {
    this.enabled = false;
    return this;
  }

  getLogBuffer() {
    return this.buffer.getEntries();
  }

  clearLogBuffer() {
    this.buffer.clear();
    return this;
  }
}

// Export other classes for compatibility
export { LogEntry, LogFilter, LogBuffer, CallerInfo }; 