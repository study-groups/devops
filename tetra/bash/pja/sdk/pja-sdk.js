/**
 * PJA SDK v1.0.0 - PixelJam Arcade Software Development Kit
 *
 * Unified namespace for game development within PJA ecosystem.
 * Source: ~/src/devops/tetra/bash/pja/sdk/pja-sdk.js
 *
 * Components:
 *   PJA.RT     - API-RT: Realtime Host<->Client iframe messaging
 *   PJA.Game   - Game API: Standard game controls (start, stop, pause, paddle 1-4)
 *   PJA.MP     - API-MP: Multiplayer/Server protocol (OSC-style)
 *   PJA.Deck   - ControlDeck integration (BroadcastChannel)
 *   PJA.Theme  - CSS variable/theme token communication
 *   PJA.Input  - Standard input mappings (gamepad, MIDI, keyboard)
 *
 * OSC Address Conventions (API-MP):
 *   /game/{gameId}/state                    - Game state changes
 *   /game/{gameId}/player/{n}/paddle        - Paddle position (0.0-1.0)
 *   /game/{gameId}/player/{n}/action        - Player action (start, pause, etc)
 *   /game/{gameId}/ball                     - Ball state [x, y, vx, vy]
 *   /game/{gameId}/score                    - Score update [p1, p2, p3, p4]
 *   /lobby/player/join                      - Join lobby
 *   /lobby/query                            - Query server status
 *   /lobby/stats                            - Server statistics
 *
 * Usage (in iframe channel):
 *   <script src="../../pja-sdk.js"></script>
 *   <script>
 *     PJA.RT.on('init', (data) => console.log('Channel ready'));
 *     PJA.Game.on('paddle', (n, value) => movePaddle(n, value));
 *     PJA.Game.on('start', () => startGame());
 *   </script>
 */

(function(global) {
    'use strict';

    const VERSION = '1.0.0';

    // ========================================================================
    // SHARED: Event Emitter Base
    // ========================================================================
    class EventEmitter {
        constructor() { this._handlers = {}; }
        on(event, fn) {
            (this._handlers[event] = this._handlers[event] || []).push(fn);
            return this;
        }
        off(event, fn) {
            if (this._handlers[event]) {
                this._handlers[event] = fn
                    ? this._handlers[event].filter(f => f !== fn)
                    : [];
            }
            return this;
        }
        emit(event, ...args) {
            (this._handlers[event] || []).forEach(fn => {
                try { fn(...args); } catch(e) { console.error('[PJA] Handler error:', e); }
            });
            return this;
        }
    }

    // ========================================================================
    // Input Mappings (from ansicab SDK)
    // ========================================================================
    const Input = {
        GAMEPAD_BUTTONS: {
            'A': 0, 'B': 1, 'X': 2, 'Y': 3,
            'L1': 4, 'R1': 5, 'L2': 6, 'R2': 7,
            'SELECT': 8, 'START': 9,
            'L3': 10, 'R3': 11,
            'UP': 12, 'DOWN': 13, 'LEFT': 14, 'RIGHT': 15
        },
        GAMEPAD_AXES: {
            'LEFT_X': 0, 'LEFT_Y': 1, 'RIGHT_X': 2, 'RIGHT_Y': 3
        },
        MIDI_CHANNELS: {
            0: 'player1', 1: 'player2', 2: 'player3', 3: 'player4',
            9: 'drums', 15: 'system'
        },
        MIDI_CC: {
            1: 'MOD_WHEEL', 7: 'VOLUME', 10: 'PAN', 64: 'SUSTAIN',
            20: 'ACTION_1', 21: 'ACTION_2',
            22: 'MOVE_X', 23: 'MOVE_Y', 24: 'AIM_X', 25: 'AIM_Y'
        },
        KEYBOARD_ZONES: {
            player1: {
                up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
                action1: 'KeyQ', action2: 'KeyE', action3: 'Space'
            },
            player2: {
                up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
                action1: 'Comma', action2: 'Period', action3: 'Slash'
            },
            player3: {
                up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL',
                action1: 'KeyU', action2: 'KeyO', action3: 'KeyP'
            },
            player4: {
                up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6',
                action1: 'Numpad7', action2: 'Numpad9', action3: 'Numpad0'
            }
        }
    };

    // ========================================================================
    // API-RT: Realtime Host <-> Client (iframe postMessage)
    // ========================================================================
    const RT = new EventEmitter();

    Object.assign(RT, {
        channel: null,
        name: null,
        ready: false,
        host: null,  // Reference to parent window

        /**
         * Send message to host (Plenith TV)
         */
        send(type, data = {}) {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    source: 'pja-client',
                    type,
                    channel: this.channel,
                    timestamp: performance.now(),
                    ...data
                }, '*');
            }
            return this;
        },

        /**
         * Request channel change
         */
        changeChannel(channel) {
            return this.send('channel:change', { target: channel });
        },

        /**
         * Send game state to host (for display/sync)
         */
        sendState(state) {
            return this.send('game:state', { state });
        },

        /**
         * Send score update
         */
        sendScore(scores) {
            return this.send('game:score', { scores });
        },

        /**
         * Log to host console
         */
        log(...args) {
            this.send('log', { message: args });
            console.log('[PJA.RT]', ...args);
            return this;
        },

        /**
         * Query host for information
         */
        query(key) {
            return this.send('query', { key });
        },

        /**
         * Volume control (0.0 - 1.0)
         */
        setVolume(volume) {
            return this.send('audio:volume', { volume: Math.max(0, Math.min(1, volume)) });
        },

        /**
         * Mute control
         */
        setMute(muted) {
            return this.send('audio:mute', { muted: !!muted });
        },

        /**
         * Initialize - called automatically
         */
        _init() {
            window.addEventListener('message', (event) => {
                const data = event.data;

                // Accept messages from pja-host or plenith-tv (backwards compat)
                if (!data || (data.source !== 'pja-host' && data.source !== 'plenith-tv')) {
                    return;
                }

                const { type, ...rest } = data;

                // Handle Plenith TV init format
                if (type === 'channel-init') {
                    this.channel = rest.channel;
                    this.name = rest.name;
                    this.ready = true;
                    this.emit('init', rest);
                } else if (type === 'init') {
                    this.channel = rest.channel;
                    this.name = rest.name;
                    this.ready = true;
                    this.emit('init', rest);
                } else if (type === 'game:control') {
                    // Forward to Game API
                    Game._handleControl(rest);
                } else {
                    this.emit(type, rest);
                    this.emit('message', data);
                }
            });

            // Notify host we're ready (both formats)
            this.send('client:loaded');
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    source: 'plenith-channel',
                    type: 'channel-loaded'
                }, '*');
            }
        }
    });

    // ========================================================================
    // GAME API: Standard game controls
    // ========================================================================
    const Game = new EventEmitter();

    Object.assign(Game, {
        state: 'idle',  // idle, playing, paused, ended
        players: 4,     // Max supported players
        paddles: [0.5, 0.5, 0.5, 0.5],  // Paddle positions (0.0-1.0)
        score: [0, 0, 0, 0],
        config: {},

        /**
         * Start game
         */
        start() {
            if (this.state === 'idle' || this.state === 'ended') {
                this.state = 'playing';
                this.emit('start');
                RT.send('game:start');
            }
            return this;
        },

        /**
         * Stop game (reset to idle)
         */
        stop() {
            this.state = 'idle';
            this.score = [0, 0, 0, 0];
            this.emit('stop');
            RT.send('game:stop');
            return this;
        },

        /**
         * Pause game
         */
        pause() {
            if (this.state === 'playing') {
                this.state = 'paused';
                this.emit('pause');
                RT.send('game:pause');
            }
            return this;
        },

        /**
         * Resume game
         */
        resume() {
            if (this.state === 'paused') {
                this.state = 'playing';
                this.emit('resume');
                RT.send('game:resume');
            }
            return this;
        },

        /**
         * Toggle pause
         */
        togglePause() {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
            else if (this.state === 'idle' || this.state === 'ended') this.start();
            return this;
        },

        /**
         * Set paddle position
         * @param {number} player - Player number (1-4)
         * @param {number} value - Position (0.0-1.0) or axis value (-1 to 1)
         */
        setPaddle(player, value) {
            if (player < 1 || player > 4) return this;
            // Normalize: if value is -1 to 1 (axis), convert to 0-1
            const normalized = value >= -1 && value <= 1 && (value < 0 || value > 1)
                ? (value + 1) / 2
                : Math.max(0, Math.min(1, value));
            this.paddles[player - 1] = normalized;
            this.emit('paddle', player, normalized);
            return this;
        },

        /**
         * Move paddle by delta
         */
        movePaddle(player, delta) {
            if (player < 1 || player > 4) return this;
            const newVal = Math.max(0, Math.min(1, this.paddles[player - 1] + delta));
            return this.setPaddle(player, newVal);
        },

        /**
         * Update score
         */
        setScore(player, score) {
            if (player < 1 || player > 4) return this;
            this.score[player - 1] = score;
            this.emit('score', player, score);
            RT.sendScore(this.score);
            return this;
        },

        /**
         * Add points
         */
        addScore(player, points = 1) {
            return this.setScore(player, this.score[player - 1] + points);
        },

        /**
         * End game
         */
        end(winner = null) {
            this.state = 'ended';
            this.emit('end', winner);
            RT.send('game:end', { winner, scores: this.score });
            return this;
        },

        /**
         * Handle control message from host
         */
        _handleControl(data) {
            switch (data.action) {
                case 'start': this.start(); break;
                case 'stop': this.stop(); break;
                case 'reset':
                    // Reset game to initial state and restart
                    this.stop();
                    this.start();
                    break;
                case 'pause': this.pause(); break;
                case 'resume': this.resume(); break;
                case 'toggle': this.togglePause(); break;
                case 'paddle':
                    if (data.player && data.value !== undefined) {
                        this.setPaddle(data.player, data.value);
                    }
                    break;
            }
        }
    });

    // ========================================================================
    // API-MP: Multiplayer Server Protocol (OSC-style)
    // ========================================================================
    const MP = new EventEmitter();

    Object.assign(MP, {
        connected: false,
        socket: null,
        playerId: null,
        serverUrl: null,
        reconnectAttempts: 0,
        maxReconnects: 5,

        /**
         * OSC Address builder
         */
        addr: {
            // Game addresses
            gameState: (gameId) => `/game/${gameId}/state`,
            paddle: (gameId, player) => `/game/${gameId}/player/${player}/paddle`,
            action: (gameId, player) => `/game/${gameId}/player/${player}/action`,
            ball: (gameId) => `/game/${gameId}/ball`,
            score: (gameId) => `/game/${gameId}/score`,

            // Lobby addresses
            playerJoin: '/lobby/player/join',
            playerLeave: '/lobby/player/leave',
            queueJoin: '/lobby/queue/join',
            queueLeave: '/lobby/queue/leave',
            query: '/lobby/query',
            stats: '/lobby/stats',
            status: '/lobby/status',

            // Audio
            volume: '/audio/volume',
            mute: '/audio/mute'
        },

        /**
         * Build OSC message
         */
        msg(address, ...args) {
            return {
                address,
                args: args.map(a => {
                    if (typeof a === 'number') return { type: 'f', value: a };
                    if (typeof a === 'string') return { type: 's', value: a };
                    if (typeof a === 'boolean') return { type: 'i', value: a ? 1 : 0 };
                    return { type: 's', value: String(a) };
                }),
                timestamp: Date.now()
            };
        },

        /**
         * Connect to multiplayer server
         */
        connect(url) {
            if (typeof WebSocket === 'undefined') {
                console.error('[PJA.MP] WebSocket not available');
                this.emit('error', { code: 'NO_WEBSOCKET', message: 'WebSocket not supported' });
                return this;
            }

            this.serverUrl = url;
            try {
                this.socket = new WebSocket(url);

                this.socket.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.emit('connected');
                    // Send initial query
                    this.query();
                };

                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this._handleMessage(data);
                    } catch (e) {
                        console.error('[PJA.MP] Parse error:', e);
                    }
                };

                this.socket.onclose = () => {
                    this.connected = false;
                    this.emit('disconnected');
                    this._attemptReconnect();
                };

                this.socket.onerror = (err) => {
                    this.emit('error', { code: 'WS_ERROR', message: err.message || 'Connection error' });
                };
            } catch (e) {
                this.emit('error', { code: 'CONNECT_FAILED', message: e.message });
            }
            return this;
        },

        /**
         * Disconnect from server
         */
        disconnect() {
            if (this.socket) {
                this.socket.close();
                this.socket = null;
            }
            this.connected = false;
            return this;
        },

        /**
         * Send OSC message to server
         */
        send(address, ...args) {
            if (!this.connected || !this.socket) {
                this.emit('error', { code: 'NOT_CONNECTED', message: 'Not connected to server' });
                return this;
            }
            const msg = this.msg(address, ...args);
            this.socket.send(JSON.stringify(msg));
            return this;
        },

        /**
         * Join lobby
         */
        join(name, color = '#FFFFFF') {
            return this.send(this.addr.playerJoin, name, color);
        },

        /**
         * Leave lobby
         */
        leave() {
            return this.send(this.addr.playerLeave, this.playerId || '');
        },

        /**
         * Join game queue
         */
        queueJoin(gameType) {
            return this.send(this.addr.queueJoin, this.playerId || '', gameType);
        },

        /**
         * Query server status
         */
        query() {
            return this.send(this.addr.query);
        },

        /**
         * Get server stats
         */
        stats() {
            return this.send(this.addr.stats);
        },

        /**
         * Send paddle position
         */
        sendPaddle(gameId, player, value) {
            return this.send(this.addr.paddle(gameId, player), value);
        },

        /**
         * Send player action
         */
        sendAction(gameId, player, action) {
            return this.send(this.addr.action(gameId, player), action);
        },

        /**
         * Set volume (0.0-1.0)
         */
        setVolume(volume) {
            return this.send(this.addr.volume, Math.max(0, Math.min(1, volume)));
        },

        /**
         * Set mute
         */
        setMute(muted) {
            return this.send(this.addr.mute, muted ? 1 : 0);
        },

        /**
         * Handle incoming message
         */
        _handleMessage(data) {
            this.emit('message', data);

            // Parse OSC address
            if (data.address) {
                const parts = data.address.split('/').filter(Boolean);
                const args = (data.args || []).map(a => a.value);

                // Lobby responses
                if (parts[0] === 'lobby') {
                    if (parts[1] === 'player' && parts[2] === 'joined') {
                        this.playerId = args[0];
                        this.emit('joined', { playerId: args[0] });
                    } else if (parts[1] === 'status') {
                        this.emit('status', {
                            players: args[0],
                            matches: args[1],
                            uptime: args[2]
                        });
                    } else if (parts[1] === 'stats') {
                        this.emit('stats', data);
                    } else if (parts[1] === 'error') {
                        this.emit('error', { code: args[0], message: args[1] });
                    }
                }

                // Game messages
                if (parts[0] === 'game') {
                    const gameId = parts[1];
                    if (parts[2] === 'state') {
                        this.emit('game:state', { gameId, state: args[0] });
                    } else if (parts[2] === 'player') {
                        const player = parseInt(parts[3]);
                        if (parts[4] === 'paddle') {
                            this.emit('game:paddle', { gameId, player, value: args[0] });
                            Game.setPaddle(player, args[0]);
                        } else if (parts[4] === 'action') {
                            this.emit('game:action', { gameId, player, action: args[0] });
                        }
                    } else if (parts[2] === 'ball') {
                        this.emit('game:ball', { gameId, x: args[0], y: args[1], vx: args[2], vy: args[3] });
                    } else if (parts[2] === 'score') {
                        this.emit('game:score', { gameId, scores: args });
                    }
                }
            }
        },

        /**
         * Attempt reconnection
         */
        _attemptReconnect() {
            if (this.reconnectAttempts >= this.maxReconnects) {
                this.emit('error', { code: 'MAX_RECONNECTS', message: 'Max reconnection attempts reached' });
                return;
            }
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            setTimeout(() => {
                if (!this.connected && this.serverUrl) {
                    this.connect(this.serverUrl);
                }
            }, delay);
        },

        /**
         * Get API schema (for offline display)
         */
        getSchema() {
            return {
                version: VERSION,
                protocol: 'PJA API-MP (OSC-style)',
                addresses: {
                    lobby: {
                        '/lobby/player/join': { args: ['name:s', 'color:s'], desc: 'Join lobby' },
                        '/lobby/player/leave': { args: ['playerId:s'], desc: 'Leave lobby' },
                        '/lobby/queue/join': { args: ['playerId:s', 'gameType:s'], desc: 'Join game queue' },
                        '/lobby/queue/leave': { args: ['playerId:s'], desc: 'Leave queue' },
                        '/lobby/query': { args: [], desc: 'Query server status' },
                        '/lobby/stats': { args: [], desc: 'Get detailed statistics' },
                        '/lobby/status': { args: [], desc: 'Get lobby status' }
                    },
                    game: {
                        '/game/{id}/state': { args: ['state:s'], desc: 'Game state (idle|playing|paused|ended)' },
                        '/game/{id}/player/{n}/paddle': { args: ['value:f'], desc: 'Paddle position 0.0-1.0' },
                        '/game/{id}/player/{n}/action': { args: ['action:s'], desc: 'Player action' },
                        '/game/{id}/ball': { args: ['x:f', 'y:f', 'vx:f', 'vy:f'], desc: 'Ball state' },
                        '/game/{id}/score': { args: ['p1:i', 'p2:i', 'p3:i', 'p4:i'], desc: 'Scores' }
                    },
                    audio: {
                        '/audio/volume': { args: ['level:f'], desc: 'Volume 0.0-1.0' },
                        '/audio/mute': { args: ['muted:i'], desc: 'Mute (0|1)' }
                    }
                },
                types: {
                    's': 'string',
                    'f': 'float32',
                    'i': 'int32'
                }
            };
        }
    });

    // ========================================================================
    // DECK: ControlDeck Integration (BroadcastChannel)
    // ========================================================================
    const Deck = new EventEmitter();

    Object.assign(Deck, {
        channel: null,
        stateChannel: null,
        connected: false,
        channelName: 'pong',
        acceptInput: false,  // Delay accepting input to prevent stale messages

        // Store latest axis values for continuous reading
        axes: [0, 0, 0, 0],  // [left-x, left-y, right-x, right-y]
        buttons: {},

        /**
         * Initialize ControlDeck integration
         */
        init(channelName = 'pong') {
            if (typeof BroadcastChannel === 'undefined') {
                console.warn('[PJA.Deck] BroadcastChannel not supported');
                return this;
            }

            this.channelName = channelName;

            // Receive input from ControlDeck
            this.channel = new BroadcastChannel(`controldeck-${channelName}`);
            this.channel.onmessage = (e) => this._handleInput(e.data);

            // Send state to ControlDeck (for AI)
            this.stateChannel = new BroadcastChannel(`controldeck-${channelName}-state`);

            this.connected = true;
            this.emit('connected');

            // Delay accepting input to prevent stale BroadcastChannel messages
            // from auto-starting games on page load
            setTimeout(() => {
                this.acceptInput = true;
            }, 500);

            return this;
        },

        /**
         * Send game state to ControlDeck AI
         */
        sendState(state) {
            if (this.stateChannel) {
                this.stateChannel.postMessage({
                    type: 'gamestate',
                    ...state,
                    timestamp: performance.now()
                });
            }
            return this;
        },

        /**
         * Handle input from ControlDeck
         */
        _handleInput(data) {
            if (data._src !== 'controldeck') {
                return;
            }

            // Ignore input until ready (prevents stale messages from auto-starting)
            if (!this.acceptInput) {
                return;
            }

            this.emit('input', data);

            // Route to Game API
            if (data.type === 'trigger') {
                // Only trigger on button PRESS, not release
                if (data.control === 'start' && data.pressed) {
                    Game.togglePause();
                }
                this.buttons[data.control] = data.pressed;
                this.emit('button', data.control, data.pressed);
            } else if (data.type === 'continuous') {
                // Get axis value (-1 to 1)
                const axisValue = data.raw?.value ?? ((data.value * 2) - 1);

                // Store axis values for polling by game loop
                const axisIndexMap = {
                    'left-x': 0, 'left-y': 1,
                    'right-x': 2, 'right-y': 3
                };
                const axisIdx = axisIndexMap[data.control];
                if (axisIdx !== undefined) {
                    this.axes[axisIdx] = axisValue;
                }

                // NOTE: We do NOT directly move paddles here.
                // The game should poll getAxis() in its game loop for smooth control.
                // This prevents double-processing and gives the game control over timing.

                this.emit('axis', data.control, axisValue);
            }
        },

        /**
         * Get current axis value (for polling in game loop)
         */
        getAxis(name) {
            const map = { 'left-x': 0, 'left-y': 1, 'right-x': 2, 'right-y': 3 };
            return this.axes[map[name]] || 0;
        },

        /**
         * Check if button is pressed
         */
        isPressed(name) {
            return !!this.buttons[name];
        },

        /**
         * Disconnect
         */
        disconnect() {
            if (this.channel) {
                this.channel.close();
                this.channel = null;
            }
            if (this.stateChannel) {
                this.stateChannel.close();
                this.stateChannel = null;
            }
            this.connected = false;
            return this;
        }
    });

    // ========================================================================
    // THEME: CSS Variable Communication (TUT-compatible)
    // ========================================================================
    const Theme = new EventEmitter();

    Object.assign(Theme, {
        protocol: 'tut-1.0',
        tokens: {},
        ready: false,

        // Default tokens (TUT FAB compatible)
        defaults: {
            '--bg-primary': '#1a1a2e',
            '--bg-secondary': '#16213e',
            '--bg-tertiary': '#0d1b2a',
            '--bg-hover': '#2a2a4a',
            '--text-title': '#eaeaea',
            '--text-primary': '#c0c0d0',
            '--text-secondary': '#8a8aa0',
            '--text-code': '#ff6b6b',
            '--accent-primary': '#e94560',
            '--accent-secondary': '#3b82c4',
            '--success': '#4ade80',
            '--warning': '#fbbf24',
            '--error': '#f87171',
            '--border': '#2a2a4a',
            '--border-visible': '#3a3a5a',
            '--border-active': '#3b82c4',
            '--highlight': 'rgba(233, 69, 96, 0.15)'
        },

        /**
         * Get a CSS variable value
         */
        get(name) {
            const cssVar = name.startsWith('--') ? name : `--${name}`;
            return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || this.tokens[cssVar];
        },

        /**
         * Set a CSS variable
         */
        set(name, value) {
            const cssVar = name.startsWith('--') ? name : `--${name}`;
            document.documentElement.style.setProperty(cssVar, value);
            this.tokens[cssVar] = value;
            this.emit('change', { name: cssVar, value });
            return this;
        },

        /**
         * Set multiple tokens at once
         */
        setAll(tokens) {
            Object.entries(tokens).forEach(([name, value]) => this.set(name, value));
            this.emit('update', { tokens });
            return this;
        },

        /**
         * Get all current tokens
         */
        getAll() {
            const result = {};
            Object.keys(this.defaults).forEach(cssVar => {
                result[cssVar] = this.get(cssVar);
            });
            return result;
        },

        /**
         * Apply a TUT theme object
         */
        applyTheme(theme) {
            if (!theme?.tokens) {
                console.warn('[PJA.Theme] Invalid theme object');
                return false;
            }
            Object.entries(theme.tokens).forEach(([tokenId, tokenData]) => {
                const cssVar = tokenData.css || tokenData.cssVar || `--${tokenId}`;
                const value = tokenData.value || tokenData;
                this.set(cssVar, value);
            });
            this.emit('theme:apply', theme);
            return true;
        },

        /**
         * Reset to defaults
         */
        reset() {
            Object.entries(this.defaults).forEach(([name, value]) => this.set(name, value));
            this.emit('reset');
            return this;
        },

        /**
         * Request theme from parent (for iframes)
         */
        requestFromParent() {
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'TUT_REQUEST_THEME', source: 'pja-client' }, '*');
            }
            return this;
        },

        /**
         * Send current theme to iframe
         */
        sendToFrame(iframe) {
            if (!iframe?.contentWindow) return this;
            iframe.contentWindow.postMessage({
                type: 'TUT_APPLY_TOKENS',
                tokens: this.getAll()
            }, '*');
            return this;
        },

        /**
         * Broadcast tokens via BroadcastChannel
         */
        broadcast(channelName = 'pja-theme') {
            if (typeof BroadcastChannel === 'undefined') return this;
            const bc = new BroadcastChannel(channelName);
            bc.postMessage({ type: 'tokens', tokens: this.getAll(), timestamp: performance.now() });
            bc.close();
            return this;
        },

        /**
         * Listen for theme updates on BroadcastChannel
         */
        listen(channelName = 'pja-theme') {
            if (typeof BroadcastChannel === 'undefined') return this;
            const bc = new BroadcastChannel(channelName);
            bc.onmessage = (e) => {
                if (e.data?.type === 'tokens' && e.data.tokens) {
                    this.setAll(e.data.tokens);
                }
            };
            return this;
        },

        /**
         * Initialize - listen for TUT messages
         */
        _init() {
            window.addEventListener('message', (e) => {
                if (e.data?.type === 'TUT_APPLY_THEME' && e.data.theme) {
                    this.applyTheme(e.data.theme);
                }
                if (e.data?.type === 'TUT_APPLY_TOKENS' && e.data.tokens) {
                    this.setAll(e.data.tokens);
                }
            });
            this.ready = true;
            this.emit('ready');
        }
    });

    // ========================================================================
    // PJA NAMESPACE
    // ========================================================================
    const PJA = {
        version: VERSION,
        RT,      // API-RT: Realtime iframe messaging
        Game,    // Game API: Standard game controls
        MP,      // API-MP: Multiplayer server protocol
        Deck,    // ControlDeck integration
        Theme,   // CSS Variable / TUT theme communication
        Input,   // Standard input mappings (gamepad, MIDI, keyboard)

        // Callback-style API (Cabinet SDK compatibility)
        // These wire into PJA.Game event emitter via init()
        onStart: null,
        onStop: null,
        onPause: null,
        onResume: null,
        onVolumeChange: null,

        /**
         * Quick setup for common use case
         */
        init(options = {}) {
            const {
                deck = true,
                deckChannel = 'pong',
                server = null,
                theme = true,
                themeChannel = 'pja-theme'
            } = options;

            // Always init RT (iframe comms)
            RT._init();

            // Wire callback properties to Game events (Cabinet SDK compatibility)
            Game.on('start', () => this.onStart?.());
            Game.on('stop', () => this.onStop?.());
            Game.on('pause', () => this.onPause?.());
            Game.on('resume', () => this.onResume?.());

            // Wire volume callback to RT events
            RT.on('audio:volume', (data) => {
                this.onVolumeChange?.(data.volume, data.muted ?? false);
            });

            // Theme/CSS variable communication
            if (theme) {
                Theme._init();
                Theme.listen(themeChannel);
            }

            // ControlDeck integration
            if (deck) {
                Deck.init(deckChannel);
            }

            // Multiplayer server
            if (server) {
                MP.connect(server);
            }

            console.log(`[PJA] SDK v${VERSION} initialized`);
            return this;
        }
    };

    // Auto-initialize RT when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => RT._init());
    } else {
        RT._init();
    }

    // Export
    global.PJA = PJA;

})(typeof window !== 'undefined' ? window : this);
