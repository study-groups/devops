#!/usr/bin/env bash
# Estovox TUI Guide
# Complete guide to the full interactive TUI interface

## Overview

Estovox now features a **full TUI (Text User Interface)** similar to the org module, with two distinct modes:

1. **Command Mode** - Type commands like a REPL (default on startup)
2. **Interactive Mode** - Real-time keyboard control of facial parameters

## Quick Start

```bash
# Start Estovox (defaults to TUI)
estovox

# You'll see the animated face with a command prompt
# Type 'ipa' to see the IPA chart
# Type 'interactive' to switch to interactive mode
# Type 'help' for all commands
```

## The Two Modes

### Command Mode (Default)

**What it is**: Traditional command-line interface where you type commands

**How to enter**:
- Start Estovox (it starts in command mode)
- Press `:` from interactive mode

**Prompt**: `estovox>`

**Usage**:
```bash
estovox> ph a              # Articulate phoneme
estovox> expr happy        # Show expression
estovox> ipa               # Show IPA chart (color-coded!)
estovox> interactive       # Switch to interactive mode
estovox> help              # Show help
estovox> quit              # Exit
```

**Status Bar** (bottom of screen):
```
╔══════════════════════════════════════════════════════╗
║ MODE: COMMAND                                        ║
║ Enter commands below. Type 'help' for help          ║
║ ESC: Interactive Mode  |  Ctrl+C: Quit               ║
╚══════════════════════════════════════════════════════╝
```

### Interactive Mode

**What it is**: Real-time keyboard control - press keys to directly manipulate the face

**How to enter**:
- Type `interactive` or `int` in command mode
- Press `ESC` from command mode

**Prompt**: None - direct keyboard input

**Keyboard Controls**:

#### Jaw Control (WASD)
```
     W
   ◀   ▶
     S

W - Jaw UP (close mouth)
S - Jaw DOWN (open mouth)
A - (reserved for future use)
D - (reserved for future use)
```

#### Tongue Control (IJKL)
```
     I
   ◀ J L ▶
     K

I - Tongue UP (raise tongue)
K - Tongue DOWN (lower tongue)
J - Tongue BACK
L - Tongue FORWARD
```

#### Lip Control (QE)
```
Q - Lip ROUND (pucker lips)
E - Lip SPREAD (smile, pull corners)
```

#### Quick Phonemes (Number Keys)
```
1 - Vowel 'i' (beet)
2 - Vowel 'e' (bay)
3 - Vowel 'a' (bat)
4 - Vowel 'o' (boat)
5 - Vowel 'u' (boot)
```

#### Other Controls
```
R - Reset to neutral position
: - Enter command mode
Ctrl+C - Quit
```

**Status Bar**:
```
╔══════════════════════════════════════════════════════╗
║ MODE: INTERACTIVE                                    ║
║ WASD: Jaw  |  IJKL: Tongue  |  Q: Round  |  E: Spread ║
║ 1-5: Vowels  |  :: Command  |  Ctrl+C: Quit         ║
╚══════════════════════════════════════════════════════╝
```

## The IPA Chart Command

One of the most powerful features is the **color-coded IPA chart**.

**Access**:
- Command mode: Type `ipa` or `chart`
- From terminal: `estovox ipa`

**Features**:
- **Color-coded** by articulation type:
  - <span style="color:cyan">Vowels</span> (cyan)
  - <span style="color:red">Plosives</span> (red)
  - <span style="color:green">Nasals</span> (green)
  - <span style="color:yellow">Fricatives</span> (yellow)
  - <span style="color:blue">Approximants</span> (blue)
  - <span style="color:magenta">Lateral</span> (magenta)

- **Organized** by IPA classification:
  - Vowels by tongue position (front/central/back, close/mid/open)
  - Consonants by place and manner of articulation
  - Examples for each sound (e.g., "i [beet]")

- **Descriptions** of how each sound is produced:
  - Vowels: oral cavity resonance
  - Plosives: complete closure
  - Fricatives: turbulent airflow
  - Etc.

**Example Output**:
```
╔══════════════════════════════════════════════════════╗
║            IPA PHONEME CHART - Estovox               ║
╚══════════════════════════════════════════════════════╝

VOWELS - Oral cavity resonance with open vocal tract
┌──────────────────────────────────────────────────┐
│           FRONT    CENTRAL     BACK              │
│  CLOSE     i [beet]              u [boot]        │
│  ...                                             │
└──────────────────────────────────────────────────┘

FRICATIVES - Air forced through narrow channel
┌──────────────────────────────────────────────────┐
│  ALVEOLAR    s [see]   z [zoo]                   │
│  ...                                             │
└──────────────────────────────────────────────────┘

Press any key to return...
```

## Screen Layout

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                    /// \\\\                          │  Face
│                    ● ●                               │  (animated)
│                     ○                                │
│                                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│ ╭─ Articulator State                                │  Parameter
│ │ JAW:0.50 RND:0.20 CRN:0.50 CMP:0.00               │  Status
│ │ TNG_H:0.50 TNG_F:0.50 GRV:0.00 VEL:0.00           │
│ ╰─────────────────────────────────────              │
├──────────────────────────────────────────────────────┤
│ ╔════════════════════════════════════════════╗      │  Mode
│ ║ MODE: COMMAND / INTERACTIVE                ║      │  Status Bar
│ ║ [Mode-specific help text]                  ║      │
│ ╚════════════════════════════════════════════╝      │
├──────────────────────────────────────────────────────┤
│ estovox>                                             │  Command
│                                                      │  Prompt
└──────────────────────────────────────────────────────┘
```

## Workflow Examples

### Example 1: Explore IPA Phonemes

```bash
# Start estovox
$ estovox

# Show the IPA chart
estovox> ipa

# (Colorful chart appears, organized by type)
# Press any key to return

# Try articulating each vowel
estovox> ph i
estovox> ph e
estovox> ph a
estovox> ph o
estovox> ph u
```

### Example 2: Interactive Vowel Sculpting

```bash
# Start estovox
$ estovox

# Switch to interactive mode
estovox> interactive

# Now you're in interactive mode - use keyboard:
# Press 'S' to open jaw (for 'a' sound)
# Press 'I' to raise tongue slightly
# Press 'L' to move tongue forward
# Press 'E' to spread lips
# You've created a custom vowel!

# Press 'R' to reset
# Press ':' to return to command mode
```

### Example 3: Create Expression + Articulation

```bash
# Start estovox
$ estovox

# Apply happy expression
estovox> expr happy

# Switch to interactive
estovox> int

# Fine-tune the smile with 'E' key
# Add some jaw movement with 'W' and 'S'
# Make it say something by trying different tongue positions

# Return to command
# Press ':'
estovox> reset
```

### Example 4: Learn IPA by Doing

```bash
# Show the chart
$ estovox ipa

# Note the vowel positions (front/back, close/open)
# Return to TUI
$ estovox

# Try to manually create each vowel in interactive mode
estovox> interactive

# For 'i' (close front):
#   - Press 'I' multiple times (tongue up)
#   - Press 'L' multiple times (tongue forward)
#   - Press 'W' to close jaw slightly
#   - Press 'E' to spread lips

# Compare to preset:
# Press ':'
estovox> ph i
# Does it match your manual version?
```

## Tips & Tricks

### Command Mode Tips

1. **Use tab completion** (if available) - type partial commands
2. **Chain commands** - execute multiple presets in sequence with `seq`
3. **Check the IPA chart often** - it's your reference guide
4. **Use `controls` command** - shows all keyboard shortcuts

### Interactive Mode Tips

1. **Hold keys** for continuous movement (jaw, tongue, lips adjust smoothly)
2. **Combine keys** - press W+Q+L together for complex articulations
3. **Use number keys** for instant vowels, then fine-tune with WASD/IJKL
4. **Reset often** with 'R' to start fresh
5. **Practice IPA vowels** - try to recreate the vowel chart by hand

### Visual Learning

1. **Watch the parameters** - bottom panel shows real-time values
2. **Note the mouth shape** - different characters for different jaw/lip positions
3. **Compare presets** - use `ph` command then try to recreate in interactive mode

## Advanced Usage

### Creating Custom Articulations

```bash
# Command mode - precise control
estovox> set TONGUE_HEIGHT 0.7
estovox> set TONGUE_FRONTNESS 0.8
estovox> set JAW_OPENNESS 0.3
estovox> set LIP_ROUNDING 0.0

# Interactive mode - intuitive feel
# Switch to interactive
# Use I/K for tongue height
# Use J/L for tongue frontness
# Use W/S for jaw
# Use Q for rounding
```

### Scripted Sequences

```bash
# Create speech-like patterns
estovox> seq h:100 e:200 l:100 o:300 rest:100

# Or in scripts:
echo "seq a:200 i:150 u:200" | estovox repl
```

## Troubleshooting

### Keys Not Responding in Interactive Mode

- Make sure you typed `interactive` or pressed ESC to enter interactive mode
- Check the status bar - should say "MODE: INTERACTIVE"
- Try pressing ':' then 'interactive' again

### Can't See IPA Chart Colors

- Your terminal must support ANSI colors
- Try a different terminal emulator (iTerm2, Alacritty, etc.)
- Colors fallback to default if TDS not available

### Face Not Animating

- Animation runs in background automatically
- If stuck, try `reset` command
- Check that ESTOVOX_RUNNING is 1

### Mode Confusion

- **Command mode**: Has `estovox>` prompt, type commands
- **Interactive mode**: No prompt, direct keyboard input
- Check status bar at bottom for current mode

## Comparison: REPL vs TUI

### Legacy REPL Mode
```bash
estovox repl
```
- Command-only interface
- Simple, traditional REPL
- No interactive controls
- Good for scripting

### Full TUI Mode (Default)
```bash
estovox
# or
estovox tui
```
- Two modes: command AND interactive
- Real-time keyboard controls
- Dynamic mode switching
- Better for exploration and learning

## Summary

The new Estovox TUI gives you:

✅ **Command Mode** - Precise control via typed commands
✅ **Interactive Mode** - Real-time keyboard manipulation
✅ **IPA Chart** - Color-coded reference organized by articulation
✅ **Mode Switching** - Seamless transition between modes
✅ **Status Display** - Always know your current mode and controls
✅ **Animation** - Smooth, continuous rendering in both modes

**Start exploring**: `estovox` → `ipa` → `interactive` → have fun!

---

Press `h` or type `help` anytime for quick reference.
Type `ipa` to see the beautiful color-coded phoneme chart.
Type `controls` for keyboard shortcut reference.
