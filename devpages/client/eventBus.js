/**
 * client/eventBus.js
 * A simple event bus implementation for loose component coupling and communication.
 * 
 * The EventBus follows the publish-subscribe pattern allowing components to communicate
 * without direct dependencies. Components can emit events and subscribe to events
 * from other components.
 * 
 * Common event naming convention: 'domain:action'
 * Examples: 'editor:contentChanged', 'auth:loginRequested', 'file:save'
 */
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

  /**
   * Register an event handler
   * @param {string} event - The event name to subscribe to
   * @param {Function} handler - The callback function to execute when the event is emitted
   * @returns {EventBus} - Returns this instance for method chaining
   * 
   * @example
   * // Subscribe to editor content changes
   * eventBus.on('editor:contentChanged', (data) => {
   *   console.log('Editor content changed:', data.content);
   *   updatePreview(data.content);
   * });
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
    console.log(`[EventBus] Subscribed to "${event}"`);
    return this; // For chaining
  }

  /**
   * Remove an event handler
   * @param {string} event - The event name to unsubscribe from
   * @param {Function} handler - The handler function to remove
   * @returns {EventBus} - Returns this instance for method chaining
   * 
   * @example
   * // Define handler function
   * const handleContentChange = (data) => {...};
   * 
   * // Subscribe
   * eventBus.on('editor:contentChanged', handleContentChange);
   * 
   * // Later, unsubscribe
   * eventBus.off('editor:contentChanged', handleContentChange);
   */
  off(event, handler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    return this;
  }

  /**
   * Emit an event with optional data
   * @param {string} eventName - The name of the event to emit
   * @param {*} data - Optional data to pass to handlers
   * 
   * @example
   * // Emit content changed event with new content
   * eventBus.emit('editor:contentChanged', { 
   *   content: textarea.value,
   *   timestamp: Date.now()
   * });
   */
  emit(eventName, data) {
    if (!this.handlers.has(eventName)) {
        // Optional: Log if emitting an event with no listeners
        // console.debug(`[EventBus] Emitted "${eventName}" but no listeners registered.`);
        return;
    }
    
    const handlers = this.handlers.get(eventName);
    handlers.forEach(handler => {
      try {
        const result = handler(data);
        // Handle async handlers that return promises
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            console.error(`[EventBus] Async error in event handler for ${eventName}:`, error);
          });
        }
      } catch (error) {
        console.error(`[EventBus] Error in event handler for ${eventName}:`, error);
      }
    });
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus();

// Also export as default for convenience
export default eventBus; 

/**
 * Common Events in DevPages:
 * 
 * Editor Events:
 * - 'editor:contentChanged' - Fired when editor content changes
 * - 'editor:initialized' - Fired when editor is initialized
 * - 'editor:save' - Request to save the current file
 * - 'editor:focus' - Editor gained focus
 * - 'editor:blur' - Editor lost focus
 * 
 * Navigation Events:
 * - 'navigate:pathname' - Navigate to specified path
 * - 'navigate:absolute' - Navigate to absolute path
 * - 'navigate:root' - Navigate to root directory
 * 
 * Auth Events:
 * - 'auth:loginRequested' - Login requested with credentials
 * 
 * UI Events:
 * - 'ui:viewModeChanged' - View mode changed (editor/preview/split)
 * - 'ui:renderFileList' - Request to render file list
 * 
 * Preview Events:
 * - 'preview:initialized' - Preview component initialized
 * - 'preview:updated' - Preview content updated
 * - 'preview:cssSettingsChanged' - CSS settings changed
 * 
 * File Events:
 * - 'file:save' - Request to save current file
 * 
 * Image Events:
 * - 'image:uploaded' - Image upload completed
 * - 'image:uploadError' - Image upload failed
 * - 'image:deleted' - Image deleted
 * 
 * App Events:
 * - 'app:ready' - Application initialization complete
 *
 * A key benefit of using the EventBus is the ability to decouple
 * components. For example, the editor component can emit content changes
 * without knowing which components need to respond (preview, autosave, etc).
 */ 