# Quadrupole Mechanics - Quick Start

## What Is It?

A novel dual-pulsar control mechanic where two pulsars start **bonded together** and can be **split apart** by moving the joysticks in opposite directions. Once split, they're controlled independently with physics-based tension and repulsion forces.

## Running the Demo

```bash
cd /Users/mricos/src/devops/tetra/bash/game

# Load game module
source game.sh

# Run quadrupole mechanics demo
game quadrupole

# Or see all available games
game help
```

## Controls

### Bonded State (Starting)
- **WASD (Left Stick)**: Move both pulsars together
- **IJKL (Right Stick)**: Move opposite to WASD for 1.5 seconds to SPLIT

### Split State
- **WASD (Left Stick)**: Control Pulsar A (purple, 8 arms)
- **IJKL (Right Stick)**: Control Pulsar B (red, 6 arms)
- **Automatic**: Tension pulls them together if too far, repulsion pushes apart if too close

### Debug/UI
- **q**: Quit
- **h**: Toggle help overlay
- **1**: Toggle debug panel (shows bonded state, timer, CPU)
- **2**: Toggle event log (shows stick inputs and mappings)

## Key Features

✅ **Mapping Outside Engine**: Joystick → velocity mapping in Bash (not C)
✅ **Enhanced Logging**: Shows `L[raw_x,raw_y]->V[vel_x,vel_y]` mappings
✅ **Quadrupole Start**: Both pulsars at (20, 12) - overlapping
✅ **Contrary Motion**: Move sticks opposite for 1.5s to split
✅ **Field Forces**: Tension & repulsion when split

## Configuration

Edit `config/quadrupole.toml`:

```toml
[quadrupole]
contrary_threshold = 1.5    # Time to trigger split
max_velocity = 20.0         # Stick sensitivity
tension_constant = 0.3      # Spring force
repulsion_constant = 1.5    # Push force
```

## Testing

```bash
# Run unit tests
bash test_quadrupole.sh

# Expected output:
# ✓ Joystick mapping works (0.5 -> 10.0 velocity)
# ✓ Deadzone works (0.1 -> 0.0 velocity)
# ✓ Angle calculation (180° for opposite)
# ✓ Contrary detection (true for opposite sticks)
```

## Files Created

```
bash/game/
├── core/
│   ├── quadrupole_mechanics.sh       # Main implementation (150 LOC)
│   └── gamepad_bridge.sh             # Input bridge (80 LOC)
├── config/
│   └── quadrupole.toml               # Tunable parameters
├── demos/
│   └── quadrupole_mechanics_demo.sh  # Demo launcher
├── docs/
│   └── QUADRUPOLE_MECHANICS.md       # Full documentation
└── test_quadrupole.sh                # Unit tests
```

## Architecture Highlights

```
┌─────────────────────────────────────────┐
│   Bash Layer (Game Logic)              │
│   • quadrupole_mechanics.sh            │
│   • Mapping functions                   │
│   • State management                    │
│   • Field physics                       │
└─────────────────┬───────────────────────┘
                  │ pulsar_set()
                  │ game_state_query()
┌─────────────────▼───────────────────────┐
│   C Engine (Rendering)                  │
│   • Pulsar rendering                    │
│   • Gamepad input polling               │
│   • Display/terminal                    │
└─────────────────────────────────────────┘
```

**Key**: Game mechanics in Bash, rendering in C - clean separation!

## What's Happening Under the Hood

1. **Gamepad Bridge** reads stick positions (via keyboard simulation)
2. **Mapping Function** converts raw axes to velocity with deadzone
3. **State Machine** tracks bonded/split state and contrary timer
4. **Contrary Detection** checks if sticks are ≥150° opposite
5. **Field Forces** calculate tension/repulsion and apply to pulsars
6. **Logging** shows raw input → mapped velocity → assignment

## Next Steps

- Try moving WASD and IJKL in opposite directions to split
- Watch the event log (press `2`) to see mappings
- Tune `config/quadrupole.toml` to change feel
- Read full docs: `docs/QUADRUPOLE_MECHANICS.md`

## Troubleshooting

**Q: "Pulsar engine not available"**
A: Build the C engine first:
```bash
cd engine && make
```

**Q: Sticks not responding?**
A: Use keyboard simulation - WASD for left stick, IJKL for right

**Q: How do I see the mapping logs?**
A: Enable debug logging in `config/quadrupole.toml`:
```toml
[quadrupole.debug]
log_stick_input = true
```

## Philosophy

This implementation demonstrates **separation of concerns**:
- **C Engine**: Fast rendering, input polling, display
- **Bash Layer**: Game logic, mechanics, configuration

Result: Rapid iteration on game feel without touching C code! 🎮
