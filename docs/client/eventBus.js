// client/eventBus.js - Simple event bus for component communication
const EventBus = {
  listeners: {},
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    console.log(`[EVENT] Subscribed to "${event}"`);
    return () => this.off(event, callback);
  },
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  },
  
  emit(event, data = {}) {
    console.log(`[EVENT] Emitting "${event}":`, data);
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EVENT] Handler error for "${event}":`, error);
        }
      });
    }
  }
};

// Make available globally for debugging
window.EventBus = EventBus;

export default EventBus; 