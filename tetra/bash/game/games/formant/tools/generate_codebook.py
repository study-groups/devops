#!/usr/bin/env python3
"""
generate_codebook.py - Simple CELP Codebook Generator

Creates hand-crafted excitation vectors for CELP synthesis.
Outputs C header file for embedding in formant engine.

Requirements: numpy, scipy
Install: tetra_python_activate && pip install numpy scipy

Usage:
    source ~/tetra/tetra.sh
    tetra_python_activate
    python generate_codebook.py --output ../src/excitation_codebook.h
    python generate_codebook.py --plot  # Preview codebook vectors
"""

import numpy as np
import scipy.signal as sig
from pathlib import Path
import argparse

# Config
SAMPLE_RATE = 16000
VECTOR_LENGTH = 160  # 10ms @ 16kHz
CODEBOOK_SIZE = 64   # Small enough to hand-tune

def normalize(signal):
    """Normalize to [-1, 1]"""
    max_val = np.max(np.abs(signal))
    if max_val > 0:
        return signal / max_val
    return signal

# ============================================================================
# Voiced Excitations (Periodic)
# ============================================================================

def create_voice_soft(f0=120):
    """Gentle glottal pulse - for soft speech"""
    t = np.arange(VECTOR_LENGTH) / SAMPLE_RATE
    period = 1.0 / f0
    phase = (t % period) / period

    # Rosenberg glottal pulse
    pulse = np.where(
        phase < 0.6,
        0.5 * (1 - np.cos(np.pi * phase / 0.6)),
        np.exp(-5 * (phase - 0.6) / 0.4)
    )

    return normalize(pulse)

def create_voice_bright(f0=140):
    """Sharp glottal closure - for excited speech"""
    pulse = create_voice_soft(f0)
    # Sharpen with differentiation
    brightened = pulse + 0.5 * np.diff(pulse, prepend=0)
    return normalize(brightened)

def create_voice_creaky(f0=70):
    """Irregular pulses - vocal fry"""
    pulse1 = create_voice_soft(f0)
    pulse2 = create_voice_soft(f0 * 0.93)  # Detuned

    # Mix with offset
    mixed = 0.7 * pulse1 + 0.3 * np.roll(pulse2, 75)
    return normalize(mixed)

def create_voice_breathy(f0=120):
    """Pulse + noise - breathy voice"""
    pulse = create_voice_soft(f0)
    noise = np.random.randn(VECTOR_LENGTH) * 0.15

    # Low-pass the noise
    sos = sig.butter(2, 1000, 'lp', fs=SAMPLE_RATE, output='sos')
    noise_lp = sig.sosfilt(sos, noise)

    return normalize(pulse + noise_lp)

def create_voice_tense(f0=140):
    """Narrow pulse - tense voice"""
    t = np.arange(VECTOR_LENGTH) / SAMPLE_RATE
    period = 1.0 / f0
    phase = (t % period) / period

    # Narrower pulse (higher OQ)
    pulse = np.where(
        phase < 0.4,
        0.5 * (1 - np.cos(np.pi * phase / 0.4)),
        np.exp(-10 * (phase - 0.4) / 0.6)  # Faster decay
    )

    return normalize(pulse)

# ============================================================================
# Unvoiced Excitations (Noise)
# ============================================================================

def create_noise_white():
    """Pure white noise"""
    return normalize(np.random.randn(VECTOR_LENGTH))

def create_noise_hiss():
    """High-frequency emphasis - for /s/"""
    noise = np.random.randn(VECTOR_LENGTH)
    sos = sig.butter(4, 4000, 'hp', fs=SAMPLE_RATE, output='sos')
    return normalize(sig.sosfilt(sos, noise))

def create_noise_shush():
    """Mid-frequency peak - for /sh/"""
    noise = np.random.randn(VECTOR_LENGTH)
    # Band-pass 2-4 kHz
    sos = sig.butter(4, [2000, 4000], 'bp', fs=SAMPLE_RATE, output='sos')
    return normalize(sig.sosfilt(sos, noise))

def create_noise_puff():
    """Short burst - for /p/, /t/, /k/"""
    noise = np.random.randn(VECTOR_LENGTH)
    t = np.arange(VECTOR_LENGTH) / SAMPLE_RATE
    envelope = np.exp(-50 * t)  # Fast decay
    return normalize(noise * envelope)

def create_noise_buzz():
    """Low rumble - for voiced fricatives"""
    noise = np.random.randn(VECTOR_LENGTH)
    sos = sig.butter(4, 500, 'lp', fs=SAMPLE_RATE, output='sos')
    return normalize(sig.sosfilt(sos, noise))

# ============================================================================
# Mixed Excitations (The Secret Sauce)
# ============================================================================

def create_pulse_aspiration(f0=120):
    """Pulse + aspiration tail"""
    pulse = create_voice_soft(f0)
    t = np.arange(VECTOR_LENGTH) / SAMPLE_RATE

    # Aspiration with decay
    noise = np.random.randn(VECTOR_LENGTH)
    sos = sig.butter(2, 2000, 'lp', fs=SAMPLE_RATE, output='sos')
    aspiration = sig.sosfilt(sos, noise) * np.exp(-10 * t)

    return normalize(pulse + 0.4 * aspiration)

def create_burst_ring(f_burst=2000):
    """Plosive burst + formant ring"""
    t = np.arange(VECTOR_LENGTH) / SAMPLE_RATE

    # Noise burst
    noise = np.random.randn(VECTOR_LENGTH)
    envelope = np.exp(-30 * t)
    burst = noise * envelope

    # Formant ring (damped sinusoid)
    ring = np.sin(2 * np.pi * f_burst * t) * np.exp(-15 * t)

    return normalize(0.7 * burst + 0.3 * ring)

def create_nasal_hum(f0=110):
    """Low-frequency resonance - for /m/, /n/"""
    pulse = create_voice_soft(f0)

    # Add low-frequency emphasis
    sos = sig.butter(2, 500, 'lp', fs=SAMPLE_RATE, output='sos')
    return normalize(sig.sosfilt(sos, pulse))

# ============================================================================
# Codebook Generation
# ============================================================================

def generate_codebook():
    """Generate full excitation codebook"""
    codebook = {}

    # Voiced (5 variations × 3 pitches)
    for pitch_name, f0 in [('low', 90), ('mid', 120), ('high', 150)]:
        codebook[f'voice_soft_{pitch_name}'] = create_voice_soft(f0)
        codebook[f'voice_bright_{pitch_name}'] = create_voice_bright(f0)
        codebook[f'voice_creaky_{pitch_name}'] = create_voice_creaky(max(70, f0-30))
        codebook[f'voice_breathy_{pitch_name}'] = create_voice_breathy(f0)
        codebook[f'voice_tense_{pitch_name}'] = create_voice_tense(f0)

    # Unvoiced (5 types)
    codebook['noise_white'] = create_noise_white()
    codebook['noise_hiss'] = create_noise_hiss()
    codebook['noise_shush'] = create_noise_shush()
    codebook['noise_puff'] = create_noise_puff()
    codebook['noise_buzz'] = create_noise_buzz()

    # Mixed (6 types × 2 variants)
    for pitch_name, f0 in [('mid', 120), ('high', 140)]:
        codebook[f'pulse_asp_{pitch_name}'] = create_pulse_aspiration(f0)
        codebook[f'nasal_hum_{pitch_name}'] = create_nasal_hum(f0)

    for freq_name, freq in [('low', 1500), ('mid', 2000), ('high', 2500)]:
        codebook[f'burst_ring_{freq_name}'] = create_burst_ring(freq)

    # Add some random variations for diversity
    for i in range(5):
        codebook[f'random_pulse_{i}'] = create_voice_soft(100 + i * 10)
        codebook[f'random_noise_{i}'] = create_noise_white()

    return codebook

def write_c_header(codebook, output_path):
    """Write codebook as C header file"""
    with open(output_path, 'w') as f:
        f.write("""/**
 * excitation_codebook.h
 *
 * Auto-generated CELP excitation codebook
 * Generated by: tools/generate_codebook.py
 */

#ifndef EXCITATION_CODEBOOK_H
#define EXCITATION_CODEBOOK_H

#include <string.h>

#define EXCITATION_VECTOR_LENGTH %d
#define EXCITATION_CODEBOOK_SIZE %d
#define EXCITATION_SAMPLE_RATE %d

typedef struct {
    const char* name;
    const float samples[EXCITATION_VECTOR_LENGTH];
    float energy;
} excitation_vector_t;

""" % (VECTOR_LENGTH, len(codebook), SAMPLE_RATE))

        # Write vectors
        for i, (name, vector) in enumerate(codebook.items()):
            energy = np.sqrt(np.mean(vector ** 2))

            f.write(f'/* Vector {i}: {name} */\n')
            f.write(f'static const excitation_vector_t EXCITATION_{i} = {{\n')
            f.write(f'    .name = "{name}",\n')
            f.write(f'    .samples = {{')

            # Write samples (8 per line)
            for j, sample in enumerate(vector):
                if j % 8 == 0:
                    f.write('\n        ')
                f.write(f'{sample:.6f}f, ')

            f.write('\n    },\n')
            f.write(f'    .energy = {energy:.6f}f\n')
            f.write('};\n\n')

        # Write codebook array
        f.write('static const excitation_vector_t* EXCITATION_CODEBOOK[] = {\n')
        for i in range(len(codebook)):
            f.write(f'    &EXCITATION_{i},\n')
        f.write('};\n\n')

        # Write lookup function
        f.write("""
const excitation_vector_t* get_excitation_by_name(const char* name) {
    for (int i = 0; i < EXCITATION_CODEBOOK_SIZE; i++) {
        if (strcmp(EXCITATION_CODEBOOK[i]->name, name) == 0) {
            return EXCITATION_CODEBOOK[i];
        }
    }
    return NULL;
}

#endif /* EXCITATION_CODEBOOK_H */
""")

    print(f"✓ Wrote {len(codebook)} excitation vectors to {output_path}")

def plot_codebook(codebook):
    """Plot codebook vectors for inspection"""
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("Error: matplotlib required for plotting")
        print("Install with: pip install matplotlib")
        return

    # Plot first 16 vectors
    fig, axes = plt.subplots(4, 4, figsize=(15, 10))
    axes = axes.flatten()

    for i, (name, vector) in enumerate(list(codebook.items())[:16]):
        axes[i].plot(vector)
        axes[i].set_title(name, fontsize=8)
        axes[i].set_ylim(-1.1, 1.1)
        axes[i].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig('codebook_preview.png', dpi=150)
    print("✓ Saved codebook preview to codebook_preview.png")
    plt.show()

def main():
    parser = argparse.ArgumentParser(description='Generate CELP excitation codebook')
    parser.add_argument('--output', default='../src/excitation_codebook.h',
                       help='Output C header file')
    parser.add_argument('--plot', action='store_true',
                       help='Plot codebook vectors')
    args = parser.parse_args()

    print("Generating CELP excitation codebook...")
    print(f"  Sample rate: {SAMPLE_RATE} Hz")
    print(f"  Vector length: {VECTOR_LENGTH} samples ({VECTOR_LENGTH/SAMPLE_RATE*1000:.1f} ms)")
    print(f"  Target codebook size: {CODEBOOK_SIZE} vectors")
    print()

    codebook = generate_codebook()
    print(f"✓ Generated {len(codebook)} excitation vectors")

    if args.plot:
        plot_codebook(codebook)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_c_header(codebook, output_path)

    print()
    print("Next steps:")
    print("  1. Review codebook_preview.png (if --plot was used)")
    print("  2. Add CELP synthesis mode to formant engine")
    print("  3. Test: ./bin/formant --mode celp --say 'hello'")
    print("  4. Compare: ./demo_comparison.sh")

if __name__ == '__main__':
    main()
