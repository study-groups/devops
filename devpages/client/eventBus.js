// client/eventBus.js - Simple event bus for component communication
export class EventBus {
  constructor() {
    this.handlers = new Map();
    this.authState = {
      isAuthenticated: false,
      username: null,
      token: null,
      loginTime: null,
      expiresAt: null
    };
  }

  // Register event handlers
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
    console.log(`[EVENT] Subscribed to "${event}"`);
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
      return;
    }
    
    const handlers = this.handlers.get(eventName);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${eventName}:`, error);
      }
    });
    
    // For backward compatibility, also dispatch DOM events
    if (eventName.startsWith('auth:')) {
      document.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
  }

  // Update authentication state
  setAuthState(state) {
    // Check for valid state object to prevent errors
    if (!state) {
      console.error('[EVENT BUS] Invalid auth state provided to setAuthState');
      return this;
    }
    
    const oldState = { ...this.authState };
    this.authState = { ...state };

    // Emit auth changed event with both old and new state
    this.emit('auth:changed', { 
      oldState,
      newState: this.authState,
      isLogin: !oldState.isAuthenticated && state.isAuthenticated,
      isLogout: oldState.isAuthenticated && !state.isAuthenticated
    });

    // Also emit specific login/logout events
    if (!oldState.isAuthenticated && state.isAuthenticated) {
      this.emit('auth:login', { username: state.username });
    } else if (oldState.isAuthenticated && !state.isAuthenticated) {
      this.emit('auth:logout');
    }

    return this;
  }

  // Get current auth state
  getAuthState() {
    return { ...this.authState };
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.authState.isAuthenticated && 
           this.authState.username && 
           (!this.authState.expiresAt || this.authState.expiresAt > Date.now());
  }

  // Check if action is authorized
  isAuthorized(actionType, resource) {
    if (!this.isAuthenticated()) {
      console.log(`[EVENT BUS] Not authorized - user not authenticated`);
      return false;
    }

    // Log the authorization check
    console.log(`[EVENT BUS] Authorization check for ${actionType} on ${resource}`, this.authState);
    
    // Add your authorization logic here
    // For now, authenticated users can do everything
    return true;
  }

  // Clear auth state (for logout)
  clearAuthState() {
    this.setAuthState({
      isAuthenticated: false,
      username: null,
      token: null,
      loginTime: null,
      expiresAt: null
    });
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus();

// Also export as default for convenience
export default eventBus; 