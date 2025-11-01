# Estovox Speech Script (.esto) Format

## Overview

The `.esto` file format provides a simple, human-readable way to script speech synthesis for the formant engine. It supports phoneme sequences, timing control, and prosodic directives.

## Format Specification

### Comments

Lines starting with `#` are comments and are ignored.

```
# This is a comment
```

### Directives

Directives start with `@` and control synthesis parameters.

```
@<COMMAND> <arguments>
```

**Available Directives:**

| Directive | Arguments | Description | Example |
|-----------|-----------|-------------|---------|
| `@EMOTION` | `<emotion> [intensity]` | Set emotional tone | `@EMOTION HAPPY 0.8` |
| `@PITCH` | `<hz>` | Set base pitch frequency | `@PITCH 140` |
| `@RATE` | `<multiplier>` | Set speaking rate | `@RATE 1.2` |
| `@VOLUME` | `<0.0-1.0>` | Set volume level | `@VOLUME 0.9` |
| `@BREATHINESS` | `<0.0-1.0>` | Set breathiness | `@BREATHINESS 0.3` |
| `@CREAKY` | `<0.0-1.0>` | Set vocal fry/creaky voice | `@CREAKY 0.5` |
| `@TENSION` | `<0.0-1.0>` | Set vocal tension | `@TENSION 0.7` |
| `@RESET` | - | Reset all to defaults | `@RESET` |

**Emotion Values:**
- `NEUTRAL` - Neutral voice (default)
- `HAPPY` - Raised pitch, brighter formants
- `SAD` - Lowered pitch, vocal fry
- `ANGRY` - Increased tension, harsh quality
- `FEAR` - Raised pitch, breathiness
- `DISGUST` - Nasal quality
- `SURPRISED` - Sudden pitch rise

### Phoneme Lines

Phonemes are specified one per line in the format:

```
<phoneme>:<duration_ms>:<pitch_hz>
```

- **phoneme**: IPA symbol (a, i, e, o, u, m, p, etc.)
- **duration_ms**: Duration in milliseconds
- **pitch_hz**: Pitch in Hz (use 0 for silence/rest)

**Examples:**
```
a:200:120      # 'a' sound, 200ms, 120Hz
i:150:140      # 'i' sound, 150ms, 140Hz
rest:100:0     # Silence for 100ms
```

### Available Phonemes

#### Vowels
- `i` - beet (300Hz, 2300Hz, 3000Hz)
- `e` - bay (400Hz, 2000Hz, 2800Hz)
- `a` - bat (800Hz, 1200Hz, 2500Hz)
- `o` - boat (500Hz, 900Hz, 2500Hz)
- `u` - boot (300Hz, 700Hz, 2300Hz)
- `ə` - schwa/about (500Hz, 1500Hz, 2500Hz)

#### Consonants
- **Nasals**: `m`, `n`
- **Plosives**: `p`, `b`, `t`, `d`, `k`, `g`
- **Fricatives**: `f`, `v`, `s`, `z`, `sh`, `zh`, `h`
- **Approximants**: `w`, `j`, `y`
- **Lateral**: `l`
- **Rhotic**: `r`

#### Special
- `rest` - Silence (use with pitch 0)

## Example Files

### Example 1: Simple Hello

**File: hello.esto**
```
# Say "hello"
@EMOTION NEUTRAL 0.5
@PITCH 120

h:80:120
e:180:125
l:100:122
o:280:120

rest:200:0
```

### Example 2: Emotional Greeting

**File: greeting.esto**
```
# Happy greeting
@EMOTION HAPPY 0.8
@PITCH 140

# "Hi there!"
h:70:150
a:180:155
i:200:160

rest:150:0

# Change to calmer tone
@EMOTION NEUTRAL 0.5
@PITCH 125

# "How are you?"
h:80:130
a:150:132
u:180:130

rest:100:0

a:120:128
r:100:125

rest:100:0

y:80:132
u:200:130
```

### Example 3: Word Sequence

**File: words.esto**
```
@PITCH 120
@RATE 1.0

# "hello"
h:80:120
e:180:125
l:100:122
o:280:120
rest:200:0

# "world"
w:100:118
ə:80:120
r:80:120
l:100:120
d:120:118
rest:200:0

# "goodbye"
g:80:115
u:160:118
d:100:118
rest:100:0
b:80:118
a:200:120
i:180:122
rest:300:0
```

## Usage

### Method 1: Using esto_speak.sh (Recommended)

```bash
# Basic usage
./esto_speak.sh examples/hello.esto

# Verbose mode (shows each phoneme)
./esto_speak.sh -v examples/sentence.esto

# Custom sample rate
./esto_speak.sh -s 24000 examples/greeting.esto
```

### Method 2: Convert to ECL and pipe to formant

```bash
# Convert .esto to ECL commands and send to formant
cat examples/hello.esto | grep -v '^#' | while read line; do
    # Process line and convert to ECL
    # ...
done
```

### Method 3: Manual playback via bash

```bash
source formant.sh
formant_start 48000 512

# Read and execute .esto file manually
# Each phoneme:duration:pitch line becomes:
# formant_phoneme <phoneme> <duration> <pitch>

formant_stop
```

## Timing Guidelines

### Phoneme Durations

| Phoneme Type | Typical Duration | Notes |
|--------------|------------------|-------|
| Vowels | 100-250ms | Longer in stressed syllables |
| Nasals | 80-120ms | m, n |
| Plosives | 60-100ms | p, b, t, d, k, g |
| Fricatives | 100-150ms | f, v, s, z, sh |
| Approximants | 80-120ms | w, l, r, y |
| Pauses | 100-300ms | Between words |

### Speaking Rate

- **Slow**: Rate 0.7-0.8 (longer durations)
- **Normal**: Rate 1.0 (default)
- **Fast**: Rate 1.2-1.5 (shorter durations)

Use `@RATE <multiplier>` to adjust globally, or manually adjust individual phoneme durations.

### Pitch Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| **Monotone** | Flat pitch | All phonemes same Hz |
| **Rising** | Question intonation | Gradual increase (120→140Hz) |
| **Falling** | Statement intonation | Gradual decrease (140→110Hz) |
| **Emphasis** | Stress on syllable | Higher pitch + longer duration |

## Creating .esto Files

### Option 1: Manual Creation

Create a text file with `.esto` extension and write phoneme sequences by hand. This gives the most control.

```bash
vim my_speech.esto
```

### Option 2: Use text2esto.sh Helper

Simple text-to-phoneme converter (basic):

```bash
# Generate .esto from text
./text2esto.sh "hello world" > hello.esto

# With custom pitch
./text2esto.sh -p 140 "hi there" > greeting.esto

# Edit the generated file for better results
vim greeting.esto
```

**Note**: `text2esto.sh` provides a basic starting point but requires manual editing for quality results.

### Option 3: Copy and Modify Examples

```bash
# Start from an example
cp examples/hello.esto my_speech.esto
vim my_speech.esto
```

## Best Practices

1. **Add Comments**: Document what each section represents
   ```
   # "hello" - greeting
   # "world" - subject
   ```

2. **Use Directives**: Set emotion and prosody at the start
   ```
   @EMOTION NEUTRAL 0.5
   @PITCH 120
   @RATE 1.0
   ```

3. **Include Pauses**: Add `rest` between words and phrases
   ```
   rest:150:0   # Between words
   rest:300:0   # Between sentences
   ```

4. **Vary Pitch**: Use pitch contours for natural speech
   ```
   # Rising pitch for questions
   h:80:125
   e:180:135
   l:100:140
   o:280:145
   ```

5. **Test Incrementally**: Build up complex scripts piece by piece
   ```bash
   # Test each word separately
   ./esto_speak.sh word1.esto
   ./esto_speak.sh word2.esto

   # Then combine
   cat word1.esto word2.esto > combined.esto
   ```

## Advanced Techniques

### Coarticulation Simulation

Smooth transitions between phonemes by overlapping durations and adjusting pitch:

```
# "hello" with smooth transitions
h:80:120      # Start 'h'
e:180:125     # Overlap with 'e', pitch rises
l:100:123     # 'l' continues pitch
l:80:122      # Second 'l' slightly lower
o:280:120     # 'o' returns to base
```

### Emphasis

Increase duration and pitch for stressed syllables:

```
# "HELLO world" (emphasize "hello")
h:100:140      # Louder, higher, longer
e:220:145
l:120:143
o:320:140

rest:100:0

w:80:115       # Quieter, lower, shorter
ə:70:115
r:70:115
l:80:115
d:100:110
```

### Emotional Shifts

Change emotion mid-script:

```
@EMOTION NEUTRAL 0.5
# Calm greeting
h:80:120
i:200:120

rest:100:0

@EMOTION EXCITED 0.9
@PITCH 155
# Excited exclamation
h:70:165
e:180:170
y:160:168
```

## Troubleshooting

### Choppy Speech
- Increase phoneme durations
- Add more `rest` pauses
- Reduce `@RATE` multiplier

### Robotic Sound
- Vary pitch across phonemes
- Use emotion directives
- Add breathiness/tension

### Wrong Phoneme
- Check IPA symbol spelling
- See available phonemes list
- Use verbose mode: `./esto_speak.sh -v file.esto`

## File Examples Included

```
examples/
├── hello.esto          # Simple "hello world"
├── greeting.esto       # "Hi there! How are you?"
├── sentence.esto       # "The quick brown fox..."
└── words.esto          # Common word samples
```

## Summary

The `.esto` format provides:
- ✅ Simple, readable syntax
- ✅ Full phoneme control
- ✅ Prosody and emotion directives
- ✅ Comment support
- ✅ Easy to generate programmatically
- ✅ Compatible with formant synthesis engine

Start with simple examples and gradually build complexity!
