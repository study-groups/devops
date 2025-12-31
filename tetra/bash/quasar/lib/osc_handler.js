/**
 * OSC Handler - Audio control via OSC protocol
 *
 * Handles incoming OSC messages for sound synthesis control:
 *   /quasar/{voice}/set {gate} {freq} {wave} {vol}
 *   /quasar/{voice}/gate {0|1}
 *   /quasar/mode {tia|pwm|sidplus}
 *   /quasar/trigger/{name}
 */

const EventEmitter = require('events');
const osc = require('osc');

const DEFAULT_CONFIG = {
  oscInPort: 1986,
  verbose: false
};

class OSCHandler extends EventEmitter {
  constructor(server, options = {}) {
    super();
    this.server = server;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.oscIn = null;
  }

  /**
   * Initialize OSC UDP port and wire event handlers
   */
  setup() {
    this.oscIn = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: this.config.oscInPort,
      broadcast: true,
      metadata: true
    });

    this.oscIn.on('ready', () => {
      this.server.log(`OSC listening on :${this.config.oscInPort}`);
    });

    this.oscIn.on('message', (msg, timeTag, info) => {
      this.handleMessage(msg, info);
    });

    this.oscIn.on('error', (err) => {
      this.server.log(`OSC error: ${err.message}`, 'error');
    });

    this.oscIn.open();
  }

  /**
   * Process incoming OSC message
   */
  handleMessage(msg, info) {
    this.server.stats.oscMessages++;
    const parts = msg.address.split('/').filter(Boolean);

    if (this.config.verbose) {
      this.server.log(`OSC: ${msg.address} ${JSON.stringify(msg.args.map(a => a.value))}`);
    }

    // Handle /sound/* messages from pulsar game engine
    if (parts[0] === 'sound') {
      this.handleSoundMessage(parts, msg.args.map(a => a.value));
      return;
    }

    if (parts[0] !== 'quasar') return;

    const args = msg.args.map(a => a.value);

    if (parts[1] === 'mode') {
      this.server.soundState.mode = args[0];
      this.broadcastSound({ mode: args[0] });
    } else if (parts[1] === 'trigger') {
      const triggerName = parts[2];
      const voice = args[0];
      this.broadcastSound({ trig: [{ name: triggerName, voice }] });
    } else {
      // Voice command: /quasar/0/set or /quasar/0/gate
      const voiceNum = parseInt(parts[1]);
      if (voiceNum >= 0 && voiceNum < 4) {
        const cmd = parts[2];
        if (cmd === 'set' && args.length >= 4) {
          const [gate, freq, wave, vol] = args;
          this.server.soundState.v[voiceNum] = { g: gate, f: freq, w: wave, v: vol };
          this.broadcastSound({ v: this.server.soundState.v });
        } else if (cmd === 'gate') {
          this.server.soundState.v[voiceNum].g = args[0];
          this.broadcastSound({ v: this.server.soundState.v });
        }
      }
    }
  }

  /**
   * Handle /sound/* messages from game engine
   * Format:
   *   /sound/collision id1 id2 z x_norm y_norm energy
   *   /sound/spawn id z x_norm y_norm
   *   /sound/death id z x_norm y_norm
   */
  handleSoundMessage(parts, args) {
    const eventType = parts[1];  // collision, spawn, death

    if (this.config.verbose) {
      this.server.log(`Sound event: ${eventType} ${JSON.stringify(args)}`);
    }

    // Map game events to QUASAR preset triggers
    // The preset names match the event types
    if (['collision', 'spawn', 'death'].includes(eventType)) {
      this.broadcastSound({ trig: [{ name: eventType }] });
    }
  }

  /**
   * Broadcast sound update to all connected browser clients
   */
  broadcastSound(sndUpdate) {
    const WebSocket = require('ws');
    const msg = JSON.stringify({ t: 'snd', snd: sndUpdate });
    this.server.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  /**
   * Stop OSC listener
   */
  stop() {
    if (this.oscIn) {
      this.oscIn.close();
      this.oscIn = null;
    }
  }

  toJSON() {
    return {
      port: this.config.oscInPort,
      messagesReceived: this.server.stats.oscMessages
    };
  }
}

module.exports = { OSCHandler, DEFAULT_CONFIG };
