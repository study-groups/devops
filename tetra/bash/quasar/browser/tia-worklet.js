/**
 * TIA AudioWorklet Processor
 *
 * Emulates the Atari 2600 TIA sound chip with 4 voices.
 * Each voice has: gate, freq (AUDF 0-31), wave (AUDC 0-15), vol (AUDV 0-15)
 *
 * TIA Clock: ~30kHz base, divided by (AUDF + 1)
 * Output: Mono audio at worklet sample rate (typically 44.1kHz or 48kHz)
 */

class TIAProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // 4 voices, each with TIA state
    this.voices = Array(4).fill(null).map(() => ({
      gate: 0,
      freq: 0,      // AUDF 0-31
      wave: 0,      // AUDC 0-15
      vol: 0,       // AUDV 0-15
      phase: 0,     // Current phase accumulator
      polyCounter4: 0,
      polyCounter5: 0,
      polyCounter9: 0,
      divCounter: 0
    }));

    // TIA base clock ~30kHz (varies by NTSC/PAL, using NTSC)
    this.tiaClock = 30000;

    // Polynomial counter feedback taps (LFSR)
    // 4-bit: taps at bits 0,1 (period 15)
    // 5-bit: taps at bits 0,2 (period 31)
    // 9-bit: taps at bits 0,4 (period 511)
    this.poly4 = this.generatePoly(4, [0, 1], 15);
    this.poly5 = this.generatePoly(5, [0, 2], 31);
    this.poly9 = this.generatePoly(9, [0, 4], 511);

    // Handle parameter updates from main thread
    this.port.onmessage = (e) => {
      const { voice, gate, freq, wave, vol } = e.data;
      if (voice >= 0 && voice < 4) {
        const v = this.voices[voice];
        if (gate !== undefined) v.gate = gate;
        if (freq !== undefined) v.freq = Math.max(0, Math.min(31, freq));
        if (wave !== undefined) v.wave = Math.max(0, Math.min(15, wave));
        if (vol !== undefined) v.vol = Math.max(0, Math.min(15, vol));
      }
    };
  }

  // Generate polynomial counter lookup table
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

  // Get TIA frequency in Hz from AUDF register
  getFrequency(audf) {
    // TIA divides 30kHz clock by (AUDF + 1)
    return this.tiaClock / (audf + 1);
  }

  // Generate one sample for a voice based on AUDC waveform type
  generateSample(voice) {
    const v = this.voices[voice];
    if (!v.gate || v.vol === 0) return 0;

    const freq = this.getFrequency(v.freq);
    const phaseInc = freq / sampleRate;

    let sample = 0;

    // AUDC waveform selection (simplified but authentic)
    switch (v.wave) {
      case 0:  // Silent
        sample = 0;
        break;

      case 1:  // 4-bit poly (noise)
        sample = this.poly4[v.polyCounter4] * 2 - 1;
        break;

      case 2:  // div-by-15 -> 4-bit poly
        if (v.divCounter === 0) {
          sample = this.poly4[v.polyCounter4] * 2 - 1;
        }
        break;

      case 3:  // 5-bit poly -> 4-bit poly
        sample = (this.poly5[v.polyCounter5] & this.poly4[v.polyCounter4]) * 2 - 1;
        break;

      case 4:  // div-by-2 pure tone (square wave)
        sample = v.phase < 0.5 ? 1 : -1;
        break;

      case 5:  // div-by-2 -> 4-bit poly
        sample = (v.phase < 0.5 ? 1 : 0) * (this.poly4[v.polyCounter4] * 2 - 1);
        break;

      case 6:  // div-by-31 pure tone (low square)
        sample = (v.divCounter % 31 < 15) ? 1 : -1;
        break;

      case 7:  // 5-bit poly -> div-by-6
        sample = this.poly5[v.polyCounter5] * 2 - 1;
        break;

      case 8:  // 9-bit poly (white noise)
        sample = this.poly9[v.polyCounter9] * 2 - 1;
        break;

      case 9:  // 5-bit poly
        sample = this.poly5[v.polyCounter5] * 2 - 1;
        break;

      case 10: // div-by-31 -> 4-bit poly
        if (v.divCounter % 31 === 0) {
          sample = this.poly4[v.polyCounter4] * 2 - 1;
        }
        break;

      case 11: // Set last 4 bits to 1 (constant high)
        sample = 1;
        break;

      case 12: // div-by-6 pure tone
        sample = (v.divCounter % 6 < 3) ? 1 : -1;
        break;

      case 13: // div-by-6 pure tone (same as 12)
        sample = (v.divCounter % 6 < 3) ? 1 : -1;
        break;

      case 14: // div-by-93 (div31 -> div3)
        sample = (v.divCounter % 93 < 46) ? 1 : -1;
        break;

      case 15: // 5-bit poly -> div-by-6
        sample = this.poly5[v.polyCounter5] * ((v.divCounter % 6 < 3) ? 1 : -1);
        break;
    }

    // Advance phase and counters
    v.phase += phaseInc;
    if (v.phase >= 1) {
      v.phase -= 1;
      v.polyCounter4 = (v.polyCounter4 + 1) % 15;
      v.polyCounter5 = (v.polyCounter5 + 1) % 31;
      v.polyCounter9 = (v.polyCounter9 + 1) % 511;
      v.divCounter++;
    }

    // Scale by volume (AUDV 0-15 -> 0.0-1.0)
    return sample * (v.vol / 15) * 0.25; // 0.25 for headroom with 4 voices
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];

    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      let sample = 0;

      // Sum all 4 voices
      for (let v = 0; v < 4; v++) {
        sample += this.generateSample(v);
      }

      // Soft clip to prevent harsh distortion
      sample = Math.tanh(sample);

      channel[i] = sample;
    }

    return true;
  }
}

registerProcessor('tia-processor', TIAProcessor);


<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>
