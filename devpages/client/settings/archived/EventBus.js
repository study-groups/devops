/**
 * Simplified Event Bus
 * Lightweight pub/sub system to replace complex event bus mixins
 */

class SettingsEventBus {
  constructor() {
    this.listeners = new Map();
    this.debugMode = false;
  }
  
  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(callback);
    
    if (this.debugMode) {
      console.debug(`[EventBus] Subscribed to '${event}' (${this.listeners.get(event).length} listeners)`);
    }
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }
  
  /**
   * Subscribe to an event once (auto-unsubscribe after first emission)
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const onceWrapper = (data) => {
      callback(data);
      this.off(event, onceWrapper);
    };
    
    return this.on(event, onceWrapper);
  }
  
  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    
    if (this.debugMode && callbacks.length > 0) {
      console.debug(`[EventBus] Emitting '${event}' to ${callbacks.length} listeners:`, data);
    }
    
    // Call all callbacks, catching any errors to prevent one bad listener from breaking others
    callbacks.forEach((callback, index) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventBus] Error in listener ${index} for event '${event}':`, error);
      }
    });
  }
  
  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    
    if (index > -1) {
      callbacks.splice(index, 1);
      
      if (this.debugMode) {
        console.debug(`[EventBus] Unsubscribed from '${event}' (${callbacks.length} listeners remaining)`);
      }
      
      // Clean up empty event arrays
      if (callbacks.length === 0) {
        this.listeners.delete(event);
      }
    }
  }
  
  /**
   * Remove all listeners for an event, or all listeners if no event specified
   * @param {string} [event] - Event name (optional)
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
      if (this.debugMode) {
        console.debug(`[EventBus] Cleared all listeners for '${event}'`);
      }
    } else {
      this.listeners.clear();
      if (this.debugMode) {
        console.debug('[EventBus] Cleared all listeners');
      }
    }
  }
  
  /**
   * Get list of events with listener counts
   * @returns {Object} Events and their listener counts
   */
  getEvents() {
    const events = {};
    for (const [event, callbacks] of this.listeners) {
      events[event] = callbacks.length;
    }
    return events;
  }
  
  /**
   * Check if an event has listeners
   * @param {string} event - Event name
   * @returns {boolean} True if event has listeners
   */
  hasListeners(event) {
    return this.listeners.has(event) && this.listeners.get(event).length > 0;
  }
  
  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).length : 0;
  }
  
  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Debug mode enabled
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`[EventBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Debug method to log all events and listeners
   */
  debug() {
    console.group('[EventBus] Debug Info');
    console.log('Total events:', this.listeners.size);
    
    if (this.listeners.size === 0) {
      console.log('No events registered');
    } else {
      for (const [event, callbacks] of this.listeners) {
        console.log(`- ${event}: ${callbacks.length} listeners`);
      }
    }
    
    console.groupEnd();
  }
}

// Create and export singleton instance
export const settingsEvents = new SettingsEventBus();

// Make available globally for debugging and integration
if (typeof window !== 'undefined') {
  window.settingsEvents = settingsEvents;
}

// Common event names (optional - for consistency)
export const EVENTS = {
  // Panel events
  PANEL_TOGGLED: 'panel-toggled',
  PANEL_REGISTERED: 'panel-registered',
  PANEL_SHOWN: 'panel-shown',
  PANEL_HIDDEN: 'panel-hidden',
  
  // CSS events
  CSS_FILE_ADDED: 'css-file-added',
  CSS_FILE_REMOVED: 'css-file-removed',
  CSS_FILE_TOGGLED: 'css-file-toggled',
  CSS_BUNDLING_CHANGED: 'css-bundling-changed',
  
  // Theme events
  THEME_CHANGED: 'theme-changed',
  THEME_MODE_SWITCHED: 'theme-mode-switched',
  
  // Settings events
  SETTINGS_CHANGED: 'settings-changed',
  SETTINGS_SAVED: 'settings-saved',
  SETTINGS_RESET: 'settings-reset'
}; 