# Estovox Command Language for Formant Synthesis

## Overview

The Estovox Command Language (ECL) is a real-time protocol for streaming phonetic articulation commands from the estovox facial animation engine to the formant audio synthesis engine. It enables synchronized audio-visual speech synthesis with sub-30ms latency.

## Design Goals

1. **Real-time Performance**: Target 20ms average phoneme duration
2. **IPA Compatibility**: Direct mapping from IPA phonemes to formant parameters
3. **Prosodic Control**: Support for pitch, duration, intensity, and emotional cues
4. **Streaming Protocol**: Continuous command flow with timing precision
5. **Extensibility**: Support for advanced features (vocal fry, breathiness, etc.)

## Command Format

### Basic Syntax

```
<command> [param1] [param2] ... [paramN]\n
```

All commands are newline-terminated ASCII strings for easy parsing and debugging.

## Core Commands

### 1. PHONEME Command

Synthesize an IPA phoneme with optional prosodic parameters.

```
PH <ipa> [duration_ms] [pitch_hz] [intensity] [rate]
```

**Parameters:**
- `ipa`: IPA phoneme symbol (a, i, e, o, u, m, p, etc.)
- `duration_ms`: Duration in milliseconds (default: 100)
- `pitch_hz`: Fundamental frequency in Hz (default: 120)
- `intensity`: Amplitude 0.0-1.0 (default: 0.7)
- `rate`: Interpolation speed 0.0-1.0 (default: 0.3)

**Examples:**
```
PH a 200 120 0.8 0.3
PH i 150 140 0.7 0.4
PH m 100 110 0.6 0.2
```

### 2. FORMANT Command

Direct formant frequency control (low-level).

```
FM <f1> <f2> <f3> [bw1] [bw2] [bw3] [duration_ms]
```

**Parameters:**
- `f1`, `f2`, `f3`: Formant frequencies in Hz
- `bw1`, `bw2`, `bw3`: Bandwidths in Hz (default: 50, 100, 150)
- `duration_ms`: Duration in milliseconds (default: 100)

**Examples:**
```
FM 800 1200 2500 50 100 150 200
FM 300 2300 3000 60 120 180 150
```

### 3. PROSODY Command

Set prosodic parameters for upcoming phonemes.

```
PR <param> <value>
```

**Parameters:**
- `PITCH`: Base pitch in Hz (80-400)
- `RATE`: Speaking rate multiplier (0.5-2.0)
- `VOLUME`: Global volume (0.0-1.0)
- `BREATHINESS`: Breathiness amount (0.0-1.0)
- `CREAKY`: Vocal fry/creaky voice (0.0-1.0)
- `TENSION`: Vocal tension (0.0-1.0)

**Examples:**
```
PR PITCH 140
PR RATE 1.2
PR BREATHINESS 0.3
PR CREAKY 0.5
```

### 4. EMOTION Command

Apply emotional vocal characteristics.

```
EM <emotion> [intensity]
```

**Emotions:**
- `NEUTRAL`: Neutral voice (default)
- `HAPPY`: Raised pitch, increased rate, brighter formants
- `SAD`: Lowered pitch, decreased rate, darker formants
- `ANGRY`: Increased tension, irregular pitch, harsh quality
- `FEAR`: Raised pitch, increased breathiness, tremolo
- `DISGUST`: Nasal quality, lowered F2
- `SURPRISED`: Sudden pitch rise, increased intensity

**Intensity:** 0.0-1.0 (default: 0.7)

**Examples:**
```
EM HAPPY 0.8
EM SAD 0.6
EM ANGRY 1.0
```

### 5. SEQUENCE Command

Execute a timed sequence of phonemes.

```
SQ <ph:dur:pitch> <ph:dur:pitch> ...
```

**Format:** `phoneme:duration_ms:pitch_hz`

**Examples:**
```
SQ h:80:120 e:180:130 l:100:125 o:250:120
SQ a:200:140 i:200:150 u:200:130
```

### 6. RESET Command

Reset synthesis engine to neutral state.

```
RESET
```

**Effect:**
- Clears all formant targets
- Resets prosody to defaults
- Clears emotion state
- Stops any active synthesis

### 7. CONTROL Commands

Engine control and synchronization.

```
SYNC <timestamp_ms>    # Synchronization marker
FLUSH                  # Flush audio buffer
PAUSE                  # Pause synthesis
RESUME                 # Resume synthesis
STOP                   # Stop immediately (with fadeout)
```

## IPA Phoneme to Formant Mappings

### Vowels

| IPA | F1 (Hz) | F2 (Hz) | F3 (Hz) | Description |
|-----|---------|---------|---------|-------------|
| i   | 300     | 2300    | 3000    | Close front unrounded (beet) |
| e   | 400     | 2000    | 2800    | Close-mid front (bay) |
| a   | 800     | 1200    | 2500    | Open front (bat) |
| o   | 500     | 900     | 2500    | Close-mid back rounded (boat) |
| u   | 300     | 700     | 2300    | Close back rounded (boot) |
| ə   | 500     | 1500    | 2500    | Mid central schwa (about) |

### Consonants

| IPA | Type | F1 | F2 | F3 | Special |
|-----|------|----|----|----|---------|
| m   | Nasal | 300 | 1000 | 2500 | Velum lowered, F1 damped |
| p   | Plosive | silence | silence | silence | 20ms silence + burst |
| b   | Plosive | silence | silence | silence | 20ms silence + voiced burst |
| f   | Fricative | noise | 1400 | 3000 | High-frequency noise |
| v   | Fricative | noise | 1400 | 3000 | Voiced high-freq noise |
| s   | Fricative | noise | noise | 4000+ | High sibilant noise |
| z   | Fricative | noise | noise | 4000+ | Voiced sibilant |
| sh  | Fricative | noise | 2000 | 3000 | Lower sibilant |
| w   | Approximant | 300 | 700 | 2300 | u-like transition |
| l   | Lateral | 400 | 1200 | 2800 | F1 lowered |
| r   | Rhotic | 350 | 1400 | 1600 | F3 lowered |
| h   | Fricative | noise | noise | noise | Breathy aspiration |

## Timing and Synchronization

### Target Latency

- **Command processing**: < 1ms
- **Formant interpolation**: 5-8ms
- **Audio buffer**: 8-12ms
- **Total latency**: 15-20ms (target)

### Buffer Management

The formant engine maintains a 50ms lookahead buffer:
- Allows smooth interpolation
- Handles timing jitter
- Enables coarticulation effects

### Coarticulation

Formants are interpolated smoothly between phonemes to simulate natural coarticulation:
- Interpolation rate controlled by `rate` parameter
- Fast transitions for consonants (rate > 0.7)
- Slow transitions for vowels (rate 0.2-0.4)

## Emotional Vocal Cues

### Vocal Fry (Creaky Voice)

Triggered by `PR CREAKY <value>` or `EM SAD/DISGUST`

**Implementation:**
- Irregular pitch periods (jitter)
- Subharmonic generation (F0/2)
- Reduced intensity
- Increased spectral tilt

**Typical in:**
- Sentence-final lowering
- Sad/depressed emotion
- Relaxed speech

### Breathiness

Triggered by `PR BREATHINESS <value>` or `EM FEAR/SURPRISED`

**Implementation:**
- Aspiration noise mixed with harmonics
- Reduced harmonic amplitude
- Increased bandwidth
- Noise proportional to airflow

### Tension

Triggered by `PR TENSION <value>` or `EM ANGRY`

**Implementation:**
- Narrower bandwidths (sharper formants)
- Increased high-frequency energy
- Irregular pitch (jitter/shimmer)
- Harder voice onset

## Protocol Examples

### Simple Utterance: "hello"

```
PR PITCH 120
PR RATE 1.0
PH h 80 120 0.5 0.8
PH e 180 130 0.7 0.3
PH l 100 125 0.7 0.4
PH o 250 120 0.7 0.3
RESET
```

### Emotional: "I'm so happy!" (happy)

```
EM HAPPY 0.9
PR PITCH 140
PH a 200 160 0.8 0.4
PH m 120 155 0.7 0.3
PH s 100 150 0.7 0.8
PH o 220 165 0.8 0.3
PH h 70 170 0.6 0.8
PH a 180 175 0.9 0.4
PH p 60 175 0.7 0.9
PH i 180 180 0.9 0.3
RESET
```

### Sad with Vocal Fry: "I'm sad"

```
EM SAD 0.8
PR PITCH 90
PR CREAKY 0.6
PH a 250 95 0.5 0.2
PH m 150 90 0.5 0.2
PH s 120 88 0.5 0.6
PH a 280 85 0.4 0.2
PH d 100 80 0.4 0.5
RESET
```

## IPC Transport

### Named Pipe (FIFO)

Default transport for estovox → formant communication.

**Setup:**
```bash
mkfifo /tmp/estovox_to_formant
formant < /tmp/estovox_to_formant &
estovox > /tmp/estovox_to_formant
```

### Unix Socket (Alternative)

For lower latency and bidirectional feedback.

```bash
formant --socket /tmp/formant.sock &
estovox --formant-socket /tmp/formant.sock
```

### Shared Memory (Future)

For ultra-low latency (< 5ms).

## Command Extensions (Future)

### Real-time Parameter Modulation

```
MOD <param> <waveform> <freq_hz> <depth>
```

**Examples:**
```
MOD PITCH SINE 5.0 20        # 5Hz vibrato, ±20Hz
MOD VOLUME SINE 6.0 0.1      # 6Hz tremolo
```

### Granular Synthesis Control

```
GRAIN <size_ms> <density> <pitch_variation>
```

**Examples:**
```
GRAIN 50 0.8 0.2             # 50ms grains, 80% density
```

### Formant Trajectory

```
TRAJ <f1_start> <f1_end> <f2_start> <f2_end> <duration_ms>
```

**Examples:**
```
TRAJ 300 800 2300 1200 300   # i → a transition
```

## Performance Considerations

1. **Command Parsing**: Use simple string tokenization (< 100μs)
2. **Formant Calculation**: Pre-compute filter coefficients
3. **Buffer Size**: 512-1024 samples @ 44.1kHz (11-23ms)
4. **Real-time Priority**: Use SCHED_FIFO or audio thread priority
5. **Lock-free Queues**: For command buffer management

## Error Handling

### Command Errors

```
ERROR INVALID_COMMAND <line>
ERROR MISSING_PARAM <command>
ERROR OUT_OF_RANGE <param> <value>
```

### Engine Errors

```
ERROR BUFFER_UNDERRUN
ERROR AUDIO_DEVICE_FAILURE
ERROR SYNTHESIS_FAILURE
```

## Summary

The Estovox Command Language provides a simple, text-based protocol for real-time control of formant synthesis. It balances expressiveness with parsing efficiency, enabling rich vocal synthesis while maintaining sub-20ms latency.

**Key Features:**
- ✅ IPA-based phoneme control
- ✅ Prosodic parameter control
- ✅ Emotional vocal characteristics
- ✅ Real-time performance (< 20ms)
- ✅ Extensible command set
- ✅ Simple text protocol
- ✅ Vocal fry and breathiness support
