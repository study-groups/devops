/**
 * Quasar Audio Engine
 *
 * Multi-mode audio synthesizer for tetra games.
 * Modes: TIA (Atari 2600), PWM (lo-fi), SIDPlus (C64+)
 *
 * Usage:
 *   await QUASAR.init();
 *   QUASAR.setVoice(0, { gate: 1, freq: 18, wave: 7, vol: 12 });
 *   QUASAR.trigger('pew');
 */

window.QUASAR = (function() {
  'use strict';

  // State
  let audioContext = null;
  let workletNode = null;
  let initialized = false;
  let mode = 'tia';

  // Voice state (4 voices)
  const voices = Array(4).fill(null).map(() => ({
    gate: 0,
    freq: 0,
    wave: 0,
    vol: 0
  }));

  // Preset one-shot sounds
  const presets = {
    // Pew - laser/bullet fire
    pew: {
      voices: [2],  // Use voice 2 for effects
      sequence: [
        { t: 0, gate: 1, freq: 8, wave: 4, vol: 15 },
        { t: 30, freq: 12, vol: 12 },
        { t: 60, freq: 18, vol: 8 },
        { t: 90, freq: 24, vol: 4 },
        { t: 120, gate: 0 }
      ]
    },

    // Boom - explosion
    boom: {
      voices: [2, 3],
      sequence: [
        { t: 0, gate: 1, freq: 2, wave: 8, vol: 15 },
        { t: 50, freq: 4, vol: 14 },
        { t: 100, freq: 6, vol: 12 },
        { t: 150, freq: 8, vol: 10 },
        { t: 200, freq: 10, vol: 8 },
        { t: 300, freq: 12, vol: 5 },
        { t: 400, gate: 0 }
      ]
    },

    // Clank - metallic track sound
    clank: {
      voices: [3],
      sequence: [
        { t: 0, gate: 1, freq: 20, wave: 1, vol: 10 },
        { t: 20, freq: 24, vol: 8 },
        { t: 40, freq: 28, vol: 4 },
        { t: 60, gate: 0 }
      ]
    },

    // Pickup - item collected
    pickup: {
      voices: [2],
      sequence: [
        { t: 0, gate: 1, freq: 20, wave: 12, vol: 12 },
        { t: 50, freq: 15, vol: 14 },
        { t: 100, freq: 10, vol: 12 },
        { t: 150, freq: 8, vol: 10 },
        { t: 200, gate: 0 }
      ]
    },

    // Engine idle - low rumble
    engine_idle: {
      voices: [0],
      sequence: [
        { t: 0, gate: 1, freq: 28, wave: 3, vol: 4 }
        // No end - continuous until changed
      ]
    },

    // Engine rev - higher pitched engine
    engine_rev: {
      voices: [0],
      sequence: [
        { t: 0, gate: 1, freq: 12, wave: 7, vol: 12 }
      ]
    },

    // Hit - damage taken
    hit: {
      voices: [3],
      sequence: [
        { t: 0, gate: 1, freq: 4, wave: 8, vol: 14 },
        { t: 30, freq: 8, vol: 12 },
        { t: 60, freq: 12, vol: 8 },
        { t: 100, gate: 0 }
      ]
    },

    // Score - point scored
    score: {
      voices: [2],
      sequence: [
        { t: 0, gate: 1, freq: 15, wave: 4, vol: 12 },
        { t: 80, freq: 12, vol: 14 },
        { t: 160, freq: 10, vol: 12 },
        { t: 240, gate: 0 }
      ]
    }
  };

  // Active trigger timers
  const activeTimers = new Map();

  /**
   * Initialize audio engine
   */
  async function init() {
    if (initialized) return true;

    try {
      audioContext = new AudioContext();

      // Load TIA worklet
      const workletUrl = new URL('tia-worklet.js', import.meta.url || window.location.href);
      await audioContext.audioWorklet.addModule(workletUrl);

      // Create worklet node
      workletNode = new AudioWorkletNode(audioContext, 'tia-processor');
      workletNode.connect(audioContext.destination);

      initialized = true;
      console.log('[QUASAR] Initialized, mode:', mode);
      return true;
    } catch (err) {
      console.error('[QUASAR] Init failed:', err);
      return false;
    }
  }

  /**
   * Resume audio context (call after user interaction)
   */
  async function resume() {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  }

  /**
   * Set voice parameters
   * @param {number} voice - Voice index (0-3)
   * @param {object} params - { gate, freq, wave, vol }
   */
  function setVoice(voice, params) {
    if (!initialized || voice < 0 || voice > 3) return;

    const v = voices[voice];
    if (params.gate !== undefined) v.gate = params.gate;
    if (params.freq !== undefined) v.freq = params.freq;
    if (params.wave !== undefined) v.wave = params.wave;
    if (params.vol !== undefined) v.vol = params.vol;

    // Send to worklet
    workletNode.port.postMessage({
      voice,
      gate: v.gate,
      freq: v.freq,
      wave: v.wave,
      vol: v.vol
    });
  }

  /**
   * Update voice from frame data
   * @param {Array} voiceArray - Array of voice objects from frame bundle
   */
  function updateFromFrame(voiceArray) {
    if (!Array.isArray(voiceArray)) return;

    voiceArray.forEach((vData, i) => {
      if (i < 4 && vData) {
        setVoice(i, {
          gate: vData.g,
          freq: vData.f,
          wave: vData.w,
          vol: vData.v
        });
      }
    });
  }

  /**
   * Trigger a preset sound
   * @param {string} name - Preset name
   * @param {number} [voiceOverride] - Override default voice
   */
  function trigger(name, voiceOverride) {
    if (!initialized) return;

    const preset = presets[name];
    if (!preset) {
      console.warn('[QUASAR] Unknown preset:', name);
      return;
    }

    // Cancel any existing timers for these voices
    const targetVoices = voiceOverride !== undefined ? [voiceOverride] : preset.voices;
    targetVoices.forEach(v => {
      const timers = activeTimers.get(v);
      if (timers) {
        timers.forEach(t => clearTimeout(t));
        activeTimers.delete(v);
      }
    });

    // Schedule the sequence
    const newTimers = [];
    preset.sequence.forEach(step => {
      const timer = setTimeout(() => {
        targetVoices.forEach(v => {
          setVoice(v, step);
        });
      }, step.t);
      newTimers.push(timer);
    });

    targetVoices.forEach(v => {
      activeTimers.set(v, newTimers);
    });
  }

  /**
   * Process triggers from frame bundle
   * @param {Array} triggers - Array of trigger names or {name, voice} objects
   */
  function processTriggers(triggers) {
    if (!Array.isArray(triggers)) return;
    triggers.forEach(t => {
      if (typeof t === 'string') {
        trigger(t);
      } else if (t && t.name) {
        trigger(t.name, t.voice);
      }
    });
  }

  /**
   * Process a complete frame bundle
   * @param {object} frame - Frame bundle with snd property
   */
  function processFrame(frame) {
    if (!frame || !frame.snd) return;

    const { snd } = frame;

    // Switch mode if needed
    if (snd.mode && snd.mode !== mode) {
      setMode(snd.mode);
    }

    // Update voices
    if (snd.v) {
      updateFromFrame(snd.v);
    }

    // Process triggers
    if (snd.trig) {
      processTriggers(snd.trig);
    }
  }

  /**
   * Set synthesis mode
   * @param {string} newMode - 'tia', 'pwm', or 'sidplus'
   */
  function setMode(newMode) {
    if (['tia', 'pwm', 'sidplus'].includes(newMode)) {
      mode = newMode;
      console.log('[QUASAR] Mode:', mode);
      // TODO: Switch worklet for different modes
    }
  }

  /**
   * Stop all voices
   */
  function stopAll() {
    for (let i = 0; i < 4; i++) {
      setVoice(i, { gate: 0 });
    }

    // Clear all timers
    activeTimers.forEach(timers => {
      timers.forEach(t => clearTimeout(t));
    });
    activeTimers.clear();
  }

  /**
   * Get current state
   */
  function getState() {
    return {
      initialized,
      mode,
      voices: voices.map(v => ({ ...v })),
      contextState: audioContext?.state
    };
  }

  // Public API
  return {
    init,
    resume,
    setVoice,
    updateFromFrame,
    trigger,
    processTriggers,
    processFrame,
    setMode,
    stopAll,
    getState,

    // Expose for debugging
    get audioContext() { return audioContext; },
    get mode() { return mode; },
    get presets() { return Object.keys(presets); }
  };
})();


<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>
