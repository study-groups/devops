/**
 * TERRAIN Events
 * Pub/sub event bus for decoupled module communication
 */

(function(TERRAIN) {
    'use strict';

    const listeners = new Map();

    const Events = {
        /**
         * Subscribe to an event
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         * @returns {Function} Unsubscribe function
         */
        on: function(event, callback) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event).add(callback);

            // Return unsubscribe function
            return () => this.off(event, callback);
        },

        /**
         * Subscribe once
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         */
        once: function(event, callback) {
            const wrapper = (data) => {
                this.off(event, wrapper);
                callback(data);
            };
            return this.on(event, wrapper);
        },

        /**
         * Emit an event
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        emit: function(event, data) {
            const handlers = listeners.get(event);
            if (handlers) {
                handlers.forEach(callback => {
                    try {
                        callback(data);
                    } catch (e) {
                        console.error(`[TERRAIN.Events] Error in '${event}' handler:`, e);
                    }
                });
            }

            // Wildcard handlers
            const wildcards = listeners.get('*');
            if (wildcards) {
                wildcards.forEach(callback => {
                    try {
                        callback(event, data);
                    } catch (e) {
                        console.error(`[TERRAIN.Events] Error in wildcard handler:`, e);
                    }
                });
            }
        },

        /**
         * Unsubscribe from an event
         * @param {string} event - Event name
         * @param {Function} callback - Handler to remove (optional - removes all if not provided)
         */
        off: function(event, callback) {
            if (!callback) {
                listeners.delete(event);
            } else {
                const handlers = listeners.get(event);
                if (handlers) {
                    handlers.delete(callback);
                    if (handlers.size === 0) {
                        listeners.delete(event);
                    }
                }
            }
        },

        /**
         * Clear all listeners
         */
        clear: function() {
            listeners.clear();
        },

        /**
         * Get listener count for event
         * @param {string} event - Event name
         */
        listenerCount: function(event) {
            return listeners.get(event)?.size || 0;
        }
    };

    // Standard event names
    Events.EVENTS = {
        // Platform lifecycle
        INIT: 'terrain:init',
        READY: 'terrain:ready',
        DESTROY: 'terrain:destroy',

        // Module lifecycle
        MODULE_REGISTER: 'terrain:module:register',
        MODULE_UNREGISTER: 'terrain:module:unregister',

        // State
        STATE_CHANGE: 'state:change',

        // Bridge
        BRIDGE_MESSAGE: 'bridge:message'
    };

    TERRAIN.Events = Events;

})(window.TERRAIN);
