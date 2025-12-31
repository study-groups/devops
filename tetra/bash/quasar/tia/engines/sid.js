/**
 * SID Engine - C64 Style Synthesis
 *
 * Simplified SID emulation with:
 * - Triangle, sawtooth, pulse, noise waveforms
 * - LFSR-based noise generator
 *
 * Wave mapping:
 *   0 = Triangle
 *   1 = Sawtooth
 *   2 = Pulse (50% duty)
 *   3 = Noise
 *   4-15 = Combinations/variants
 */

let TIAEngine;
if (typeof require !== 'undefined') {
    TIAEngine = require('../engine-interface.js').TIAEngine;
} else if (typeof window !== 'undefined' && window.TIAEngine) {
    TIAEngine = window.TIAEngine;
}

class SIDEngine extends TIAEngine {
    constructor(sampleRate) {
        super(sampleRate);
        this.name = 'sid';

        // Initialize voice-specific state
        for (const v of this.voices) {
            v.state = {
                noiseReg: 0x7FFFF8  // 23-bit LFSR
            };
        }
    }

    /**
     * SID-style frequency mapping
     * Maps 0-31 to ~65Hz - ~4kHz
     */
    getFrequencyHz(freqReg) {
        return 65 * Math.pow(2, freqReg / 5);
    }

    generateVoiceSample(voiceIndex) {
        const v = this.voices[voiceIndex];
        if (!v.gate || v.vol === 0) return 0;

        const freq = this.getFrequencyHz(v.freq);
        const phaseInc = freq / this.sampleRate;
        const s = v.state;
        let sample = 0;

        // Wave types: 0=tri, 1=saw, 2=pulse, 3=noise
        switch (v.wave & 0x3) {
            case 0: // Triangle
                sample = Math.abs(v.phase * 4 - 2) - 1;
                break;

            case 1: // Sawtooth
                sample = v.phase * 2 - 1;
                break;

            case 2: // Pulse (50% duty)
                sample = v.phase < 0.5 ? 1 : -1;
                break;

            case 3: // Noise (LFSR)
                if (v.phase < phaseInc) {
                    // Advance LFSR on phase wrap
                    const bit = ((s.noiseReg >> 22) ^ (s.noiseReg >> 17)) & 1;
                    s.noiseReg = ((s.noiseReg << 1) | bit) & 0x7FFFFF;
                }
                sample = ((s.noiseReg & 0xFF) / 127.5) - 1;
                break;
        }

        // Advance phase
        v.phase += phaseInc;
        if (v.phase >= 1) v.phase -= 1;

        return sample * (v.vol / 15) * 0.25;
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SIDEngine };
} else if (typeof window !== 'undefined') {
    window.SIDEngine = SIDEngine;
}
