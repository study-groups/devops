/**
 * TIA Engine Interface
 *
 * Base class that all synthesis engines must implement.
 * Engines are isomorphic - same code runs in browser (AudioWorklet) and Node.js.
 */

class TIAEngine {
    /**
     * @param {number} sampleRate - Audio sample rate (e.g., 44100, 48000)
     */
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.name = 'base';

        // 4 voices, each with standard TIA state
        this.voices = Array(4).fill(null).map(() => ({
            gate: 0,      // 0 = off, 1 = on
            freq: 0,      // 0-31, engine interprets
            wave: 0,      // 0-15, engine interprets
            vol: 0,       // 0-15
            // Internal state (engine-specific)
            phase: 0,
            state: {}
        }));
    }

    /**
     * Get engine name
     * @returns {string}
     */
    getName() {
        return this.name;
    }

    /**
     * Set voice parameters
     * @param {number} voiceIndex - Voice index (0-3)
     * @param {object} params - { gate, freq, wave, vol }
     */
    setVoice(voiceIndex, params) {
        if (voiceIndex < 0 || voiceIndex > 3) return;

        const v = this.voices[voiceIndex];
        if (params.gate !== undefined) v.gate = params.gate;
        if (params.freq !== undefined) v.freq = Math.max(0, Math.min(31, params.freq));
        if (params.wave !== undefined) v.wave = Math.max(0, Math.min(15, params.wave));
        if (params.vol !== undefined) v.vol = Math.max(0, Math.min(15, params.vol));
    }

    /**
     * Get voice state
     * @param {number} voiceIndex - Voice index (0-3)
     * @returns {object} Voice state
     */
    getVoice(voiceIndex) {
        if (voiceIndex < 0 || voiceIndex > 3) return null;
        return { ...this.voices[voiceIndex] };
    }

    /**
     * Generate one audio sample (sum of all voices)
     * Override this in subclasses.
     * @returns {number} Sample value (-1.0 to 1.0)
     */
    generateSample() {
        let sample = 0;
        for (let i = 0; i < 4; i++) {
            sample += this.generateVoiceSample(i);
        }
        // Soft clip to prevent harsh distortion
        return Math.tanh(sample);
    }

    /**
     * Generate one sample for a specific voice
     * Override this in subclasses.
     * @param {number} voiceIndex - Voice index (0-3)
     * @returns {number} Sample value
     */
    generateVoiceSample(voiceIndex) {
        // Base implementation returns silence
        return 0;
    }

    /**
     * Fill a buffer with samples
     * @param {Float32Array|Buffer} buffer - Output buffer
     * @param {number} [offset=0] - Start offset
     * @param {number} [length] - Number of samples
     */
    fillBuffer(buffer, offset = 0, length) {
        const len = length || buffer.length - offset;
        for (let i = 0; i < len; i++) {
            buffer[offset + i] = this.generateSample();
        }
    }

    /**
     * Reset all voices to initial state
     */
    reset() {
        for (const v of this.voices) {
            v.gate = 0;
            v.freq = 0;
            v.wave = 0;
            v.vol = 0;
            v.phase = 0;
            v.state = {};
        }
    }

    /**
     * Get frequency in Hz from freq register value
     * Override in subclasses for different frequency mappings.
     * @param {number} freqReg - Frequency register value (0-31)
     * @returns {number} Frequency in Hz
     */
    getFrequencyHz(freqReg) {
        // Default: TIA-style mapping (30kHz base clock / (reg + 1))
        const baseClock = 30000;
        return baseClock / (freqReg + 1);
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TIAEngine };
} else if (typeof window !== 'undefined') {
    window.TIAEngine = TIAEngine;
}
