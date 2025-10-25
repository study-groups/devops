# CELP Quick Start Guide

## What is CELP?

**Code-Excited Linear Prediction (CELP)** adds natural vocal texture to formant synthesis by using real audio "excitation patterns" instead of purely mathematical waveforms. This makes the synthesized speech sound more human-like and less robotic.

## The Three Modes

### 1. FORMANT Mode (Traditional)
- Uses mathematical glottal pulses
- Very clean and precise
- Somewhat robotic sound
- **Best for**: Clear, predictable output

### 2. CELP Mode (Natural)
- Uses pre-recorded excitation textures
- Adds character and warmth
- More organic sound
- **Best for**: Natural-sounding speech

### 3. HYBRID Mode (Best of Both)
- Blends FORMANT and CELP synthesis
- Configurable mix ratio (0.0 to 1.0)
- Combines clarity with naturalness
- **Best for**: Most applications

## Quick Examples

### Switch Between Modes

```bash
# Start formant engine
./bin/formant

# In another terminal, send commands:

# Pure formant synthesis
echo "MODE FORMANT" | nc localhost 9999
echo "PH a 500 120 0.8 0.3" | nc localhost 9999

# Pure CELP synthesis
echo "MODE CELP" | nc localhost 9999
echo "PH a 500 120 0.8 0.3" | nc localhost 9999

# Hybrid mode (50/50 blend)
echo "MODE HYBRID 0.5" | nc localhost 9999
echo "PH a 500 120 0.8 0.3" | nc localhost 9999
```

### Or use stdin directly:

```bash
(
  echo "MODE CELP"
  echo "PH h 70 120 0.8 0.3"
  echo "PH e 160 125 0.8 0.3"
  echo "PH l 90 123 0.7 0.3"
  echo "PH o 240 120 0.8 0.3"
  sleep 1
) | ./bin/formant
```

### Hybrid Mix Control

The `mix` parameter in HYBRID mode controls the blend:
- `0.0` = 100% CELP (maximum texture)
- `0.5` = 50/50 blend (balanced)
- `1.0` = 100% formant (maximum clarity)

```bash
# More CELP character (70% CELP, 30% formant)
echo "MODE HYBRID 0.3" | ./bin/formant

# Balanced blend
echo "MODE HYBRID 0.5" | ./bin/formant

# More formant clarity (30% CELP, 70% formant)
echo "MODE HYBRID 0.7" | ./bin/formant
```

## Run the Demo

The easiest way to hear the difference is to run the comparison demo:

```bash
./demo_celp_compare.sh
```

This will say "Hello! My name is Formant" in all three modes so you can hear the difference.

## How CELP Works

### Excitation Codebook (37 vectors)

The CELP codebook contains 37 different "excitation textures":

1. **Voiced Variations** (15 vectors)
   - Soft, bright, creaky, breathy, tense
   - Low, mid, high pitch variants
   - Used for vowels and voiced consonants

2. **Noise Types** (5 vectors)
   - White noise, hiss, shush, puff, buzz
   - Used for fricatives (s, f, sh, etc.)

3. **Mixed Types** (7 vectors)
   - Pulse+aspiration, burst+ring, nasal hum
   - Used for plosives and nasals

4. **Random Variations** (10 vectors)
   - Additional texture variety

### Automatic Selection

When you send a phoneme command, formant automatically:
1. Detects the phoneme type (vowel, fricative, plosive, etc.)
2. Selects appropriate excitation from codebook
3. Applies LPC filtering to shape the sound
4. Outputs natural-sounding audio

## From Bash Scripts

```bash
source formant.sh

# Start engine
formant_start 48000 512

# Set mode
formant_mode "CELP"

# Say some phonemes
formant_sequence "h:70:120" "e:160:125" "l:90:123" "o:240:120"

# Try hybrid mode
formant_mode "HYBRID" 0.5
formant_sequence "a:200:120" "i:200:130"

# Stop
formant_stop
```

## Performance

- **Latency**: Same as formant mode (~11ms @ 48kHz)
- **CPU Usage**: Slightly higher (~6-7% vs ~5%)
- **Quality**: Noticeably more natural

## Tips

1. **Start with HYBRID 0.5** - Good balance of clarity and naturalness
2. **Use CELP for sustained vowels** - The texture really shines here
3. **Use FORMANT for precise control** - When you need exact frequencies
4. **Experiment with mix values** - Find your sweet spot (0.3-0.7 range works well)

## Troubleshooting

### Sounds too robotic?
- Switch to CELP or lower the hybrid mix (try 0.3)

### Sounds too noisy?
- Switch to FORMANT or raise the hybrid mix (try 0.7)

### Want to customize?
- Edit LPC coefficients in `src/formant_celp.c`
- Generate custom excitation vectors with `tools/generate_codebook.py`

## Next Steps

- Run `./demo_celp_compare.sh` to hear the differences
- Try different hybrid mix values
- Integrate with estovox for audio-visual speech
- Record your own voice samples for personalized excitations

## Technical Details

For more information about the CELP implementation:
- See `CELP_DESIGN.md` for architecture details
- See `src/formant_celp.c` for implementation
- See `src/excitation_codebook.h` for all 37 excitation vectors
