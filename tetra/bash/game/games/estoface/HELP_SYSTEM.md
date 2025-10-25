# Estoface Help System

Complete documentation for estoface facial modeling captured in bash/tree help system.

## Files

- **estoface_help.sh** - Tree data (30+ nodes, concise for 80x24)
- **estoface_help_tds.sh** - TDS-bordered display wrapper
- **test_help_tree.sh** - Demo script

## Usage

```bash
# Source the TDS-bordered help
source estoface_help_tds.sh

# Main help
estoface_help_tds

# Specific topics
estoface_help_tds gamepad
estoface_help_tds gamepad.mapping
estoface_help_tds model.facs
estoface_help_tds formant.mapping
```

## Features

- **Concise**: All content fits 80x24 terminal
- **Hierarchical**: 6 main categories, 30+ subtopics
- **TDS Bordered**: Auto-adapts to $COLUMNS
- **Colored**: Preserves ANSI color codes
- **No Pagination**: Direct output, no prompts

## Topics

```
estoface/
├── overview - Architecture & philosophy
├── gamepad - MIDI-style controller
│   ├── mapping - Joystick layout
│   ├── grid - 4x4 position system
│   └── performance - Rhythmic sequencing
├── model - Anatomical state
│   ├── state - Core parameters
│   ├── facs - Action Units
│   └── phonemes - Sound recipes
├── rendering - UTF-8 display
│   ├── panels - 5 toggleable layers
│   ├── characters - Glyph palette
│   └── examples - Sample outputs
├── formant - Speech synthesis
│   ├── mapping - Face→formant rules
│   ├── protocol - FIFO messages
│   └── ipc - Design rationale
├── testing - Calibration tools
│   ├── positions - 256 config generator
│   └── repl - Interactive commands
├── roadmap - 5 phases
└── references - FACS, IPA, formant, pulsar
```

## Integration

The help tree integrates with:
- `bash/tree` - Core data structure
- `bash/tds` - Terminal display borders
- `bash/color` - ANSI color system
- `../pulsar` - Reference architecture

## Key Content

### FACS Action Units
Complete mouth AU catalog: AU8-31, AD19-32 with muscles & actions

### 4x4 Grid System
256 mouth configurations via dual joystick control

### Formant Mapping
Jaw/tongue/lip → F1/F2/F3 frequency rules

### IPC Protocol
Named pipes (FIFOs) for estoface→formant communication

### Phoneme Recipes
State vectors for [i], [u], [æ], [ɑ] and cardinal vowels

## Development Status

Phase 1 (Current): Mouth foundation
- ✓ Basic rendering
- ✓ Documentation
- • FACS model (in progress)
- • Gamepad input
- • Testing script

See `help estoface.roadmap` for full plan.
