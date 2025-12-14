# Estoface REPL + TUI Architecture

## Two Standalone Interfaces

Estoface provides **two independent interfaces** for different use cases:

```
┌─────────────────────────────────────────────────┐
│                   ESTOFACE                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. REPL (Bash)          2. TUI (C Binary)    │
│     Interactive shell        Full-screen app    │
│     Text commands            Real-time          │
│     Development/script       Performance        │
│     Help + completion        Gamepad input      │
│                                                 │
└─────────────────────────────────────────────────┘
```

They are **alternatives**, not wrapper/wrapped!

## 1. REPL Interface (Bash)

**File**: `core/estoface_repl.sh`

**Purpose**: Command-line interface for:
- Development and debugging
- Scripting facial sequences
- Learning the system (via help)
- Non-real-time experimentation

**Features**:
- Unified bash/repl system
- Help tree (30+ topics) with tab completion
- Tight, prompt-focused display (80x24)
- Commands: help, start, stop, status, show, record, play
- Shell escape: `!ls` for shell commands

**Example Session**:
```bash
$ game
[tetra x user x lobby] > play estoface

⚡ ESTOFACE REPL v0.1

Facial animation + speech synthesis via bash commands
Type 'help' or TAB for topics | '/mode' to toggle | '/exit' to quit

Note: C binary (TUI) is separate: ./bin/estoface

💤 estoface > help<TAB>
overview  gamepad  model  rendering  formant  testing  roadmap  references

💤 estoface > help gamepad

■ Gamepad
  MIDI-style facial performance controller
  ...

Topics (TAB):
  mapping       Controller layout
  grid          4x4 position system
  rhythm        Sequencing phonemes

💤 estoface > start
⚡ ESTOFACE v0.1
  Starting engine...
  ✓ Gamepad initialized (4×4 grid)
  ✓ Facial model loaded (FACS)
  ✓ Formant IPC ready

⚡ estoface > show grid 2 3
(shows mouth position [2,3])

⚡ estoface > quit
```

## 2. TUI Interface (C Binary)

**File**: `bin/estoface` (built from src/*.c)

**Purpose**: Real-time performance interface:
- Low-latency gamepad input
- Real-time formant synthesis
- Full-screen ncurses display
- Performance-optimized

**Features**:
- Full ncurses TUI
- Direct gamepad reading
- Real-time mouth rendering
- Live formant output

**Example Run**:
```bash
$ cd games/estoface
$ make
$ ./bin/estoface

┌────────────────────────────────────┐
│  Estoface v0.1                     │
├────────────────────────────────────┤
│                                    │
│      //  \\                        │
│      O    O                        │
│        v                           │
│    /──────\                        │
│                                    │
├────────────────────────────────────┤
│ Jaw:0.5 Lips:0.3 [q]uit [?]help   │
└────────────────────────────────────┘

(press ? for help overlay)
(gamepad controls mouth directly)
```

## Help System Architecture

### Help Tree (estoface_help.sh)

30+ nodes covering all topics:
```
help.estoface/
├── overview - Architecture
├── gamepad - Controller
│   ├── mapping - Layout
│   ├── grid - 4x4 system
│   └── rhythm - Performance
├── model - Facial state
│   ├── state - Parameters
│   ├── facs - Action units
│   └── phonemes - Recipes
├── rendering - UTF-8 display
├── formant - Speech synthesis
├── testing - Tools
├── roadmap - Phases
└── references - Resources
```

### Display Format (Compact for REPL)

- Fits 80x24 terminal
- 4-column right padding
- Left-aligned table layout
- Max 5 detail lines
- TAB completion hints

### Tab Completion

```bash
estoface > help <TAB>
  overview gamepad model rendering formant testing roadmap references

estoface > help gamepad <TAB>
  mapping grid rhythm

estoface > help gamepad.grid
(shows specific help)
```

## Integration with Game System

Both interfaces integrate via `game_repl.sh`:

```bash
$ game
[tetra x user x lobby] > play estoface  # Launches REPL
[tetra x user x lobby] > run estoface   # Launches TUI binary (future)
```

## When to Use Which?

### Use REPL when:
- Learning the system
- Developing/debugging
- Scripting sequences
- Non-real-time work
- Need help reference

### Use TUI when:
- Live performance
- Real-time gamepad control
- Low-latency requirements
- Full-screen visual feedback

## Files

```
estoface/
├── src/                    # C source for TUI
│   ├── estoface.c
│   ├── render.c
│   └── ...
├── bin/
│   └── estoface           # Compiled TUI binary
├── core/
│   └── estoface_repl.sh   # Bash REPL (standalone)
├── estoface_help.sh       # Help tree (30+ nodes)
├── estoface_help_tds.sh   # TDS-bordered display (optional)
└── Makefile               # Builds C binary
```

## Summary

- **REPL** = Bash shell for commands/learning
- **TUI** = C binary for real-time performance
- **Independent** = Run either, not both together
- **Help** = Integrated in REPL, press ? in TUI
- **Purpose** = Different tools for different needs
