# Simple CELP for Formant - Time Domain Excitement!

## The Big Idea: Replace "Boring Math Sources" with "Cool Sound Snippets"

Instead of:
```
source = sin(2πft) + noise()  // Boring math!
```

Do this:
```
source = codebook[phoneme_type][excitement_pattern]  // Real sound textures!
```

## CELP in a Nutshell (The Fun Way)

**Traditional Formant Synthesis:**
```
Glottal Pulse → [Formant Filters] → Speech
   (math)           (resonators)
```

**Our Simple CELP:**
```
Excitation Codebook → [LPC Filter] → Speech
  (real textures!)     (learned poles)
```

## Hand-Crafted Codebook Design

### Codebook Structure

We'll create small audio "excitement snippets" for different phoneme types:

```c
typedef struct {
    float samples[160];  // 10ms @ 16kHz (keeps it simple!)
    char name[32];
    phoneme_type_t type;
    float energy;
} excitation_vector_t;

typedef struct {
    excitation_vector_t vectors[256];  // Small enough to hand-craft!
    int count;
} excitation_codebook_t;
```

### Codebook Categories

**1. Voiced Excitations (periodic with character)**
- `voice_soft` - Gentle glottal pulse (for soft speech)
- `voice_bright` - Sharp glottal closure (for excited speech)
- `voice_creaky` - Irregular pulses (for vocal fry)
- `voice_breathy` - Pulse + noise (for breathy voice)
- `voice_tense` - Narrow pulse (for tense voice)

**2. Unvoiced Excitations (noise textures)**
- `noise_white` - Pure white noise (for /h/)
- `noise_hiss` - High-frequency emphasis (for /s/)
- `noise_shush` - Mid-frequency peak (for /sh/)
- `noise_puff` - Short burst (for /p/)
- `noise_buzz` - Low rumble (for voiced fricatives)

**3. Mixed Excitations (the secret sauce!)**
- `pulse_aspiration` - Pulse + aspiration tail
- `pulse_crack` - Pulse with irregular break
- `burst_ring` - Plosive burst with formant ring
- `nasal_hum` - Low-frequency resonance

### Hand-Crafting Process

```python
# Generate codebook vectors (Python for prototyping)
import numpy as np
import scipy.signal as sig

def create_voice_soft(f0=120, sr=16000):
    """Gentle glottal pulse"""
    n_samples = 160  # 10ms
    t = np.arange(n_samples) / sr

    # Rosenberg glottal pulse (simpler than LF)
    period = 1.0 / f0
    phase = (t % period) / period

    # Smooth pulse shape
    pulse = np.where(
        phase < 0.6,
        0.5 * (1 - np.cos(np.pi * phase / 0.6)),
        np.exp(-5 * (phase - 0.6) / 0.4)
    )

    return pulse / np.max(np.abs(pulse))

def create_voice_bright(f0=120, sr=16000):
    """Sharp glottal closure - more high frequencies"""
    pulse = create_voice_soft(f0, sr)

    # Sharpen with differentiation (adds high freq)
    pulse = np.diff(pulse, prepend=0)

    return pulse / np.max(np.abs(pulse))

def create_voice_creaky(f0=70, sr=16000):
    """Irregular pulses for vocal fry"""
    n_samples = 160
    t = np.arange(n_samples) / sr

    # Two pulses with jitter
    pulse1 = create_voice_soft(f0, sr)
    pulse2 = create_voice_soft(f0 * 0.95, sr)  # Slightly detuned

    # Mix with random phase
    mix = 0.7 * pulse1 + 0.3 * np.roll(pulse2, 80)

    return mix / np.max(np.abs(mix))

def create_noise_hiss(sr=16000):
    """High-frequency noise for /s/"""
    n_samples = 160
    noise = np.random.randn(n_samples)

    # High-pass filter @ 4kHz
    sos = sig.butter(4, 4000, 'hp', fs=sr, output='sos')
    hiss = sig.sosfilt(sos, noise)

    return hiss / np.max(np.abs(hiss))

def create_burst_ring(f_burst=2000, sr=16000):
    """Plosive burst with formant ring"""
    n_samples = 160
    t = np.arange(n_samples) / sr

    # Noise burst with exponential decay
    noise = np.random.randn(n_samples)
    envelope = np.exp(-30 * t)
    burst = noise * envelope

    # Add formant ring (damped sinusoid)
    ring = np.sin(2 * np.pi * f_burst * t) * np.exp(-10 * t)

    # Mix
    mixed = 0.7 * burst + 0.3 * ring

    return mixed / np.max(np.abs(mixed))

# Save codebook
codebook = {
    'voice_soft': create_voice_soft(120),
    'voice_bright': create_voice_bright(140),
    'voice_creaky': create_voice_creaky(70),
    'noise_hiss': create_noise_hiss(),
    'burst_ring': create_burst_ring(2000),
    # ... add more!
}

# Export to C header
write_codebook_c_header(codebook, 'excitation_codebook.h')
```

## LPC Analysis & Synthesis

### Simple LPC (Keep it Fun!)

Instead of complex math, use a simple all-pole filter:

```c
typedef struct {
    float a[10];     // LPC coefficients (10th order is plenty)
    float gain;      // Overall gain
    float mem[10];   // Filter memory (for IIR)
} lpc_filter_t;

float lpc_filter_sample(lpc_filter_t* lpc, float excitation) {
    // Simple all-pole IIR filter
    float output = excitation * lpc->gain;

    // Apply LPC coefficients (10th order)
    for (int i = 0; i < 10; i++) {
        output -= lpc->a[i] * lpc->mem[i];
    }

    // Shift memory
    for (int i = 9; i > 0; i--) {
        lpc->mem[i] = lpc->mem[i-1];
    }
    lpc->mem[0] = output;

    return output;
}
```

### Hand-Crafted LPC Coefficients

Instead of analyzing real speech, hand-craft coefficients for each phoneme:

```c
// Pre-computed LPC coefficients for /a/ (open vowel)
static const float LPC_A[] = {
    1.5624, -1.1345, 0.7823, -0.4521, 0.2341,
    -0.1234, 0.0823, -0.0412, 0.0211, -0.0102
};

// Pre-computed LPC for /i/ (close front vowel)
static const float LPC_I[] = {
    1.8234, -1.6543, 1.2341, -0.8234, 0.4521,
    -0.2341, 0.1234, -0.0623, 0.0312, -0.0156
};

// Map phoneme → LPC coefficients
const float* get_lpc_for_phoneme(char phoneme) {
    switch (phoneme) {
        case 'a': return LPC_A;
        case 'i': return LPC_I;
        case 'e': return LPC_E;
        // ... etc
        default: return LPC_NEUTRAL;
    }
}
```

## Training Process (The Fun Part!)

### 1. Record Yourself!

```bash
# Record yourself saying vowels
arecord -f S16_LE -r 16000 -d 1 vowel_a.wav
arecord -f S16_LE -r 16000 -d 1 vowel_i.wav
# ... etc
```

### 2. Extract Excitation Patterns

```python
# Simplified excitation extraction
def extract_excitation(audio, lpc_order=10):
    """
    Given audio, find the excitation signal that would
    produce it through an LPC filter
    """
    # Compute LPC coefficients
    lpc = compute_lpc(audio, order=lpc_order)

    # Inverse filter to get excitation
    excitation = inverse_lpc_filter(audio, lpc)

    return excitation, lpc

# Process your recordings
for phoneme in ['a', 'i', 'e', 'o', 'u']:
    audio = load_audio(f'vowel_{phoneme}.wav')

    # Extract excitation
    excitation, lpc = extract_excitation(audio)

    # Chop into 10ms segments
    segments = chop_into_segments(excitation, segment_ms=10)

    # Pick the best ones (highest energy, most typical)
    best = pick_best_segments(segments, n=5)

    # Add to codebook
    for i, seg in enumerate(best):
        codebook[f'{phoneme}_exc_{i}'] = seg
```

### 3. Hand-Tune for Character

```python
# Now the fun part - tweaking!

def make_it_brighter(excitation):
    """Add some edge for excited speech"""
    return excitation + 0.3 * np.diff(excitation, prepend=0)

def make_it_softer(excitation):
    """Smooth for gentle speech"""
    return convolve(excitation, gaussian_window(5))

def add_vocal_fry(excitation):
    """Make it creaky"""
    # Double pulses with jitter
    return 0.7 * excitation + 0.3 * np.roll(excitation, 80)

# Curate your codebook with character
codebook['a_bright'] = make_it_brighter(codebook['a_exc_0'])
codebook['a_soft'] = make_it_softer(codebook['a_exc_0'])
codebook['a_creaky'] = add_vocal_fry(codebook['a_exc_0'])
```

## Integration with Formant Engine

### Hybrid Approach (Best of Both Worlds)

```c
typedef struct {
    // Current mode
    synthesis_mode_t mode;  // FORMANT, CELP, or HYBRID

    // Formant synthesis (existing)
    formant_bank_t formant_bank;

    // CELP synthesis (new!)
    excitation_codebook_t codebook;
    lpc_filter_t lpc;
    int current_excitation;

    // Blending
    float formant_mix;  // 0.0 = pure CELP, 1.0 = pure formant

} hybrid_synth_t;

float hybrid_synth_process(hybrid_synth_t* synth) {
    float celp_output = 0.0f;
    float formant_output = 0.0f;

    // Generate CELP output
    if (synth->mode == CELP || synth->mode == HYBRID) {
        // Get excitation from codebook
        float excitation = synth->codebook.vectors[synth->current_excitation].samples[sample_idx];

        // Filter through LPC
        celp_output = lpc_filter_sample(&synth->lpc, excitation);
    }

    // Generate formant output (existing code)
    if (synth->mode == FORMANT || synth->mode == HYBRID) {
        formant_output = formant_bank_process(...);
    }

    // Blend
    return (1.0f - synth->formant_mix) * celp_output +
           synth->formant_mix * formant_output;
}
```

## Fun Training Ideas

### 1. "Phoneme Karaoke"

Record yourself imitating the synthesizer:
```bash
# Synthesizer says /a/
./formant say "a"

# You record yourself saying /a/ in response
arecord -f S16_LE -r 16000 -d 1 my_a.wav

# Extract excitation and add to codebook
python extract_excitation.py my_a.wav --add-to-codebook
```

### 2. "Voice Cloning (Lite)"

```python
# Record your voice saying all phonemes
phonemes = ['a', 'i', 'e', 'o', 'u', 'm', 'n', 's', 'f', ...]

for ph in phonemes:
    print(f"Say: {ph}")
    audio = record_audio(duration=1)

    # Extract your characteristic excitation
    exc, lpc = extract_excitation(audio)

    # Add to personalized codebook
    codebook[f'me_{ph}'] = best_segment(exc)
    lpc_table[ph] = lpc

# Now the synthesizer sounds like YOU!
```

### 3. "Emotional Codebooks"

```python
# Record yourself with different emotions
emotions = ['happy', 'sad', 'angry', 'excited']

for emotion in emotions:
    print(f"Say 'hello' with {emotion} emotion")
    audio = record_audio()

    excitations = extract_all_segments(audio)

    # Cluster excitations by character
    clusters = kmeans(excitations, n_clusters=8)

    # Add to emotion-specific codebook
    for i, cluster_center in enumerate(clusters):
        codebook[f'{emotion}_exc_{i}'] = cluster_center

# Now you can switch emotions:
synthesize("hello", emotion='happy')
synthesize("hello", emotion='sad')
```

## Simplified Implementation Plan

### Phase 1: Codebook Bootstrap
```bash
# 1. Generate initial codebook (Python)
python tools/generate_codebook.py --output codebook.h

# 2. Compile into formant
make

# 3. Test
./bin/formant --mode celp --say "hello"
```

### Phase 2: Record & Extract
```bash
# Record training data
./tools/record_phonemes.sh

# Extract excitations
python tools/extract_excitations.py recordings/*.wav

# Generate personalized codebook
python tools/build_codebook.py --input extractions/ --output my_voice.h
```

### Phase 3: Hybrid Synthesis
```bash
# Mix formant + CELP for best quality
./bin/formant --mode hybrid --formant-mix 0.5 --say "hello world"

# Pure CELP
./bin/formant --mode celp --say "hello world"

# Pure formant (existing)
./bin/formant --mode formant --say "hello world"
```

## Why This is Fun

1. **Instant Gratification** - Record yourself, hear it back synthesized in seconds
2. **Character Control** - Hand-tune excitations for personality
3. **Simple Math** - Just IIR filtering, no complex transforms
4. **Trainable** - Can bootstrap from recordings or hand-craft
5. **Hybrid Power** - Combine with formant synthesis for best of both

## Codebook Size

Keep it tiny and fun:
```
Voice types:     5 (soft, bright, breathy, creaky, tense)
Noise types:     5 (white, hiss, shush, buzz, puff)
Mixed types:     6 (combinations)
Emotional:       8 (per emotion type)
─────────────────
Total vectors:   ~50-100 (totally hand-craftable!)
```

At 160 samples × 2 bytes = 320 bytes per vector
100 vectors = 32KB (fits in L1 cache!)

## Next Steps

1. **Create `codebook_generator.py`** - Bootstrap from math
2. **Add CELP mode to formant engine** - Simple LPC filter
3. **Record training samples** - Your voice!
4. **Extract & curate** - Build personalized codebook
5. **A/B test** - Compare formant vs CELP vs hybrid

Want me to implement the codebook generator and CELP mode? It would be a fun addition that makes the voice much more natural while keeping things simple and trainable!

**The secret**: CELP's "magic" is just having real texture in the excitation signal instead of boring sine waves. We can hand-craft that texture for maximum fun and control!
