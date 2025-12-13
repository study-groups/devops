# Estovox Command Reference

Quick reference for all REPL commands.

## Articulation Commands

| Command | Syntax | Description | Example |
|---------|--------|-------------|---------|
| `ph`, `phoneme` | `ph <ipa> [rate]` | Articulate IPA phoneme | `ph a 0.5` |
| `expr`, `expression` | `expr <name> [rate]` | Apply facial expression | `expr happy` |
| `say` | `say <text>` | Simple text articulation | `say hello` |
| `seq`, `sequence` | `seq <ph:ms> [ph:ms...]` | Play phoneme sequence | `seq a:200 i:150 u:200` |

### Rate Parameter
- Optional second parameter controlling transition speed
- Range: 0.0 (slowest) to 1.0 (fastest)
- Default: 0.2-0.3 (depends on command)
- Lower = smoother, slower transitions
- Higher = snappier, faster transitions

### Sequence Timing
- Format: `phoneme:duration_ms`
- Duration in milliseconds
- Example: `a:200` = 'a' sound for 200ms

## State Control Commands

| Command | Syntax | Description | Example |
|---------|--------|-------------|---------|
| `set` | `set <param> <value> [rate]` | Tween parameter to value | `set JAW_OPENNESS 0.8 0.3` |
| `setimm` | `setimm <param> <value>` | Set parameter immediately | `setimm EYE_OPENNESS 0.0` |
| `get` | `get <param>` | Get current parameter value | `get JAW_OPENNESS` |
| `reset` | `reset` | Reset all state to defaults | `reset` |

### Parameter Names
- Can use short names without `ESTOVOX_` prefix
- `JAW_OPENNESS` and `ESTOVOX_JAW_OPENNESS` both work

### Parameter Values
- All values normalized to 0.0-1.0 range
- Values automatically clamped to valid range

## Information Commands

| Command | Syntax | Description | Example |
|---------|--------|-------------|---------|
| `list`, `ls` | `list [type]` | List available items | `list phonemes` |
| `help`, `h`, `?` | `help` | Show help screen | `help` |
| `clear`, `cls` | `clear` | Clear screen and redraw | `clear` |

### List Types
- `phonemes` - List IPA phonemes
- `expressions` - List facial expressions
- `params` - List all parameters with current values
- `all` - List everything (default)

## Control Commands

| Command | Syntax | Description | Example |
|---------|--------|-------------|---------|
| `quit`, `exit`, `q` | `quit` | Exit Estovox REPL | `quit` |

## Available Phonemes

### Vowels
```
i     - Close front unrounded (beet)
e     - Close-mid front unrounded (bay)
a     - Open front unrounded (bat)
o     - Close-mid back rounded (boat)
u     - Close back rounded (boot)
ə     - Mid central / schwa (about)
```

### Consonants
```
m     - Bilabial nasal (mom)
p     - Voiceless bilabial plosive (pop)
b     - Voiced bilabial plosive (bob)
f     - Voiceless labiodental fricative (fan)
v     - Voiced labiodental fricative (van)
s     - Voiceless alveolar fricative (see)
z     - Voiced alveolar fricative (zoo)
sh    - Voiceless postalveolar fricative (she)
zh    - Voiced postalveolar fricative (measure)
w     - Labial-velar approximant (we)
l     - Alveolar lateral (let)
r     - Alveolar trill (red)
h     - Glottal fricative (hat)
j, y  - Palatal approximant (yes)
```

### Special
```
rest, neutral  - Neutral face position
```

## Available Expressions

### Basic Emotions
```
neutral      - Neutral face
happy        - Happy/smiling
smile        - Same as happy
sad          - Sad expression
angry        - Angry expression
surprised    - Surprised (wide eyes, open mouth)
fear         - Fearful
scared       - Same as fear
disgust      - Disgusted
```

### Eyebrow Expressions
```
raised       - Raised eyebrows
furrowed     - Furrowed brow
skeptical    - One eyebrow raised
```

### Eye States
```
wink_left    - Left eye closed
wink_right   - Right eye closed
blink        - Both eyes closed
```

### Other
```
thinking     - Contemplative look
animated     - Energetic/speaking
```

## Facial Parameters

All parameters are 0.0-1.0 normalized values.

### Eyebrows (6 params)
```
EYEBROW_L_HEIGHT      - Left eyebrow vertical position
EYEBROW_R_HEIGHT      - Right eyebrow vertical position
EYEBROW_L_ARCH        - Left eyebrow curvature
EYEBROW_R_ARCH        - Right eyebrow curvature
EYEBROW_L_ANGLE       - Left eyebrow rotation angle
EYEBROW_R_ANGLE       - Right eyebrow rotation angle
EYEBROW_SYMMETRY      - Force symmetry (1.0 = symmetric)
```

### Eyes (5 params)
```
EYE_OPENNESS          - Both eyes (global)
EYE_L_OPENNESS        - Left eye individual
EYE_R_OPENNESS        - Right eye individual
GAZE_H                - Horizontal gaze (0=left, 0.5=center, 1=right)
GAZE_V                - Vertical gaze (0=up, 0.5=center, 1=down)
```

### Mouth/Articulators (10 params - IPA-based)
```
JAW_OPENNESS          - Jaw height (0=closed, 1=wide open)
JAW_FORWARD           - Jaw protrusion
LIP_ROUNDING          - Lip rounding (0=spread, 1=rounded)
LIP_COMPRESSION       - Lip compression/tension
LIP_PROTRUSION        - Lip protrusion forward
LIP_CORNER_HEIGHT     - Mouth corners (0=frown, 0.5=neutral, 1=smile)
TONGUE_HEIGHT         - Tongue vertical position
TONGUE_FRONTNESS      - Tongue front/back position
TONGUE_GROOVED        - Tongue grooving for sibilants
VELUM_LOWERED         - Velum position (0=raised, 1=lowered for nasals)
```

## Common Workflows

### Express an Emotion
```bash
estovox> expr happy
estovox> expr surprised
estovox> expr neutral
```

### Articulate a Word
```bash
estovox> seq h:100 e:200 l:100 o:300 rest:100
```

### Custom Animation
```bash
estovox> set JAW_OPENNESS 0.9 0.2
estovox> set LIP_ROUNDING 1.0 0.3
estovox> set EYEBROW_L_HEIGHT 0.9
estovox> set EYEBROW_R_HEIGHT 0.9
```

### Combine Expression with Phoneme
```bash
estovox> expr happy
estovox> ph a
estovox> reset
```

### Quick Vowel Test
```bash
estovox> seq i:300 e:300 a:300 o:300 u:300 rest:200
```

### Wink Sequence
```bash
estovox> seq wink_left:500 neutral:200 wink_right:500 neutral:200
```

## Tips

1. **Use `clear` after `help` or `list`** - Clears text and returns to face view
2. **Experiment with rates** - Try different transition speeds (0.1 = slow, 0.9 = fast)
3. **Combine commands** - Apply expression first, then phonemes
4. **Use shortcuts** - `ph` instead of `phoneme`, `ls` instead of `list`
5. **Reset when stuck** - `reset` returns everything to neutral state
6. **Check parameters** - `list params` shows current state of all variables

## Example Session

```bash
$ estovox
estovox> help                          # Read the help
estovox> clear                         # Clear help screen
estovox> list phonemes                 # See available phonemes
estovox> clear                         # Back to face
estovox> ph a                          # Try vowel 'a'
estovox> ph i                          # Try vowel 'i'
estovox> ph u                          # Try vowel 'u'
estovox> expr happy                    # Smile
estovox> expr surprised                # Surprise
estovox> say hello                     # Say something
estovox> seq h:100 i:200 rest:100      # Custom sequence
estovox> set JAW_OPENNESS 0.5          # Manual control
estovox> get JAW_OPENNESS              # Check value
estovox> reset                         # Back to neutral
estovox> quit                          # Exit
```

## Troubleshooting Commands

| Issue | Command | Effect |
|-------|---------|--------|
| Screen cluttered | `clear` | Clear screen and redraw |
| Face stuck in weird state | `reset` | Reset all parameters to defaults |
| Forgot command syntax | `help` | Show full help screen |
| Want to see current state | `list params` | Show all parameter values |
| Animation too fast | Use lower rate values | `ph a 0.1` instead of `ph a 0.9` |
| Animation too slow | Use higher rate values | `ph a 0.9` instead of `ph a 0.1` |

---

**Pro Tip**: Type `help` then press any key to clear - this shows the full command reference then returns you to the animated face view.
