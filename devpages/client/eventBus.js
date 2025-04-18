// client/eventBus.js - Simple event bus for component communication
export class EventBus {
  constructor() {
    this.handlers = new Map();
    // REMOVED: Authentication state is now managed centrally in appState.js
    // this.authState = {
    //   isAuthenticated: false,
    //   username: null,
    //   token: null,
    //   loginTime: null,
    //   expiresAt: null
    // };
  }

  // Register event handlers
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
    console.log(`[EventBus] Subscribed to "${event}"`); // Use class name for clarity
    return this; // For chaining
  }

  // Remove event handlers
  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    return this;
  }

  // Trigger event with data
  emit(eventName, data) {
    if (!this.handlers.has(eventName)) {
        // Optional: Log if emitting an event with no listeners
        // console.debug(`[EventBus] Emitted "${eventName}" but no listeners registered.`);
        return;
    }
    
    const handlers = this.handlers.get(eventName);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[EventBus] Error in event handler for ${eventName}:`, error);
      }
    });
    
    // REMOVED: Redundant DOM event dispatching for auth.
    // Components should subscribe to appState directly.
    // if (eventName.startsWith(\'auth:\')) {
    //   document.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    // }
  }

  // REMOVED: Authentication state management methods
  // setAuthState(state) { ... }
  // getAuthState() { ... }
  // isAuthenticated() { ... }
  // isAuthorized(actionType, resource) { ... }
  // clearAuthState() { ... }

}

// Create and export a singleton instance
export const eventBus = new EventBus();

// Also export as default for convenience
export default eventBus; 