# State System & External Editing

## Overview

The Pulsar game engine implements a **separation of abstract state from rendering**, allowing external tools (like bash) to observe, query, edit, and validate the complete game state while the engine is running.

## Key Concepts

### 1. Platonic State Space

The game state exists as an abstract, renderer-agnostic description:
- **Microstate**: Per-arm properties (angle, energy, polarity, color)
- **Macrostate**: Per-pulsar aggregates (position, velocity, entropy)
- **World State**: Global properties (physics, fields, geometry)

### 2. External Palette System

Colors and visual styles are defined in external TOML files:
- `assets/palettes/neon.toml` - High-contrast cyberpunk
- `assets/palettes/tokyo_night.toml` - Professional balanced theme
- Semantic color mapping (player, enemy, collectible, etc.)
- Gradient definitions for energy/heat visualization

### 3. State Query Protocol

Bash can communicate with the C engine via stdin/stdout protocol:

```bash
# Query single values
game_state_query "pulsar.0.center_x"        # Returns: 80
game_state_query "world.pulsars.count"      # Returns: 2

# Export complete state
game_state_export > snapshot.toml

# Set values (future)
game_state_set "pulsar.0.center_x" 100.0
```

## Usage Examples

### Load and Preview Palettes

```bash
source "$GAME_SRC/core/palette.sh"

# List available palettes
game_palette_list

# Load a palette
game_palette_load "neon"

# Get color by semantic name
hex=$(game_palette_get_semantic_color "player_core")  # Returns: 00FFFF

# Interpolate from gradient
hex=$(game_palette_interpolate_gradient "player_energy" 0.75)

# Preview palette with swatches
game_palette_preview "tokyo_night"
```

### Query Game State

```bash
source "$GAME_SRC/core/state_query.sh"

# Get pulsar count
count=$(game_state_count_pulsars)

# Get position
x=$(game_state_query "pulsar.0.center_x")
y=$(game_state_query "pulsar.0.center_y")

# Export full state
game_state_export > game_state_$(date +%s).toml

# List all pulsars
game_state_list_pulsars
```

### Watch State Changes

```bash
# Define callback
on_energy_change() {
    local path="$1"
    local value="$2"
    echo "Energy changed: $path = $value"
}

# Register watch
watch_id=$(game_state_watch "pulsar.0.energy" "on_energy_change")

# In game loop
game_state_process_watches
```

## Architecture Benefits

### 1. Inspectable

Bash scripts can read and validate the entire game state:
- Debug tools can dump state at any frame
- Unit tests can verify state transitions
- Performance profiling can track state complexity

### 2. Configurable

Palettes and characters are external assets:
- Artists can edit colors without touching code
- Themes can be swapped at runtime
- A/B testing different visual styles

### 3. Replayable

Complete state snapshots enable:
- Save/load functionality
- Time-reversible replay
- Deterministic simulation
- Bug reproduction from saved states

### 4. Networkable

Pure state representation enables:
- Network state synchronization
- Spectator modes
- Replay sharing
- Collaborative editing

### 5. Multi-Renderer

Same state, different projections:
- Terminal (Braille microgrid) ← current
- HTML5 Canvas (smooth pixels)
- WebGL (3D hardware accelerated)
- VR/AR (stereoscopic)

## State Export Format

Exported state is valid TOML:

```toml
version = "1.0.0"
timestamp = 1735689234

[world]
width = 160
height = 96

[[pulsars]]
id = 0
center_x = 80
center_y = 48
angular_velocity = 0.5
pulse_frequency = 1.0
theta = 1.234
phase = 0.567
```

## Protocol Commands

The C engine accepts these commands via stdin:

### Query Commands
- `QUERY <path>` - Get single value
- `EXPORT_STATE` - Get complete state as TOML
- `LIST_PULSARS` - Get list of active pulsar IDs
- `DERIVE <path>` - Get calculated property (future)

### Control Commands
- `SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>`
- `SET <id> <key> <value>` - Update property
- `KILL <id>` - Remove pulsar
- `RUN <fps>` - Start rendering loop
- `QUIT` - Exit engine

### Palette Commands (future)
- `SET_PALETTE <name>` - Load palette
- `SET_COLOR <index> <hex>` - Override single color
- `GET_PALETTE` - Export current palette

## Future Enhancements

### Per-Arm Microstate

Track individual arm properties:
```toml
[[pulsars.arms]]
index = 0
angle = 0.0
energy = 1.0
polarity = 1
color_index = 0
glyph_index = 255
```

### Entropy Calculations

Measure system disorder:
```toml
[pulsar.0.entropy]
energy_distribution = 0.23
phase_coherence = 0.89
spatial_symmetry = 0.95
total = 0.44
```

### Character Sets

External glyph definitions:
```toml
# charsets/braille_extended.toml
[charset]
name = "braille_extended"
width = 2
height = 4

[[glyphs]]
codepoint = 0x2800
char = "⠀"
bitmap = "..\n..\n..\n.."
```

### Input Events

Generic input abstraction:
```toml
[[event]]
timestamp = 1735689234.567
source = "keyboard"
type = "button_press"
button = "space"
```

## Files

### Core System
- `core/state_query.sh` - State query protocol (bash side)
- `core/palette.sh` - Palette management system
- `engine/src/pulsar.c` - C engine with protocol support

### Assets
- `assets/palettes/neon.toml` - Neon palette
- `assets/palettes/tokyo_night.toml` - Tokyo Night palette

### Demos
- `demos/state_editing.sh` - Interactive demo

### Documentation
- `ARCHITECTURE.md` - Complete architecture vision
- `STATE_SYSTEM.md` - This file

## Running the Demo

```bash
cd ~/tetra/bash/game
./demos/state_editing.sh
```

Or via game CLI:
```bash
game state-demo
```

## Design Philosophy

The state system embodies these principles:

1. **Separation of Concerns** - State, logic, and rendering are independent layers
2. **Observable by Default** - All state is queryable and exportable
3. **External Configuration** - Visual style is data, not code
4. **Renderer Agnostic** - State describes "what is", not "how to draw"
5. **Time-Reversible** - Complete snapshots enable save/load/replay
6. **Platform Independent** - Same engine works on terminal, web, VR

This is not a terminal toy - it's a professional game architecture suitable for production titles.
