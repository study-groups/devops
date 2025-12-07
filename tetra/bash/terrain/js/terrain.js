/**
 * Terrain.js - Iframe Communication Library
 * Attaches to window.Terrain namespace for use in iframes
 *
 * Usage in iframe:
 *   Terrain.Iframe.init({
 *     onMessage: function(data) { ... },
 *     onReady: function() { ... }
 *   });
 *
 *   Terrain.Iframe.send({ type: 'myEvent', data: ... });
 */
(function() {
    'use strict';

    const TerrainIframe = {
        parentOrigin: '*',  // Configure for security in production
        handlers: {},
        isReady: false,

        /**
         * Initialize iframe communication
         * @param {Object} options - Configuration options
         * @param {Function} options.onMessage - Handler for incoming messages
         * @param {Function} options.onReady - Called when iframe is ready
         */
        init: function(options) {
            options = options || {};
            this.handlers.onMessage = options.onMessage || function() {};
            this.handlers.onReady = options.onReady || function() {};

            // Listen for messages from parent
            window.addEventListener('message', (e) => {
                this.handleMessage(e);
            });

            // Notify ready when DOM is loaded
            if (document.readyState === 'complete') {
                this.setReady();
            } else {
                window.addEventListener('load', () => this.setReady());
            }

            console.log('[Terrain.Iframe] Initialized');
        },

        /**
         * Set ready state and call handler
         */
        setReady: function() {
            if (this.isReady) return;
            this.isReady = true;
            this.handlers.onReady();
        },

        /**
         * Handle incoming message from parent
         * @param {MessageEvent} event - The message event
         */
        handleMessage: function(event) {
            // Optional: validate origin for security
            // if (event.origin !== 'https://expected-origin.com') return;

            const data = event.data;

            // Ignore non-object messages
            if (!data || typeof data !== 'object') return;

            // Call user handler
            this.handlers.onMessage(data);

            // Built-in message handlers
            if (data.type) {
                switch (data.type) {
                    case 'ping':
                        this.send({
                            type: 'pong',
                            timestamp: Date.now(),
                            originalTimestamp: data.timestamp
                        });
                        break;

                    case 'getState':
                        this.send({
                            type: 'state',
                            data: this.getState()
                        });
                        break;

                    case 'injectTokens':
                        // Receive CSS tokens from parent
                        if (data.tokens) {
                            this.applyTokens(data.tokens);
                        }
                        break;
                }
            }
        },

        /**
         * Apply CSS tokens to document
         * @param {Object} tokens - Token name/value pairs
         */
        applyTokens: function(tokens) {
            const root = document.documentElement;
            let count = 0;
            Object.entries(tokens).forEach(([name, value]) => {
                if (value) {
                    root.style.setProperty('--' + name, value);
                    count++;
                }
            });
            console.log('[Terrain.Iframe] Tokens applied:', count);
            this.send({ type: 'tokensApplied', count: count });
        },

        /**
         * Send message to parent window
         * @param {Object} data - Data to send
         */
        send: function(data) {
            if (window.parent !== window) {
                window.parent.postMessage(data, this.parentOrigin);
            }
        },

        /**
         * Get current iframe state
         * Override this in your iframe to return custom state
         * @returns {Object} Current state
         */
        getState: function() {
            return {
                ready: this.isReady,
                url: window.location.href,
                title: document.title
            };
        },

        /**
         * Request something from parent
         * @param {string} type - Request type
         * @param {Object} data - Additional data
         */
        request: function(type, data) {
            this.send({
                type: 'request',
                requestType: type,
                data: data || {}
            });
        }
    };

    // Attach to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Iframe = TerrainIframe;

    console.log('[Terrain.js] Library loaded');

})();
