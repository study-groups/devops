/**
 * Terrain SDK - Unified iframe messaging with topic-based routing
 *
 * Simple, topic-based protocol for iframe communication.
 * Uses MQTT-style topics for routing with wildcard support.
 *
 * @version 2.0.0
 *
 * Usage:
 *   // In an iframe
 *   Terrain.init({ identity: 'deploy' });
 *   Terrain.on('terrain/env/+/+', (pkt) => handleEnvChange(pkt.payload));
 *
 *   // In parent window (hub mode)
 *   Terrain.init({ identity: 'parent', isHub: true });
 *   Terrain.broadcast('terrain/env/tetra/dev', 'command', { org: 'tetra', env: 'dev' });
 */

(function(global) {
    'use strict';

    const VERSION = '2.0.0';

    // Packet types
    const PacketType = {
        EVENT: 'event',
        COMMAND: 'command',
        STATE: 'state',
        CONTROL: 'control',
        RESPONSE: 'response'
    };

    // =========================================================================
    // Utility Functions
    // =========================================================================

    function timestamp() {
        return Date.now() / 1000;
    }

    /**
     * Match topic against MQTT-style pattern
     * Supports + (single level) and # (multi-level) wildcards
     */
    function matchTopic(topic, pattern) {
        if (pattern === '#') return true;
        if (pattern === topic) return true;

        const topicParts = topic.split('/');
        const patternParts = pattern.split('/');

        for (let i = 0; i < patternParts.length; i++) {
            const p = patternParts[i];
            if (p === '#') return true;
            if (p === '+') {
                if (i >= topicParts.length) return false;
                continue;
            }
            if (topicParts[i] !== p) return false;
        }

        return topicParts.length === patternParts.length;
    }

    function detectIdentity() {
        const match = window.location.pathname.match(/([^/]+)\.iframe\.html$/);
        if (match) return match[1];
        if (document.title) return document.title.toLowerCase().replace(/\s+/g, '-');
        return 'unknown-' + Math.random().toString(36).substr(2, 4);
    }

    // =========================================================================
    // TerrainSDK Class
    // =========================================================================

    class TerrainSDK {
        constructor() {
            this.identity = null;
            this.isHub = false;
            this.debug = false;
            this.ready = false;
            this.initialized = false;

            this.subscriptions = new Map();
            this.iframes = new Map();
            this.messageQueue = [];
            this.stateVersion = 0;

            // DOM event delegation
            this._actions = new Map();

            this.hooks = {
                onReady: null,
                onMessage: null
            };
        }

        // =====================================================================
        // Initialization
        // =====================================================================

        init(opts = {}) {
            if (this.initialized) {
                this._log('warn', 'Already initialized');
                return this;
            }

            this.identity = opts.identity || detectIdentity();
            this.isHub = opts.isHub || (window.parent === window);
            this.debug = opts.debug || false;

            if (opts.onReady) this.hooks.onReady = opts.onReady;
            if (opts.onMessage) this.hooks.onMessage = opts.onMessage;

            this._setupPostMessage();
            this._setupDOMEvents();
            this.initialized = true;

            this._log('info', `Initialized as "${this.identity}"`, { isHub: this.isHub });

            if (document.readyState === 'complete') {
                this._setReady();
            } else {
                window.addEventListener('load', () => this._setReady());
            }

            return this;
        }

        _setReady() {
            if (this.ready) return;
            this.ready = true;

            if (!this.isHub) {
                this.sendReady();
            }

            while (this.messageQueue.length > 0) {
                const { topic, type, payload } = this.messageQueue.shift();
                this.send(topic, type, payload);
            }

            if (this.hooks.onReady) this.hooks.onReady(this);
            this._log('info', 'Ready');
        }

        _setupPostMessage() {
            window.addEventListener('message', (event) => {
                this._handleMessage(event.data, {
                    source: event.source,
                    origin: event.origin
                });
            });
        }

        _setupDOMEvents() {
            const handleAction = (e) => {
                const el = e.target.closest('[data-action]');
                if (!el) return;

                const action = el.dataset.action;
                const handler = this._actions.get(action);

                if (handler) {
                    e.preventDefault();
                    handler(el, el.dataset, e);
                }
            };

            document.addEventListener('click', handleAction);
            document.addEventListener('change', handleAction);
            document.addEventListener('submit', handleAction);
        }

        /**
         * Register a DOM action handler
         * Usage: Terrain.action('toggle-logs', (el, data) => { ... })
         * HTML:  <button data-action="toggle-logs" data-service="foo">
         *
         * @param {string} name - Action name (matches data-action="name")
         * @param {function} handler - Handler(element, dataset, event)
         */
        action(name, handler) {
            this._actions.set(name, handler);
            this._log('debug', `Registered action: ${name}`);
            return this;
        }

        // =====================================================================
        // Message Handling
        // =====================================================================

        _handleMessage(data, context) {
            if (!data || typeof data !== 'object') return;

            const packet = this._normalize(data, context);
            if (!packet) return;

            this._log('debug', '← Received', packet.topic, packet);

            if (this.hooks.onMessage) {
                this.hooks.onMessage(packet);
            }

            // Hub mode: route to other iframes
            if (this.isHub && context.source) {
                this._routeAsHub(packet, context);
            }

            this._dispatch(packet);
        }

        /**
         * Normalize message to standard format
         * If msg has 'topic' field, it's already routable
         * Otherwise, attempt legacy normalization
         */
        _normalize(msg, context = {}) {
            // Already has topic - it's routable
            if (typeof msg.topic === 'string') {
                if (!msg._trace) msg._trace = [];
                msg._trace.push(this.identity);
                return msg;
            }

            // Legacy Terrain: { type: 'ready', from: 'deploy' }
            if (msg.type && msg.from && !msg.source) {
                return {
                    topic: `terrain/panel/${msg.from}/${msg.type}`,
                    type: PacketType.EVENT,
                    payload: msg,
                    source: msg.from,
                    ts: timestamp(),
                    _trace: [msg.from],
                    _legacy: 'terrain'
                };
            }

            // Legacy PJA: { source: 'pja-game', type: '...', data: {} }
            if (msg.source?.startsWith('pja-') && msg.type) {
                const id = msg.data?.iframeId || 'unknown';
                const eventType = msg.type.toLowerCase().replace(/_/g, '-');
                return {
                    topic: `pja/game/${id}/${eventType}`,
                    type: PacketType.EVENT,
                    payload: msg.data || {},
                    source: id,
                    ts: timestamp(),
                    _trace: [id],
                    _legacy: 'pja'
                };
            }

            // Legacy Terrain parent: { source: 'terrain', type: '...' }
            if (msg.source === 'terrain' && msg.type) {
                return {
                    topic: `terrain/system/${msg.type.toLowerCase().replace(/_/g, '-')}`,
                    type: msg.type.includes('change') ? PacketType.COMMAND : PacketType.EVENT,
                    payload: msg,
                    source: 'parent',
                    ts: timestamp(),
                    _trace: ['parent'],
                    _legacy: 'terrain-parent'
                };
            }

            // Game messages: { type: 'game_ready', ... }
            if (msg.type?.match(/^(game_|player_|state_|input_)/)) {
                const gameId = msg.gameId || 'game';
                return {
                    topic: `pja/game/${gameId}/${msg.type}`,
                    type: msg.type.includes('state') ? PacketType.STATE : PacketType.EVENT,
                    payload: msg,
                    source: gameId,
                    ts: timestamp(),
                    _trace: [gameId],
                    _legacy: 'game'
                };
            }

            // Unknown with type - wrap it
            if (msg.type) {
                return {
                    topic: `custom/unknown/${msg.type}`,
                    type: PacketType.EVENT,
                    payload: msg,
                    source: 'unknown',
                    ts: timestamp(),
                    _trace: [],
                    _legacy: 'unknown'
                };
            }

            return null;
        }

        _routeAsHub(packet, context) {
            // Track iframe
            if (context.source && context.source !== window) {
                this.iframes.set(packet.source, context.source);
            }

            // Broadcast to all iframes except sender
            this.iframes.forEach((win, id) => {
                if (win === context.source) return;
                if (!win || win.closed) {
                    this.iframes.delete(id);
                    return;
                }
                try {
                    win.postMessage({
                        ...packet,
                        _trace: [...(packet._trace || []), this.identity]
                    }, '*');
                } catch (e) {
                    this._log('warn', `Failed to route to ${id}`, e);
                }
            });
        }

        _dispatch(packet) {
            this.subscriptions.forEach((handlers, pattern) => {
                if (matchTopic(packet.topic, pattern)) {
                    handlers.forEach(handler => {
                        try {
                            handler(packet);
                        } catch (e) {
                            this._log('error', `Handler error for ${pattern}`, e);
                        }
                    });
                }
            });
        }

        // =====================================================================
        // Sending Messages
        // =====================================================================

        send(topic, type = PacketType.EVENT, payload = {}) {
            const packet = {
                topic,
                type,
                payload,
                source: this.identity,
                ts: timestamp(),
                _trace: [this.identity]
            };

            if (!this.ready) {
                this.messageQueue.push({ topic, type, payload });
                return;
            }

            this._log('debug', '→ Sending', topic, packet);

            if (!this.isHub && window.parent !== window) {
                window.parent.postMessage(packet, '*');
            }

            if (this.isHub) {
                this._dispatch(packet);
            }
        }

        emit(topic, payload = {}) {
            this.send(topic, PacketType.EVENT, payload);
        }

        // =====================================================================
        // Subscriptions
        // =====================================================================

        on(pattern, handler) {
            if (!this.subscriptions.has(pattern)) {
                this.subscriptions.set(pattern, new Set());
            }
            this.subscriptions.get(pattern).add(handler);
            this._log('debug', `Subscribed to ${pattern}`);
            return () => this.off(pattern, handler);
        }

        off(pattern, handler) {
            const handlers = this.subscriptions.get(pattern);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.subscriptions.delete(pattern);
                }
            }
        }

        once(pattern, handler) {
            const wrapper = (pkt) => {
                this.off(pattern, wrapper);
                handler(pkt);
            };
            return this.on(pattern, wrapper);
        }

        // =====================================================================
        // Convenience - Terrain Panels
        // =====================================================================

        sendReady() {
            this.send(`terrain/panel/${this.identity}/ready`, PacketType.EVENT, {
                url: window.location.href,
                title: document.title
            });
        }

        onEnvChange(handler) {
            return this.on('terrain/env/+/+', (pkt) => {
                const [, , org, env] = pkt.topic.split('/');
                handler({ org, env, ...pkt.payload });
            });
        }

        // =====================================================================
        // Hub Mode (Parent Window)
        // =====================================================================

        registerIframe(id, contentWindow) {
            this.iframes.set(id, contentWindow);
            this._log('info', `Registered iframe: ${id}`);
        }

        sendToIframe(id, topic, type, payload = {}) {
            const win = this.iframes.get(id);
            if (!win) {
                this._log('warn', `Iframe not found: ${id}`);
                return;
            }

            win.postMessage({
                topic,
                type,
                payload,
                source: this.identity,
                ts: timestamp(),
                _trace: [this.identity]
            }, '*');
        }

        broadcast(topic, type, payload = {}) {
            const packet = {
                topic,
                type,
                payload,
                source: this.identity,
                ts: timestamp(),
                _trace: [this.identity]
            };

            this.iframes.forEach((win, id) => {
                if (!win || win.closed) {
                    this.iframes.delete(id);
                    return;
                }
                try {
                    win.postMessage(packet, '*');
                } catch (e) {
                    this._log('warn', `Failed to broadcast to ${id}`, e);
                }
            });

            // Also dispatch locally
            this._dispatch(packet);
        }

        setEnvironment(org, env, user) {
            this.broadcast(`terrain/env/${org}/${env}`, PacketType.COMMAND, { org, env, user });
        }

        injectTokens(tokens) {
            this.broadcast('terrain/system/tokens', PacketType.COMMAND, { tokens });
        }

        // =====================================================================
        // Logging
        // =====================================================================

        _log(level, ...args) {
            if (!this.debug && level === 'debug') return;
            const prefix = `[Terrain:${this.identity}]`;
            switch (level) {
                case 'error': console.error(prefix, ...args); break;
                case 'warn': console.warn(prefix, ...args); break;
                case 'info': console.log(prefix, ...args); break;
                case 'debug': console.debug(prefix, ...args); break;
            }
        }

        // =====================================================================
        // Cleanup
        // =====================================================================

        destroy() {
            this.subscriptions.clear();
            this.iframes.clear();
            this.initialized = false;
            this.ready = false;
        }
    }

    // =========================================================================
    // Global Instance
    // =========================================================================

    const Terrain = new TerrainSDK();
    Terrain.PacketType = PacketType;
    Terrain.VERSION = VERSION;

    // Expose globally
    global.Terrain = Terrain;

    // Auto-initialize in simple mode
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!Terrain.initialized) {
                Terrain.init();
            }
        });
    } else {
        setTimeout(() => {
            if (!Terrain.initialized) {
                Terrain.init();
            }
        }, 0);
    }

})(typeof window !== 'undefined' ? window : global);
