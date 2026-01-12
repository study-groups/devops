/**
 * CabinetHost: Cabinet-side SDK Injector and Bridge
 *
 * This module:
 * 1. Injects PJA-SDK.js into game iframes
 * 2. Handles postMessage communication with games
 * 3. Manages input routing based on capture mode
 * 4. Provides marquee and style injection
 *
 * @version 1.0.0
 */

'use strict';

const CabinetHost = {
    version: '1.0.0',

    // Configuration
    config: {
        captureInput: 'iframe',  // 'iframe' | 'parent'
        devMode: false,
        debug: false
    },

    // Game iframe reference
    gameFrame: null,

    // Game metadata from game.toml (loaded by Cabinet)
    gameMetadata: null,

    // Event handlers
    _handlers: new Map(),

    // =========================================================================
    // Initialization
    // =========================================================================

    /**
     * Initialize TerrainSDK with game iframe
     * @param {HTMLIFrameElement} iframe - The game iframe
     * @param {Object} metadata - Game metadata from game.toml
     */
    init(iframe, metadata = {}) {
        this.gameFrame = iframe;
        this.gameMetadata = metadata;

        // Listen for messages from game
        window.addEventListener('message', (e) => this._handleMessage(e));

        // Inject PJA-SDK when iframe loads
        iframe.addEventListener('load', () => this._injectSDK());

        if (this.config.debug) {
            console.log('[CabinetHost] Initialized', metadata);
        }
    },

    // =========================================================================
    // SDK Injection
    // =========================================================================

    /**
     * Inject PJA-SDK into game iframe
     */
    async _injectSDK() {
        if (!this.gameFrame?.contentWindow) {
            console.warn('[CabinetHost] No game iframe to inject into');
            return;
        }

        try {
            // Fetch the SDK source
            const sdkPath = '/lib/pja-sdk.js';
            const response = await fetch(sdkPath);
            const sdkSource = await response.text();

            // Create script element and inject
            const script = this.gameFrame.contentDocument.createElement('script');
            script.textContent = sdkSource;
            this.gameFrame.contentDocument.head.appendChild(script);

            if (this.config.debug) {
                console.log('[CabinetHost] Injected PJA-SDK into game iframe');
            }
        } catch (e) {
            // Cross-origin or security restriction
            // Game must include PJA-SDK itself or we use postMessage bootstrap
            if (this.config.debug) {
                console.log('[CabinetHost] Cannot inject (cross-origin?), using postMessage bootstrap');
            }
            this._bootstrapViaPostMessage();
        }
    },

    /**
     * Bootstrap SDK via postMessage for cross-origin iframes
     */
    _bootstrapViaPostMessage() {
        // Send SDK source as a message for the game to eval
        // This is a fallback for cross-origin scenarios
        this.send('PJA_BOOTSTRAP', {
            sdkUrl: window.location.origin + '/lib/pja-sdk.js'
        });
    },

    // =========================================================================
    // Communication
    // =========================================================================

    /**
     * Send message to game iframe
     * @param {string} type - Message type (PJA_*)
     * @param {Object} payload - Message payload
     */
    send(type, payload = {}) {
        if (!this.gameFrame?.contentWindow) {
            console.warn('[CabinetHost] No game iframe to send to');
            return;
        }

        this.gameFrame.contentWindow.postMessage({
            type,
            payload,
            source: 'cabinet-host',
            timestamp: Date.now()
        }, '*');

        if (this.config.debug) {
            console.log('[CabinetHost] Sent:', type, payload);
        }
    },

    /**
     * Handle message from game
     */
    _handleMessage(event) {
        // Validate source
        if (this.gameFrame && event.source !== this.gameFrame.contentWindow) {
            return;
        }

        const { type, payload } = event.data || {};
        if (!type || !type.startsWith('PJA_')) return;

        if (this.config.debug) {
            console.log('[CabinetHost] Received:', type, payload);
        }

        // Emit to registered handlers
        this._emit(type, payload);

        // Handle standard events
        switch (type) {
            case 'PJA_READY':
                this._onGameReady();
                break;
            case 'PJA_GAME_OVER':
                this._onGameOver(payload);
                break;
            case 'PJA_REQUEST_INPUT_FOCUS':
                this.config.captureInput = 'iframe';
                break;
            case 'PJA_RELEASE_INPUT_FOCUS':
                this.config.captureInput = 'parent';
                break;
        }
    },

    // =========================================================================
    // Event Handlers
    // =========================================================================

    /**
     * Register event handler
     * @param {string} event - Event type
     * @param {Function} handler - Handler function
     */
    on(event, handler) {
        if (!this._handlers.has(event)) {
            this._handlers.set(event, new Set());
        }
        this._handlers.get(event).add(handler);
    },

    /**
     * Remove event handler
     */
    off(event, handler) {
        if (this._handlers.has(event)) {
            this._handlers.get(event).delete(handler);
        }
    },

    /**
     * Emit event to handlers
     */
    _emit(event, data) {
        if (this._handlers.has(event)) {
            this._handlers.get(event).forEach(h => h(data));
        }
    },

    /**
     * Game is ready - send start command
     */
    _onGameReady() {
        const players = this._getPlayers();
        const settings = this._getSettings();
        this.send('PJA_START_GAME', { players, settings });
    },

    /**
     * Game over - handle scores
     */
    _onGameOver(payload) {
        this._emit('gameOver', payload);
    },

    // =========================================================================
    // Game Control
    // =========================================================================

    /**
     * Start the game
     */
    startGame(players = [], settings = {}) {
        this.send('PJA_START_GAME', { players, settings });
    },

    /**
     * Stop the game
     * @param {string} reason - 'user' | 'timeout' | 'error'
     */
    stopGame(reason = 'user') {
        this.send('PJA_STOP_GAME', { reason });
    },

    /**
     * Pause the game
     */
    pauseGame() {
        this.send('PJA_PAUSE_GAME');
    },

    /**
     * Resume the game
     */
    resumeGame() {
        this.send('PJA_RESUME_GAME');
    },

    // =========================================================================
    // Volume Control
    // =========================================================================

    volumeUp() {
        this.send('PJA_VOLUME_UP');
    },

    volumeDown() {
        this.send('PJA_VOLUME_DOWN');
    },

    setVolume(level) {
        this.send('PJA_VOLUME_SET', { level });
    },

    mute() {
        this.send('PJA_VOLUME_MUTE');
    },

    unmute() {
        this.send('PJA_VOLUME_UNMUTE');
    },

    // =========================================================================
    // Display Control
    // =========================================================================

    enterFullscreen() {
        this.send('PJA_FULLSCREEN_ENTER');
    },

    exitFullscreen() {
        this.send('PJA_FULLSCREEN_EXIT');
    },

    /**
     * Update game styles (Terrain CSS injection)
     * @param {Object} css - CSS properties to update
     */
    updateStyles(css) {
        this.send('PJA_STYLE_UPDATE', { css });
    },

    // =========================================================================
    // Input Forwarding (when parent captures)
    // =========================================================================

    /**
     * Forward keyboard input to game
     */
    sendKey(key, pressed, player = 0) {
        if (this.config.captureInput === 'parent') {
            this.send('PJA_KEY', { key, pressed, player });
        }
    },

    /**
     * Forward gamepad button to game
     */
    sendGamepad(player, button, pressed) {
        if (this.config.captureInput === 'parent') {
            this.send('PJA_GAMEPAD', { player, button, pressed });
        }
    },

    /**
     * Forward gamepad axis to game
     */
    sendGamepadAxis(player, axis, value) {
        if (this.config.captureInput === 'parent') {
            this.send('PJA_GAMEPAD_AXIS', { player, axis, value });
        }
    },

    /**
     * Forward MIDI CC to game
     */
    sendMidiCC(channel, cc, value) {
        if (this.config.captureInput === 'parent') {
            this.send('PJA_MIDI_CC', { channel, cc, value });
        }
    },

    // =========================================================================
    // Developer Mode
    // =========================================================================

    /**
     * Enable/disable developer mode
     */
    setDevMode(enabled, captureInput = 'iframe') {
        this.config.devMode = enabled;
        this.config.captureInput = captureInput;
        this.send('PJA_DEV_MODE', { enabled, captureInput });
    },

    /**
     * Toggle input capture mode
     */
    toggleInputCapture() {
        this.config.captureInput = this.config.captureInput === 'iframe' ? 'parent' : 'iframe';
        this.send('PJA_DEV_MODE', {
            enabled: this.config.devMode,
            captureInput: this.config.captureInput
        });
        return this.config.captureInput;
    },

    // =========================================================================
    // Queries
    // =========================================================================

    /**
     * Request scores from game
     */
    getScores() {
        this.send('PJA_GET_SCORES');
    },

    /**
     * Request state from game
     */
    getState() {
        this.send('PJA_GET_STATE');
    },

    // =========================================================================
    // Marquee
    // =========================================================================

    /**
     * Load and display marquee from game metadata
     * @param {HTMLElement} container - Container element for marquee
     */
    loadMarquee(container) {
        if (!this.gameMetadata?.marquee) {
            if (this.config.debug) {
                console.log('[CabinetHost] No marquee defined in game metadata');
            }
            return;
        }

        const marquee = this.gameMetadata.marquee;
        const gameDir = this.gameMetadata.dir || '';

        container.style.width = '100%';
        container.style.height = (marquee.height || 120) + 'px';
        container.style.maxHeight = '15vh';
        container.style.backgroundColor = marquee.background || '#1a1a2e';
        container.style.backgroundSize = 'contain';
        container.style.backgroundRepeat = 'no-repeat';
        container.style.backgroundPosition = 'center';

        if (marquee.src) {
            const marqueePath = gameDir + '/' + marquee.src;
            container.style.backgroundImage = `url('${marqueePath}')`;
        }

        container.classList.add('cabinet-marquee');
    },

    // =========================================================================
    // Helpers
    // =========================================================================

    _getPlayers() {
        // Override this or provide via config
        return [{ id: 'p1', name: 'Player 1' }];
    },

    _getSettings() {
        // Return settings from game metadata or defaults
        return this.gameMetadata?.settings || {
            difficulty: 'normal',
            volume: 0.7
        };
    }
};

// Export for both module and browser use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CabinetHost;
} else {
    window.CabinetHost = CabinetHost;
}
