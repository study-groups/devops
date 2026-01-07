/**
 * CML State Machine - Cabinet Markup Language State Management
 *
 * Manages lifecycle states for GAMMA ANSI Cabinet games.
 * Standard flow: boot → credits → load → title → attract/waiting → gameplay → gameover
 *
 * States:
 *   boot     - GAMMA cabinet system diagnostics (3s)
 *   credits  - TETRA/GAMMA branding (2s, skippable)
 *   load     - Game asset loading (waits for game.loaded trigger)
 *   title    - Game title screen (10s, then attract mode)
 *   attract  - AI demo loop (30s, loops to title)
 *   waiting  - "Press PLAY" (waits for game.play trigger)
 *   intro    - Game intro animation (3s)
 *   gameplay - Active game
 *   paused   - Game paused
 *   gameover - End screen (5s, then attract)
 */

const CABINET_STATES = {
  boot: {
    duration: 3000,           // 3 seconds - GAMMA cabinet system check
    next: 'credits',
    interruptible: false
  },
  credits: {
    duration: 2000,           // 2 seconds - TETRA/GAMMA branding
    next: 'load',
    interruptible: true,
    skipTo: 'load'
  },
  load: {
    duration: null,           // Waits for game assets to load
    next: 'title',
    triggers: {
      'game.loaded': 'title'  // Game signals loading complete
    },
    timeout: 10000,           // Max wait before auto-proceeding
    interruptible: false
  },
  title: {
    duration: 10000,          // 10s before attract
    next: 'attract',
    interruptible: true,
    skipTo: 'waiting'
  },
  attract: {
    duration: 30000,          // 30s demo loop
    next: 'title',
    loop: true,
    interruptible: true,
    skipTo: 'waiting'
  },
  waiting: {
    duration: null,           // Wait forever for play button
    triggers: {
      'game.play': 'intro'
    }
  },
  intro: {
    duration: 3000,           // 3s intro animation
    next: 'gameplay',
    interruptible: false
  },
  gameplay: {
    duration: null,
    triggers: {
      'game.over': 'gameover',
      'game.pause': 'paused'
    }
  },
  paused: {
    triggers: {
      'game.resume': 'gameplay',
      'game.reset': 'waiting'
    }
  },
  gameover: {
    duration: 5000,           // 5s before attract
    next: 'attract',
    triggers: {
      'game.reset': 'waiting',
      'game.play': 'intro'
    }
  }
};

class CabinetState {
  /**
   * @param {Object} config
   * @param {string[]} config.states - List of valid state names
   * @param {Object} config.transitions - State transition definitions
   * @param {string} config.initial - Initial state (default: 'boot')
   */
  constructor(config = {}) {
    this.states = config.states || Object.keys(CABINET_STATES);
    this.transitions = config.transitions || CABINET_STATES;
    this.initial = config.initial || 'boot';

    this.current = null;
    this.previous = null;
    this.stateFrame = 0;
    this.stateStartTime = 0;

    // Callbacks
    this.onEnter = null;      // (state, previous) => void
    this.onExit = null;       // (state, next) => void
    this.onTransition = null; // (from, to) => void
  }

  /**
   * Initialize the state machine with the initial state
   */
  start() {
    this.enter(this.initial);
    return this;
  }

  /**
   * Enter a new state
   * @param {string} state - State to enter
   */
  enter(state) {
    if (!this.states.includes(state)) {
      console.error(`[CabinetState] Invalid state: ${state}`);
      return false;
    }

    const prev = this.current;

    // Exit current state
    if (prev && this.onExit) {
      this.onExit(prev, state);
    }

    // Update state
    this.previous = prev;
    this.current = state;
    this.stateFrame = 0;
    this.stateStartTime = Date.now();

    // Enter new state
    if (this.onEnter) {
      this.onEnter(state, prev);
    }

    // Fire transition callback
    if (this.onTransition) {
      this.onTransition(prev, state);
    }

    return true;
  }

  /**
   * Called each frame to check for auto-transitions
   * @param {number} deltaMs - Milliseconds since last tick (optional)
   */
  tick(deltaMs = 33) {
    if (!this.current) return;

    this.stateFrame++;

    const config = this.transitions[this.current];
    if (!config) return;

    const elapsed = this.getTimeInState();

    // Check for timed transition
    if (config.duration !== null && config.duration !== undefined) {
      if (elapsed >= config.duration) {
        const next = config.next;
        if (next) {
          this.transition(next);
        }
      }
    }

    // Check for timeout (e.g., load state waiting for assets)
    if (config.timeout !== null && config.timeout !== undefined) {
      if (elapsed >= config.timeout && config.next) {
        console.warn(`[CabinetState] State '${this.current}' timed out after ${config.timeout}ms`);
        this.transition(config.next);
      }
    }
  }

  /**
   * Manually transition to a new state
   * @param {string} to - Target state
   */
  transition(to) {
    if (!this.canTransition(to)) {
      console.warn(`[CabinetState] Cannot transition from ${this.current} to ${to}`);
      return false;
    }
    return this.enter(to);
  }

  /**
   * Handle an event trigger (e.g., 'game.play', 'game.reset')
   * @param {string} event - Event name
   */
  trigger(event) {
    if (!this.current) return false;

    const config = this.transitions[this.current];
    if (!config || !config.triggers) return false;

    const targetState = config.triggers[event];
    if (targetState) {
      return this.transition(targetState);
    }

    return false;
  }

  /**
   * Handle input (for interruptible states)
   */
  handleInput() {
    if (!this.current) return false;

    const config = this.transitions[this.current];
    if (!config) return false;

    if (config.interruptible && config.skipTo) {
      return this.transition(config.skipTo);
    }

    return false;
  }

  /**
   * Check if a transition to the target state is valid
   * @param {string} to - Target state
   */
  canTransition(to) {
    if (!this.states.includes(to)) return false;

    const config = this.transitions[this.current];
    if (!config) return true; // No config = allow all

    // Check if it's the configured next state
    if (config.next === to) return true;

    // Check if it's in triggers
    if (config.triggers) {
      const triggerTargets = Object.values(config.triggers);
      if (triggerTargets.includes(to)) return true;
    }

    // Check skipTo for interruptible states
    if (config.interruptible && config.skipTo === to) return true;

    return false;
  }

  /**
   * Get milliseconds spent in current state
   */
  getTimeInState() {
    if (!this.stateStartTime) return 0;
    return Date.now() - this.stateStartTime;
  }

  /**
   * Get frames spent in current state
   */
  getFramesInState() {
    return this.stateFrame;
  }

  /**
   * Check if current state is a specific state
   * @param {string} state - State to check
   */
  is(state) {
    return this.current === state;
  }

  /**
   * Check if current state is one of several states
   * @param {string[]} states - States to check
   */
  isAny(...states) {
    return states.includes(this.current);
  }

  /**
   * Get current state config
   */
  getConfig() {
    return this.transitions[this.current] || {};
  }

  /**
   * Reset state machine to initial state
   */
  reset() {
    this.current = null;
    this.previous = null;
    this.stateFrame = 0;
    this.stateStartTime = 0;
    this.start();
  }

  /**
   * Get state info for debugging
   */
  getInfo() {
    return {
      current: this.current,
      previous: this.previous,
      frame: this.stateFrame,
      timeMs: this.getTimeInState(),
      config: this.getConfig()
    };
  }
}

// Simple presets for common game types
const PRESETS = {
  // Full arcade experience with boot, credits, attract mode
  arcade: {
    states: ['boot', 'credits', 'load', 'title', 'attract', 'waiting', 'intro', 'gameplay', 'paused', 'gameover'],
    transitions: CABINET_STATES,
    initial: 'boot'
  },

  // Simplified: skip boot/credits, go straight to waiting
  simple: {
    states: ['waiting', 'gameplay', 'gameover'],
    transitions: {
      waiting: { triggers: { 'game.play': 'gameplay' } },
      gameplay: { triggers: { 'game.over': 'gameover', 'game.reset': 'waiting' } },
      gameover: { duration: 5000, next: 'waiting', triggers: { 'game.play': 'gameplay' } }
    },
    initial: 'waiting'
  },

  // Demo mode: continuous attract loop
  demo: {
    states: ['attract', 'gameover'],
    transitions: {
      attract: { duration: 60000, next: 'attract', loop: true },
      gameover: { duration: 3000, next: 'attract' }
    },
    initial: 'attract'
  }
};

module.exports = { CabinetState, CABINET_STATES, PRESETS };
