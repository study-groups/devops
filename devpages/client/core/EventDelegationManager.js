/**
 * EventDelegationManager.js - Centralized event delegation system
 * 
 * This module provides a centralized way to handle events across the application,
 * preventing conflicts between multiple event handlers and improving performance.
 */

class EventDelegationManager {
    constructor() {
        this.handlers = new Map(); // eventType -> Set of handlers
        this.delegatedEvents = new Set();
        this.initialized = false;
        this.debugMode = false;
        
        // Prevent multiple instances
        if (typeof window !== 'undefined' && window.eventDelegationManager) {
            return window.eventDelegationManager;
        }
    }

    /**
     * Initialize the event delegation system
     */
    initialize() {
        if (this.initialized) return;
        
        console.log('[EventDelegationManager] 🎯 Initializing event delegation system...');
        
        // Set up delegation for common conflicting events
        const commonEvents = [
            'click', 'keydown', 'change', 'mousedown', 'mousemove', 'mouseup',
            'mouseenter', 'mouseleave', 'input', 'dragstart', 'dragend', 
            'dragover', 'drop', 'load', 'DOMContentLoaded'
        ];
        
        for (const eventType of commonEvents) {
            this.setupDelegation(eventType);
        }
        
        this.initialized = true;
        
        // Make globally available
        if (typeof window !== 'undefined') {
            window.eventDelegationManager = this;
        }
        
        console.log('[EventDelegationManager] ✅ Event delegation system initialized');
    }

    /**
     * Set up delegation for a specific event type
     * @param {string} eventType - Event type to delegate
     */
    setupDelegation(eventType) {
        if (this.delegatedEvents.has(eventType)) return;
        
        this.handlers.set(eventType, new Set());
        
        // Add single delegated listener
        document.addEventListener(eventType, (event) => {
            this.handleDelegatedEvent(eventType, event);
        }, true); // Use capture phase for better control
        
        this.delegatedEvents.add(eventType);
        
        if (this.debugMode) {
            console.log(`[EventDelegationManager] 📡 Set up delegation for: ${eventType}`);
        }
    }

    /**
     * Handle a delegated event
     * @param {string} eventType - Event type
     * @param {Event} event - Event object
     */
    handleDelegatedEvent(eventType, event) {
        const handlers = this.handlers.get(eventType);
        if (!handlers || handlers.size === 0) return;
        
        if (this.debugMode) {
            console.log(`[EventDelegationManager] 🎯 Handling ${eventType} with ${handlers.size} handlers`);
        }
        
        // Execute handlers in registration order
        for (const handler of handlers) {
            try {
                // Check if handler should execute for this event
                if (this.shouldExecuteHandler(handler, event)) {
                    const result = handler.callback(event);
                    
                    // If handler returns false or calls preventDefault, stop propagation
                    if (result === false || event.defaultPrevented) {
                        if (this.debugMode) {
                            console.log(`[EventDelegationManager] 🛑 Handler stopped propagation: ${handler.id}`);
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error(`[EventDelegationManager] ❌ Handler error:`, error);
                console.error(`Handler ID: ${handler.id}`);
            }
        }
    }

    /**
     * Check if a handler should execute for an event
     * @param {Object} handler - Handler configuration
     * @param {Event} event - Event object
     * @returns {boolean} Whether handler should execute
     */
    shouldExecuteHandler(handler, event) {
        // Check selector matching
        if (handler.selector) {
            const target = event.target.closest(handler.selector);
            if (!target) return false;
            
            // Add matched element to event for convenience
            event.delegateTarget = target;
        }
        
        // Check custom condition
        if (handler.condition && !handler.condition(event)) {
            return false;
        }
        
        // Check if handler is enabled
        if (handler.enabled === false) {
            return false;
        }
        
        return true;
    }

    /**
     * Register an event handler
     * @param {string} eventType - Event type
     * @param {string|Function} selector - CSS selector or callback function
     * @param {Function|Object} callbackOrOptions - Callback function or options object
     * @param {Object} options - Additional options
     * @returns {string} Handler ID for removal
     */
    on(eventType, selector, callbackOrOptions, options = {}) {
        // Handle different parameter combinations
        let callback, actualOptions;
        
        if (typeof selector === 'function') {
            // on(eventType, callback, options)
            callback = selector;
            actualOptions = callbackOrOptions || {};
            selector = null;
        } else if (typeof callbackOrOptions === 'function') {
            // on(eventType, selector, callback, options)
            callback = callbackOrOptions;
            actualOptions = options;
        } else {
            // on(eventType, selector, options) - callback in options
            actualOptions = callbackOrOptions || {};
            callback = actualOptions.callback;
            if (!callback) {
                throw new Error('Callback function is required');
            }
        }
        
        // Set up delegation for this event type if not already done
        this.setupDelegation(eventType);
        
        // Create handler configuration
        const handlerId = this.generateHandlerId(eventType, selector);
        const handler = {
            id: handlerId,
            eventType,
            selector,
            callback,
            condition: actualOptions.condition,
            priority: actualOptions.priority || 0,
            enabled: actualOptions.enabled !== false,
            once: actualOptions.once || false,
            namespace: actualOptions.namespace,
            registered: new Date()
        };
        
        // Add to handlers
        const handlers = this.handlers.get(eventType);
        handlers.add(handler);
        
        // Sort by priority (higher priority first)
        const sortedHandlers = Array.from(handlers).sort((a, b) => b.priority - a.priority);
        this.handlers.set(eventType, new Set(sortedHandlers));
        
        if (this.debugMode) {
            console.log(`[EventDelegationManager] ✅ Registered handler: ${handlerId}`);
        }
        
        return handlerId;
    }

    /**
     * Remove an event handler
     * @param {string} handlerId - Handler ID returned by on()
     */
    off(handlerId) {
        for (const [eventType, handlers] of this.handlers.entries()) {
            for (const handler of handlers) {
                if (handler.id === handlerId) {
                    handlers.delete(handler);
                    
                    if (this.debugMode) {
                        console.log(`[EventDelegationManager] ❌ Removed handler: ${handlerId}`);
                    }
                    
                    return true;
                }
            }
        }
        
        console.warn(`[EventDelegationManager] Handler not found: ${handlerId}`);
        return false;
    }

    /**
     * Remove all handlers for a namespace
     * @param {string} namespace - Namespace to remove
     */
    offNamespace(namespace) {
        let removedCount = 0;
        
        for (const [eventType, handlers] of this.handlers.entries()) {
            const toRemove = Array.from(handlers).filter(h => h.namespace === namespace);
            toRemove.forEach(handler => {
                handlers.delete(handler);
                removedCount++;
            });
        }
        
        console.log(`[EventDelegationManager] 🧹 Removed ${removedCount} handlers from namespace: ${namespace}`);
        return removedCount;
    }

    /**
     * Enable/disable a handler
     * @param {string} handlerId - Handler ID
     * @param {boolean} enabled - Whether to enable the handler
     */
    setHandlerEnabled(handlerId, enabled) {
        for (const handlers of this.handlers.values()) {
            for (const handler of handlers) {
                if (handler.id === handlerId) {
                    handler.enabled = enabled;
                    
                    if (this.debugMode) {
                        console.log(`[EventDelegationManager] ${enabled ? '✅' : '❌'} ${enabled ? 'Enabled' : 'Disabled'} handler: ${handlerId}`);
                    }
                    
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Generate a unique handler ID
     * @param {string} eventType - Event type
     * @param {string} selector - CSS selector
     * @returns {string} Unique handler ID
     */
    generateHandlerId(eventType, selector) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        const selectorPart = selector ? `-${selector.replace(/[^a-zA-Z0-9]/g, '')}` : '';
        return `${eventType}${selectorPart}-${timestamp}-${random}`;
    }

    /**
     * Get debug information about registered handlers
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        const info = {
            delegatedEvents: Array.from(this.delegatedEvents),
            totalHandlers: 0,
            handlersByEvent: {}
        };
        
        for (const [eventType, handlers] of this.handlers.entries()) {
            info.totalHandlers += handlers.size;
            info.handlersByEvent[eventType] = Array.from(handlers).map(h => ({
                id: h.id,
                selector: h.selector,
                priority: h.priority,
                enabled: h.enabled,
                namespace: h.namespace,
                registered: h.registered
            }));
        }
        
        return info;
    }

    /**
     * Enable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[EventDelegationManager] 🐛 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Migrate existing event listeners to use delegation
     * @param {string} eventType - Event type to migrate
     * @param {string} namespace - Namespace for migrated handlers
     */
    migrateExistingListeners(eventType, namespace = 'migrated') {
        console.log(`[EventDelegationManager] 🔄 Migrating existing ${eventType} listeners...`);
        
        // This is a helper method - actual migration would need to be done manually
        // as we can't automatically detect all existing listeners
        
        console.log(`[EventDelegationManager] ℹ️ To migrate ${eventType} listeners:`);
        console.log(`1. Replace: element.addEventListener('${eventType}', callback)`);
        console.log(`2. With: eventDelegationManager.on('${eventType}', selector, callback, { namespace: '${namespace}' })`);
    }

    /**
     * Create a convenience method for common event patterns
     */
    createConvenienceMethods() {
        // Click delegation
        this.onClick = (selector, callback, options) => {
            return this.on('click', selector, callback, options);
        };
        
        // Keydown delegation
        this.onKeydown = (selector, callback, options) => {
            return this.on('keydown', selector, callback, options);
        };
        
        // Change delegation
        this.onChange = (selector, callback, options) => {
            return this.on('change', selector, callback, options);
        };
        
        // Mouse event delegation
        this.onMousedown = (selector, callback, options) => {
            return this.on('mousedown', selector, callback, options);
        };
        
        // Drag event delegation
        this.onDragStart = (selector, callback, options) => {
            return this.on('dragstart', selector, callback, options);
        };
        
        console.log('[EventDelegationManager] ✅ Convenience methods created');
    }

    /**
     * Cleanup all handlers and listeners
     */
    cleanup() {
        // Remove all delegated listeners
        for (const eventType of this.delegatedEvents) {
            // Note: We can't easily remove the listeners we added to document
            // This would require keeping references to the actual listener functions
            console.log(`[EventDelegationManager] ⚠️ Cannot remove document listener for: ${eventType}`);
        }
        
        // Clear internal state
        this.handlers.clear();
        this.delegatedEvents.clear();
        this.initialized = false;
        
        console.log('[EventDelegationManager] 🧹 Cleaned up');
    }
}

// Create singleton instance
const eventDelegationManager = new EventDelegationManager();

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            eventDelegationManager.initialize();
            eventDelegationManager.createConvenienceMethods();
        });
    } else {
        eventDelegationManager.initialize();
        eventDelegationManager.createConvenienceMethods();
    }
}

export { eventDelegationManager };
export default eventDelegationManager;
