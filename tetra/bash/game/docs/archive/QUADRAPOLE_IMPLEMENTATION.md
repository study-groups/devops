# Quadrapole Mechanics Implementation - Complete

## ✅ What Was Built

I've successfully implemented the **quadrapole mechanics** system with joystick mapping outside the C engine, augmented logging, and field-based physics.

### Core Features Implemented

1. **Joystick Mapping Function** (outside engine)
   - `quadrapole_map_stick_to_velocity()` - Maps raw axes [-1.0, 1.0] to velocity
   - Applies deadzone (0.15) and max velocity scaling (20 units/sec)
   - Located in: `core/quadrapole_mechanics.sh`

2. **Augmented Logging**
   - Shows both raw input AND mapped values
   - Format: `L[raw_x,raw_y]->V[vel_x,vel_y] R[raw_x,raw_y]->V[vel_x,vel_y]`
   - Includes bonded state and contrary timer

3. **Quadrapole Configuration**
   - Both pulsars start at (20, 12) - overlapping (center-left)
   - Bonded state: Left stick moves both together
   - Split state: Sticks control independently

4. **Contrary Motion Detection**
   - Monitors stick angle (must be ≥150° opposite)
   - Accumulates timer over 1.5 seconds
   - Configurable via `QUADRAPOLE_CONTRARY_THRESHOLD`

5. **Split Mechanics**
   - SNAP! when contrary timer threshold reached
   - Pulsars separate slightly (2 units)
   - Transitions to independent control

6. **Field Forces**
   - **Tension**: Pulls together when distance > 30 units
   - **Repulsion**: Pushes apart when distance < 5 units
   - Applied as equal/opposite forces (Newton's 3rd law)

## 🎯 How to Use

### Running the Game

```bash
cd /Users/mricos/src/devops/tetra/bash/game

# Load game module
source game.sh

# Run quadrapole with NEW mechanics
game quadrapole

# Or see all options
game help
```

### Available Commands

- `game quadrapole` - Current version with NEW mechanics (Pulsar C engine)
- `game quadrapole-bash` - Original bash renderer (legacy, for posterity)
- `game quadrapole-gfx` - Alias for `game quadrapole`

### Controls

**Bonded State (Starting):**
- WASD (Left Stick) - Move both pulsars together
- IJKL (Right Stick) - Move opposite to WASD for 1.5s to trigger split

**Split State:**
- WASD (Left Stick) - Control Pulsar A (purple, 8 arms)
- IJKL (Right Stick) - Control Pulsar B (red, 6 arms)
- Automatic tension/repulsion forces apply

**Debug:**
- `q` - Quit
- `h` - Toggle help overlay
- `1` - Toggle debug panel
- `2` - Toggle event log (shows mapping)

## 📁 Files Created

```
bash/game/
├── core/
│   ├── quadrapole_mechanics.sh       # Main mechanics (150 LOC)
│   └── gamepad_bridge.sh             # Input bridge (80 LOC)
├── config/
│   └── quadrapole.toml               # Configuration
├── demos/
│   └── quadrapole_mechanics_demo.sh  # Demo launcher
├── docs/
│   └── QUADRAPOLE_MECHANICS.md       # Full documentation (not updated yet)
└── test_quadrapole.sh                # Unit tests
```

## 🔧 Configuration

Edit `config/quadrapole.toml` to tune parameters:

```toml
[quadrapole]
contrary_threshold = 1.5    # Time to split (seconds)
contrary_angle = 150        # Opposition angle (degrees)
tension_constant = 0.3      # Spring force strength
repulsion_constant = 1.5    # Repulsion force strength
max_separation = 30.0       # Max comfortable distance
min_separation = 5.0        # Min distance before repulsion

[quadrapole.input]
max_velocity = 20.0         # Max velocity at full stick
deadzone = 0.15             # Stick deadzone [0-1]
```

## 🧪 Testing

```bash
# Run unit tests
bash test_quadrapole.sh

# Expected output:
# ✓ Joystick mapping: (0.5, 0.0) → (10.0, 0)
# ✓ Deadzone: (0.1, 0.1) → (0.0, 0.0)
# ✓ Angle: 180° for opposite vectors
# ✓ Contrary detection works
```

## 🏗️ Architecture

```
┌────────────────────────────────────┐
│   Bash Layer (Game Logic)         │
│   • quadrapole_mechanics.sh       │
│   • Mapping functions              │
│   • State management               │
│   • Field physics                  │
└──────────────┬─────────────────────┘
               │ pulsar_set()
               │ game_state_query()
┌──────────────▼─────────────────────┐
│   C Engine (Rendering)             │
│   • Pulsar rendering               │
│   • Gamepad input polling          │
│   • Display/terminal               │
└────────────────────────────────────┘
```

**Key Design**: Clean separation between game logic (Bash) and rendering (C).

## ✨ Key Highlights

- ✅ Mapping function **outside engine** (pure Bash, not C)
- ✅ Augmented logging shows raw → mapped transformations
- ✅ Quadrapole starting position: both pulsars overlapping
- ✅ Left stick controls both when bonded
- ✅ Contrary motion detection with configurable timer
- ✅ Snap separation mechanic
- ✅ Tension & repulsion field forces

## 🎮 Game Mechanics Flow

1. **Start**: Both pulsars at (20, 12), bonded
2. **Move**: WASD moves both together
3. **Contrary**: Move WASD + IJKL opposite for 1.5s
4. **Timer**: Watch contrary timer accumulate
5. **SNAP!**: Pulsars split when timer ≥ 1.5s
6. **Independent**: WASD controls A, IJKL controls B
7. **Forces**: Tension pulls together, repulsion pushes apart

## 📊 State Variables

Global state tracked in `quadrapole_mechanics.sh`:

```bash
QUADRAPOLE_BONDED=1              # 1=bonded, 0=split
QUADRAPOLE_CONTRARY_TIMER=0.0    # Accumulator
QUADRAPOLE_PULSAR_A=""           # Pulsar A ID
QUADRAPOLE_PULSAR_B=""           # Pulsar B ID
QUADRAPOLE_START_X=20            # Starting X
QUADRAPOLE_START_Y=12            # Starting Y
```

## 🚀 Next Steps

To integrate into your workflow:

1. **Test the mechanics**: `game quadrapole`
2. **Tune parameters**: Edit `config/quadrapole.toml`
3. **Check logging**: Press `2` to see event log with mappings
4. **Try splitting**: Move WASD and IJKL opposite for 1.5s

## 📝 Implementation Notes

- All function names use **quadrapole** (correct spelling)
- The system is fully integrated into `game quadrapole` command
- Original bash renderer preserved as `game quadrapole-bash`
- Logging shows mapping transformations in real-time
- Configuration is TOML-based for easy tuning

---

**Status**: ✅ Complete and ready to use!

Run `game quadrapole` to experience the new mechanics! 🎮
