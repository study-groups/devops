# Formant Synthesis Engine - Quick Start

## 1. Build

```bash
cd /Users/mricos/src/devops/tetra/bash/game/games/formant

# Check dependencies
make check-deps

# Build
make
```

## 2. Run Demo

```bash
# Run the interactive demo
./demo_formant.sh
```

This will demonstrate:
- Vowel synthesis (i, e, a, o, u)
- Simple words ("mama", "hello")
- Prosody control (pitch variation)
- Direct formant morphing
- Consonant articulation

## 3. Interactive Use

```bash
# Source the bash module
source formant.sh

# Start engine
formant_start 48000 512

# Synthesize phonemes
formant_phoneme "a" 200 120 0.8 0.3    # 'a' sound, 200ms, 120Hz
formant_phoneme "i" 150 140 0.7 0.4    # 'i' sound, 150ms, 140Hz

# Play sequences
formant_sequence "h:80:120" "e:180:130" "l:100:125" "o:250:120"

# Control prosody
formant_prosody "PITCH" 140
formant_prosody "VOLUME" 0.9

# Stop engine
formant_stop
```

## 4. Use with Estovox

```bash
# In your estovox integration:
source "$TETRA_SRC/bash/game/games/formant/formant.sh"

# Start formant alongside estovox
formant_start 48000 512

# In your phoneme handler:
estovox_apply_preset() {
    local phoneme=$1
    local rate=$2

    # Visual (estovox)
    # ... your existing estovox code ...

    # Audio (formant)
    formant_from_estovox "$phoneme" "$rate"
}

# Cleanup
formant_stop
```

## 5. Direct ECL Commands

```bash
# Create a test file
cat > test_commands.txt <<EOF
PH a 200 120 0.8 0.3
PH i 150 140 0.7 0.4
PH u 180 110 0.7 0.3
RESET
EOF

# Run formant with command file
./bin/formant -i test_commands.txt -s 48000 -b 512
```

Or use a named pipe:

```bash
# Terminal 1: Start formant
mkfifo /tmp/formant_pipe
./bin/formant -i /tmp/formant_pipe

# Terminal 2: Send commands
echo "PH a 200 120 0.8 0.3" > /tmp/formant_pipe
echo "PH i 150 140 0.7 0.4" > /tmp/formant_pipe
echo "STOP" > /tmp/formant_pipe
```

## 6. ECL Command Reference

### Phoneme (PH)
```
PH <ipa> [duration_ms] [pitch_hz] [intensity] [rate]
```
Example: `PH a 200 120 0.8 0.3`

### Direct Formant (FM)
```
FM <f1> <f2> <f3> [bw1] [bw2] [bw3] [duration_ms]
```
Example: `FM 800 1200 2500 60 120 180 200`

### Prosody (PR)
```
PR <param> <value>
```
Params: PITCH, RATE, VOLUME, BREATHINESS, CREAKY, TENSION
Example: `PR PITCH 140`

### Emotion (EM)
```
EM <emotion> [intensity]
```
Emotions: NEUTRAL, HAPPY, SAD, ANGRY, FEAR, DISGUST, SURPRISED
Example: `EM HAPPY 0.8`

### Control
```
RESET       # Reset to neutral
STOP        # Stop engine
PAUSE       # Pause synthesis
RESUME      # Resume synthesis
```

## 7. Available Phonemes

### Vowels
`i e a o u ə`

### Consonants
**Nasals**: `m n`
**Plosives**: `p b t d k g`
**Fricatives**: `f v s z sh zh h`
**Approximants**: `w j y`
**Laterals**: `l`
**Rhotics**: `r`

### Special
`rest` - Silence

## 8. Performance Tips

| Use Case | Sample Rate | Buffer Size | Latency |
|----------|-------------|-------------|---------|
| **Low Latency** | 48000 | 256 | ~5ms |
| **Balanced** | 48000 | 512 | ~11ms |
| **Lower CPU** | 24000 | 512 | ~21ms |
| **Minimum CPU** | 16000 | 512 | ~32ms |

```bash
# Low latency mode
formant_start 48000 256

# Lower CPU mode
formant_start 24000 512
```

## 9. Troubleshooting

### Build fails
```bash
make clean
make check-deps
make
```

### No sound
- Check system audio volume
- Verify PortAudio: `./bin/formant --help`
- Increase volume: `PR VOLUME 1.0`

### Audio dropouts
- Increase buffer size: `formant_start 48000 1024`
- Reduce sample rate: `formant_start 24000 512`

### Command not executing
- Check FIFO is open: `ls -l /tmp/estovox_to_formant_*`
- Verify engine is running: `ps | grep formant`

## 10. Next Steps

- Read **ARCHITECTURE.md** for technical details
- Read **ESTOVOX_LANGUAGE.md** for full ECL specification
- Read **README.md** for comprehensive documentation
- Explore **src/** to understand implementation
- Integrate with your estovox project

## Example: Complete Synthesis Session

```bash
#!/usr/bin/env bash
source formant.sh

# Start
formant_start 48000 512

# Vowel progression
formant_sequence "i:300:140" "e:300:135" "a:300:130" "o:300:125" "u:300:120"
sleep 1

# Say "hello"
formant_sequence "h:80:120" "e:180:130" "l:100:125" "o:250:120"
sleep 1

# Emotional variation
formant_emotion "HAPPY" 0.9
formant_prosody "PITCH" 150
formant_sequence "h:70:160" "i:200:165"
sleep 1

formant_emotion "SAD" 0.8
formant_prosody "PITCH" 90
formant_prosody "CREAKY" 0.6
formant_sequence "b:80:95" "a:280:90" "i:200:85"
sleep 1

# Reset and stop
formant_reset
formant_stop

echo "Done!"
```

## Target: 20ms Latency

With the default configuration (48kHz, 512 samples):
- **Buffer latency**: 10.7ms
- **Processing latency**: ~2-5ms
- **Total latency**: ~15-20ms ✓

This meets the 20ms target for synchronized audio-visual speech synthesis!
