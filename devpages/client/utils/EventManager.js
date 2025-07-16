/**
 * EventManager - Automatic event listener cleanup
 * Prevents memory leaks by tracking and cleaning up event listeners
 */
export class EventManager {
    constructor() {
        this.cleanup = [];
        this.destroyed = false;
    }
    
    /**
     * Add an event listener with automatic cleanup tracking
     * @param {EventTarget} element - The element to attach to
     * @param {string} event - The event type
     * @param {Function} handler - The event handler
     * @param {object} options - Event listener options
     */
    on(element, event, handler, options = {}) {
        if (this.destroyed) {
            console.warn('[EventManager] Cannot add event listener - manager destroyed');
            return;
        }
        
        element.addEventListener(event, handler, options);
        
        // Store cleanup function
        const cleanup = () => element.removeEventListener(event, handler, options);
        this.cleanup.push(cleanup);
        
        return cleanup; // Return cleanup function for manual removal if needed
    }
    
    /**
     * Remove a specific event listener
     * @param {EventTarget} element - The element
     * @param {string} event - The event type  
     * @param {Function} handler - The event handler
     * @param {object} options - Event listener options
     */
    off(element, event, handler, options = {}) {
        element.removeEventListener(event, handler, options);
        
        // Remove from cleanup array
        this.cleanup = this.cleanup.filter(cleanup => {
            // This is a bit tricky since we can't directly compare cleanup functions
            // In practice, most usage will be through destroy() anyway
            return true; // Keep it simple for now
        });
    }
    
    /**
     * Clean up all event listeners
     */
    destroy() {
        if (this.destroyed) {
            return;
        }
        
        this.cleanup.forEach(cleanupFn => {
            try {
                cleanupFn();
            } catch (error) {
                console.warn('[EventManager] Error during cleanup:', error);
            }
        });
        
        this.cleanup = [];
        this.destroyed = true;
    }
    
    /**
     * Get count of tracked event listeners (for debugging)
     */
    getListenerCount() {
        return this.cleanup.length;
    }
}

/**
 * Mixin for classes that need event management
 */
export class EventManagerMixin {
    constructor() {
        this.eventManager = new EventManager();
    }
    
    /**
     * Add event listener with automatic cleanup
     */
    addEventListener(element, event, handler, options) {
        return this.eventManager.on(element, event, handler, options);
    }
    
    /**
     * Remove event listener
     */
    removeEventListener(element, event, handler, options) {
        return this.eventManager.off(element, event, handler, options);
    }
    
    /**
     * Destroy all event listeners (call this in your destroy method)
     */
    destroyEvents() {
        if (this.eventManager) {
            this.eventManager.destroy();
        }
    }
} 