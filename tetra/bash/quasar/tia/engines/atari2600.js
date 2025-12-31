/**
 * Atari 2600 TIA Engine
 *
 * Emulates the Television Interface Adapter sound chip.
 * 4 voices with polynomial counter-based waveforms.
 *
 * Wave types (AUDC register):
 *   0  - Silent
 *   1  - 4-bit poly (buzzy)
 *   2  - div-by-15 -> 4-bit poly
 *   3  - 5-bit poly -> 4-bit poly
 *   4  - div-by-2 pure tone (square wave)
 *   5  - div-by-2 -> 4-bit poly
 *   6  - div-by-31 pure tone
 *   7  - 5-bit poly -> div-by-6
 *   8  - 9-bit poly (white noise)
 *   9  - 5-bit poly
 *   10 - div-by-31 -> 4-bit poly
 *   11 - constant high
 *   12 - div-by-6 pure tone
 *   13 - div-by-6 pure tone
 *   14 - div-by-93
 *   15 - 5-bit poly -> div-by-6
 */

// Import base class if in Node.js
let TIAEngine;
if (typeof require !== 'undefined') {
    TIAEngine = require('../engine-interface.js').TIAEngine;
} else if (typeof window !== 'undefined' && window.TIAEngine) {
    TIAEngine = window.TIAEngine;
}

class Atari2600Engine extends TIAEngine {
    constructor(sampleRate) {
        super(sampleRate);
        this.name = 'atari2600';

        // TIA base clock ~30kHz (NTSC)
        this.tiaClock = 30000;

        // Generate polynomial counter tables
        this.poly4 = this.generatePoly(4, [0, 1], 15);
        this.poly5 = this.generatePoly(5, [0, 2], 31);
        this.poly9 = this.generatePoly(9, [0, 4], 511);

        // Initialize voice-specific state
        for (const v of this.voices) {
            v.state = {
                polyCounter4: 0,
                polyCounter5: 0,
                polyCounter9: 0,
                divCounter: 0
            };
        }
    }

    /**
     * Generate polynomial counter lookup table
     * @param {number} bits - Number of bits
     * @param {number[]} taps - XOR feedback tap positions
     * @param {number} period - Table period
     * @returns {Uint8Array}
     */
    generatePoly(bits, taps, period) {
        const table = new Uint8Array(period);
        let reg = (1 << bits) - 1; // Start with all 1s

        for (let i = 0; i < period; i++) {
            table[i] = reg & 1;
            // XOR feedback from taps
            let feedback = 0;
            for (const tap of taps) {
                feedback ^= (reg >> tap) & 1;
            }
            reg = ((reg >> 1) | (feedback << (bits - 1))) & ((1 << bits) - 1);
        }
        return table;
    }

    /**
     * Get frequency in Hz from AUDF register
     * @param {number} audf - AUDF value (0-31)
     * @returns {number} Frequency in Hz
     */
    getFrequencyHz(audf) {
        return this.tiaClock / (audf + 1);
    }

    /**
     * Generate one sample for a voice
     * @param {number} voiceIndex - Voice index (0-3)
     * @returns {number} Sample value
     */
    generateVoiceSample(voiceIndex) {
        const v = this.voices[voiceIndex];
        if (!v.gate || v.vol === 0) return 0;

        const freq = this.getFrequencyHz(v.freq);
        const phaseInc = freq / this.sampleRate;
        const s = v.state;

        let sample = 0;

        // AUDC waveform selection
        switch (v.wave) {
            case 0:  // Silent
                sample = 0;
                break;

            case 1:  // 4-bit poly (noise)
                sample = this.poly4[s.polyCounter4] * 2 - 1;
                break;

            case 2:  // div-by-15 -> 4-bit poly
                if (s.divCounter % 15 === 0) {
                    sample = this.poly4[s.polyCounter4] * 2 - 1;
                }
                break;

            case 3:  // 5-bit poly -> 4-bit poly
                sample = (this.poly5[s.polyCounter5] & this.poly4[s.polyCounter4]) * 2 - 1;
                break;

            case 4:  // div-by-2 pure tone (square wave)
                sample = v.phase < 0.5 ? 1 : -1;
                break;

            case 5:  // div-by-2 -> 4-bit poly
                sample = (v.phase < 0.5 ? 1 : 0) * (this.poly4[s.polyCounter4] * 2 - 1);
                break;

            case 6:  // div-by-31 pure tone
                sample = (s.divCounter % 31 < 15) ? 1 : -1;
                break;

            case 7:  // 5-bit poly -> div-by-6
                sample = this.poly5[s.polyCounter5] * 2 - 1;
                break;

            case 8:  // 9-bit poly (white noise)
                sample = this.poly9[s.polyCounter9] * 2 - 1;
                break;

            case 9:  // 5-bit poly
                sample = this.poly5[s.polyCounter5] * 2 - 1;
                break;

            case 10: // div-by-31 -> 4-bit poly
                if (s.divCounter % 31 === 0) {
                    sample = this.poly4[s.polyCounter4] * 2 - 1;
                }
                break;

            case 11: // constant high
                sample = 1;
                break;

            case 12: // div-by-6 pure tone
            case 13:
                sample = (s.divCounter % 6 < 3) ? 1 : -1;
                break;

            case 14: // div-by-93
                sample = (s.divCounter % 93 < 46) ? 1 : -1;
                break;

            case 15: // 5-bit poly -> div-by-6
                sample = this.poly5[s.polyCounter5] * ((s.divCounter % 6 < 3) ? 1 : -1);
                break;
        }

        // Advance phase and counters
        v.phase += phaseInc;
        if (v.phase >= 1) {
            v.phase -= 1;
            s.polyCounter4 = (s.polyCounter4 + 1) % 15;
            s.polyCounter5 = (s.polyCounter5 + 1) % 31;
            s.polyCounter9 = (s.polyCounter9 + 1) % 511;
            s.divCounter++;
        }

        // Scale by volume (AUDV 0-15 -> 0.0-1.0)
        // 0.25 headroom for 4 voices
        return sample * (v.vol / 15) * 0.25;
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Atari2600Engine };
} else if (typeof window !== 'undefined') {
    window.Atari2600Engine = Atari2600Engine;
}
