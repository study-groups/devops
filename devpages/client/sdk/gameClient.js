/**
 * gameClient.js - PJA Games Client SDK
 * Standalone game client that can be included in game projects
 * Provides initializeGameClient function for iframe-based games
 */

// Game API Actions (matching the DevPages logging system)
const GAME_API_ACTIONS = {
    // Lifecycle actions
    GAME_IDLE: "GAME_IDLE",
    GAME_LOADING: "GAME_LOADING", 
    GAME_LOADED: "GAME_LOADED",
    GAME_STARTED: "GAME_STARTED",
    GAME_ENDED: "GAME_ENDED",
    
    // Game state actions
    GAME_STATE_UPDATE: "GAME_STATE_UPDATE",
    PLAYER_ACTION: "PLAYER_ACTION",
    SUBMIT_SCORE: "SUBMIT_SCORE",
    
    // Control actions
    SET_VOLUME: "SET_VOLUME",
    PLAY_GAME: "PLAY_GAME", 
    PAUSE_GAME: "PAUSE_GAME",
    
    // Data actions
    GET_SCORE: "GET_SCORE",
    GET_USER: "GET_USER",
    SET_USER: "SET_USER",
    
    // Auth actions
    AUTHENTICATE: "AUTHENTICATE"
};

/**
 * Game Client SDK - runs inside the game iframe
 */
class GameClient {
    constructor(options = {}) {
        this.options = options;
        this.role = 'CLIENT';
        this.parentWindow = window.parent;
        this.debug = options.debug || false;
        this.gameId = options.gameId || 'unknown';
        
        // Set up postMessage communication with parent
        this.setupCommunication();
        
        this.log('Game client initialized', { gameId: this.gameId });
    }
    
    /**
     * Set up postMessage communication with parent window
     */
    setupCommunication() {
        // Listen for messages from parent
        window.addEventListener('message', (event) => {
            if (event.source !== this.parentWindow) return;
            
            this.handleParentMessage(event.data);
        });
        
        // Send ready message to parent
        this.sendToParent('GAME_LOADING', { gameId: this.gameId });
    }
    
    /**
     * Handle messages from parent window
     */
    handleParentMessage(data) {
        if (this.debug) {
            this.log('Received message from parent', data);
        }
        
        // Handle specific parent messages
        switch (data.type) {
            case 'PLAY_GAME':
                this.onPlayGame(data.data);
                break;
            case 'PAUSE_GAME':
                this.onPauseGame(data.data);
                break;
            case 'SET_VOLUME':
                this.onSetVolume(data.data);
                break;
        }
    }
    
    /**
     * Send message to parent window
     */
    sendToParent(action, data = null) {
        const message = {
            type: action,
            from: this.role,
            to: 'HOST',
            gameId: this.gameId,
            timestamp: performance.now(),
            data
        };
        
        if (this.debug) {
            this.log('Sending to parent', message);
        }
        
        this.parentWindow.postMessage(message, '*');
    }
    
    /**
     * Log message (internal logging)
     */
    log(message, data = null) {
        const logMessage = `[GameClient:${this.gameId}] ${message}`;
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
    
    // === Game Lifecycle Methods ===
    
    /**
     * Signal that the game has loaded
     */
    loaded() {
        this.sendToParent('GAME_LOADED');
        this.log('Game loaded');
    }
    
    /**
     * Signal that the game has started
     */
    started() {
        this.sendToParent('GAME_STARTED');
        this.log('Game started');
    }
    
    /**
     * Signal that the game has ended
     */
    ended(score = null) {
        this.sendToParent('GAME_ENDED', { score });
        this.log('Game ended', { score });
    }
    
    /**
     * Submit a score
     */
    submitScore(score) {
        this.sendToParent('SUBMIT_SCORE', { score });
        this.log('Score submitted', { score });
    }
    
    /**
     * Authenticate with token
     */
    authenticate(token) {
        this.sendToParent('AUTHENTICATE', { token });
        this.log('Authentication requested');
    }
    
    /**
     * Update game state
     */
    updateState(state) {
        this.sendToParent('GAME_STATE_UPDATE', state);
        if (this.debug) {
            this.log('State updated', state);
        }
    }
    
    /**
     * Send player action
     */
    playerAction(action, data = null) {
        this.sendToParent('PLAYER_ACTION', { action, data });
        if (this.debug) {
            this.log('Player action', { action, data });
        }
    }
    
    // === Event Handlers (override these in your game) ===
    
    onPlayGame(data) {
        this.log('Play game requested', data);
        // Override this method in your game
    }
    
    onPauseGame(data) {
        this.log('Pause game requested', data);
        // Override this method in your game
    }
    
    onSetVolume(data) {
        this.log('Set volume requested', data);
        // Override this method in your game
    }
    
    // === Utility Methods ===
    
    /**
     * Get available actions
     */
    getActions() {
        return GAME_API_ACTIONS;
    }
    
    /**
     * Check if running in iframe
     */
    isInIframe() {
        return window !== window.parent;
    }
    
    /**
     * Get game container element
     */
    getGameContainer() {
        return document.getElementById('game-container') || document.body;
    }
}

/**
 * Initialize the game client
 * This is the main function that games should call
 */
function initializeGameClient(options = {}) {
    // Check if already initialized
    if (window.gameClient) {
        console.warn('[GameClient] Already initialized, returning existing instance');
        return window.gameClient;
    }
    
    // Create and store game client instance
    const gameClient = new GameClient(options);
    window.gameClient = gameClient;
    
    // Also make it globally available as PJA namespace
    window.PJA = window.PJA || {};
    window.PJA.gameClient = gameClient;
    
    console.log('[GameClient] Initialized successfully');
    return gameClient;
}

// Make initializeGameClient globally available
window.initializeGameClient = initializeGameClient;

// Also export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializeGameClient, GameClient, GAME_API_ACTIONS };
}

// Auto-initialize if in iframe and no manual initialization
if (window !== window.parent && !window.gameClient) {
    // Auto-initialize with basic options after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.gameClient) {
                initializeGameClient({ debug: true, gameId: 'auto-init' });
            }
        });
    } else {
        // DOM already ready
        if (!window.gameClient) {
            initializeGameClient({ debug: true, gameId: 'auto-init' });
        }
    }
}

console.log('[GameClient SDK] Loaded successfully'); 