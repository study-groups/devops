# Run the Formant Demos

## Quick Demo (Best Speech Quality)

```bash
./demo_speech.sh
```

This runs the full demonstration showing:
- "Hello world" (with phoneme breakdown)
- "Hello! My name is Formant." (best sentence)
- Vowel progression (i, e, a, o, u)
- Fricatives (s, sh, f)
- Plosives (p, b, pop, baby)
- Prosody (statement vs question)
- Full vowel triangle

**Duration**: ~2 minutes

## Interactive REPL

```bash
# Start formant engine
source formant.sh
formant_start 48000 512

# Say some words
formant_sequence "h:70:120" "e:160:125" "l:90:123" "o:240:120"  # "hello"
formant_sequence "m:110:115" "a:190:118" "m:110:116" "a:190:118"  # "mama"
formant_sequence "y:90:125" "e:180:128" "s:140:125"  # "yes"

# Control prosody
formant_prosody "PITCH" 140
formant_emotion "HAPPY" 0.8

# Stop
formant_stop
```

## Play .esto Scripts

```bash
# Simple hello
./esto_speak.sh examples/hello.esto

# Full sentence
./esto_speak.sh examples/sentence.esto

# Common words
./esto_speak.sh examples/words.esto

# Verbose mode (see each phoneme)
./esto_speak.sh -v examples/hello.esto
```

## View Available Features

```bash
# Show codebook
./list_codebook.sh

# View current status
cat STATUS.md

# Read documentation
cat README.md
cat QUICKSTART.md
```

## Build & Test

```bash
# Build from source
make clean && make

# Run original demo
./demo_formant.sh
