/**
 * host-config.js - Server-side configuration for Cabinet Host
 *
 * Flags can be set via:
 *   - Environment variables: CABINET_STUN=1, CABINET_DEBUG=1
 *   - Constructor options (highest priority)
 *
 * Usage:
 *   const { HostConfig } = require('./host-config');
 *   const config = new HostConfig({ collectFingerprint: true });
 *   if (config.get('collectFingerprint')) { ... }
 */

class HostConfig {
  static defaults = {
    collectFingerprint: false,  // STUN fingerprinting
    debug: false,               // Debug logging
    autoRespawn: true,          // Auto-respawn game on exit
    respawnDelay: 1000,         // Respawn delay in ms
    maxPlayers: 4,
    maxSpectators: 4
  };

  // Environment variable prefix
  static envPrefix = 'CABINET_';

  // Env var name mappings (camelCase -> SCREAMING_SNAKE_CASE)
  static envMap = {
    collectFingerprint: 'STUN',
    debug: 'DEBUG',
    autoRespawn: 'AUTO_RESPAWN',
    respawnDelay: 'RESPAWN_DELAY',
    maxPlayers: 'MAX_PLAYERS',
    maxSpectators: 'MAX_SPECTATORS'
  };

  constructor(options = {}) {
    this.flags = { ...HostConfig.defaults };

    // Override with environment variables
    for (const [key, envSuffix] of Object.entries(HostConfig.envMap)) {
      const envVar = HostConfig.envPrefix + envSuffix;
      const envVal = process.env[envVar];
      if (envVal !== undefined) {
        // Parse booleans and numbers
        if (envVal === '1' || envVal === 'true') {
          this.flags[key] = true;
        } else if (envVal === '0' || envVal === 'false') {
          this.flags[key] = false;
        } else if (!isNaN(envVal)) {
          this.flags[key] = parseInt(envVal, 10);
        } else {
          this.flags[key] = envVal;
        }
      }
    }

    // Override with constructor options (highest priority)
    for (const [key, value] of Object.entries(options)) {
      if (key in this.flags) {
        this.flags[key] = value;
      }
    }

    if (this.flags.debug) {
      console.log('[host-config] Flags:', this.flags);
    }
  }

  get(key) {
    return this.flags[key];
  }

  set(key, value) {
    this.flags[key] = value;
  }

  // Convert to options object for Host constructor
  toHostOptions() {
    return {
      collectFingerprint: this.flags.collectFingerprint,
      autoRespawn: this.flags.autoRespawn,
      respawnDelay: this.flags.respawnDelay,
      maxPlayers: this.flags.maxPlayers,
      maxSpectators: this.flags.maxSpectators
    };
  }
}

module.exports = { HostConfig };
