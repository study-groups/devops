# Formant Synthesis Engine Architecture

## Overview

**Formant** is a real-time granular synthesis engine with vocal tract modeling for speech synthesis. It receives commands from the estovox facial animation engine via the Estovox Command Language (ECL) and generates naturalistic speech audio with emotional prosody and vocal quality cues. Target latency: sub-20ms.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         ESTOVOX                              │
│                  (Facial Animation Engine)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ Estovox Command Language (ECL)
                         │ Named Pipe / Unix Socket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    FORMANT SYNTHESIS ENGINE                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Command Parser & Dispatcher                │ │
│  │  • ECL Protocol Parser                                 │ │
│  │  • Command Queue (Lock-free)                           │ │
│  │  • Timing & Synchronization                            │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │           Phoneme-to-Formant Mapper                    │ │
│  │  • IPA → Formant Frequency Tables                      │ │
│  │  • Coarticulation Rules                                │ │
│  │  • Target Interpolation (lerp)                         │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │         Vocal Tract Model (Formant Filters)            │ │
│  │  • Parallel Formant Synthesis                          │ │
│  │  • Bandpass Filter Bank (F1, F2, F3, F4, F5)           │ │
│  │  • Cascade/Parallel Hybrid                             │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │            Source Signal Generators                    │ │
│  │  • Glottal Pulse (LF Model)                            │ │
│  │  • Aspiration Noise (filtered white noise)             │ │
│  │  • Frication Noise (filtered pink noise)               │ │
│  │  • Plosive Bursts                                      │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │           Granular Synthesis Engine                    │ │
│  │  • Grain Generation & Windowing                        │ │
│  │  • Time-stretching                                     │ │
│  │  • Pitch-shifting                                      │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │          Prosody & Emotional Modulation                │ │
│  │  • Pitch Contour (F0)                                  │ │
│  │  • Vocal Fry Generator                                 │ │
│  │  • Breathiness Control                                 │ │
│  │  • Tension/Spectral Tilt                               │ │
│  └────────────┬───────────────────────────────────────────┘ │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────────┐ │
│  │              Audio Output Manager                      │ │
│  │  • PortAudio Integration                               │ │
│  │  • Ring Buffer (50ms lookahead)                        │ │
│  │  • Sample Rate Conversion (if needed)                  │ │
│  └────────────┬───────────────────────────────────────────┘ │
└────────────────┼────────────────────────────────────────────┘
                 │
                 ▼
         ┌──────────────┐
         │  PortAudio   │
         │ Audio Device │
         └──────────────┘
```

## Core Components

### 1. Command Parser (`formant_parser.c/h`)

**Responsibilities:**
- Parse ECL protocol commands from input stream
- Validate command syntax and parameters
- Queue commands with timestamps
- Handle synchronization markers

**Key Functions:**
```c
formant_command_t* formant_parse_command(const char* line);
void formant_queue_command(formant_engine_t* engine, formant_command_t* cmd);
void formant_process_command_queue(formant_engine_t* engine);
```

**Data Structures:**
```c
typedef enum {
    CMD_PHONEME,      // PH
    CMD_FORMANT,      // FM
    CMD_PROSODY,      // PR
    CMD_EMOTION,      // EM
    CMD_SEQUENCE,     // SQ
    CMD_RESET,        // RESET
    CMD_CONTROL       // SYNC, FLUSH, PAUSE, RESUME, STOP
} formant_command_type_t;

typedef struct {
    formant_command_type_t type;
    uint64_t timestamp_ms;
    union {
        struct { char ipa[4]; float duration_ms, pitch_hz, intensity, rate; } phoneme;
        struct { float f1, f2, f3, bw1, bw2, bw3; float duration_ms; } formant;
        struct { char param[16]; float value; } prosody;
        struct { char emotion[16]; float intensity; } emotion;
        // ... other command payloads
    } params;
} formant_command_t;
```

### 2. Phoneme Mapper (`formant_phonemes.c/h`)

**Responsibilities:**
- Map IPA symbols to formant frequencies
- Provide coarticulation blending rules
- Handle consonant special cases (plosives, fricatives, nasals)

**Key Data:**
```c
typedef struct {
    char ipa[4];
    float f1, f2, f3, f4, f5;    // Formant frequencies (Hz)
    float bw1, bw2, bw3;         // Bandwidths (Hz)
    float duration_default;      // Default duration (ms)
    phoneme_type_t type;         // VOWEL, PLOSIVE, FRICATIVE, NASAL, etc.
} phoneme_config_t;

// Formant frequency tables
static const phoneme_config_t PHONEME_TABLE[] = {
    {"i",  300, 2300, 3000, 3500, 4500, 50, 100, 150, 100, VOWEL},
    {"e",  400, 2000, 2800, 3500, 4500, 50, 100, 150, 120, VOWEL},
    {"a",  800, 1200, 2500, 3500, 4500, 60, 120, 180, 150, VOWEL},
    {"o",  500,  900, 2500, 3500, 4500, 50, 100, 150, 130, VOWEL},
    {"u",  300,  700, 2300, 3500, 4500, 50, 100, 150, 110, VOWEL},
    // ... more phonemes
};
```

**Key Functions:**
```c
const phoneme_config_t* formant_get_phoneme(const char* ipa);
void formant_interpolate_phonemes(
    const phoneme_config_t* from,
    const phoneme_config_t* to,
    float t,  // 0.0 to 1.0
    float* f1_out, float* f2_out, float* f3_out
);
```

### 3. Formant Synthesizer (`formant_synth.c/h`)

**Responsibilities:**
- Implement parallel formant filter bank
- Generate vocal tract resonances
- Apply bandwidth control

**Implementation:**
- **Filter Type**: Second-order resonant bandpass filters (biquad)
- **Topology**: Parallel (all formants sum together)
- **Update Rate**: Per-sample or per-buffer (512 samples)

**Key Functions:**
```c
void formant_filter_init(formant_filter_t* filt, float freq, float bw, float sample_rate);
void formant_filter_set_freq(formant_filter_t* filt, float freq_hz);
float formant_filter_process(formant_filter_t* filt, float input);

typedef struct {
    formant_filter_t f1, f2, f3, f4, f5;
    float f1_gain, f2_gain, f3_gain, f4_gain, f5_gain;
} formant_bank_t;

void formant_bank_process(formant_bank_t* bank, float* input, float* output, int num_samples);
```

**Biquad Filter Equations:**
```
y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]

For bandpass resonator:
  Center freq (fc), bandwidth (bw), sample rate (fs)
  Q = fc / bw
  omega = 2*pi*fc/fs
  alpha = sin(omega) / (2*Q)

  b0 = alpha
  b1 = 0
  b2 = -alpha
  a0 = 1 + alpha
  a1 = -2*cos(omega)
  a2 = 1 - alpha
```

### 4. Source Generators (`formant_source.c/h`)

**Glottal Pulse (LF Model):**
```c
float formant_generate_glottal_pulse(
    float phase,        // 0.0 to 1.0 within pitch period
    float oq,           // Open quotient (0.3-0.7)
    float alpha,        // Spectral tilt
    float* derivative   // Output: glottal flow derivative
);
```

**Noise Sources:**
```c
float formant_generate_aspiration(float intensity);
float formant_generate_frication(float intensity, float cutoff_freq);
float formant_generate_white_noise();
float formant_generate_pink_noise();
```

**Implementation:**
- **Glottal Pulse**: Liljencrants-Fant (LF) model for realistic voice source
- **Aspiration**: Low-pass filtered white noise (< 8 kHz)
- **Frication**: Band-pass filtered noise (2-10 kHz, frequency-dependent)

### 5. Granular Engine (`formant_grain.c/h`)

**Grain Structure:**
```c
typedef struct {
    float* buffer;          // Grain audio samples
    int length;             // Number of samples
    int position;           // Current playback position
    float pitch_shift;      // Pitch shift factor
    float envelope_pos;     // Envelope position (0.0-1.0)
    bool active;
} grain_t;

typedef struct {
    grain_t grains[MAX_GRAINS];  // Typically 32-64 grains
    int num_active_grains;
    float grain_size_ms;         // 20-100ms typical
    float grain_density;         // 0.0-1.0 (overlap factor)
} grain_engine_t;
```

**Key Functions:**
```c
void formant_grain_trigger(grain_engine_t* engine, float* source, int length, float pitch);
void formant_grain_process(grain_engine_t* engine, float* output, int num_samples);
```

**Window Functions:**
- Hanning window for smooth grain envelopes
- Overlap-add for continuous output
- Density control for time-stretching effects

### 6. Emotional Modulation (`formant_emotion.c/h`)

**Vocal Fry (Creaky Voice):**
```c
typedef struct {
    float intensity;           // 0.0-1.0
    float irregularity;        // Pitch period jitter
    float subharmonic_amp;     // F0/2 amplitude
    int pulse_count;           // For irregular pulse trains
} vocal_fry_state_t;

void formant_apply_vocal_fry(
    vocal_fry_state_t* state,
    float* signal,
    int num_samples,
    float f0_hz
);
```

**Implementation:**
- Irregular pitch periods (coefficient of variation: 20-40%)
- Subharmonic injection at F0/2
- Amplitude reduction (3-6 dB)
- Spectral tilt increase

**Breathiness:**
```c
typedef struct {
    float intensity;           // 0.0-1.0
    float noise_amp;           // Aspiration noise level
    float harmonic_damp;       // Harmonic amplitude reduction
} breathiness_state_t;

void formant_apply_breathiness(
    breathiness_state_t* state,
    float* harmonic_signal,
    float* noise_signal,
    float* output,
    int num_samples
);
```

**Tension:**
- Bandwidth reduction (sharper formants)
- High-frequency boost (+3-6 dB above 2 kHz)
- Jitter and shimmer (pitch/amplitude irregularity)

### 7. Audio Engine (`formant_audio.c/h`)

**PortAudio Integration:**
```c
typedef struct {
    PaStream* stream;
    float sample_rate;         // 44100 or 48000 Hz
    int buffer_size;           // 512 or 1024 samples
    ring_buffer_t ring;        // 50ms lookahead buffer
    pthread_mutex_t lock;
} audio_engine_t;

int formant_audio_callback(
    const void* input,
    void* output,
    unsigned long frame_count,
    const PaStreamCallbackTimeInfo* time_info,
    PaStreamCallbackFlags status_flags,
    void* user_data
);

void formant_audio_init(audio_engine_t* audio, float sample_rate);
void formant_audio_start(audio_engine_t* audio);
void formant_audio_write(audio_engine_t* audio, float* samples, int num_samples);
```

**Ring Buffer:**
```c
typedef struct {
    float* buffer;
    int size;              // Power of 2 (e.g., 8192)
    int write_pos;
    int read_pos;
} ring_buffer_t;

void ring_buffer_write(ring_buffer_t* rb, float* data, int num_samples);
int ring_buffer_read(ring_buffer_t* rb, float* data, int num_samples);
int ring_buffer_available(ring_buffer_t* rb);
```

## State Management

**Global Engine State:**
```c
typedef struct {
    // Audio
    audio_engine_t audio;
    float sample_rate;

    // Synthesis
    formant_bank_t formant_bank;
    grain_engine_t grain_engine;

    // Source
    float phase;               // Glottal phase (0.0-1.0)
    float f0_hz;              // Fundamental frequency
    float intensity;          // Amplitude (0.0-1.0)

    // Formant targets (for interpolation)
    float f1_current, f1_target;
    float f2_current, f2_target;
    float f3_current, f3_target;
    float lerp_rate;          // Interpolation rate

    // Prosody
    float pitch_base;         // Base pitch (Hz)
    float rate_multiplier;    // Speaking rate
    float volume;             // Global volume

    // Emotion
    vocal_fry_state_t vocal_fry;
    breathiness_state_t breathiness;
    float tension;

    // Timing
    uint64_t time_ms;         // Current synthesis time

    // Command queue
    formant_command_t* cmd_queue;
    int cmd_queue_size;
    int cmd_queue_head;
    int cmd_queue_tail;

} formant_engine_t;
```

**Initialization:**
```c
formant_engine_t* formant_engine_create(float sample_rate);
void formant_engine_destroy(formant_engine_t* engine);
void formant_engine_reset(formant_engine_t* engine);
```

## Processing Pipeline

**Per-Buffer Processing (512 samples @ 44.1 kHz = 11.6ms):**

1. **Command Processing**
   - Check command queue for commands with `timestamp <= current_time`
   - Execute commands (update formant targets, prosody, etc.)

2. **Parameter Interpolation**
   - Interpolate formant frequencies towards targets (lerp)
   - Smooth pitch contour
   - Update filter coefficients

3. **Source Generation**
   - Generate glottal pulse train at F0
   - Apply vocal fry irregularity if enabled
   - Generate aspiration/frication noise

4. **Formant Filtering**
   - Pass source signal through formant filter bank
   - Sum all formants with appropriate gains

5. **Emotional Modulation**
   - Apply breathiness (noise mixing)
   - Apply tension (spectral shaping)
   - Apply vocal fry (subharmonics)

6. **Granular Processing** (optional)
   - Grain-based time/pitch manipulation
   - Used for special effects or time-stretching

7. **Output**
   - Write to ring buffer
   - PortAudio callback reads from ring buffer

## File Structure

```
formant/
├── formant.sh               # Bash wrapper & REPL
├── src/
│   ├── formant_main.c       # Main entry point & IPC handling
│   ├── formant_engine.c/h   # Core engine structure
│   ├── formant_parser.c/h   # Command parser
│   ├── formant_phonemes.c/h # IPA → Formant mapping
│   ├── formant_synth.c/h    # Formant filter bank
│   ├── formant_source.c/h   # Glottal & noise sources
│   ├── formant_grain.c/h    # Granular synthesis
│   ├── formant_emotion.c/h  # Emotional modulation
│   ├── formant_audio.c/h    # PortAudio integration
│   └── formant_util.c/h     # Utilities (lerp, clamp, etc.)
├── include/
│   └── formant.h            # Public API header
├── Makefile                 # Build system
├── ARCHITECTURE.md          # This file
├── ESTOVOX_LANGUAGE.md      # ECL protocol spec
├── README.md                # User documentation
└── test_formant.sh          # Test suite
```

## Build System

**Dependencies:**
- PortAudio (v19+)
- Math library (libm)
- Pthreads
- C11 compiler (gcc/clang)

**Makefile Targets:**
```make
all:            Build formant binary
clean:          Remove build artifacts
install:        Install to $TETRA_SRC/bash/game/games/formant/bin/
test:           Run test suite
debug:          Build with debug symbols
```

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Latency | < 20ms | End-to-end command-to-audio |
| CPU Usage | < 10% | Single core @ 2 GHz |
| Buffer Size | 512 samples | @ 44.1 kHz = 11.6ms |
| Lookahead | 40ms | Ring buffer size |
| Formants | 5 | F1-F5 (can reduce to 3 for efficiency) |
| Max Grains | 32-64 | Concurrent active grains |

## Integration with Estovox

**Bash Wrapper (`formant.sh`):**
```bash
#!/usr/bin/env bash
source "$TETRA_SRC/bash/game/games/formant/formant.sh"

formant_start() {
    local fifo="/tmp/estovox_to_formant_$$"
    mkfifo "$fifo"

    # Start C engine
    "$FORMANT_BIN" --input "$fifo" --sample-rate 44100 &
    FORMANT_PID=$!

    # Open FIFO for writing
    exec 3>"$fifo"
    FORMANT_FD=3
}

formant_send() {
    echo "$*" >&$FORMANT_FD
}

formant_stop() {
    echo "STOP" >&$FORMANT_FD
    kill $FORMANT_PID
    exec 3>&-
}
```

**Estovox Integration:**

In `estovox/core/animation.sh`, add:
```bash
if [[ -n "$FORMANT_ENABLED" ]]; then
    formant_send "PH $phoneme $duration $pitch $intensity $rate"
fi
```

## Future Enhancements

1. **MIDI Control**: Real-time pitch and expression control
2. **Vibrato/Tremolo**: Automatic modulation
3. **Formant Singing**: Extended pitch range synthesis
4. **Multi-voice**: Polyphonic synthesis (chorus, harmony)
5. **Room Reverb**: Spatial audio effects
6. **GPU Acceleration**: Formant filtering on GPU
7. **Neural Vocoder**: Deep learning-based synthesis

## References

- **Formant Synthesis**: Klatt, D. H. (1980). "Software for a cascade/parallel formant synthesizer"
- **LF Model**: Fant, G. et al. (1985). "The LF-model revisited"
- **Vocal Fry**: Keating, P. et al. (2015). "Acoustic properties of phonation modes"
- **PortAudio**: http://www.portaudio.com/
- **IPA**: International Phonetic Alphabet charts
