# Game Engine Status

## Completed ✅

### Core Systems
- **Timing system** (core/timing.sh) - FPS control, delta time calculation
- **Entity system** (core/entities.sh) - Entity registry with update/render callbacks
- **Game loop** (core/game_loop.sh) - 30 FPS loop using tcurses_input_read_key
- **Animation** (animation/tweening.sh) - Easing functions (sine, linear, ease-in-out, pulse)
- **Rendering** (rendering/screen.sh, rendering/draw.sh) - Double-buffered cell-based rendering with ANSI positioning (1-based coordinates fixed)

### Integration
- Uses `tcurses_input_read_key` for non-blocking input (matching bash/repl pattern)
- Integrates with `bash/color` for TDS-aware colors
- Proper ANSI escape sequence rendering

### Demo
- **Quadrapole** (demos/quadrapole.sh) - Dual pulsar demo with 8 radiating arms

## Current Issue  ❌

**Entities not appearing**: FPS counter shows "Entities: 0"

### Root Cause
Bash associative arrays (`GAME_ENTITY_DATA`) don't propagate across function calls due to bash scoping. When `pulsar_create` calls `game_entity_create`, the entity is added to the array, but the changes don't persist.

### Evidence
- `quadrapole_init` is called (stderr messages work)
- `pulsar_create` returns entity IDs
- But `game_entity_count()` returns 0
- Arrays are declared with `declare -A` but not exported

## Next Steps to Fix

### Option 1: Use Global Scope (Quick Fix)
Remove `declare -A` from functions, rely on global initialization in game.sh:

```bash
# In game.sh, before sourcing components:
declare -gA GAME_ENTITY_DATA
declare -gA GAME_ENTITY_UPDATE_FN
declare -gA GAME_ENTITY_RENDER_FN
declare -ga GAME_ENTITIES
```

### Option 2: Use File-Based State (Robust)
Store entity data in `$TETRA_DIR/game/entities/` as JSON:
- Matches tetra's `$TETRA_SRC` (code) vs `$TETRA_DIR` (runtime) pattern
- Survives subshells
- Can inspect state externally

### Option 3: Rewrite Without Associative Arrays
Use indexed arrays with entity structs as strings:
```bash
GAME_ENTITIES[0]="id:1|type:pulsar|x:20|y:12|color:cyan"
```

## Recommended: Option 1 + Study demo/basic/010

The `demo/basic/010` system solves this exact problem. Study:
- How `double_buffer.sh` manages frame state across function calls
- How `game_input.sh` maintains input state
- Their use of global declarations

## Files Created

```
bash/game/
├── game.sh                     # Main entry, needs global array declarations
├── includes.sh                 # Tetra module pattern
├── run_quadrapole.sh          # Quick launcher
├── test_game.sh               # Test suite (passes unit tests)
├── core/
│   ├── timing.sh              # ✅ Works (fixed awk for large ns values)
│   ├── entities.sh            # ❌ Needs global array fix
│   └── game_loop.sh           # ✅ Works (uses tcurses)
├── animation/
│   ├── tweening.sh            # ✅ Works
│   └── pulsar.sh              # ✅ Logic correct, needs entity fix
├── rendering/
│   ├── screen.sh              # ✅ Works (fixed 1-based ANSI coords)
│   └── draw.sh                # ✅ Works
├── demos/
│   └── quadrapole.sh          # ✅ Awaits entity fix
└── README.md                  # Complete documentation
```

## Demo Output (Current)

Screen renders correctly with:
- FPS counter (0 FPS due to no entities updating)
- Title: "QUADRAPOLE - Dual Pulsar Demo"
- Instructions: "Press 'q' to quit"
- **Missing**: The two pulsars (entities not persisting)

## To Run

```bash
source ~/tetra/tetra.sh
source $TETRA_SRC/bash/game/game.sh
game quadrapole
```

Or: `bash $TETRA_SRC/bash/game/run_quadrapole.sh`
