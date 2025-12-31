/**
 * TIA: Tetra Instrument Architecture
 *
 * Multi-engine synth manager with uniform 4-voice interface.
 * Engines are swappable at runtime while maintaining the same API.
 *
 * Usage:
 *   const tia = new TIA(44100);
 *   tia.setEngine('atari2600');
 *   tia.setVoice(0, { gate: 1, freq: 8, wave: 4, vol: 15 });
 *   const sample = tia.generateSample();
 */

// Engine registry - populated by engine modules
const engines = {};

// Import base class
let TIAEngine;
if (typeof require !== 'undefined') {
    TIAEngine = require('./engine-interface.js').TIAEngine;
} else if (typeof window !== 'undefined' && window.TIAEngine) {
    TIAEngine = window.TIAEngine;
}

/**
 * Register an engine class
 * @param {string} name - Engine identifier
 * @param {class} EngineClass - Engine class extending TIAEngine
 */
function registerEngine(name, EngineClass) {
    engines[name] = EngineClass;
}

/**
 * Get list of registered engines
 * @returns {string[]}
 */
function getEngines() {
    return Object.keys(engines);
}

/**
 * TIA Manager
 */
class TIA {
    /**
     * @param {number} sampleRate - Audio sample rate
     * @param {string} [engineName='atari2600'] - Initial engine
     */
    constructor(sampleRate, engineName = 'atari2600') {
        this.sampleRate = sampleRate;
        this.engine = null;
        this.engineName = null;

        // Try to set initial engine
        if (engines[engineName]) {
            this.setEngine(engineName);
        } else {
            // Create a silent fallback engine
            this.engine = new TIAEngine(sampleRate);
            this.engineName = 'base';
        }
    }

    /**
     * Switch to a different engine
     * @param {string} name - Engine name
     * @returns {boolean} Success
     */
    setEngine(name) {
        const EngineClass = engines[name];
        if (!EngineClass) {
            console.warn(`TIA: Unknown engine '${name}'. Available: ${Object.keys(engines).join(', ')}`);
            return false;
        }

        // Preserve voice state if switching mid-playback
        const oldVoices = this.engine ? this.engine.voices.map(v => ({
            gate: v.gate,
            freq: v.freq,
            wave: v.wave,
            vol: v.vol
        })) : null;

        // Create new engine
        this.engine = new EngineClass(this.sampleRate);
        this.engineName = name;

        // Restore voice state
        if (oldVoices) {
            for (let i = 0; i < 4; i++) {
                this.engine.setVoice(i, oldVoices[i]);
            }
        }

        return true;
    }

    /**
     * Get current engine name
     * @returns {string}
     */
    getEngineName() {
        return this.engineName;
    }

    /**
     * Set voice parameters
     * @param {number} voiceIndex - Voice index (0-3)
     * @param {object} params - { gate, freq, wave, vol }
     */
    setVoice(voiceIndex, params) {
        if (this.engine) {
            this.engine.setVoice(voiceIndex, params);
        }
    }

    /**
     * Get voice state
     * @param {number} voiceIndex - Voice index (0-3)
     * @returns {object}
     */
    getVoice(voiceIndex) {
        return this.engine ? this.engine.getVoice(voiceIndex) : null;
    }

    /**
     * Generate one audio sample
     * @returns {number} Sample value (-1.0 to 1.0)
     */
    generateSample() {
        return this.engine ? this.engine.generateSample() : 0;
    }

    /**
     * Generate one sample for a specific voice
     * @param {number} voiceIndex - Voice index (0-3)
     * @returns {number}
     */
    generateVoiceSample(voiceIndex) {
        return this.engine ? this.engine.generateVoiceSample(voiceIndex) : 0;
    }

    /**
     * Fill a buffer with samples
     * @param {Float32Array|Buffer} buffer - Output buffer
     * @param {number} [offset=0] - Start offset
     * @param {number} [length] - Number of samples
     */
    fillBuffer(buffer, offset = 0, length) {
        if (this.engine) {
            this.engine.fillBuffer(buffer, offset, length);
        }
    }

    /**
     * Reset all voices
     */
    reset() {
        if (this.engine) {
            this.engine.reset();
        }
    }

    /**
     * Get frequency in Hz for a freq register value
     * @param {number} freqReg - Frequency register (0-31)
     * @returns {number}
     */
    getFrequencyHz(freqReg) {
        return this.engine ? this.engine.getFrequencyHz(freqReg) : 0;
    }
}

// Auto-register built-in engines
if (typeof require !== 'undefined') {
    // Node.js - load engines
    try {
        const { Atari2600Engine } = require('./engines/atari2600.js');
        registerEngine('atari2600', Atari2600Engine);
    } catch (e) {
        console.warn('TIA: Could not load atari2600 engine:', e.message);
    }

    try {
        const { SIDEngine } = require('./engines/sid.js');
        registerEngine('sid', SIDEngine);
    } catch (e) {
        console.warn('TIA: Could not load sid engine:', e.message);
    }

    try {
        const { FMEngine } = require('./engines/fm.js');
        registerEngine('fm', FMEngine);
    } catch (e) {
        console.warn('TIA: Could not load fm engine:', e.message);
    }
} else if (typeof window !== 'undefined') {
    // Browser - engines register themselves via window globals
    if (window.Atari2600Engine) {
        registerEngine('atari2600', window.Atari2600Engine);
    }
    if (window.SIDEngine) {
        registerEngine('sid', window.SIDEngine);
    }
    if (window.FMEngine) {
        registerEngine('fm', window.FMEngine);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TIA, TIAEngine, registerEngine, getEngines };
} else if (typeof window !== 'undefined') {
    window.TIA = TIA;
    window.TIARegisterEngine = registerEngine;
    window.TIAGetEngines = getEngines;
}
