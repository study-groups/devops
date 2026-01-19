/**
 * GameFrame.js - Game Iframe Management
 * Handles game loading, postMessage communication, and PJA-SDK bridging
 */

export class GameFrame {
    constructor(options = {}) {
        this.onMessage = options.onMessage || (() => {});
        this.onLoad = options.onLoad || (() => {});
        this.onError = options.onError || (() => {});

        this.element = null;
        this.iframe = null;
        this.overlay = null;
        this.currentUrl = null;
        this.currentSlug = null;
        this.isLoaded = false;

        // PJA-SDK state mirror
        this.gameState = {
            state: 'idle',
            paddles: [0.5, 0.5, 0.5, 0.5],
            score: [0, 0, 0, 0],
            volume: 1.0,
            muted: false
        };

        this._messageHandler = this._handleMessage.bind(this);
    }

    /**
     * Render the frame component
     * @returns {HTMLElement}
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'game-frame-container';

        // Placeholder when no game loaded
        this.overlay = document.createElement('div');
        this.overlay.className = 'game-frame-overlay';
        this.overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-icon">🎮</div>
                <div class="overlay-title">No Game Loaded</div>
                <div class="overlay-hint">Use "load &lt;url&gt;" to load a game</div>
            </div>
        `;

        // Iframe
        this.iframe = document.createElement('iframe');
        this.iframe.className = 'game-frame';
        this.iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
        this.iframe.allow = 'autoplay; fullscreen';

        this.element.appendChild(this.overlay);
        this.element.appendChild(this.iframe);

        // Listen for messages
        window.addEventListener('message', this._messageHandler);

        // Iframe load event
        this.iframe.addEventListener('load', () => {
            if (this.iframe.src && this.iframe.src !== 'about:blank') {
                this.isLoaded = true;
                this.overlay.classList.add('hidden');
                this.onLoad(this.currentUrl);
            }
        });

        this.iframe.addEventListener('error', (e) => {
            this.onError(`Failed to load: ${e.message || 'Unknown error'}`);
        });

        return this.element;
    }

    /**
     * Load a game URL
     * @param {string} url - URL to load
     */
    load(url) {
        if (!url) {
            this.onError('No URL provided');
            return;
        }

        // Reset state
        this.isLoaded = false;
        this.gameState = {
            state: 'idle',
            paddles: [0.5, 0.5, 0.5, 0.5],
            score: [0, 0, 0, 0],
            volume: 1.0,
            muted: false
        };

        this.currentUrl = url;
        this.overlay.classList.remove('hidden');
        this.overlay.querySelector('.overlay-title').textContent = 'Loading...';
        this.overlay.querySelector('.overlay-hint').textContent = url;

        this.iframe.src = url;
    }

    /**
     * Load a game by slug (from workspace)
     * @param {string} slug - Game slug
     * @param {string} filename - Entry file (default: index.html)
     */
    loadGame(slug, filename = 'index.html') {
        this.currentSlug = slug;
        // Games are served via /api/games/:slug/play/* route
        const url = `/api/games/${slug}/play/${filename}`;
        this.load(url);
    }

    /**
     * Reload current game
     */
    reload() {
        if (this.currentUrl) {
            this.load(this.currentUrl);
        } else {
            this.onError('No game loaded to reload');
        }
    }

    /**
     * Unload game
     */
    unload() {
        this.iframe.src = 'about:blank';
        this.currentUrl = null;
        this.currentSlug = null;
        this.isLoaded = false;
        this.overlay.classList.remove('hidden');
        this.overlay.querySelector('.overlay-title').textContent = 'No Game Loaded';
        this.overlay.querySelector('.overlay-hint').textContent = 'Use "load <url>" to load a game';
    }

    /**
     * Handle postMessage from iframe
     */
    _handleMessage(event) {
        // Only handle messages from our iframe
        if (event.source !== this.iframe.contentWindow) return;

        const { type, data } = event.data || {};
        if (!type) return;

        // Update local state mirror
        this._updateState(type, data);

        // Forward to handler
        this.onMessage(type, data);
    }

    /**
     * Update state mirror based on message type
     */
    _updateState(type, data) {
        switch (type) {
            case 'client:loaded':
                this.gameState.state = 'idle';
                break;
            case 'game:start':
                this.gameState.state = 'playing';
                break;
            case 'game:stop':
                this.gameState.state = 'idle';
                this.gameState.score = [0, 0, 0, 0];
                break;
            case 'game:pause':
                this.gameState.state = 'paused';
                break;
            case 'game:resume':
                this.gameState.state = 'playing';
                break;
            case 'game:end':
                this.gameState.state = 'ended';
                break;
            case 'game:paddle':
                if (data && typeof data.player === 'number') {
                    this.gameState.paddles[data.player] = data.value;
                }
                break;
            case 'game:score':
                if (data && Array.isArray(data.scores)) {
                    this.gameState.score = data.scores;
                } else if (data && typeof data.player === 'number') {
                    this.gameState.score[data.player] = data.score;
                }
                break;
            case 'game:state':
                if (data) {
                    Object.assign(this.gameState, data);
                }
                break;
        }
    }

    /**
     * Send postMessage to iframe
     * @param {string} type - Message type
     * @param {object} data - Message data
     */
    postMessage(type, data = {}) {
        if (!this.isLoaded) {
            return false;
        }

        try {
            this.iframe.contentWindow.postMessage({ type, data, source: 'pbase-console' }, '*');
            return true;
        } catch (e) {
            this.onError(`postMessage failed: ${e.message}`);
            return false;
        }
    }

    // PJA-SDK style methods

    /**
     * Start game
     */
    start() {
        return this.postMessage('game:control', { action: 'start' });
    }

    /**
     * Stop game
     */
    stop() {
        return this.postMessage('game:control', { action: 'stop' });
    }

    /**
     * Pause game
     */
    pause() {
        return this.postMessage('game:control', { action: 'pause' });
    }

    /**
     * Resume game
     */
    resume() {
        return this.postMessage('game:control', { action: 'resume' });
    }

    /**
     * Toggle pause
     */
    togglePause() {
        return this.postMessage('game:control', { action: 'toggle' });
    }

    /**
     * Set paddle position
     */
    setPaddle(player, value) {
        return this.postMessage('game:control', {
            action: 'paddle',
            player,
            value: Math.max(0, Math.min(1, value))
        });
    }

    /**
     * Set score
     */
    setScore(player, score) {
        return this.postMessage('game:control', {
            action: 'score',
            player,
            score
        });
    }

    /**
     * Set volume
     */
    setVolume(level) {
        this.gameState.volume = Math.max(0, Math.min(1, level));
        return this.postMessage('audio:volume', { volume: this.gameState.volume });
    }

    /**
     * Set mute
     */
    setMute(muted) {
        this.gameState.muted = muted;
        return this.postMessage('audio:mute', { muted });
    }

    /**
     * Send arbitrary message
     */
    send(type, data) {
        return this.postMessage(type, data);
    }

    /**
     * Get current game state
     */
    getState() {
        return { ...this.gameState };
    }

    /**
     * Get current URL
     */
    getUrl() {
        return this.currentUrl;
    }

    /**
     * Check if loaded
     */
    isGameLoaded() {
        return this.isLoaded;
    }

    /**
     * Cleanup
     */
    destroy() {
        window.removeEventListener('message', this._messageHandler);
        this.unload();
    }
}
