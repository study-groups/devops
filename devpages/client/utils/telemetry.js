/**
 * Telemetry - Lightweight Console Telemetry
 *
 * A minimal, opt-in telemetry utility for debugging via Chrome DevTools.
 * Load with: telemetry.enable() to start tracking
 *
 * Usage:
 *   telemetry.enable()           - Start tracking with console output
 *   telemetry.disable()          - Stop tracking
 *   telemetry.track('EVENT', {}) - Manual event tracking
 *   telemetry.session()          - View session info
 *   telemetry.buffer()           - View buffered events
 *   telemetry.clear()            - Clear buffer
 *   telemetry.help()             - Show all commands
 */
(function(global) {
    'use strict';

    const telemetry = {
        // State
        _enabled: false,
        _buffer: [],
        _sessionId: null,
        _sessionStart: null,
        _listeners: [],
        _config: {
            trackClicks: true,
            trackForms: true,
            trackErrors: true,
            trackMouse: false,  // Off by default - very noisy
            bufferSize: 100
        },

        // ========== CORE API ==========

        /**
         * Enable tracking with console output
         */
        enable(opts = {}) {
            if (this._enabled) {
                console.log('%c[telemetry] Already enabled', 'color: #888');
                return this;
            }

            Object.assign(this._config, opts);
            this._enabled = true;
            this._sessionId = `telem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            this._sessionStart = Date.now();

            this._attachListeners();
            this._log('SESSION_START', { sessionId: this._sessionId });

            console.log('%c[telemetry] Enabled', 'color: #4CAF50; font-weight: bold');
            console.log('%c  Commands: telemetry.help()', 'color: #888');
            return this;
        },

        /**
         * Disable tracking
         */
        disable() {
            if (!this._enabled) {
                console.log('%c[telemetry] Already disabled', 'color: #888');
                return this;
            }

            this._log('SESSION_END', {
                duration: Date.now() - this._sessionStart,
                eventCount: this._buffer.length
            });

            this._detachListeners();
            this._enabled = false;

            console.log('%c[telemetry] Disabled', 'color: #f44336; font-weight: bold');
            return this;
        },

        /**
         * Track a custom event
         */
        track(event, data = {}) {
            if (!this._enabled) {
                console.log('%c[telemetry] Not enabled. Run telemetry.enable() first', 'color: #ff9800');
                return this;
            }
            this._log(event, data);
            return this;
        },

        // ========== INSPECTION API ==========

        /**
         * Get session info
         */
        session() {
            if (!this._enabled) {
                console.log('%c[telemetry] Not enabled', 'color: #888');
                return null;
            }
            const info = {
                sessionId: this._sessionId,
                started: new Date(this._sessionStart).toISOString(),
                duration: `${((Date.now() - this._sessionStart) / 1000).toFixed(1)}s`,
                events: this._buffer.length,
                config: this._config
            };
            console.table(info);
            return info;
        },

        /**
         * Get buffered events
         */
        buffer(last = 20) {
            const events = this._buffer.slice(-last);
            if (events.length === 0) {
                console.log('%c[telemetry] Buffer empty', 'color: #888');
                return [];
            }
            console.table(events.map(e => ({
                time: new Date(e.ts).toISOString().slice(11, 23),
                event: e.event,
                data: JSON.stringify(e.data).slice(0, 60)
            })));
            return events;
        },

        /**
         * Clear buffer
         */
        clear() {
            const count = this._buffer.length;
            this._buffer = [];
            console.log(`%c[telemetry] Cleared ${count} events`, 'color: #2196F3');
            return this;
        },

        /**
         * Export buffer as JSON
         */
        export() {
            const data = {
                session: {
                    id: this._sessionId,
                    start: this._sessionStart,
                    duration: Date.now() - this._sessionStart
                },
                events: this._buffer
            };
            console.log(JSON.stringify(data, null, 2));
            return data;
        },

        /**
         * Show help
         */
        help() {
            console.log(`%c
╔═══════════════════════════════════════════════════════╗
║  TELEMETRY - Console Telemetry                        ║
╠═══════════════════════════════════════════════════════╣
║  telemetry.enable()         Start tracking            ║
║  telemetry.enable({         Start with options        ║
║    trackMouse: true           - track mouse moves     ║
║    trackClicks: false         - skip click tracking   ║
║  })                                                   ║
║  telemetry.disable()        Stop tracking             ║
║                                                       ║
║  telemetry.track('NAME', {data})  Manual event        ║
║                                                       ║
║  telemetry.session()        View session info         ║
║  telemetry.buffer()         View last 20 events       ║
║  telemetry.buffer(50)       View last 50 events       ║
║  telemetry.clear()          Clear buffer              ║
║  telemetry.export()         Export as JSON            ║
║                                                       ║
║  telemetry.config           View/modify config        ║
╚═══════════════════════════════════════════════════════╝
`, 'color: #2196F3; font-family: monospace');
            return this;
        },

        // ========== CONFIG ==========

        get config() {
            return { ...this._config };
        },

        set config(opts) {
            Object.assign(this._config, opts);
            console.log('%c[telemetry] Config updated', 'color: #2196F3');
        },

        // ========== INTERNAL ==========

        _log(event, data = {}) {
            const entry = {
                ts: Date.now(),
                event,
                data
            };

            this._buffer.push(entry);

            // Trim buffer if needed
            if (this._buffer.length > this._config.bufferSize) {
                this._buffer.shift();
            }

            // Console output
            const color = this._getEventColor(event);
            console.log(
                `%c[telemetry]%c ${event}`,
                'color: #888',
                `color: ${color}; font-weight: bold`,
                data
            );
        },

        _getEventColor(event) {
            if (event.includes('ERROR')) return '#f44336';
            if (event.includes('CLICK')) return '#4CAF50';
            if (event.includes('SESSION')) return '#2196F3';
            if (event.includes('FORM')) return '#ff9800';
            if (event.includes('MOUSE')) return '#9E9E9E';
            return '#888';
        },

        _attachListeners() {
            // Click tracking
            if (this._config.trackClicks) {
                const clickHandler = (e) => {
                    const el = e.target;
                    const selector = this._getSelector(el);
                    this._log('CLICK', {
                        selector,
                        x: e.clientX,
                        y: e.clientY,
                        text: (el.textContent || '').slice(0, 30).trim()
                    });
                };
                document.addEventListener('click', clickHandler);
                this._listeners.push(['click', clickHandler, document]);
            }

            // Form tracking
            if (this._config.trackForms) {
                const focusHandler = (e) => {
                    const el = e.target;
                    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
                        this._log('FORM_FOCUS', {
                            selector: this._getSelector(el),
                            type: el.type || el.tagName.toLowerCase()
                        });
                    }
                };
                document.addEventListener('focus', focusHandler, true);
                this._listeners.push(['focus', focusHandler, document, true]);
            }

            // Error tracking
            if (this._config.trackErrors) {
                const errorHandler = (e) => {
                    this._log('ERROR', {
                        message: e.message,
                        file: e.filename,
                        line: e.lineno,
                        col: e.colno
                    });
                };
                window.addEventListener('error', errorHandler);
                this._listeners.push(['error', errorHandler, window]);
            }

            // Mouse tracking (opt-in, throttled)
            if (this._config.trackMouse) {
                let lastMove = 0;
                const mouseHandler = (e) => {
                    const now = Date.now();
                    if (now - lastMove > 500) {  // Throttle to 2/sec
                        lastMove = now;
                        this._log('MOUSE', { x: e.clientX, y: e.clientY });
                    }
                };
                document.addEventListener('mousemove', mouseHandler);
                this._listeners.push(['mousemove', mouseHandler, document]);
            }
        },

        _detachListeners() {
            this._listeners.forEach(([event, handler, target, capture]) => {
                target.removeEventListener(event, handler, capture);
            });
            this._listeners = [];
        },

        _getSelector(el) {
            if (!el || !el.tagName) return null;
            let sel = el.tagName.toLowerCase();
            if (el.id) sel += `#${el.id}`;
            else if (el.className && typeof el.className === 'string') {
                sel += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
            }
            return sel;
        }
    };

    // Expose globally
    global.telemetry = telemetry;

    // Self-register with console tools registry
    if (global.consoleTools) {
        global.consoleTools.register({
            name: 'telemetry',
            description: 'Event tracking for debugging',
            icon: 'T',
            toggle: () => telemetry._enabled ? telemetry.disable() : telemetry.enable(),
            isEnabled: () => telemetry._enabled,
            commands: [
                { name: 'session', fn: () => telemetry.session(), description: 'View session info' },
                { name: 'buffer', fn: () => telemetry.buffer(), description: 'View recent events' },
                { name: 'clear', fn: () => telemetry.clear(), description: 'Clear buffer' },
                { name: 'export', fn: () => telemetry.export(), description: 'Export as JSON' },
                { name: 'help', fn: () => telemetry.help(), description: 'Show all commands' }
            ]
        });
    }

    // Startup message (subtle)
    console.log('%c[telemetry] Loaded. Run telemetry.enable() to start', 'color: #888; font-size: 10px');

})(typeof window !== 'undefined' ? window : this);
