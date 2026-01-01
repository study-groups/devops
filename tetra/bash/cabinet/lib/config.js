/**
 * config.js - Unified configuration and feature flags for Cabinet
 *
 * Browser usage:
 *   <script src="lib/config.js"></script>
 *   if (CabinetConfig.flags.stun) { ... }
 *
 * Flags can be set via:
 *   - Query params: ?stun=1&debug=1
 *   - LocalStorage: cabinet-config
 *   - Defaults
 */

const CabinetConfig = {
  // Feature flags (query params override localStorage override defaults)
  flags: {},

  // Default flag values
  defaults: {
    stun: false,      // STUN fingerprinting
    debug: false,     // Debug logging
    ai: true,         // Local AI controller
    bridge: true,     // ControlDeck BroadcastChannel bridge
    autoConnect: true // Auto-connect when served from game host
  },

  init() {
    // Start with defaults
    this.flags = { ...this.defaults };

    // Override with localStorage
    try {
      const stored = localStorage.getItem('cabinet-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.assign(this.flags, parsed);
      }
    } catch (e) {}

    // Override with query params (highest priority)
    if (typeof URLSearchParams !== 'undefined') {
      const params = new URLSearchParams(window.location?.search || '');
      for (const key of Object.keys(this.defaults)) {
        if (params.has(key)) {
          const val = params.get(key);
          this.flags[key] = val === '1' || val === 'true';
        }
      }
    }

    if (this.flags.debug) {
      console.log('[config] Flags:', this.flags);
    }

    return this;
  },

  // Set a flag (persists to localStorage)
  set(key, value) {
    this.flags[key] = value;
    this.save();
  },

  // Get a flag
  get(key) {
    return this.flags[key];
  },

  // Save current flags to localStorage
  save() {
    try {
      localStorage.setItem('cabinet-config', JSON.stringify(this.flags));
    } catch (e) {}
  },

  // Reset to defaults
  reset() {
    this.flags = { ...this.defaults };
    try {
      localStorage.removeItem('cabinet-config');
    } catch (e) {}
  }
};

// Auto-init in browser
if (typeof window !== 'undefined') {
  CabinetConfig.init();
  window.CabinetConfig = CabinetConfig;
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CabinetConfig };
}
