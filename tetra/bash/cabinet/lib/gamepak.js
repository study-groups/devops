/**
 * gamepak.js - Gamepak interface definition
 *
 * A Gamepak is a pluggable game driver that runs inside a Cabinet.
 * Any game that implements this interface can be loaded into any Cabinet.
 *
 * INTERFACE:
 *   gamepak.start()              - Initialize and start the game
 *   gamepak.stop()               - Cleanup and stop the game
 *   gamepak.play()               - Start gameplay (after waiting state)
 *   gamepak.reset()              - Reset game to waiting state
 *   gamepak.sendInput(slot, input) - Route player input
 *   gamepak.onFrame(callback)    - Subscribe to frame updates
 *   gamepak.onEvent(callback)    - Subscribe to game events
 *
 * FRAME FORMAT:
 *   {
 *     display: string,    // Text/ANSI for terminal display
 *     snd: object,        // Sound state (TIA/SID/FM params)
 *     state: object       // Optional game state for UI overlays
 *   }
 *
 * INPUT FORMAT:
 *   {
 *     src: 'keyboard'|'gamepad'|'midi',
 *     ctrl: string,       // Key code or control name
 *     val: number,        // Value (0-1 for buttons, -1 to 1 for axes)
 *     pressed: boolean    // For discrete buttons
 *   }
 *
 * EVENT FORMAT:
 *   {
 *     type: string,       // 'collision', 'score', 'gameover', etc.
 *     ...                 // Event-specific data
 *   }
 *
 * STATE MACHINE (optional):
 *   Games can use the CabinetState class for lifecycle management.
 *   Set options.useStateMachine = true to enable.
 *   States: boot → credits → load → title → attract/waiting → gameplay → gameover
 */

const { CabinetState, CABINET_STATES, PRESETS } = require('./cml-state.js');
const {
  renderBootScreen,
  renderCreditsScreen,
  renderLoadScreen,
  renderTitleScreen,
  renderWaitingScreen,
  renderGameoverScreen,
} = require('./screens/index.js');

class Gamepak {
    constructor(options = {}) {
        this.name = options.name || 'unnamed';
        this.version = options.version || '1.0.0';
        this.slots = options.slots || 2;  // Max players

        this._onFrame = null;
        this._onEvent = null;
        this._onExit = null;
        this.running = false;

        // Display dimensions
        this.cols = options.cols || 60;
        this.rows = options.rows || 30;

        // Match/session info
        this.matchCode = options.matchCode || null;
        this.playerCount = 0;

        // State machine (optional)
        this.useStateMachine = options.useStateMachine || false;
        this.state = null;

        if (this.useStateMachine) {
            const preset = options.statePreset || 'arcade';
            const config = PRESETS[preset] || PRESETS.arcade;
            this.state = new CabinetState(config);

            // Wire up state callbacks
            this.state.onEnter = (state, prev) => this._onStateEnter(state, prev);
            this.state.onExit = (state, next) => this._onStateExit(state, next);
            this.state.onTransition = (from, to) => {
                this.emitEvent({ type: 'state_change', from, to });
            };
        }

        // Legacy compatibility: waitingForStart flag
        this.waitingForStart = true;
    }

    // Lifecycle
    start() {
        this.running = true;
        if (this.state) {
            this.state.start();
        }
        return this;
    }

    stop() {
        this.running = false;
    }

    // Play the game (triggered by PLAY button)
    play() {
        if (this.state) {
            this.state.trigger('game.play');
        }
        this.waitingForStart = false;
    }

    // Reset game
    reset() {
        if (this.state) {
            this.state.trigger('game.reset');
        }
        this.waitingForStart = true;
    }

    // Signal that game assets are loaded
    loaded() {
        if (this.state) {
            this.state.trigger('game.loaded');
        }
    }

    // Input routing
    sendInput(slot, input) {
        // Check for skip on interruptible states
        if (this.state && input.pressed) {
            this.state.handleInput();
        }
        // Override in subclass for game-specific handling
    }

    // Callbacks
    onFrame(callback) { this._onFrame = callback; }
    onEvent(callback) { this._onEvent = callback; }
    onExit(callback) { this._onExit = callback; }

    // Emit helpers
    emitFrame(frame) {
        if (this._onFrame) this._onFrame(frame);
    }

    emitEvent(event) {
        if (this._onEvent) this._onEvent(event);
    }

    // State machine callbacks (override in subclass for custom behavior)
    _onStateEnter(state, prev) {
        // Default behavior - can be overridden
    }

    _onStateExit(state, next) {
        // Default behavior - can be overridden
    }

    // Tick the state machine and render appropriate screen
    // Call this from your game's _tick() method
    // Returns: { display: string, handled: boolean }
    //   display: ANSI string to render (null if game should render)
    //   handled: true if state machine handled this frame
    tickState() {
        if (!this.state) return { display: null, handled: false };

        this.state.tick();

        // Render standard screens based on state
        const current = this.state.current;
        const frame = this.state.getFramesInState();
        const context = {
            frame,
            width: this.cols,
            height: this.rows,
            info: {
                cols: this.cols,
                rows: this.rows,
                gameName: this.name.toUpperCase(),
                matchCode: this.matchCode,
                playerCount: this.playerCount,
                maxPlayers: this.slots,
            }
        };

        switch (current) {
            case 'boot':
                return { display: renderBootScreen(context), handled: true };
            case 'credits':
                return { display: renderCreditsScreen(context), handled: true };
            case 'load':
                return { display: renderLoadScreen(context), handled: true };
            case 'title':
                return { display: renderTitleScreen(context), handled: true };
            case 'waiting':
                return { display: renderWaitingScreen(context), handled: true };
            case 'gameover':
                // Game provides winner/scores
                context.winner = this.lastWinner || null;
                context.scores = this.lastScores || {};
                return { display: renderGameoverScreen(context), handled: true };
            case 'intro':
            case 'gameplay':
            case 'paused':
            case 'attract':
                // Game handles these states
                return { display: null, handled: false };
            default:
                return { display: null, handled: false };
        }
    }

    // Set winner/scores for gameover screen
    setGameResult(winner, scores) {
        this.lastWinner = winner;
        this.lastScores = scores;
    }

    // Get current state name (for games to check)
    getCurrentState() {
        return this.state ? this.state.current : null;
    }

    // Check if in a specific state
    isState(stateName) {
        return this.state ? this.state.is(stateName) : false;
    }

    // Get display info for screens
    getDisplayInfo() {
        return {
            cols: this.cols,
            rows: this.rows,
            gameName: this.name,
            matchCode: this.matchCode,
            playerCount: this.playerCount,
            maxPlayers: this.slots,
        };
    }
}

module.exports = { Gamepak, CabinetState, CABINET_STATES, PRESETS };
