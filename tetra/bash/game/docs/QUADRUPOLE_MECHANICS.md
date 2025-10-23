# Quadrupole Mechanics

## Overview

The **Quadrupole Mechanics** system implements a novel dual-pulsar control scheme where two pulsars start bonded together and can be split through contrary joystick motion. This creates interesting gameplay dynamics with field forces, tension, and repulsion.

## Core Concept

- **Starting State**: Two pulsars positioned on top of each other (center-left of screen)
- **Bonded Mode**: Both pulsars move together, controlled by the left joystick
- **Split Mode**: Pulsars separate and are controlled independently by left/right joysticks
- **Transition**: Apply contrary motion (opposite stick directions) for 1.5 seconds to trigger the split

## Architecture

### Bash Layer (Outside Engine)

The quadrupole mechanics are implemented **outside the C engine** in pure Bash, demonstrating the separation between game logic and rendering engine:

```
bash/game/core/
├── quadrupole_mechanics.sh   # Core mechanics implementation
├── gamepad_bridge.sh          # Bridge between C engine and bash logic
└── state_query.sh             # State query protocol (existing)
```

### Key Design Decisions

1. **Mapping Function Outside Engine**: The joystick-to-velocity mapping happens in Bash, not in C
2. **Augmented Logging**: Logs show both raw stick values AND mapped velocities
3. **State Management**: Quadrupole bonded/split state managed in Bash
4. **Field Physics**: Tension and repulsion calculated in Bash, applied via engine commands

## Control Scheme

### Bonded State
- **Left Stick (WASD)**: Move both pulsars together
- **Right Stick (IJKL)**: Monitored for contrary motion
- **Contrary Motion**: Move sticks in opposite directions for 1.5s to split

### Split State
- **Left Stick (WASD)**: Control Pulsar A
- **Right Stick (IJKL)**: Control Pulsar B
- **Field Forces**: Automatic tension (if too far) and repulsion (if too close)

### Contrary Motion Detection

Two sticks are considered "contrary" when:
1. Both sticks have magnitude > 0.3
2. Angle between stick directions ≥ 150 degrees (mostly opposite)

Timer accumulates when contrary motion is detected and decays when not.

## Configuration

Edit `bash/game/config/quadrupole.toml`:

```toml
[quadrupole]
contrary_threshold = 1.5        # Seconds to trigger split
contrary_angle = 150             # Degrees of opposition required
tension_constant = 0.3           # Spring force strength
repulsion_constant = 1.5         # Repulsion force strength
max_separation = 30.0            # Max comfortable distance
min_separation = 5.0             # Min distance before repulsion

[quadrupole.input]
max_velocity = 20.0              # Max velocity at full stick
deadzone = 0.15                  # Stick deadzone
```

## Implementation Details

### Joystick Mapping

The mapping function converts raw joystick axes `[-1.0, 1.0]` to screen velocity:

```bash
quadrupole_map_stick_to_velocity() {
    local stick_x="$1"
    local stick_y="$2"

    # Apply deadzone
    local mag=$(calculate_magnitude)
    if (( mag < deadzone )); then
        return 0.0, 0.0
    fi

    # Scale to max velocity
    vx = stick_x * max_velocity
    vy = stick_y * max_velocity
}
```

### State Transitions

```
BONDED ──[contrary motion >= 1.5s]──> SPLIT
       <──[re-bond command]──────────
```

### Field Forces (Split Mode)

**Tension** (when distance > max_separation):
```
force = tension_constant * (distance - max_separation)
direction: toward partner
```

**Repulsion** (when distance < min_separation):
```
force = repulsion_constant * (min_separation - distance)
direction: away from partner
```

Forces are applied equally and oppositely to both pulsars (Newton's third law).

## Logging

The system logs mapped values alongside raw inputs:

```
[DEBUG] Sticks: L[0.75,0.00]->V[15.00,0.00] R[-0.80,0.00]->V[-16.00,0.00] bonded=1 timer=0.85
```

Format: `L[raw_x,raw_y]->V[vel_x,vel_y]` shows the mapping transformation.

## Usage

### Running the Demo

```bash
# From game directory
source game.sh
game quadrupole_mechanics

# Or directly
./demos/quadrupole_mechanics_demo.sh
```

### Integrating into Custom Games

```bash
# Load modules
source "${GAME_SRC}/core/gamepad_bridge.sh"
source "${GAME_SRC}/core/quadrupole_mechanics.sh"

# Initialize
gamepad_bridge_init
quadrupole_init "$pulsar_a_id" "$pulsar_b_id"

# In game loop update
gamepad_bridge_update
read left_x left_y < <(gamepad_bridge_get_left_stick 0)
read right_x right_y < <(gamepad_bridge_get_right_stick 0)
quadrupole_update "$left_x" "$left_y" "$right_x" "$right_y" "$dt"
```

## API Reference

### quadrupole_mechanics.sh

#### `quadrupole_init <pulsar_a_id> <pulsar_b_id>`
Initialize quadrupole system with two pulsar IDs.

#### `quadrupole_update <left_x> <left_y> <right_x> <right_y> <dt>`
Main update function - call every frame with current stick state and delta time.

#### `quadrupole_map_stick_to_velocity <stick_x> <stick_y> <out_vx> <out_vy>`
Map raw stick input to velocity (applies deadzone and scaling).

#### `quadrupole_map_stick_to_delta <stick_x> <stick_y> <dt> <out_dx> <out_dy>`
Map stick input to position delta for a given time step.

#### `quadrupole_is_contrary <lx> <ly> <rx> <ry>`
Check if two stick inputs are in contrary (opposite) directions.

### gamepad_bridge.sh

#### `gamepad_bridge_get_left_stick <player_id>`
Returns: `"x y"` - left stick position for player.

#### `gamepad_bridge_get_right_stick <player_id>`
Returns: `"x y"` - right stick position for player.

#### `gamepad_bridge_get_axis <player_id> <axis_id>`
Get specific axis value (0=LX, 1=LY, 2=RX, 3=RY, 4=LT, 5=RT).

## Future Enhancements

- [ ] Visual tether rendering between split pulsars
- [ ] Contrary motion indicator UI
- [ ] Re-bonding mechanic (bring pulsars together to re-bond)
- [ ] Multiple quadrupole pairs simultaneously
- [ ] Energy transfer between bonded pulsars
- [ ] Rotation synchronization modes
- [ ] Plasmic-thumb integration for third-party interaction

## Technical Notes

### Why Bash for Game Logic?

This implementation demonstrates that complex game mechanics can be implemented in Bash scripting outside the rendering engine. Benefits:

1. **Rapid iteration**: Modify mechanics without recompiling C code
2. **Clear separation**: Game logic vs. rendering engine
3. **Configuration**: Easy TOML-based tweaking
4. **Debugging**: Shell-level debugging tools available
5. **Scriptability**: Hook into tetra ecosystem

### Performance Considerations

- Bash calculations use `bc` for floating-point math
- Each frame processes ~10-20 shell operations
- Target: 60 FPS with <1% CPU overhead for mechanics
- C engine handles rendering pipeline (fast path)

### C Engine Integration Points

The mechanics layer communicates with the C engine via:
- `pulsar_set <id> <key> <value>` - Update pulsar properties
- `game_state_query <path>` - Query current state (future)
- Event log shows gamepad input events in engine HUD

## See Also

- [Pair Dynamics](../core/pair_dynamics.sh) - Similar bonding system
- [Plasmic Thumb](../core/plasmic_thumb.sh) - Field-based interaction
- [Controls Configuration](../config/controls.toml) - Input mappings
