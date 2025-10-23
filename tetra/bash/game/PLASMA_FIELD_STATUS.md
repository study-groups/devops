# Plasma Field Engine - Implementation Status

## Completed (Phase 5.1 - Foundation)

### ✅ Configuration System
- **Created** `bash/game/config/` directory
- **Written** all TOML configuration files:
  - `game.toml` - Global settings (display, physics, colors, gameplay)
  - `pulsars.toml` - Pulsar templates and defaults
  - `controls.toml` - Keyboard and gamepad mappings
  - `physics.toml` - Interaction parameters (energy, magnetism, sync, groups)
  - `help.toml` - Help HUD content (editable at runtime)

### ✅ TOML Parser Integration
- **Downloaded** `tomlc99` library (toml.h, toml.c)
- **Updated** Makefile to compile with TOML support
- **Ready** for config loading in C engine

### ✅ Design Documentation
- **Defined** nomenclature: Plasma Field, Pulsars, Arms, Flux, Resonance, Polarity
- **Specified** data structures: Per-arm microstates, z-ordering, z-axis depth
- **Planned** two-pass rendering, physics simulation, control modes

---

## Ready for Implementation

### Next: Refactor C Engine Data Structures

**Current `Sprite` struct (simple):**
```c
typedef struct {
    int id, mx, my, len0, amp, valence;
    float freq, dtheta, theta, phase;
} Sprite;
```

**New `Pulsar` struct (advanced):**
```c
typedef struct Arm {
    float angle;        // Radians from center
    float length;       // Current length
    int z_order;        // 0-15 for layering
    float energy;       // 0.0-1.0
    int active;         // Can be toggled off
} Arm;

typedef struct Pulsar {
    int id;
    float x, y, z;      // Z is depth (0.0=far, 1.0=near)
    Arm arms[8];        // Per-arm microstates
    float energy;       // Total energy pool
    float polarity;     // -1.0 to +1.0 (magnetic charge)
    float phase;        // Rotation phase
    float resonance;    // Sync level with neighbors
    int group_id;       // -1 or cluster ID
    float rotation_rate; // rad/s
    int valence;        // Color
} Pulsar;
```

### Tasks Remaining

1. **Config Loading** (`src/config_loader.c`):
   - Parse TOML files at startup
   - Populate game state from configs
   - Hot-reload on 'r' keypress

2. **Data Structure Refactor**:
   - Replace `Sprite` with `Pulsar`
   - Update all functions to work with new structure
   - Implement per-arm rendering

3. **Z-Order & Depth**:
   - Add 16-layer z-ordering
   - Implement z-axis (0.0-1.0 depth)
   - Two-pass rendering (transform → sort → render)

4. **Tempest Perspective**:
   - Scale by depth: `scale = min_scale + (z * (max_scale - min_scale))`
   - Pull toward center: `x' = lerp(x, center_x, (1-z) * tunnel_strength)`
   - Creates visual tunnel effect

5. **Input System**:
   - Parse gamepad HID data properly
   - Implement mode switching (global ↔ focused)
   - 'h' key for HUD overlay from help.toml

6. **Physics Engine** (`src/physics.c`):
   - Energy exchange (arm overlap detection)
   - Magnetic forces (polarity-based)
   - Phase synchronization (Kuramoto model)
   - Group formation (clustering)

---

## Current Working State

The existing engine **still works** with the old simple rendering:
```bash
tmod load game
game quadrapole-gfx
```

Shows two pulsars with 8 rotating arms each. Basic gamepad detection works.

---

## Architecture Overview

```
┌─────────────┐
│ TOML Configs│ ← Editable without recompile
└──────┬──────┘
       │ Parsed by
       ▼
┌─────────────┐
│  C Engine   │ ← GlyphGrid (glyphgrid.c)
│  - Pulsars  │   - Data structures
│  - Physics  │   - Rendering
│  - Rendering│   - Input handling
└──────┬──────┘
       │ Protocol (stdin/stdout)
       ▼
┌─────────────┐
│  Bash Layer │ ← Game module (bash/game/)
│  - Commands │   - SPAWN, SET, KILL, RUN
│  - Integration│  - Entity management
└─────────────┘
```

---

## Next Steps (Priority Order)

1. Create `src/config_loader.c` and `src/config_loader.h`
2. Refactor `glyphgrid.c` to use new `Pulsar` struct
3. Implement two-pass rendering with z-ordering
4. Add 'h' key for help HUD
5. Improve gamepad input parsing
6. Implement physics interactions
7. Test and iterate!

---

## Design Principles

✓ **Runtime Configurable** - No recompile for tweaks
✓ **Data-Driven** - TOML configs define behavior
✓ **Emergent Gameplay** - Physics creates patterns
✓ **Terminal-First** - GlyphGrid owns the display
✓ **Hybrid Control** - Keyboard + Gamepad support
✓ **Microstate Tracking** - Individual arm control
✓ **Spatial Depth** - Z-axis for Tempest effect

---

Generated: 2025-10-22
Engine Version: 2.0 (Plasma Field)
Previous: 1.0 (Simple Quadrapole Demo)
