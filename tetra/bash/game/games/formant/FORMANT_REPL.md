# Formant REPL Guide

Interactive command-line interface for professional formant recording, analysis, and synthesis.

## Quick Start

```bash
cd $TETRA_SRC/bash/game/games/formant
source formant_repl.sh
formant_game_repl_run
```

## Core Workflow

### 1. Set Up Metering

Choose a meter preset for optimal monitoring:

```bash
meter a_weight    # Human hearing curve (recommended for voice)
meter vu          # Classic VU response
meter bass        # Low-frequency emphasis
meter treble      # High-frequency emphasis
```

### 2. Record Formants

Record phonemes with automatic VAD (Voice Activity Detection):

```bash
record a          # Record vowel /a/
record s          # Record fricative /s/
record n          # Record nasal /n/
```

**VAD Features:**
- Automatic start/stop based on speech detection
- Pre-trigger buffer (captures speech onset)
- Live VU meter with peak hold
- Adaptive noise floor calibration

### 3. Analyze Recordings

Find optimal loop points and generate grain metadata:

```bash
analyze sound_bank/en_us/a.wav
```

**Analysis Output:**
- Perfect loop points (autocorrelation-based)
- Optimal midpoint for grain selection
- 16-chunk gain map for amplitude control
- Normalization gain (dB)
- Exported JSON metadata

### 4. Build Sound Bank

Add analyzed grains to the phoneme BST:

```bash
bank add a sound_bank/en_us/a.wav
bank add i sound_bank/en_us/i.wav
bank add n sound_bank/en_us/n.wav
```

### 5. Organize & Export

View the phonetic hierarchy and export:

```bash
bank list         # Show BST structure
bank export       # Export metadata to JSON
```

## Command Reference

### Engine Commands

| Command | Description |
|---------|-------------|
| `start` | Start formant synthesis engine |
| `status` | Show engine status |
| `demo` | Run speech synthesis demo |

### Metering Commands

| Command | Description |
|---------|-------------|
| `meter <preset>` | Select meter: `vu`, `a_weight`, `bass`, `treble` |
| `meter show` | Display current meter reading |
| `meter reset` | Reset meter statistics |

**Meter Presets:**

- **vu**: Classic VU meter (300ms integration, flat response)
- **a_weight**: A-weighting (ITU-R 468, emphasizes 2-5kHz)
- **bass**: Low-frequency emphasis (<500Hz)
- **treble**: High-frequency emphasis (>2kHz)

### Recording Commands

| Command | Description |
|---------|-------------|
| `record <phoneme>` | Record with VAD and live metering |
| `analyze <wav>` | Analyze WAV for grain parameters |

**Recording Tips:**
- Use `a_weight` for vocal recordings
- Speak clearly and sustain vowels for ~2 seconds
- Keep distance consistent (6-12 inches from mic)
- VAD will auto-detect speech start/stop

### Sound Bank Commands

| Command | Description |
|---------|-------------|
| `bank list` | Show phoneme BST structure |
| `bank add <phoneme> <wav>` | Add grain to bank |
| `bank play <phoneme>` | Play grain from bank |
| `bank export` | Export bank metadata (JSON) |

## Phoneme BST Structure

The sound bank organizes phonemes using a binary search tree based on phonetic features:

```
Hierarchy:
  1. Vowel (0) vs Consonant (1)
  2. Voicing (voiced/unvoiced)
  3. Obstruent vs Sonorant
  4. Place of articulation
  5. Manner of articulation
  6. Height/Backness/Rounding (vowels)
```

**Example Tree:**
```
        [FF] silence
    [C0] ə (schwa)
        [80] m (nasal)
            [40] a (low vowel)
                [20] i (high vowel)
```

**Feature Vector Encoding:**
- Bit 7: Vowel(0) / Consonant(1)
- Bit 6: Unvoiced(0) / Voiced(1)
- Bit 5: Sonorant(0) / Obstruent(1)
- Bits 4-3: Place (labial, alveolar, velar, glottal)
- Bits 2-1: Manner (stop, fricative, nasal, approximant)

## Sound Grain Metadata

Each grain contains:

```json
{
  "phoneme": "a",
  "sample_file": "sound_bank/en_us/a.wav",
  "sample_rate": 48000,
  "midpoint_sample": 24000,
  "duration_samples": 2400,
  "loop_start": 22800,
  "loop_end": 25200,
  "selection_gain_db": -2.5,
  "gain_map": [0.65, 0.82, 0.91, 0.95, ...]
}
```

**Fields:**
- `midpoint_sample`: Best cycle for looping
- `duration_samples`: Grain spread (±duration)
- `loop_start/end`: Perfect loop points (zero-crossing aligned)
- `selection_gain_db`: Normalization gain
- `gain_map`: 16 RMS values for amplitude contouring

## Advanced Usage

### Custom FIR Filters

Create custom meter filters:

1. Design FIR filter (MATLAB, Python scipy, etc.)
2. Export coefficients (one per line)
3. Save to `meters/custom.coef`
4. Use: `meter custom`

### Grain Tuning

Fine-tune loop points manually:

```bash
analyze recording.wav        # Auto-detect loop points
# Edit JSON metadata
bank add a recording.wav     # Add with custom metadata
```

### Batch Processing

Process multiple recordings:

```bash
for phoneme in a e i o u; do
  record $phoneme
  analyze sound_bank/en_us/${phoneme}.wav
  bank add $phoneme sound_bank/en_us/${phoneme}.wav
done
bank export
```

## VU Meter Display

Real-time ASCII meter:

```
[====|====]  -12dB  Peak: -6dB
[========|========]  LOW RMS:-18dB Peak:-12dB
[==============|====]  HOT RMS:-8dB Peak:-3dB
[================|==]  HOT RMS:-3dB Peak:-1dB CLIP!
```

**Colors (terminal support):**
- GREEN: Normal levels (-60dB to -12dB)
- YELLOW: Hot (approaching clip, -12dB to -6dB)
- RED: Clipping (≥ -1dB)

## Ballistics & Metering Standards

| Meter Type | Attack | Release | Integration | Peak Hold |
|------------|--------|---------|-------------|-----------|
| VU | 300ms | 300ms | 300ms | 1.5s |
| PPM | 10ms | 1500ms | 10ms | 1.5s |
| RMS | 100ms | 100ms | 100ms | 1.5s |
| Peak | 0ms | 1500ms | 0ms | 1.5s |

**Attack**: Time to reach 99% of target level
**Release**: Time to decay to 1% of peak
**Integration**: RMS window size
**Peak Hold**: Duration to hold peak indicator

## Tips & Best Practices

### Recording Quality

1. **Room Treatment**: Record in quiet space (use VAD quality mode)
2. **Microphone Distance**: 6-12 inches, consistent across recordings
3. **Level Setting**: Peak at -12dB to -6dB (use meter)
4. **Sustain Duration**: 2-3 seconds for vowels, brief for consonants

### Grain Selection

1. **Loop Length**: 2-5 pitch periods (smoother loops)
2. **Midpoint**: Choose stable, consistent cycle
3. **Gain Map**: Higher resolution = finer amplitude control
4. **Selection Gain**: Normalize to -3dB (headroom for processing)

### BST Organization

**Most Important Phonemes (top of tree):**
1. ə (schwa) - Most common vowel
2. i, a, o - Cardinal vowels
3. n, t, s - High-frequency consonants

**Traversal Strategy:**
- Vowels on left, consonants on right
- Voiced before unvoiced (within type)
- Organize by place/manner for quick similarity search

## See Also

- README.md - Project overview and quick start
- ARCHITECTURE.md - Technical details (audio pipeline, BST algorithms)
- REFERENCE.md - ECL protocol, phoneme tables
- meters/README.md - FIR filter design guide
