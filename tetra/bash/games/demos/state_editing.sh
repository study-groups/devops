#!/usr/bin/env bash
# State Editing Demo
# Shows how to query and manipulate game state from bash

source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/game/game.sh"
source "$TETRA_SRC/bash/game/core/state_query.sh"
source "$TETRA_SRC/bash/game/core/palette.sh"
source "$TETRA_SRC/bash/tds/tds.sh"

demo_state_editing() {
    clear

    # Show header
    tds_panel_header "STATE EDITING DEMO" 70 "double"
    tds_vspace md

    echo "This demo shows external state observation and editing."
    echo "The Pulsar engine exposes complete game state via protocol commands."
    tds_vspace sm

    # Load and preview palettes
    echo "$(tds_status info "Available palettes:")"
    game_palette_list
    tds_vspace sm

    echo "Loading neon palette..."
    game_palette_load "neon"
    tds_vspace sm

    echo "Preview of neon palette:"
    echo "  Player:     $(game_palette_get_semantic_color "player_core") (cyan)"
    echo "  Enemy:      $(game_palette_get_semantic_color "enemy_core") (hot pink)"
    echo "  Collectible: $(game_palette_get_semantic_color "collectible") (yellow)"
    tds_vspace md

    echo "$(tds_status success "Palette system working!")"
    tds_vspace lg

    echo "Press Enter to continue..."
    read -r

    # Show state architecture
    clear
    tds_panel_header "STATE ARCHITECTURE" 70 "double"
    tds_vspace md

    cat << 'EOF'
Game State Hierarchy:

  Microstate (per-arm, finest grain)
    - angle, length, amplitude, phase
    - energy, polarity, color_index
    - Calculated: tip position, velocity

  Macrostate (per-pulsar)
    - center position, velocity
    - angular_velocity, pulse_frequency
    - Derived: total_energy, entropy, coherence

  World State (global)
    - geometry, physics constants
    - field properties
    - Measured: system entropy

Bash can query any state value:
  game_state_query "pulsar.0.center_x"
  game_state_query "world.pulsars.count"
  game_state_export > state.toml

Palettes are external TOML files:
  assets/palettes/neon.toml
  assets/palettes/tokyo_night.toml

Colors can be mapped semantically:
  player_core -> palette[0] -> #00FFFF (cyan)
  enemy_core  -> palette[3] -> #FF0099 (hot pink)
EOF

    tds_vspace lg
    echo "$(tds_status success "Architecture: State separate from rendering")"
    tds_vspace md

    echo "Press Enter to continue..."
    read -r

    # Show protocol example
    clear
    tds_panel_header "STATE PROTOCOL EXAMPLE" 70 "double"
    tds_vspace md

    cat << 'EOF'
Bash → C Engine Communication:

  # Query single value
  Bash sends:  QUERY pulsar.0.center_x
  Engine:      VALUE pulsar.0.center_x 80

  # Export complete state
  Bash sends:  EXPORT_STATE
  Engine:      version = "1.0.0"
               timestamp = 1234567890

               [world]
               width = 160
               height = 96

               [[pulsars]]
               id = 0
               center_x = 80
               center_y = 48
               ...
               END_STATE

  # List all entities
  Bash sends:  LIST_PULSARS
  Engine:      0
               1
               2
               END_LIST

This allows:
  - Live inspection of game state
  - Save/load complete snapshots
  - External editing and validation
  - Time-reversible replay
  - Network state sync
EOF

    tds_vspace md
    echo "$(tds_status info "All state is observable and editable")"
    tds_vspace md

    echo "Press Enter to see renderer abstraction..."
    read -r

    # Show renderer abstraction
    clear
    tds_panel_header "RENDERER ABSTRACTION" 70 "double"
    tds_vspace md

    cat << 'EOF'
Platonic State → Multiple Renderers:

               ┌─────────────────────┐
               │  Abstract 3D State  │
               │  (Pulsar objects)   │
               └──────────┬──────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
  ┌───────────────┐ ┌──────────┐ ┌────────────┐
  │   Terminal    │ │  Canvas  │ │   WebGL    │
  │  (Braille)    │ │  (HTML5) │ │  (3D GPU)  │
  └───────────────┘ └──────────┘ └────────────┘
          │               │               │
          ▼               ▼               ▼
    2×4 microgrid    Smooth pixels   True 3D mesh

Same State, Different Views:
  - Terminal: 160×96 Braille microgrid (current)
  - Canvas:   Arbitrary resolution, antialiased
  - WebGL:    Hardware accelerated 3D
  - VR:       Stereoscopic projection

Palette system works for all renderers:
  - Terminal: ANSI 256-color codes
  - Canvas:   ctx.fillStyle = "#00FFFF"
  - WebGL:    uniform vec3 color = vec3(0.0, 1.0, 1.0)
EOF

    tds_vspace md
    echo "$(tds_status success "One engine, many views")"
    tds_vspace md

    echo "Press Enter to continue..."
    read -r

    # Show future vision
    clear
    tds_panel_header "EVOLUTION ROADMAP" 70 "double"
    tds_vspace md

    cat << 'EOF'
Phase 1: Foundation (Current)
  ✓ State observation protocol
  ✓ Palette management system
  ✓ Renderer abstraction design
  ✓ TOML-based configuration

Phase 2: Physics & Interaction
  - Energy transfer on proximity
  - Magnetic attraction/repulsion
  - Phase synchronization (Kuramoto model)
  - Formation dynamics (orbits, clusters)

Phase 3: Emergence
  - Per-arm microstates with memory
  - Entropy calculations (Shannon/Boltzmann)
  - Pulsar merge/split mechanics
  - Genetic encoding of behaviors

Phase 4: Multi-Renderer
  - HTML5 Canvas renderer
  - WebGL 3D renderer
  - Side-by-side comparison mode
  - Renderer hot-swapping

Phase 5: Agency
  - AI agents operating on abstract state
  - Evolutionary fitness landscapes
  - Predator-prey dynamics
  - Species emergence

The Architecture:
  - Makes all of this possible
  - State is truth, rendering is interpretation
  - Bash validates, C engine executes
  - External tools can introspect everything
EOF

    tds_vspace md
    echo "$(tds_status success "Built for the future, usable today")"
    tds_vspace lg
}

# Run demo
demo_state_editing

echo
echo "$(tds_status info "Demo complete. Explore:")"
echo "  - bash/game/core/state_query.sh"
echo "  - bash/game/core/palette.sh"
echo "  - bash/game/assets/palettes/"
echo "  - bash/game/ARCHITECTURE.md"
echo
