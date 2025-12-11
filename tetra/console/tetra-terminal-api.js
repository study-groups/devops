/**
 * Tetra Terminal API
 * Include this in parent pages to communicate with tetra-terminal.html iframes
 *
 * Usage:
 *   <script src="tetra-terminal-api.js"></script>
 *   <iframe id="terminal" src="tetra-terminal.html"></iframe>
 *   <script>
 *     const terminal = new TetraTerminal('terminal');
 *     terminal.on('ready', () => {
 *       terminal.execute('echo "Hello World"');
 *     });
 *   </script>
 */

(function() {
    'use strict';

    class TetraTerminal {
        /**
         * Create a TetraTerminal controller
         * @param {string|HTMLIFrameElement} iframe - iframe element or ID
         * @param {object} options - Configuration options
         */
        constructor(iframe, options = {}) {
            this.iframe = typeof iframe === 'string'
                ? document.getElementById(iframe)
                : iframe;

            if (!this.iframe || this.iframe.tagName !== 'IFRAME') {
                throw new Error('TetraTerminal requires an iframe element');
            }

            this.options = {
                origin: '*',  // Set to specific origin in production
                ...options
            };

            this.handlers = {};
            this.ready = false;
            this.cols = 80;
            this.rows = 24;
            this.mode = 'local';

            this._initMessageListener();
        }

        /**
         * Initialize message listener for iframe communication
         */
        _initMessageListener() {
            window.addEventListener('message', (event) => {
                const msg = event.data;
                if (!msg || msg.source !== 'tetra-terminal') return;

                // Update internal state
                if (msg.type === 'ready') {
                    this.ready = true;
                    this.cols = msg.cols || 80;
                    this.rows = msg.rows || 24;
                    this.mode = msg.config?.mode || 'local';
                }

                if (msg.type === 'resize') {
                    this.cols = msg.cols;
                    this.rows = msg.rows;
                }

                if (msg.type === 'connected') {
                    this.mode = msg.mode;
                }

                // Emit to handlers
                this._emit(msg.type, msg);
                this._emit('message', msg);
            });
        }

        /**
         * Subscribe to terminal events
         * @param {string} event - Event name (ready, connected, disconnected, output, input, error, resize)
         * @param {function} handler - Callback function
         */
        on(event, handler) {
            if (!this.handlers[event]) {
                this.handlers[event] = [];
            }
            this.handlers[event].push(handler);
            return this;
        }

        /**
         * Remove event handler
         * @param {string} event - Event name
         * @param {function} handler - Handler to remove (omit to remove all)
         */
        off(event, handler) {
            if (!this.handlers[event]) return this;
            if (handler) {
                this.handlers[event] = this.handlers[event].filter(h => h !== handler);
            } else {
                delete this.handlers[event];
            }
            return this;
        }

        /**
         * Emit event to local handlers
         */
        _emit(event, data) {
            if (this.handlers[event]) {
                this.handlers[event].forEach(h => {
                    try {
                        h(data);
                    } catch (e) {
                        console.error('TetraTerminal handler error:', e);
                    }
                });
            }
        }

        /**
         * Send message to iframe
         */
        _send(type, data = {}) {
            if (!this.iframe.contentWindow) {
                console.warn('TetraTerminal: iframe not loaded');
                return this;
            }
            this.iframe.contentWindow.postMessage({ type, ...data }, this.options.origin);
            return this;
        }

        // =========================================
        // Terminal Operations
        // =========================================

        /**
         * Write data to terminal
         * @param {string} data - Data to write
         */
        write(data) {
            return this._send('write', { data });
        }

        /**
         * Write line to terminal (with newline)
         * @param {string} data - Data to write
         */
        writeln(data) {
            return this._send('writeln', { data });
        }

        /**
         * Clear terminal screen
         */
        clear() {
            return this._send('clear');
        }

        /**
         * Focus terminal
         */
        focus() {
            return this._send('focus');
        }

        /**
         * Resize terminal to fit container
         */
        fit() {
            return this._send('resize');
        }

        /**
         * Execute a command in terminal
         * @param {string} command - Command to execute
         */
        execute(command) {
            return this._send('execute', { command });
        }

        // =========================================
        // Connection Operations
        // =========================================

        /**
         * Connect to local terminal server
         */
        connectLocal() {
            return this._send('connect', { mode: 'local' });
        }

        /**
         * Connect to SSH server
         * @param {object} options - SSH options
         * @param {string} options.host - SSH host
         * @param {string} options.user - SSH username
         * @param {string} options.token - SSH token (optional)
         */
        connectSSH(options = {}) {
            return this._send('connect', { mode: 'ssh', ...options });
        }

        /**
         * Disconnect from current connection
         */
        disconnect() {
            return this._send('disconnect');
        }

        /**
         * Update terminal configuration
         * @param {object} config - Configuration options
         */
        setConfig(config) {
            return this._send('setConfig', { config });
        }

        // =========================================
        // State Getters
        // =========================================

        /**
         * Check if terminal is ready
         */
        isReady() {
            return this.ready;
        }

        /**
         * Get terminal dimensions
         */
        getSize() {
            return { cols: this.cols, rows: this.rows };
        }

        /**
         * Get current connection mode
         */
        getMode() {
            return this.mode;
        }
    }

    // Expose globally
    window.TetraTerminal = TetraTerminal;

})();
