# Estovox Quick Start

## Installation

Estovox is a Tetra module. Make sure you have Tetra set up with `TETRA_SRC` defined.

```bash
# Source Tetra (if not already done)
source ~/tetra/tetra.sh

# Source Estovox
source $TETRA_SRC/bash/estovox/estovox.sh
```

## Running Estovox

### Interactive REPL (Recommended)

```bash
estovox
```

This starts the interactive REPL where you can type commands in real-time.

### Run Demo

```bash
estovox demo
# or
./estovox/demo_estovox.sh
```

## First Commands to Try

Once in the REPL (`estovox` command):

```bash
# Show help
help

# Try a vowel
ph a

# Try a smile
expr happy

# Articulate a sequence
seq h:100 e:200 l:100 o:300

# Say something
say hello

# List available phonemes
list phonemes

# List expressions
list expressions

# See all parameters
list params

# Manual control
set JAW_OPENNESS 0.8
set LIP_ROUNDING 1.0

# Reset to neutral
reset

# Exit
quit
```

## Common Patterns

### Making Faces

```bash
# Happy face
expr happy

# Sad face
expr sad

# Surprised
expr surprised

# Thinking
expr thinking

# Wink
expr wink_left
```

### Speaking Phonemes

```bash
# Vowels
ph i    # "ee" sound
ph a    # "ah" sound
ph u    # "oo" sound

# Consonants
ph m    # bilabial nasal
ph s    # sibilant
ph sh   # "sh" sound
```

### Animation Sequences

```bash
# Greet with sequence
seq h:100 e:150 l:100 o:200 rest:100

# Vowel progression
seq i:300 e:300 a:300 o:300 u:300 rest:200

# Expression sequence
seq neutral:500 happy:1000 surprised:800 neutral:500
```

### Manual Control

```bash
# Open mouth slowly
set JAW_OPENNESS 0.9 0.2

# Round lips quickly
set LIP_ROUNDING 1.0 0.8

# Raise eyebrows
set EYEBROW_L_HEIGHT 0.9
set EYEBROW_R_HEIGHT 0.9

# Move gaze
set GAZE_H 0.8    # Look right
set GAZE_V 0.2    # Look up
```

## Tips

1. **Rate Parameter**: The optional second parameter controls transition speed
   - Lower = slower (0.1 is very slow)
   - Higher = faster (0.9 is very fast)
   - Default is usually 0.2-0.3

2. **Sequence Timing**: In sequences, the number is milliseconds
   - `a:100` = 'a' sound for 100ms
   - `a:500` = 'a' sound for 500ms (half second)

3. **Parameter Names**: You can use short names without the `ESTOVOX_` prefix
   - `set JAW_OPENNESS 0.5` works
   - `set ESTOVOX_JAW_OPENNESS 0.5` also works

4. **Command Shortcuts**:
   - `ph` = `phoneme`
   - `seq` = `sequence`
   - `ls` = `list`
   - `h` or `?` = `help`

## Troubleshooting

### Module won't load
- Ensure `TETRA_SRC` is set: `echo $TETRA_SRC`
- Check bash version: `bash --version` (need 5.2+)
- Verify bc is installed: `which bc`

### Animation is jerky
- Try adjusting `ESTOVOX_FRAME_TIME_MS` (default 20)
- Check CPU usage (animation runs in background)

### Characters look wrong
- Ensure terminal supports Unicode
- Try a different terminal font
- Some characters may not render on all systems

## Next Steps

1. Read the full [README.md](README.md) for complete documentation
2. Explore the demo: `estovox demo`
3. Try creating custom sequences
4. Experiment with parameter combinations
5. Check out the source code in `estovox/` for module structure

## Module Integration

To use Estovox in your own scripts:

```bash
#!/usr/bin/env bash

source "$TETRA_SRC/bash/estovox/estovox.sh"

# Initialize
estovox_module_init

# Use the API
estovox_apply_preset "happy" 0.3
sleep 1
estovox_play_sequence "h:100" "i:200"

# Or start the REPL
estovox repl
```

## Getting Help

In the REPL, type `help` for command reference.

For detailed documentation, see [README.md](README.md).
