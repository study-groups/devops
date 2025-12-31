/**
 * TIA AudioWorklet Processor
 *
 * Tetra Instrument Architecture - Multi-engine synth processor.
 * Supports engine switching at runtime via message port.
 *
 * Built-in engines:
 *   - atari2600: Atari 2600 TIA chip emulation (default)
 *   - sid: C64 SID-style synthesis
 *   - fm: 2-operator FM synthesis
 *
 * Each voice has: gate, freq (0-31), wave (0-15), vol (0-15)
 */

// ============================================================================
// Engine: Atari 2600 TIA
// ============================================================================

class Atari2600Engine {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.tiaClock = 30000;

        // 4 voices
        this.voices = Array(4).fill(null).map(() => ({
            gate: 0, freq: 0, wave: 0, vol: 0,
            phase: 0,
            polyCounter4: 0, polyCounter5: 0, polyCounter9: 0,
            divCounter: 0
        }));

        // Polynomial tables
        this.poly4 = this.generatePoly(4, [0, 1], 15);
        this.poly5 = this.generatePoly(5, [0, 2], 31);
        this.poly9 = this.generatePoly(9, [0, 4], 511);
    }

    generatePoly(bits, taps, period) {
        const table = new Uint8Array(period);
        let reg = (1 << bits) - 1;
        for (let i = 0; i < period; i++) {
            table[i] = reg & 1;
            let feedback = 0;
            for (const tap of taps) feedback ^= (reg >> tap) & 1;
            reg = ((reg >> 1) | (feedback << (bits - 1))) & ((1 << bits) - 1);
        }
        return table;
    }

    setVoice(idx, params) {
        if (idx < 0 || idx > 3) return;
        const v = this.voices[idx];
        if (params.gate !== undefined) v.gate = params.gate;
        if (params.freq !== undefined) v.freq = Math.max(0, Math.min(31, params.freq));
        if (params.wave !== undefined) v.wave = Math.max(0, Math.min(15, params.wave));
        if (params.vol !== undefined) v.vol = Math.max(0, Math.min(15, params.vol));
    }

    generateSample() {
        let out = 0;
        for (let i = 0; i < 4; i++) out += this.generateVoiceSample(i);
        return Math.tanh(out);
    }

    generateVoiceSample(idx) {
        const v = this.voices[idx];
        if (!v.gate || v.vol === 0) return 0;

        const freq = this.tiaClock / (v.freq + 1);
        const phaseInc = freq / this.sampleRate;
        let sample = 0;

        switch (v.wave) {
            case 0: sample = 0; break;
            case 1: sample = this.poly4[v.polyCounter4] * 2 - 1; break;
            case 2: sample = (v.divCounter % 15 === 0) ? this.poly4[v.polyCounter4] * 2 - 1 : 0; break;
            case 3: sample = (this.poly5[v.polyCounter5] & this.poly4[v.polyCounter4]) * 2 - 1; break;
            case 4: sample = v.phase < 0.5 ? 1 : -1; break;
            case 5: sample = (v.phase < 0.5 ? 1 : 0) * (this.poly4[v.polyCounter4] * 2 - 1); break;
            case 6: sample = (v.divCounter % 31 < 15) ? 1 : -1; break;
            case 7: sample = this.poly5[v.polyCounter5] * 2 - 1; break;
            case 8: sample = this.poly9[v.polyCounter9] * 2 - 1; break;
            case 9: sample = this.poly5[v.polyCounter5] * 2 - 1; break;
            case 10: sample = (v.divCounter % 31 === 0) ? this.poly4[v.polyCounter4] * 2 - 1 : 0; break;
            case 11: sample = 1; break;
            case 12: case 13: sample = (v.divCounter % 6 < 3) ? 1 : -1; break;
            case 14: sample = (v.divCounter % 93 < 46) ? 1 : -1; break;
            case 15: sample = this.poly5[v.polyCounter5] * ((v.divCounter % 6 < 3) ? 1 : -1); break;
        }

        v.phase += phaseInc;
        if (v.phase >= 1) {
            v.phase -= 1;
            v.polyCounter4 = (v.polyCounter4 + 1) % 15;
            v.polyCounter5 = (v.polyCounter5 + 1) % 31;
            v.polyCounter9 = (v.polyCounter9 + 1) % 511;
            v.divCounter++;
        }

        return sample * (v.vol / 15) * 0.25;
    }
}

// ============================================================================
// Engine: SID (C64-style)
// ============================================================================

class SIDEngine {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;

        this.voices = Array(4).fill(null).map(() => ({
            gate: 0, freq: 0, wave: 0, vol: 0,
            phase: 0, noiseReg: 0x7FFFF8
        }));
    }

    setVoice(idx, params) {
        if (idx < 0 || idx > 3) return;
        const v = this.voices[idx];
        if (params.gate !== undefined) v.gate = params.gate;
        if (params.freq !== undefined) v.freq = Math.max(0, Math.min(31, params.freq));
        if (params.wave !== undefined) v.wave = Math.max(0, Math.min(15, params.wave));
        if (params.vol !== undefined) v.vol = Math.max(0, Math.min(15, params.vol));
    }

    // Map freq register to Hz (SID-style: wider range)
    getFrequencyHz(freqReg) {
        // Map 0-31 to ~65Hz - ~4kHz (SID range compressed)
        return 65 * Math.pow(2, freqReg / 5);
    }

    generateSample() {
        let out = 0;
        for (let i = 0; i < 4; i++) out += this.generateVoiceSample(i);
        return Math.tanh(out);
    }

    generateVoiceSample(idx) {
        const v = this.voices[idx];
        if (!v.gate || v.vol === 0) return 0;

        const freq = this.getFrequencyHz(v.freq);
        const phaseInc = freq / this.sampleRate;
        let sample = 0;

        // Wave types: 0=tri, 1=saw, 2=pulse, 3=noise, 4-15=combinations
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
            case 3: // Noise
                if (v.phase < phaseInc) {
                    // Advance LFSR
                    const bit = ((v.noiseReg >> 22) ^ (v.noiseReg >> 17)) & 1;
                    v.noiseReg = ((v.noiseReg << 1) | bit) & 0x7FFFFF;
                }
                sample = ((v.noiseReg & 0xFF) / 127.5) - 1;
                break;
        }

        v.phase += phaseInc;
        if (v.phase >= 1) v.phase -= 1;

        return sample * (v.vol / 15) * 0.25;
    }
}

// ============================================================================
// Engine: FM (2-operator)
// ============================================================================

class FMEngine {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;

        this.voices = Array(4).fill(null).map(() => ({
            gate: 0, freq: 0, wave: 0, vol: 0,
            carrierPhase: 0, modPhase: 0
        }));
    }

    setVoice(idx, params) {
        if (idx < 0 || idx > 3) return;
        const v = this.voices[idx];
        if (params.gate !== undefined) v.gate = params.gate;
        if (params.freq !== undefined) v.freq = Math.max(0, Math.min(31, params.freq));
        if (params.wave !== undefined) v.wave = Math.max(0, Math.min(15, params.wave));
        if (params.vol !== undefined) v.vol = Math.max(0, Math.min(15, params.vol));
    }

    getFrequencyHz(freqReg) {
        return 110 * Math.pow(2, freqReg / 6);
    }

    generateSample() {
        let out = 0;
        for (let i = 0; i < 4; i++) out += this.generateVoiceSample(i);
        return Math.tanh(out);
    }

    generateVoiceSample(idx) {
        const v = this.voices[idx];
        if (!v.gate || v.vol === 0) return 0;

        const carrierFreq = this.getFrequencyHz(v.freq);
        // Wave controls modulator ratio (0-15 -> 0.5x to 8x)
        const modRatio = 0.5 + (v.wave / 15) * 7.5;
        const modFreq = carrierFreq * modRatio;
        // Modulation depth from wave (higher wave = more modulation)
        const modDepth = (v.wave / 15) * 4;

        const carrierInc = carrierFreq / this.sampleRate;
        const modInc = modFreq / this.sampleRate;

        // FM synthesis: carrier modulated by modulator
        const modulator = Math.sin(v.modPhase * 2 * Math.PI) * modDepth;
        const sample = Math.sin((v.carrierPhase + modulator) * 2 * Math.PI);

        v.carrierPhase += carrierInc;
        v.modPhase += modInc;
        if (v.carrierPhase >= 1) v.carrierPhase -= 1;
        if (v.modPhase >= 1) v.modPhase -= 1;

        return sample * (v.vol / 15) * 0.25;
    }
}

// ============================================================================
// TIA Processor (AudioWorklet)
// ============================================================================

class TIAProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        // Engine registry
        this.engines = {
            atari2600: Atari2600Engine,
            sid: SIDEngine,
            fm: FMEngine
        };

        // Default engine
        this.engine = new Atari2600Engine(sampleRate);
        this.engineName = 'atari2600';

        // Handle messages from main thread
        this.port.onmessage = (e) => {
            const msg = e.data;

            // Engine switching
            if (msg.engine && this.engines[msg.engine]) {
                this.switchEngine(msg.engine);
                return;
            }

            // Voice update
            if (msg.voice !== undefined) {
                this.engine.setVoice(msg.voice, msg);
            }
        };
    }

    switchEngine(name) {
        if (!this.engines[name]) return;

        // Preserve voice state
        const oldVoices = this.engine.voices.map(v => ({
            gate: v.gate, freq: v.freq, wave: v.wave, vol: v.vol
        }));

        // Create new engine
        this.engine = new this.engines[name](sampleRate);
        this.engineName = name;

        // Restore voice state
        for (let i = 0; i < 4; i++) {
            this.engine.setVoice(i, oldVoices[i]);
        }

        // Notify main thread
        this.port.postMessage({ engineChanged: name });
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        if (!channel) return true;

        for (let i = 0; i < channel.length; i++) {
            channel[i] = this.engine.generateSample();
        }

        return true;
    }
}

registerProcessor('tia-processor', TIAProcessor);
