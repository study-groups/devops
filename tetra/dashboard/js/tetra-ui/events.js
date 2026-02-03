/**
 * TetraUI Events - Cross-panel event bus
 *
 * Usage:
 *   TetraUI.events.on('eventName', handler)
 *   TetraUI.events.emit('eventName', data)
 *   TetraUI.events.off('eventName', handler)
 *
 * Integrates with Terrain.Bus if available.
 */

window.TetraUI = window.TetraUI || {};

TetraUI.events = {
    _handlers: {},

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Unsubscribe function
     */
    on: function(event, handler) {
        if (!this._handlers[event]) {
            this._handlers[event] = [];
        }
        this._handlers[event].push(handler);

        var self = this;
        return function() {
            self.off(event, handler);
        };
    },

    /**
     * Subscribe to an event once
     * @param {string} event
     * @param {Function} handler
     */
    once: function(event, handler) {
        var self = this;
        var wrapper = function(data) {
            self.off(event, wrapper);
            handler(data);
        };
        this.on(event, wrapper);
    },

    /**
     * Unsubscribe from an event
     * @param {string} event
     * @param {Function} handler
     */
    off: function(event, handler) {
        if (!this._handlers[event]) return;
        this._handlers[event] = this._handlers[event].filter(function(h) {
            return h !== handler;
        });
    },

    /**
     * Emit an event
     * @param {string} event
     * @param {*} data
     */
    emit: function(event, data) {
        var handlers = this._handlers[event];
        if (handlers) {
            for (var i = 0; i < handlers.length; i++) {
                try {
                    handlers[i](data);
                } catch (e) {
                    console.error('[TetraUI.events] Handler error:', e);
                }
            }
        }

        // Also publish to Terrain.Bus if available
        if (window.Terrain && Terrain.Bus) {
            Terrain.Bus.publish({
                type: event,
                source: 'tetra-ui',
                data: data
            });
        }
    },

    /**
     * Clear all handlers for an event (or all events)
     * @param {string} event - Optional event name
     */
    clear: function(event) {
        if (event) {
            delete this._handlers[event];
        } else {
            this._handlers = {};
        }
    }
};

// Bridge with Terrain.Bus if available
if (window.Terrain && Terrain.Bus && Terrain.Bus.subscribe) {
    Terrain.Bus.subscribe(function(msg) {
        if (msg.source !== 'tetra-ui' && msg.type) {
            TetraUI.events.emit(msg.type, msg.data || msg);
        }
    });
}
