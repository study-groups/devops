# Formant Control Signals - Audio Puppet Interface

## Overview

The formant engine is designed as a **flexible audio puppet** controlled by real-time signals from estovox. This document describes the control signal interface that will eventually be learned by a neural network.

## Design Philosophy

1. **Separate control from synthesis** - Estovox sends high-level commands, formant handles low-level audio generation
2. **Real-time control** - Sub-20ms latency for synchronized audio-visual
3. **Learnable parameters** - All controls are continuous values suitable for neural network output
4. **Modularity** - Each source (glottal, noise, burst) can be controlled independently

## Current Implementation (Manual Control)

### Primary Control Signals

| Signal | Range | Description | Neural Net Output |
|--------|-------|-------------|-------------------|
| **F1** | 200-1000 Hz | First formant frequency | Continuous |
| **F2** | 500-3000 Hz | Second formant frequency | Continuous |
| **F3** | 1500-4000 Hz | Third formant frequency | Continuous |
| **F0** | 80-400 Hz | Fundamental frequency (pitch) | Continuous |
| **Voicing** | 0.0-1.0 | Glottal pulse amplitude | Continuous |
| **Aspiration** | 0.0-1.0 | Breathiness/noise level | Continuous |
| **Frication** | 0.0-1.0 | Fricative noise level | Continuous |
| **Intensity** | 0.0-1.0 | Overall amplitude | Continuous |

### Source Mixing Controls

The formant engine mixes three independent sources:

```
output = formant_filtered(glottal) + aspiration_noise + frication_noise + plosive_burst
```

**Source 1: Glottal Pulse** (voiced sounds)
- Controlled by: `voicing` (0-1), `F0` (pitch)
- Generates: Harmonic series via LF model
- Used for: Vowels, voiced consonants (m, n, l, r, etc.)

**Source 2: Aspiration** (breathiness)
- Controlled by: `aspiration` (0-1)
- Generates: Low-pass filtered white noise (~8kHz cutoff)
- Used for: /h/, breathy voice, voiceless consonants

**Source 3: Frication** (turbulent noise)
- Controlled by: `frication` (0-1), `F3` (noise color)
- Generates: Band-pass filtered noise (2-10kHz)
- Used for: s, f, sh, z, v, etc.

**Source 4: Plosive Burst** (transients)
- Controlled by: `burst_trigger` (event), `burst_intensity` (0-1), `F2` (burst color)
- Generates: Short noise burst with exponential decay
- Used for: p, b, t, d, k, g

### Temporal Controls

| Signal | Range | Description |
|--------|-------|-------------|
| **Lerp Rate** | 0.0-1.0 | Formant transition speed |
| **Duration** | 0-1000 ms | Phoneme duration |
| **Attack Time** | 0-50 ms | Voice onset time (VOT) |
| **Release Time** | 0-100 ms | Voice offset |

## Estovox Integration Points

### Method 1: IPA Phoneme Commands (Current)

Estovox sends discrete phoneme symbols, formant looks up preset parameters:

```
estovox → "PH a 200 120 0.8 0.3" → formant
```

This maps to:
- F1=800Hz, F2=1200Hz, F3=2500Hz (from phoneme table)
- F0=120Hz, intensity=0.8, lerp_rate=0.3
- Voicing=1.0, aspiration=0.0, frication=0.0

### Method 2: Direct Control Signals (Future - Neural Net)

Estovox sends continuous control signals every 10-20ms:

```bash
# Control signal stream (one per 10ms frame)
CTRL F1=650 F2=1400 F3=2800 F0=125 V=0.95 A=0.05 FR=0.0 I=0.75
CTRL F1=720 F2=1350 F3=2700 F0=128 V=0.92 A=0.08 FR=0.0 I=0.78
CTRL F1=800 F2=1200 F3=2500 F0=130 V=0.90 A=0.10 FR=0.0 I=0.80
```

**Control Frame Format:**
```
CTRL <param>=<value> [<param>=<value> ...]
```

**Parameters:**
- `F1`, `F2`, `F3`, `F4`, `F5` - Formant frequencies (Hz)
- `F0` - Fundamental frequency (Hz)
- `V` - Voicing (0-1)
- `A` - Aspiration (0-1)
- `FR` - Frication (0-1)
- `I` - Intensity (0-1)
- `BW1`, `BW2`, `BW3` - Bandwidths (Hz, optional)
- `OQ` - Open quotient (0-1, glottal pulse shape)
- `TL` - Spectral tilt (0-1, brightness)

### Method 3: Articulatory Parameters (Future)

Map to physiological vocal tract dimensions:

```
# Articulatory → Acoustic mapping (learned by neural net)
ART jaw=0.7 tongue_height=0.3 tongue_front=0.8 lips=0.2 velum=1.0
```

The neural network learns the mapping:
```
Articulatory Params → [Neural Net] → Formant Control Signals
```

## Neural Network Training Strategy

### Input Features (from Estovox)

```python
estovox_state = {
    # Facial articulators (from estovox state)
    'jaw_openness': 0.0-1.0,
    'lip_rounding': 0.0-1.0,
    'lip_protrusion': 0.0-1.0,
    'tongue_height': 0.0-1.0,
    'tongue_frontness': 0.0-1.0,
    'velum_lowered': 0.0-1.0,  # For nasals

    # Prosody
    'pitch_target': 80-400,  # Hz
    'emotion': embedding,     # Learned embedding
    'speech_rate': 0.5-2.0,

    # Temporal context
    'phoneme_time': 0.0-1.0,  # Progress through current phoneme
    'prev_phoneme': one_hot,  # Previous phoneme
    'next_phoneme': one_hot,  # Next phoneme (for coarticulation)
}
```

### Output Signals (to Formant)

```python
formant_controls = {
    # Formant frequencies
    'F1': 200-1000,   # Hz
    'F2': 500-3000,   # Hz
    'F3': 1500-4000,  # Hz

    # Source mixing
    'voicing': 0.0-1.0,
    'aspiration': 0.0-1.0,
    'frication': 0.0-1.0,

    # Fundamental
    'F0': 80-400,  # Hz

    # Amplitude
    'intensity': 0.0-1.0,
}
```

### Training Data Collection

1. **Record human speech** with synchronized video
2. **Track facial landmarks** (estovox input)
3. **Extract formant frequencies** from audio (formant target output)
4. **Train neural network** to map facial → formant

```
Facial Landmarks → [Conv + LSTM] → Formant Control Signals
                      ↓
                 Audio Loss (MSE on formants)
                 Perceptual Loss (mel-spectrogram)
```

### Inference Pipeline

```
Estovox State (50 FPS) → [Neural Net] → Control Signals (50 FPS) → Formant Engine → Audio
     ↓                                          ↓                          ↓
  Jaw=0.7                              F1=800, F2=1200, V=1.0        Synthesized Speech
  Tongue=0.3                           F3=2500, F0=120
  Lips=0.0
```

## Control Signal Protocol

### Low-Level Control Stream

```
# Frame-by-frame control (50 FPS = 20ms frames)
FRAME 0 F1=500 F2=1500 F3=2500 F0=120 V=1.0 A=0.0 FR=0.0 I=0.7
FRAME 1 F1=520 F2=1480 F3=2520 F0=122 V=0.98 A=0.02 FR=0.0 I=0.72
FRAME 2 F1=550 F2=1450 F3=2550 F0=125 V=0.95 A=0.05 FR=0.0 I=0.75
...
```

### Event-Based Control (Current)

```
# Discrete phoneme events
PH a 200 120 0.8 0.3      # Phoneme, duration, pitch, intensity, transition rate
PH i 150 140 0.75 0.4
PH s 120 130 0.6 0.8      # Fricative
```

### Hybrid Control (Recommended)

Combine discrete events with continuous modulation:

```
# Start phoneme (sets targets)
PH a 200 120 0.8 0.3

# Modulate during phoneme
MOD F0 +5       # Pitch rise
MOD V 0.95      # Reduce voicing
MOD A 0.1       # Add breathiness

# Next phoneme
PH i 150 140 0.75 0.4
```

## Implementation Roadmap

### Phase 1: Manual Control (Current)
- ✅ IPA phoneme presets
- ✅ Formant synthesis (F1-F3)
- ✅ Glottal source (LF model)
- ✅ Noise sources (aspiration, frication, bursts)
- ✅ Real-time audio output
- ✅ Estovox command language (ECL)

### Phase 2: Continuous Control
- ⏳ Frame-based control protocol
- ⏳ Smooth parameter interpolation
- ⏳ Real-time formant tracking
- ⏳ Estovox → formant synchronization

### Phase 3: Neural Network Integration
- ⬜ Collect training data (facial + audio)
- ⬜ Train articulatory → acoustic mapping
- ⬜ Deploy inference model
- ⬜ Real-time facial → formant pipeline

### Phase 4: Advanced Features
- ⬜ Coarticulation modeling
- ⬜ Prosody prediction
- ⬜ Emotion transfer
- ⬜ Speaker adaptation

## Example: Neural Network Control

```python
import numpy as np
import torch

class ArticulatoryToAcoustic(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = torch.nn.LSTM(input_size=10, hidden_size=64, num_layers=2)
        self.fc = torch.nn.Linear(64, 7)  # Output: F1,F2,F3,F0,V,A,FR

    def forward(self, estovox_state):
        # estovox_state: (seq_len, batch, 10) - jaw, tongue, lips, etc.
        lstm_out, _ = self.lstm(estovox_state)
        controls = self.fc(lstm_out)

        # Split output
        F1 = controls[:,:,0] * 800 + 200   # 200-1000 Hz
        F2 = controls[:,:,1] * 2500 + 500  # 500-3000 Hz
        F3 = controls[:,:,2] * 2500 + 1500 # 1500-4000 Hz
        F0 = controls[:,:,3] * 320 + 80    # 80-400 Hz
        V = torch.sigmoid(controls[:,:,4]) # 0-1
        A = torch.sigmoid(controls[:,:,5]) # 0-1
        FR = torch.sigmoid(controls[:,:,6]) # 0-1

        return {
            'F1': F1, 'F2': F2, 'F3': F3, 'F0': F0,
            'voicing': V, 'aspiration': A, 'frication': FR
        }

# Real-time inference loop
model = ArticulatoryToAcoustic()
formant_engine = FormantEngine(sample_rate=48000)

while True:
    # Get current estovox state (50 FPS)
    estovox_state = get_estovox_state()  # jaw, tongue, lips, etc.

    # Neural network inference
    controls = model(estovox_state)

    # Send to formant engine
    formant_engine.set_controls(
        F1=controls['F1'],
        F2=controls['F2'],
        F3=controls['F3'],
        F0=controls['F0'],
        voicing=controls['voicing'],
        aspiration=controls['aspiration'],
        frication=controls['frication']
    )

    # Wait for next frame (20ms)
    sleep(0.02)
```

## Summary

The formant engine provides a **flexible audio puppet** with continuous control signals that can be:

1. **Currently**: Set via discrete IPA phoneme commands
2. **Soon**: Controlled frame-by-frame with smooth interpolation
3. **Future**: Driven by a neural network mapping facial articulation to formant parameters

All control signals are continuous and differentiable, making them suitable for gradient-based learning. The architecture separates high-level phonetic intent (from estovox) from low-level acoustic synthesis (formant engine), enabling future neural network integration without changing the core synthesis engine.

**Key Innovation**: The control signal interface is designed to be both **manually scriptable** (for development/testing) and **automatically learnable** (for neural network training), creating a smooth path from rule-based to learned synthesis.
