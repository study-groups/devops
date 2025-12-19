# Controls System Design

## Overview

Isomorphic control input mapping scheme for tetra. Maps physical inputs (MIDI CC, gamepad axes, buttons) to game/app actions through configurable transforms.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Physical Input │     │   Controls   │     │   Output    │
│  ─────────────  │     │   Engine     │     │  ─────────  │
│  MIDI CC        │────▶│  (C binary)  │────▶│  stdout     │
│  Gamepad axis   │     │              │     │  socket     │
│  Gamepad button │     │  Loads .json │     │  OSC        │
└─────────────────┘     └──────────────┘     └─────────────┘
```

## Control File Format (`controls/*.json`)

```json
{
  "name": "tank",
  "version": "1.0",

  "sources": {
    "p1_left":  ["midi:cc:40", "gamepad:axis:1"],
    "p1_right": ["midi:cc:41", "gamepad:axis:3"],
    "p2_left":  ["midi:cc:46"],
    "p2_right": ["midi:cc:47"],
    "pause":    ["midi:cc:48", "gamepad:button:start"]
  },

  "actions": {
    "p1_velocity": {
      "type": "differential_avg",
      "inputs": ["p1_left", "p1_right"],
      "center": 64,
      "deadzone": 20,
      "ranges": [
        [-64, -50, -3],
        [-50, -30, -2],
        [-30, -20, -1],
        [-20,  20,  0],
        [ 20,  30,  1],
        [ 30,  50,  2],
        [ 50,  64,  3]
      ],
      "output": "V:1:%d\n"
    },
    "p1_turn": {
      "type": "differential",
      "inputs": ["p1_left", "p1_right"],
      "threshold": 40,
      "output_neg": "a\n",
      "output_pos": "d\n"
    },
    "pause": {
      "type": "trigger",
      "input": "pause",
      "threshold": 64,
      "output": " \n"
    }
  }
}
```

## Key Concepts

### Sources
Physical inputs that can be read. Multiple sources can feed the same logical input (isomorphic - MIDI fader OR gamepad stick).

- `midi:cc:{number}` - MIDI Control Change (0-127)
- `midi:note:{number}` - MIDI Note On/Off
- `gamepad:axis:{number}` - Gamepad axis (-32768 to 32767)
- `gamepad:button:{name}` - Gamepad button (0/1)

### Action Types

1. **differential_avg** - Average of two inputs, mapped through ranges
   - Use: Tank velocity from two faders/sticks
   - Both forward = forward, both back = reverse

2. **differential** - Difference between two inputs
   - Use: Tank turning from fader differential
   - Right > left = turn right

3. **trigger** - Single input threshold crossing
   - Use: Buttons, pause, quit

4. **continuous** - Single input mapped through ranges
   - Use: Single knob → semantic value

### Ranges
Map continuous input displacement to ordinal output values:
```
displacement  →  output
[-64, -50]    →  -3
[-50, -30]    →  -2
...
[ 50,  64]    →   3
```

## File Locations

```
$TETRA_DIR/
└── controls/
    ├── tank.json           # Tank game controls (trax, etc)
    ├── pulsar.json         # Pulsar animation controls
    └── defaults/           # Factory defaults (read-only)

Search order:
1. CLI: midi_bridge -c /path/to/controls.json
2. Env: $TETRA_CONTROLS
3. User: $TETRA_DIR/controls/{name}.json
4. System: $TETRA_SRC/bash/midi/controls/{name}.json
```

## Implementation Plan

### Phase 1: C Engine (`midi_bridge.c`)
- [x] Basic MIDI input (CoreMIDI)
- [x] Basic gamepad input (SDL2)
- [x] OSC output
- [x] Socket output
- [x] Stdout output (`-O` flag)
- [ ] Add cJSON for controls file parsing
- [ ] Implement source abstraction (midi/gamepad unified)
- [ ] Implement action types (differential_avg, differential, trigger)
- [ ] Implement range mapping

### Phase 2: Controls Files
- [ ] Create `$TETRA_DIR/controls/` directory structure
- [ ] Write `tank.json` for trax game
- [ ] Write `pulsar.json` for pulsar animation
- [ ] Migrate existing `midi/maps/*.json` to new format

### Phase 3: Integration
- [ ] Update `games play` to auto-start midi_bridge with correct controls
- [ ] Add controls selection to game.toml: `controls = "tank"`
- [ ] Test with trax and gamepad

## Usage (Target)

```bash
# Run with controls file
midi_bridge -c tank.json | games play trax

# Or game auto-loads controls
games play trax  # reads game.toml, starts midi_bridge -c tank.json

# List available controls
ls $TETRA_DIR/controls/

# Edit controls
$EDITOR $TETRA_DIR/controls/tank.json
```

## Current State

- `midi_bridge.c` exists with MIDI/gamepad input, needs controls file loading
- `trax_midi.js` has map loading but Node.js dependency
- `midi/maps/trax.json` has old format, needs migration
- Games module ready (`games play trax` works)

## Next Steps

1. Add cJSON to `midi_bridge.c`
2. Implement controls file loader
3. Implement action processors (differential_avg, etc)
4. Create `controls/tank.json` in new format
5. Test end-to-end: `midi_bridge -c tank.json | games play trax`

## Files Involved

```
$TETRA_SRC/bash/
├── midi/
│   ├── midi_bridge.c       # Main C engine (modify)
│   ├── cJSON.c             # Add JSON parser
│   ├── cJSON.h
│   ├── controls/           # New directory
│   │   └── tank.json
│   └── maps/               # Old format (deprecate)
│       └── trax.json
├── trax/
│   ├── trax_midi.js        # Node.js version (keep as fallback)
│   └── trax_map.json       # Old format (remove)
└── games/
    └── core/
        └── games_admin.sh  # Update games_play() to use controls
```
