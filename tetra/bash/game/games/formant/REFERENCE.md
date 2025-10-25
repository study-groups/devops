# Formant Reference Manual

Technical reference for ECL protocol, phoneme data structures, and API details.

## Estovox Command Language (ECL)

### Command Format

Commands are sent as text lines via named pipe or stdin:

```
COMMAND_NAME param1 param2 ...
```

### Core Commands

#### MODE - Set Synthesis Mode

```
MODE <mode> [mix]
```

**Modes:**
- `FORMANT` - Pure formant synthesis
- `CELP` - Code-excited linear prediction
- `HYBRID` - Blend (mix: 0.0=CELP, 1.0=formant)

**Examples:**
```
MODE FORMANT
MODE CELP
MODE HYBRID 0.5
```

#### PH - Phoneme Synthesis

```
PH <ipa> [duration_ms] [pitch_hz] [intensity] [rate]
```

**Parameters:**
- `ipa`: IPA phoneme symbol
- `duration_ms`: Duration in milliseconds (default: phoneme-specific)
- `pitch_hz`: Fundamental frequency (default: 120)
- `intensity`: Amplitude 0.0-1.0 (default: 0.8)
- `rate`: Speaking rate multiplier (default: 1.0)

**Examples:**
```
PH a 200 120 0.8 1.0
PH i 150 140 0.7 1.0
PH s 100 0 0.6 1.0
```

#### FM - Direct Formant Control

```
FM <f1> <f2> <f3> [bw1] [bw2] [bw3] [duration_ms]
```

**Parameters:**
- `f1-f3`: Formant frequencies in Hz
- `bw1-bw3`: Bandwidths in Hz (default: 50, 100, 150)
- `duration_ms`: Duration (default: 100)

**Examples:**
```
FM 800 1200 2500 50 100 150 200
FM 300 2300 3000 60 120 180 150
```

#### PR - Prosody Control

```
PR <param> <value>
```

**Parameters:**
- `PITCH`: Base pitch in Hz (80-400)
- `RATE`: Speaking rate multiplier (0.5-2.0)
- `VOLUME`: Global volume (0.0-1.0)
- `BREATHINESS`: Breathiness intensity (0.0-1.0)
- `CREAKY`: Vocal fry intensity (0.0-1.0)
- `TENSION`: Vocal tension (0.0-1.0)

**Examples:**
```
PR PITCH 140
PR RATE 1.2
PR BREATHINESS 0.3
```

#### EM - Emotion Setting

```
EM <emotion> [intensity]
```

**Emotions:**
- `NEUTRAL` - Default voice
- `HAPPY` - Raised pitch, brighter formants
- `SAD` - Lowered pitch, vocal fry
- `ANGRY` - Increased tension, irregular pitch
- `FEAR` - Raised pitch, breathiness
- `DISGUST` - Nasal quality
- `SURPRISED` - Sudden pitch rise

**Examples:**
```
EM HAPPY 0.8
EM SAD 0.6
EM NEUTRAL
```

#### RECORD - Audio Recording

```
RECORD <phoneme> <duration_ms> <filename>
```

**Fixed Duration:**
```
RECORD a 1000 recordings/a.wav
```

**VAD Mode:**
```
RECORD_VAD <phoneme> <max_duration_ms> <filename> [vad_mode]
```

**VAD Modes:**
- `0` - Quality (conservative, 300ms hangover)
- `1` - Balanced (default, 200ms hangover)
- `2` - Aggressive (fast clipping, 100ms hangover)

**Examples:**
```
RECORD_VAD a 5000 recordings/a.wav 1
RECORD_VAD m 5000 recordings/m.wav 0
```

#### Control Commands

```
RESET              # Reset to neutral state
STOP               # Stop synthesis with fadeout
PAUSE              # Pause synthesis
RESUME             # Resume synthesis
FLUSH              # Flush audio buffers
SYNC <timestamp>   # Synchronization marker
```

## IPA Phoneme Table

### Vowels

| IPA | Description | F1 | F2 | F3 | Example Word |
|-----|-------------|----|----|----| -------------|
| `i` | Close front unrounded | 280 | 2250 | 2890 | beet |
| `e` | Close-mid front | 400 | 2000 | 2550 | bay |
| `æ` | Near-open front | 650 | 1700 | 2350 | bat |
| `a` | Open front | 750 | 1220 | 2550 | father |
| `o` | Close-mid back rounded | 400 | 800 | 2600 | boat |
| `u` | Close back rounded | 300 | 870 | 2250 | boot |
| `ə` | Mid central (schwa) | 500 | 1500 | 2500 | about |

### Consonants - Nasals

| IPA | Description | F1 | F2 | F3 | Example |
|-----|-------------|----|----|----| --------|
| `m` | Bilabial nasal | 280 | 1300 | 2300 | mat |
| `n` | Alveolar nasal | 280 | 1700 | 2600 | net |

### Consonants - Plosives

| IPA | Description | Voiced | Burst Freq | Example |
|-----|-------------|--------|------------|---------|
| `p` | Bilabial stop | No | 500-1500 | pat |
| `b` | Bilabial stop | Yes | 500-1500 | bat |
| `t` | Alveolar stop | No | 4000-5000 | tat |
| `d` | Alveolar stop | Yes | 4000-5000 | dad |
| `k` | Velar stop | No | 2000-3000 | cat |
| `g` | Velar stop | Yes | 2000-3000 | gap |

### Consonants - Fricatives

| IPA | Description | Voiced | Frication | Example |
|-----|-------------|--------|-----------|---------|
| `f` | Labiodental fricative | No | High | fat |
| `v` | Labiodental fricative | Yes | High | vat |
| `s` | Alveolar fricative | No | Very High | sat |
| `z` | Alveolar fricative | Yes | Very High | zap |
| `sh` | Postalveolar fricative | No | High | ship |
| `zh` | Postalveolar fricative | Yes | High | measure |
| `h` | Glottal fricative | No | Low | hat |

### Consonants - Approximants & Liquids

| IPA | Description | F1 | F2 | F3 | Example |
|-----|-------------|----|----|----| --------|
| `w` | Labial-velar approximant | 300 | 800 | 2300 | wet |
| `j/y` | Palatal approximant | 280 | 2200 | 3000 | yes |
| `l` | Lateral approximant | 350 | 1200 | 2800 | let |
| `r` | Rhotic approximant | 420 | 1200 | 1600 | red |

## Sound Grain Data Format

### JSON Schema

```json
{
  "phoneme": "string",
  "sample_file": "path/to/file.wav",
  "sample_rate": number,
  "midpoint_sample": number,
  "duration_samples": number,
  "loop_start": number,
  "loop_end": number,
  "selection_gain_db": number,
  "gain_map": [number, number, ...]
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `phoneme` | string | IPA phoneme symbol |
| `sample_file` | string | Path to WAV file (relative or absolute) |
| `sample_rate` | number | Sample rate in Hz |
| `midpoint_sample` | number | Optimal cycle midpoint (sample index) |
| `duration_samples` | number | Grain spread (±duration from midpoint) |
| `loop_start` | number | Loop point A (sample index) |
| `loop_end` | number | Loop point B (sample index) |
| `selection_gain_db` | number | Normalization gain in dB |
| `gain_map` | array | Per-chunk RMS values (16 floats) |

### Example Grain

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
  "gain_map": [
    0.65, 0.72, 0.81, 0.87,
    0.91, 0.94, 0.96, 0.98,
    0.97, 0.95, 0.91, 0.86,
    0.79, 0.72, 0.64, 0.56
  ]
}
```

## C API Reference

### Metering Functions

```c
formant_meter_t* formant_meter_create(float sample_rate, const char* preset);
void formant_meter_destroy(formant_meter_t* meter);
int formant_meter_load_filter(formant_meter_t* meter, const char* filename);
void formant_meter_process(formant_meter_t* meter, const float* samples, int num_samples);
float formant_meter_get_rms_db(formant_meter_t* meter);
float formant_meter_get_peak_db(formant_meter_t* meter);
float formant_meter_get_peak_hold_db(formant_meter_t* meter);
void formant_meter_reset(formant_meter_t* meter);
void formant_meter_format_display(formant_meter_t* meter, char* buffer, int buffer_size, int width);
```

### Sound Bank Functions

```c
sound_bank_t* sound_bank_create(const char* bank_path);
void sound_bank_destroy(sound_bank_t* bank);
sound_grain_t* sound_bank_load_grain(sound_bank_t* bank, const char* phoneme,
                                      const char* wav_file, const char* metadata_file);
sound_grain_t* sound_bank_find_grain(sound_bank_t* bank, const char* phoneme);
int sound_bank_analyze_grain(const char* wav_file, sound_grain_t* grain);
int sound_bank_export_grain_metadata(const sound_grain_t* grain, const char* filename);
void sound_bank_bst_insert(sound_bank_t* bank, const formant_phoneme_config_t* phoneme,
                           sound_grain_t* grain);
uint8_t sound_bank_calc_feature_vector(const formant_phoneme_config_t* phoneme);
void sound_bank_print_tree(phoneme_bst_node_t* node, int depth);
```

### VAD Functions

```c
formant_vad_t* formant_vad_create(float sample_rate, int mode);
void formant_vad_destroy(formant_vad_t* vad);
void formant_vad_reset(formant_vad_t* vad);
void formant_vad_calibrate(formant_vad_t* vad, const float* samples, int num_samples);
formant_vad_result_t formant_vad_process_frame(formant_vad_t* vad, const float* samples, int frame_size);
formant_vad_state_t formant_vad_get_state(formant_vad_t* vad);
int formant_vad_get_pretrigger(formant_vad_t* vad, float* output, int max_samples);
```

## FIR Filter Coefficient Format

### File Format

Plain text, one coefficient per line:

```
# Comment lines start with #
# A-weighting filter for 48kHz
-0.000142
-0.000381
-0.000721
...
0.012865
...
-0.000142
```

### Coefficient Calculation

Using scipy (Python):

```python
import numpy as np
from scipy import signal

# Design A-weighting FIR filter
numtaps = 31
sample_rate = 48000

# A-weighting frequency response (simplified)
freq = [20, 100, 1000, 10000, 20000]
gain_db = [-50, -20, 0, -10, -40]
gain_linear = 10**(np.array(gain_db) / 20)

# Design filter
coeffs = signal.firwin2(numtaps, freq, gain_linear, fs=sample_rate)

# Export
with open('a_weight.coef', 'w') as f:
    f.write('# A-weighting filter\\n')
    for c in coeffs:
        f.write(f'{c:.6f}\\n')
```

## Phonetic Feature Vector Encoding

### Bit Layout (8-bit)

```
[7] [6] [5] [4-3]   [2-1]      [0]
 │   │   │    │       │         │
 │   │   │    │       │         └─ Reserved
 │   │   │    │       └─────────── Manner (00=stop, 01=fric, 10=nasal, 11=approx)
 │   │   │    └─────────────────── Place (00=labial, 01=alveolar, 10=velar, 11=glottal)
 │   │   └──────────────────────── Obstruent(1) / Sonorant(0)
 │   └──────────────────────────── Voiced(1) / Unvoiced(0)
 └──────────────────────────────── Consonant(1) / Vowel(0)
```

### Examples

| Phoneme | Binary | Hex | Description |
|---------|--------|-----|-------------|
| `a` | 01000000 | 0x40 | Vowel, voiced, low |
| `i` | 01100000 | 0x60 | Vowel, voiced, high |
| `ə` | 01010000 | 0x50 | Vowel, voiced, mid (schwa) |
| `m` | 11000100 | 0xC4 | Cons, voiced, sonorant, labial, nasal |
| `n` | 11001100 | 0xCC | Cons, voiced, sonorant, alveolar, nasal |
| `p` | 10100000 | 0xA0 | Cons, unvoiced, obstruent, labial, stop |
| `t` | 10101000 | 0xA8 | Cons, unvoiced, obstruent, alveolar, stop |
| `s` | 10101010 | 0xAA | Cons, unvoiced, obstruent, alveolar, fric |
| `f` | 10100010 | 0xA2 | Cons, unvoiced, obstruent, labial, fric |

### BST Traversal

Search by feature vector (binary search):

```c
phoneme_bst_node_t* find(phoneme_bst_node_t* root, uint8_t target) {
    if (!root) return NULL;
    if (root->feature_vector == target) return root;
    if (target < root->feature_vector)
        return find(root->left, target);
    else
        return find(root->right, target);
}
```

## Performance Specifications

| Metric | Target | Achieved |
|--------|--------|----------|
| Latency | < 20ms | ~11ms @ 48kHz/512 |
| CPU Usage | < 10% | ~5% (M1, 2GHz) |
| Formants | 3-5 | 3 active, 5 available |
| Phonemes | 20+ | 40+ supported |
| Sample Rates | Multiple | 48k, 44.1k, 24k, 16k |
| VAD Latency | < 100ms | ~50ms (quality mode) |
| Meter Response | Mode-dependent | VU: 300ms, PPM: 10ms |

## File Locations

```
formant/
├── bin/formant                   # Compiled binary
├── src/                          # C source files
│   ├── formant_metering.c       # VU meter implementation
│   ├── formant_sound_bank.c     # BST & grain management
│   ├── formant_vad.c            # Voice activity detection
│   └── ...
├── include/formant.h             # Public API header
├── meters/                       # FIR coefficient files
│   ├── a_weight.coef
│   ├── vu.coef
│   ├── bass.coef
│   └── treble.coef
├── sound_bank/en_us/            # English phoneme bank
├── formant_repl.sh              # Interactive REPL
└── README.md                    # User documentation
```

## See Also

- FORMANT_REPL.md - REPL user guide
- ARCHITECTURE.md - Technical architecture
- README.md - Project overview
- meters/README.md - FIR filter design
