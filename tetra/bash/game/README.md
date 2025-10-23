# Game Engine Module

A real-time game engine for bash terminal games, integrated with the Tetra system.

## Overview

The game engine provides:
- **Entity System**: Create, update, and render game entities
- **Real-time Game Loop**: 30 FPS game loop with delta timing
- **Animation**: Tweening and easing functions for smooth animations
- **Rendering**: Double-buffered screen rendering with ANSI colors
- **Input**: Non-blocking keyboard input handling

## Quick Start

```bash
# Load tetra
source ~/tetra/tetra.sh

# Load game module
source $TETRA_SRC/bash/game/game.sh

# Run Quadrapole demo
game quadrapole
```

Or use the quick launcher:
```bash
bash $TETRA_SRC/bash/game/run_quadrapole.sh
```

## Module Structure

```
bash/game/
├── game.sh                 # Main entry point
├── includes.sh             # Standard tetra include pattern
├── run_quadrapole.sh       # Quick launcher
├── test_game.sh            # Test suite
├── core/
│   ├── timing.sh           # Frame timing and FPS control
│   ├── entities.sh         # Entity management system
│   └── game_loop.sh        # Main game loop
├── animation/
│   ├── tweening.sh         # Easing functions
│   └── pulsar.sh           # Pulsar entity type
├── rendering/
│   ├── screen.sh           # Screen buffer management
│   └── draw.sh             # Drawing primitives
└── demos/
    └── quadrapole.sh       # Quadrapole demo game
```

## Quadrapole Demo

Features two pulsars with 8 arms each that pulse in synchronized patterns:
- Pulsar 1: Cyan at position (20, 12)
- Pulsar 2: Magenta at position (60, 12)
- 8 arms radiating in cardinal and diagonal directions
- Smooth sine-wave pulsation from 1-10 character length
- 30 FPS real-time animation

**Controls:**
- `q` - Quit

## API Overview

### Entity System

```bash
# Create entity
entity_id=$(game_entity_create "type")

# Set/get properties
game_entity_set "$entity_id" "x" "10"
value=$(game_entity_get "$entity_id" "x")

# Register callbacks
game_entity_register_update "$entity_id" "my_update_fn"
game_entity_register_render "$entity_id" "my_render_fn"

# Update all entities
game_entity_update_all "$delta_ms"

# Render all entities
game_entity_render_all

# Destroy entity
game_entity_destroy "$entity_id"
```

### Game Loop

```bash
# Initialize
game_loop_init 30  # 30 FPS

# Run with callbacks
game_loop_run "init_fn" "update_fn" "render_fn"

# Set options
game_loop_set_fps 60
game_loop_set_debug 1  # Show FPS counter
```

### Drawing

```bash
# Draw primitives
game_draw_char "$x" "$y" "●" "$color"
game_draw_text "$x" "$y" "Hello" "$color"
game_draw_line "$x1" "$y1" "$x2" "$y2" "*" "$color"
game_draw_circle "$cx" "$cy" "$radius" "○" "$color"
game_draw_rect "$x" "$y" "$width" "$height" "$color"
```

### Animation

```bash
# Easing functions
progress=$(tween_sine_01 "0.5")      # 0.0 to 1.0
value=$(tween_linear "$start" "$end" "$t")
eased=$(tween_ease_in_out "$t")

# Animation state
state=$(tween_state_create 2000)     # 2 second duration
progress=$(tween_state_progress "$state")
tween_state_is_complete "$state" && echo "Done"
```

### Pulsar Entity

```bash
# Create pulsar
pulsar_id=$(pulsar_create "$x" "$y" "$color" "$period_ms")

# Configure
pulsar_set_period "$pulsar_id" 3000
pulsar_set_arm_range "$pulsar_id" 1 15
```

## Dependencies

- **bash/color**: Color system and palettes
- **bash/tds**: Display system with ANSI utilities
- **bash/tcurses**: Terminal input handling
- Bash 5.2+
- Terminal with ANSI color support

## Integration with Tetra Modules

The game engine integrates seamlessly with:
- **repl**: Can be launched from REPL mode
- **tui**: Can be embedded in TUI applications
- **tds**: Uses TDS for ANSI utilities
- **color**: Uses color palettes and themes
- **action**: Can define game actions

## Creating New Games

1. Create a new file in `demos/`
2. Define init, update, and render functions
3. Register entities and callbacks
4. Run via `game_loop_run`

Example:
```bash
my_game_init() {
    # Create entities
    player_id=$(game_entity_create "player")
    game_entity_register_update "$player_id" "player_update"
    game_entity_register_render "$player_id" "player_render"
}

my_game_update() {
    local delta="$1"
    game_entity_update_all "$delta"
}

my_game_render() {
    game_draw_text_centered 2 "My Game"
    game_entity_render_all
}

# Run it
game_loop_init 30
game_loop_run "my_game_init" "my_game_update" "my_game_render"
```

## Testing

Run the test suite:
```bash
bash $TETRA_SRC/bash/game/test_game.sh
```

## Version

Game Module v1.0.0
