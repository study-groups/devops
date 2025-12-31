/**
 * gamepak.js - Gamepak interface definition
 *
 * A Gamepak is a pluggable game driver that runs inside a Cabinet.
 * Any game that implements this interface can be loaded into any Cabinet.
 *
 * INTERFACE:
 *   gamepak.start()              - Initialize and start the game
 *   gamepak.stop()               - Cleanup and stop the game
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
 */

class Gamepak {
    constructor(options = {}) {
        this.name = options.name || 'unnamed';
        this.version = options.version || '1.0.0';
        this.slots = options.slots || 2;  // Max players

        this._onFrame = null;
        this._onEvent = null;
        this._onExit = null;
        this.running = false;
    }

    // Lifecycle
    start() {
        this.running = true;
        return this;
    }

    stop() {
        this.running = false;
    }

    // Input routing
    sendInput(slot, input) {
        // Override in subclass
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
}

module.exports = { Gamepak };
