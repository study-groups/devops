# Estovox

**Facial Animation and IPA-based Articulation System**

Estovox is a Tetra module that provides real-time facial animation control with IPA (International Phonetic Alphabet) phoneme support and expressive facial modeling. It renders animated faces in the terminal using a full TUI interface built with the Tetra Design System.

## Features

- **IPA Phoneme Support**: Articulate sounds using standard IPA notation with accurate tongue, lip, and jaw positioning
- **Facial Expressions**: Pre-built emotional and communicative expressions
- **Real-time Animation**: Smooth interpolation between states with configurable tweening
- **Interactive REPL**: Command-line interface for live control
- **TUI Rendering**: Terminal-based visualization using TDS components
- **Sequencing**: Create phoneme sequences for speech-like animation
- **Parameter Control**: Direct access to all facial muscle parameters

## Quick Start

```bash
# Start interactive REPL
estovox

# Run demo
estovox demo

# Show help
estovox help
```

## REPL Commands

### Articulation

```bash
# Articulate IPA phoneme
ph a                    # Open vowel
ph i 0.5               # Close front vowel, slow transition
phoneme u              # Close back rounded vowel

# Apply facial expression
expr happy             # Smile
expr surprised         # Wide eyes, open mouth
expression angry 0.2   # Angry face, gradual transition
```

### Sequences

```bash
# Play phoneme sequence (phoneme:duration_ms)
seq a:200 i:150 u:200 rest:100

# Simple text articulation
say hello
say aeiou
```

### State Control

```bash
# Set parameter with tweening
set JAW_OPENNESS 0.8 0.3       # Open jaw smoothly
set LIP_ROUNDING 1.0           # Round lips

# Set parameter immediately
setimm EYE_OPENNESS 0.0        # Close eyes instantly

# Get current parameter value
get JAW_OPENNESS

# Reset all state to defaults
reset
```

### Information

```bash
# List phonemes
list phonemes

# List expressions
list expressions

# List all parameters and current values
list params

# List everything
list all

# Show help
help
```

## Available Phonemes

### Vowels
- `i` - Close front unrounded (beet)
- `e` - Close-mid front unrounded (bay)
- `a` - Open front unrounded (bat)
- `o` - Close-mid back rounded (boat)
- `u` - Close back rounded (boot)
- `ə` (schwa) - Mid central (about)

### Consonants
- `m` - Bilabial nasal (mom)
- `p`, `b` - Bilabial plosives (pop, bob)
- `f`, `v` - Labiodental fricatives (fan, van)
- `s`, `z` - Alveolar fricatives (see, zoo)
- `sh`, `zh` - Postalveolar fricatives (she, measure)
- `w` - Labial-velar approximant (we)
- `l` - Alveolar lateral (let)
- `r` - Alveolar trill (red)
- `h` - Glottal fricative (hat)
- `j`, `y` - Palatal approximant (yes)

### Special
- `rest`, `neutral` - Neutral face position

## Available Expressions

### Basic Emotions
- `neutral` - Neutral face
- `happy`, `smile` - Happy/smiling
- `sad` - Sad expression
- `angry` - Angry expression
- `surprised` - Surprised (wide eyes, open mouth)
- `fear`, `scared` - Fearful
- `disgust` - Disgusted

### Eyebrow Expressions
- `raised` - Raised eyebrows
- `furrowed` - Furrowed brow
- `skeptical` - One eyebrow raised

### Other
- `thinking` - Contemplative look
- `wink_left`, `wink_right` - Winking
- `blink` - Eyes closed
- `animated` - Energetic/speaking

## Facial Parameters

All parameters are normalized values from 0.0 to 1.0:

### Eyebrows
- `EYEBROW_L_HEIGHT`, `EYEBROW_R_HEIGHT` - Vertical position
- `EYEBROW_L_ARCH`, `EYEBROW_R_ARCH` - Curvature
- `EYEBROW_L_ANGLE`, `EYEBROW_R_ANGLE` - Rotation angle
- `EYEBROW_SYMMETRY` - Force symmetry (1.0 = symmetric)

### Eyes
- `EYE_OPENNESS` - Both eyes
- `EYE_L_OPENNESS`, `EYE_R_OPENNESS` - Individual eyes
- `GAZE_H` - Horizontal gaze (0.0=left, 0.5=center, 1.0=right)
- `GAZE_V` - Vertical gaze (0.0=up, 0.5=center, 1.0=down)

### Mouth/Articulators (IPA-based)
- `JAW_OPENNESS` - Jaw height (0=closed, 1=wide open)
- `JAW_FORWARD` - Jaw protrusion
- `LIP_ROUNDING` - Lip rounding (0=spread, 1=rounded)
- `LIP_COMPRESSION` - Lip compression/tension
- `LIP_PROTRUSION` - Lip protrusion forward
- `LIP_CORNER_HEIGHT` - Mouth corners (0=frown, 0.5=neutral, 1=smile)
- `TONGUE_HEIGHT` - Tongue vertical position
- `TONGUE_FRONTNESS` - Tongue front/back position
- `TONGUE_GROOVED` - Tongue grooving for sibilants
- `VELUM_LOWERED` - Velum position (0=raised, 1=lowered for nasals)

## Architecture

```
estovox/
├── estovox.sh              # Main module entry point
├── core/
│   ├── state.sh            # State management and math utilities
│   └── animation.sh        # Animation loop and preset application
├── presets/
│   ├── phonemes.sh         # IPA phoneme definitions
│   └── expressions.sh      # Facial expression presets
├── tui/
│   └── renderer.sh         # Terminal rendering with TDS
├── repl/
│   ├── commands.sh         # Command processing
│   └── estovox_repl.sh     # REPL main loop
└── README.md
```

## Examples

### Simple Articulation
```bash
estovox> ph a
estovox> ph i
estovox> ph u
```

### Expression Demo
```bash
estovox> expr neutral
estovox> expr happy
estovox> expr surprised
estovox> expr neutral
```

### Speech Sequence
```bash
estovox> seq h:100 e:200 l:100 o:300 rest:200
```

### Custom Animation
```bash
estovox> set JAW_OPENNESS 0.8 0.2
estovox> set LIP_ROUNDING 1.0 0.3
estovox> set EYEBROW_L_HEIGHT 0.9 0.4
estovox> set EYEBROW_R_HEIGHT 0.9 0.4
```

## Integration with Tetra

Estovox follows Tetra module conventions:

- Uses `$TETRA_SRC` for framework integration
- Integrates with TDS (Tetra Design System) for rendering
- Follows Tetra naming conventions for functions
- Compatible with bash 5.2+

## Technical Details

### Animation System
- **Frame Rate**: 20ms per frame (50 FPS)
- **Interpolation**: Linear interpolation (lerp) with configurable rates
- **Tweening**: Smooth transitions between states
- **Symmetry**: Automatic eyebrow symmetry enforcement

### Rendering
- **Character-based**: Uses ASCII/Unicode characters
- **Layered**: Separate rendering for eyebrows, eyes, mouth
- **Dynamic**: Adapts to terminal size
- **Status Display**: Real-time parameter monitoring

## Dependencies

- bash 5.2+
- bc (for floating-point math)
- Standard terminal with cursor control (tput)
- Optional: TDS components for enhanced rendering

## Future Enhancements

- [ ] Extended IPA phoneme set
- [ ] VISEMES for video synchronization
- [ ] Animation recording/playback
- [ ] Expression blending
- [ ] Emotion intensity scaling
- [ ] Voice integration (TTS sync)
- [ ] Multi-character scenes
- [ ] Export to animation formats

## License

Part of the Tetra framework.

## Author

Created for the Tetra modular bash framework.
