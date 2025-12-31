/**
 * Slot Manager - 256-slot rendering pipeline for PULSAR engine
 *
 * Manages individual render slots, each with its own:
 * - Dimensions (cols x rows)
 * - Frame rate (fps)
 * - Tick timer
 * - Sprite entities
 */

const EventEmitter = require('events');
const WebSocket = require('ws');

const MAX_SLOTS = 256;

class SlotManager extends EventEmitter {
  constructor(server, pulsarEngine, options = {}) {
    super();
    this.server = server;
    this.pulsarEngine = pulsarEngine;
    this.slots = new Array(MAX_SLOTS).fill(null);

    // Wire up frame events from PULSAR
    if (this.pulsarEngine) {
      this.pulsarEngine.on('frame', ({ slot, lines }) => {
        this.broadcastFrame(slot, lines);
      });
    }
  }

  /**
   * Initialize a render slot
   */
  initSlot(slot, cols = 60, rows = 24, fps = 15) {
    if (slot < 0 || slot >= MAX_SLOTS) return false;

    if (!this.pulsarEngine.spawn()) return false;

    this.pulsarEngine.send(`${slot} INIT ${cols} ${rows} ${fps}`);

    this.slots[slot] = {
      fps,
      cols,
      rows,
      timer: null,
      sprites: []
    };

    // Start tick timer for this slot
    const interval = Math.floor(1000 / fps);
    this.slots[slot].timer = setInterval(() => {
      this.tickSlot(slot, interval);
    }, interval);

    this.server.log(`Slot ${slot} initialized: ${cols}x${rows} @ ${fps}fps`);
    this.emit('slotInit', { slot, cols, rows, fps });
    return true;
  }

  /**
   * Destroy a render slot
   */
  destroySlot(slot) {
    if (slot < 0 || slot >= MAX_SLOTS || !this.slots[slot]) return;

    if (this.slots[slot].timer) {
      clearInterval(this.slots[slot].timer);
    }

    this.pulsarEngine.send(`${slot} DESTROY`);

    this.slots[slot] = null;
    this.server.log(`Slot ${slot} destroyed`);
    this.emit('slotDestroy', { slot });
  }

  /**
   * Tick a slot (advance simulation and render)
   */
  tickSlot(slot, ms) {
    if (!this.slots[slot]) return;

    this.pulsarEngine.setCurrentSlot(slot);
    this.pulsarEngine.send(`${slot} TICK ${ms}`);
    this.pulsarEngine.send(`${slot} RENDER`);
  }

  /**
   * Spawn a sprite in a slot
   */
  spawnSprite(slot, type, x, y, params = {}) {
    if (!this.slots[slot]) return null;

    const len0 = params.len0 || 4;
    const dtheta = params.dtheta || 0.1;
    const valence = params.valence || 1;

    this.pulsarEngine.send(`${slot} SPAWN ${type} ${x} ${y} ${len0} ${dtheta} ${valence}`);

    const sprite = { type, x, y, params };
    this.slots[slot].sprites.push(sprite);

    this.emit('spriteSpawn', { slot, sprite });
    return sprite;
  }

  /**
   * Broadcast a frame to all WebSocket clients
   */
  broadcastFrame(slot, frameLines) {
    const frame = {
      t: 'frame',
      slot,
      display: frameLines.join('\n'),
      ts: Date.now()
    };

    // Update current screen for /api/screen
    this.server.currentScreen = frame.display;

    const frameStr = JSON.stringify(frame);
    this.server.stats.framesRelayed++;

    this.server.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(frameStr);
      }
    });

    this.emit('frameBroadcast', { slot, clients: this.server.clients.size });
  }

  /**
   * Get slot info
   */
  getSlot(slot) {
    if (slot < 0 || slot >= MAX_SLOTS) return null;
    return this.slots[slot];
  }

  /**
   * Get all active slots
   */
  getActiveSlots() {
    const active = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.slots[i]) {
        active.push({
          slot: i,
          ...this.slots[i],
          timer: undefined  // Don't expose timer
        });
      }
    }
    return active;
  }

  /**
   * Stop all slots
   */
  stopAll() {
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.slots[i] && this.slots[i].timer) {
        clearInterval(this.slots[i].timer);
      }
    }
    this.slots.fill(null);
  }

  /**
   * Stop and cleanup
   */
  stop() {
    this.stopAll();
  }

  toJSON() {
    return {
      maxSlots: MAX_SLOTS,
      active: this.getActiveSlots()
    };
  }
}

module.exports = { SlotManager, MAX_SLOTS };
