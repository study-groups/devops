/**
 * FM Engine - 2-Operator FM Synthesis
 *
 * Simple 2-op FM synthesis with:
 * - Carrier oscillator modulated by modulator
 * - Wave parameter controls modulator ratio and depth
 *
 * Wave mapping:
 *   0-15 = Different carrier:modulator ratios
 *   Higher wave = higher modulation ratio and depth
 */

let TIAEngine;
if (typeof require !== 'undefined') {
    TIAEngine = require('../engine-interface.js').TIAEngine;
} else if (typeof window !== 'undefined' && window.TIAEngine) {
    TIAEngine = window.TIAEngine;
}

class FMEngine extends TIAEngine {
    constructor(sampleRate) {
        super(sampleRate);
        this.name = 'fm';

        // Initialize voice-specific state
        for (const v of this.voices) {
            v.state = {
                carrierPhase: 0,
                modPhase: 0
            };
        }
    }

    /**
     * FM-style frequency mapping
     * Maps 0-31 to ~110Hz - ~3.5kHz
     */
    getFrequencyHz(freqReg) {
        return 110 * Math.pow(2, freqReg / 6);
    }

    generateVoiceSample(voiceIndex) {
        const v = this.voices[voiceIndex];
        if (!v.gate || v.vol === 0) return 0;

        const s = v.state;
        const carrierFreq = this.getFrequencyHz(v.freq);

        // Wave controls modulator ratio (0-15 -> 0.5x to 8x)
        const modRatio = 0.5 + (v.wave / 15) * 7.5;
        const modFreq = carrierFreq * modRatio;

        // Modulation depth from wave (higher wave = more modulation)
        const modDepth = (v.wave / 15) * 4;

        const carrierInc = carrierFreq / this.sampleRate;
        const modInc = modFreq / this.sampleRate;

        // FM synthesis: carrier modulated by modulator
        const modulator = Math.sin(s.modPhase * 2 * Math.PI) * modDepth;
        const sample = Math.sin((s.carrierPhase + modulator) * 2 * Math.PI);

        // Advance phases
        s.carrierPhase += carrierInc;
        s.modPhase += modInc;
        if (s.carrierPhase >= 1) s.carrierPhase -= 1;
        if (s.modPhase >= 1) s.modPhase -= 1;

        return sample * (v.vol / 15) * 0.25;
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FMEngine };
} else if (typeof window !== 'undefined') {
    window.FMEngine = FMEngine;
}
