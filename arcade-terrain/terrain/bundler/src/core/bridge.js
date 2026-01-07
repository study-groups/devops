/**
 * TERRAIN Bridge
 * Cross-iframe communication system
 */

(function(TERRAIN) {
    'use strict';

    const Bridge = {
        _handlers: new Map(),
        _iframes: new Set(),
        _initialized: false,
        _origin: '*',  // Configure for production

        /**
         * Initialize bridge
         */
        init: function() {
            if (this._initialized) return;

            window.addEventListener('message', this._onMessage.bind(this));
            this._discoverIframes();

            // Re-discover iframes when DOM changes
            if (typeof MutationObserver !== 'undefined') {
                const observer = new MutationObserver(() => {
                    this._discoverIframes();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }

            this._initialized = true;
            console.log('[TERRAIN.Bridge] Initialized');
        },

        /**
         * Send message to specific iframe
         * @param {Window|HTMLIFrameElement} target - Target window or iframe element
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        send: function(target, event, data) {
            const targetWindow = target.contentWindow || target;
            const message = {
                type: event,
                payload: data,
                source: 'terrain',
                timestamp: Date.now()
            };
            targetWindow.postMessage(message, this._origin);
        },

        /**
         * Broadcast to parent and all child iframes
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        broadcast: function(event, data) {
            const message = {
                type: event,
                payload: data,
                source: 'terrain',
                timestamp: Date.now()
            };

            // Send to parent (if we're in an iframe)
            if (window.parent !== window) {
                window.parent.postMessage(message, this._origin);
            }

            // Send to all child iframes
            this._iframes.forEach(iframe => {
                try {
                    iframe.contentWindow?.postMessage(message, this._origin);
                } catch (e) {
                    // Cross-origin iframe, ignore
                }
            });

            // Dispatch locally
            this._dispatch(event, data);
        },

        /**
         * Subscribe to bridge events
         * @param {string} event - Event name (* for all)
         * @param {Function} handler - Handler function
         * @returns {Function} Unsubscribe function
         */
        on: function(event, handler) {
            if (!this._handlers.has(event)) {
                this._handlers.set(event, new Set());
            }
            this._handlers.get(event).add(handler);

            return () => this.off(event, handler);
        },

        /**
         * Unsubscribe from bridge events
         * @param {string} event - Event name
         * @param {Function} handler - Handler to remove
         */
        off: function(event, handler) {
            const handlers = this._handlers.get(event);
            if (handlers) {
                if (handler) {
                    handlers.delete(handler);
                    if (handlers.size === 0) {
                        this._handlers.delete(event);
                    }
                } else {
                    this._handlers.delete(event);
                }
            }
        },

        /**
         * Request-response pattern
         * @param {Window|HTMLIFrameElement} target - Target window
         * @param {string} event - Event name
         * @param {*} data - Request data
         * @param {number} timeout - Timeout in ms
         * @returns {Promise} Response promise
         */
        request: function(target, event, data, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const requestId = TERRAIN.Utils.uniqueId('req');

                const timer = setTimeout(() => {
                    this.off(`${event}:response:${requestId}`, handler);
                    reject(new Error(`Bridge request timeout: ${event}`));
                }, timeout);

                const handler = (response) => {
                    clearTimeout(timer);
                    resolve(response);
                };

                this.on(`${event}:response:${requestId}`, handler);
                this.send(target, event, { ...data, _requestId: requestId });
            });
        },

        /**
         * Respond to a request
         * @param {string} event - Original event name
         * @param {string} requestId - Request ID from payload._requestId
         * @param {*} data - Response data
         */
        respond: function(event, requestId, data) {
            this.broadcast(`${event}:response:${requestId}`, data);
        },

        /**
         * Handle incoming message
         */
        _onMessage: function(e) {
            // Only handle terrain messages
            if (e.data?.source !== 'terrain') return;

            const { type, payload } = e.data;

            // Emit to TERRAIN events
            TERRAIN.Events.emit(TERRAIN.Events.EVENTS.BRIDGE_MESSAGE, {
                type,
                payload,
                origin: e.origin,
                source: e.source
            });

            // Dispatch to bridge handlers
            this._dispatch(type, payload, e);
        },

        /**
         * Dispatch to handlers
         */
        _dispatch: function(event, data, originalEvent = null) {
            // Specific event handlers
            const handlers = this._handlers.get(event);
            if (handlers) {
                handlers.forEach(h => {
                    try {
                        h(data, originalEvent);
                    } catch (e) {
                        console.error(`[TERRAIN.Bridge] Error in '${event}' handler:`, e);
                    }
                });
            }

            // Wildcard handlers
            const wildcards = this._handlers.get('*');
            if (wildcards) {
                wildcards.forEach(h => {
                    try {
                        h(event, data, originalEvent);
                    } catch (e) {
                        console.error('[TERRAIN.Bridge] Error in wildcard handler:', e);
                    }
                });
            }
        },

        /**
         * Discover iframes in document
         */
        _discoverIframes: function() {
            const iframes = document.querySelectorAll('iframe');
            this._iframes.clear();
            iframes.forEach(iframe => {
                this._iframes.add(iframe);
            });
        },

        /**
         * Get registered iframe count
         */
        getIframeCount: function() {
            return this._iframes.size;
        },

        /**
         * Check if running in iframe
         */
        isInIframe: function() {
            return window.parent !== window;
        }
    };

    TERRAIN.Bridge = Bridge;

})(window.TERRAIN);
