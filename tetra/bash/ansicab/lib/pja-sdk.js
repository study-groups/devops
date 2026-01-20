/**
 * PJA-SDK: PixelJam Arcade SDK for Cabinet
 *
 * @deprecated Use pja/sdk/pja-sdk.js instead.
 * This Cabinet-specific SDK is maintained for backward compatibility.
 * The unified PJA SDK supports both callback and event emitter styles.
 *
 * This SDK is automatically injected into game iframes by Cabinet.
 * Game developers use the `window.PJA` global to interact with Cabinet.
 *
 * @version 1.0.0
 */

'use strict';

(function() {
    // Prevent double initialization
    if (window.PJA && window.PJA._initialized) return;

    // =========================================================================
    // Standard Input Mappings
    // =========================================================================

    const GAMEPAD_BUTTONS = {
        'A': 0, 'B': 1, 'X': 2, 'Y': 3,
        'L1': 4, 'R1': 5, 'L2': 6, 'R2': 7,
        'SELECT': 8, 'START': 9,
        'L3': 10, 'R3': 11,
        'UP': 12, 'DOWN': 13, 'LEFT': 14, 'RIGHT': 15
    };

    const GAMEPAD_AXES = {
        'LEFT_X': 0, 'LEFT_Y': 1, 'RIGHT_X': 2, 'RIGHT_Y': 3
    };

    const MIDI_CHANNELS = {
        0: 'player1', 1: 'player2', 2: 'player3', 3: 'player4',
        9: 'drums', 15: 'system'
    };

    const MIDI_CC = {
        1: 'MOD_WHEEL', 7: 'VOLUME', 10: 'PAN', 64: 'SUSTAIN',
        20: 'ACTION_1', 21: 'ACTION_2',
        22: 'MOVE_X', 23: 'MOVE_Y', 24: 'AIM_X', 25: 'AIM_Y'
    };

    const KEYBOARD_ZONES = {
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
    };

    // =========================================================================
    // PJA Global Object
    // =========================================================================

    window.PJA = {
        // Version
        version: '1.0.0',

        // Initialization state
        _initialized: false,
        _parentOrigin: '*',  // Configure for production

        // Input mappings (exported for game use)
        GAMEPAD_BUTTONS,
        GAMEPAD_AXES,
        MIDI_CHANNELS,
        MIDI_CC,
        KEYBOARD_ZONES,

        // =====================================================================
        // Lifecycle Callbacks (game implements these)
        // =====================================================================
        onStart: null,           // (players, settings) => void
        onStop: null,            // (reason) => void
        onPause: null,           // () => void
        onResume: null,          // () => void

        // =====================================================================
        // Volume Callbacks
        // =====================================================================
        onVolumeChange: null,    // (level, muted) => void

        // =====================================================================
        // Input Callbacks (when parent captures input)
        // =====================================================================
        onGamepad: null,         // (player, button, pressed) => void
        onGamepadAxis: null,     // (player, axis, value) => void
        onMidiCC: null,          // (channel, cc, value) => void
        onKey: null,             // (key, pressed, player) => void

        // =====================================================================
        // Style/Display Callbacks
        // =====================================================================
        onStyleUpdate: null,     // (css) => void
        onFullscreenChange: null,// (isFullscreen) => void

        // =====================================================================
        // Developer Mode Callback
        // =====================================================================
        onDevMode: null,         // (enabled, captureInput) => void

        // =====================================================================
        // Methods Game Can Call
        // =====================================================================

        /**
         * Signal that game is loaded and ready to start
         */
        ready() {
            this._send('PJA_READY');
        },

        /**
         * Signal game has started
         */
        started() {
            this._send('PJA_STARTED');
        },

        /**
         * Signal game is paused
         */
        paused() {
            this._send('PJA_PAUSED');
        },

        /**
         * Signal game has resumed
         */
        resumed() {
            this._send('PJA_RESUMED');
        },

        /**
         * Signal game over with scores
         * @param {Array} scores - Array of {player, score} objects
         * @param {string} winner - Winner player ID (e.g., 'p1')
         */
        gameOver(scores, winner) {
            this._send('PJA_GAME_OVER', { scores, winner });
        },

        /**
         * Report an error
         * @param {string} code - Error code
         * @param {string} message - Error message
         */
        error(code, message) {
            this._send('PJA_ERROR', { code, message });
        },

        /**
         * Request input focus (game wants to capture input directly)
         */
        requestInputFocus() {
            this._send('PJA_REQUEST_INPUT_FOCUS');
        },

        /**
         * Release input focus back to parent
         */
        releaseInputFocus() {
            this._send('PJA_RELEASE_INPUT_FOCUS');
        },

        /**
         * Set volume level
         * @param {number} level - Volume 0.0 to 1.0
         */
        setVolume(level) {
            this._send('PJA_VOLUME_CHANGED', { level, muted: level === 0 });
        },

        /**
         * Request fullscreen mode
         */
        enterFullscreen() {
            this._send('PJA_FULLSCREEN_ENTERED');
            // Also try native fullscreen
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
        },

        /**
         * Exit fullscreen mode
         */
        exitFullscreen() {
            this._send('PJA_FULLSCREEN_EXITED');
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        },

        /**
         * Report current scores
         * @param {Array} scores - Array of {player, score} objects
         * @param {number} highScore - High score
         */
        reportScores(scores, highScore) {
            this._send('PJA_SCORES', { scores, highScore });
        },

        /**
         * Report current game state
         * @param {Object} state - Game state object
         */
        reportState(state) {
            this._send('PJA_STATE', { state });
        },

        // =====================================================================
        // Internal Methods
        // =====================================================================

        /**
         * Send message to parent (Cabinet)
         */
        _send(type, payload = {}) {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type,
                    payload,
                    source: 'pja-sdk',
                    timestamp: Date.now()
                }, this._parentOrigin);
            }
        },

        /**
         * Handle incoming message from parent
         */
        _handleMessage(event) {
            // Validate message structure
            if (!event.data || !event.data.type) return;
            if (!event.data.type.startsWith('PJA_')) return;

            const { type, payload } = event.data;

            switch (type) {
                // Lifecycle
                case 'PJA_START_GAME':
                    if (this.onStart) this.onStart(payload.players, payload.settings);
                    break;
                case 'PJA_STOP_GAME':
                    if (this.onStop) this.onStop(payload.reason);
                    break;
                case 'PJA_PAUSE_GAME':
                    if (this.onPause) this.onPause();
                    break;
                case 'PJA_RESUME_GAME':
                    if (this.onResume) this.onResume();
                    break;

                // Volume
                case 'PJA_VOLUME_UP':
                case 'PJA_VOLUME_DOWN':
                case 'PJA_VOLUME_SET':
                case 'PJA_VOLUME_MUTE':
                case 'PJA_VOLUME_UNMUTE':
                    if (this.onVolumeChange) {
                        const level = payload?.level ?? (type === 'PJA_VOLUME_MUTE' ? 0 : 1);
                        const muted = type === 'PJA_VOLUME_MUTE';
                        this.onVolumeChange(level, muted);
                    }
                    break;

                // Input
                case 'PJA_GAMEPAD':
                    if (this.onGamepad) {
                        this.onGamepad(payload.player, payload.button, payload.pressed);
                    }
                    break;
                case 'PJA_GAMEPAD_AXIS':
                    if (this.onGamepadAxis) {
                        this.onGamepadAxis(payload.player, payload.axis, payload.value);
                    }
                    break;
                case 'PJA_MIDI_CC':
                    if (this.onMidiCC) {
                        this.onMidiCC(payload.channel, payload.cc, payload.value);
                    }
                    break;
                case 'PJA_KEY':
                    if (this.onKey) {
                        this.onKey(payload.key, payload.pressed, payload.player);
                    }
                    break;

                // Display
                case 'PJA_FULLSCREEN_ENTER':
                    this.enterFullscreen();
                    if (this.onFullscreenChange) this.onFullscreenChange(true);
                    break;
                case 'PJA_FULLSCREEN_EXIT':
                    this.exitFullscreen();
                    if (this.onFullscreenChange) this.onFullscreenChange(false);
                    break;
                case 'PJA_STYLE_UPDATE':
                    if (this.onStyleUpdate) this.onStyleUpdate(payload.css);
                    break;

                // Queries
                case 'PJA_GET_SCORES':
                    // Game should have set onGetScores or call reportScores
                    break;
                case 'PJA_GET_STATE':
                    // Game should call reportState
                    break;

                // Developer mode
                case 'PJA_DEV_MODE':
                    if (this.onDevMode) {
                        this.onDevMode(payload.enabled, payload.captureInput);
                    }
                    break;
            }
        },

        /**
         * Initialize the SDK
         */
        _init() {
            if (this._initialized) return;

            // Listen for messages from parent
            window.addEventListener('message', (e) => this._handleMessage(e));

            // Track fullscreen changes
            document.addEventListener('fullscreenchange', () => {
                const isFullscreen = !!document.fullscreenElement;
                if (this.onFullscreenChange) this.onFullscreenChange(isFullscreen);
                this._send(isFullscreen ? 'PJA_FULLSCREEN_ENTERED' : 'PJA_FULLSCREEN_EXITED');
            });

            this._initialized = true;
            console.log('[PJA-SDK] Initialized v' + this.version);
        }
    };

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => PJA._init());
    } else {
        PJA._init();
    }
})();
