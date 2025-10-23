# Pulsar Game Architecture
## Separation of State, Logic, and Rendering

### Design Philosophy

The Pulsar engine implements a **pure functional game architecture** where:

1. **Platonic State Space** - Abstract, renderer-agnostic game state
2. **Physical State Space** - Observable, quantifiable system dynamics
3. **Rendering Projections** - Multiple views of the same underlying reality
4. **Input Abstraction** - Generic events from diverse sources

This allows:
- External state editing and validation
- Multiple simultaneous renderers (terminal, canvas, WebGL, VR)
- Time-reversible physics (save/load/replay)
- Network synchronization of pure state
- AI agents operating on abstract state

---

## State Hierarchy

### Microstate (Per-Arm, Per-Pulsar)

The **microstate** represents the finest-grained observable properties:

```toml
# Per-arm microstate (8 arms × N pulsars)
[pulsar.0.arm.0]
angle = 0.0              # Current rotation angle (radians)
length = 18.0            # Current length (pixels)
amplitude = 6.0          # Pulsing amplitude
phase = 0.0              # Wave phase offset
energy = 1.0             # Energy level [0.0, 1.0]
polarity = 1             # Magnetic polarity: +1 or -1
color_index = 0          # Index into palette
glyph_index = 0          # Index into character set
z_order = 0              # Depth sorting
opacity = 1.0            # Transparency [0.0, 1.0]
thickness = 1            # Line weight (1-3)

# Derived microstate (calculated, not stored)
tip_x = 80.0             # World-space tip position
tip_y = 48.0
velocity_x = 0.0         # Tip velocity vector
velocity_y = 0.0
```

### Macrostate (Per-Pulsar)

The **macrostate** represents emergent, aggregate properties:

```toml
[pulsar.0]
# Core identity
id = 0
type = "pulsar8"         # Sprite type: pulsar8, pulsar4, custom
entity_class = "player"  # Semantic class: player, enemy, neutral

# Spatial state
center_x = 80.0          # World-space center
center_y = 48.0
center_z = 0.0           # Depth (for 3D)
radius = 18.0            # Base radius

# Kinematic state
velocity_x = 0.0
velocity_y = 0.0
velocity_z = 0.0
angular_velocity = 0.5   # Rotation speed (rad/s)

# Wave dynamics
pulse_frequency = 1.0    # Breathing rate (Hz)
pulse_amplitude = 6.0    # Breathing depth
pulse_phase = 0.0        # Global phase offset

# Collective properties
total_energy = 8.0       # Sum of arm energies
coherence = 1.0          # Phase alignment [0.0, 1.0]
polarity_balance = 0.0   # Net magnetic charge [-1.0, 1.0]
entropy = 0.0            # Disorder measure [0.0, ∞)

# Metadata
mass = 1.0               # For collision physics
temperature = 1.0        # For energy distribution
lifespan = -1            # Time to live (-1 = immortal)
age = 0.0                # Time since spawn

# Rendering hints (not physics)
palette_name = "default"
character_set = "braille"
blend_mode = "normal"    # normal, additive, multiply
```

### World State (Global)

The **world state** represents the field and environment:

```toml
[world]
# Geometry
geometry_type = "flat"   # flat, tempest_tunnel, sphere, torus
width = 160              # Logical pixels
height = 96
depth = 100              # Z-depth range

# Physics
gravity_x = 0.0
gravity_y = 0.0
drag_coefficient = 0.01
energy_decay_rate = 0.001

# Field properties
magnetic_field_strength = 1.0
synchronization_coupling = 0.1  # Kuramoto model κ
energy_transfer_rate = 0.05

# Environmental
ambient_temperature = 1.0
ambient_entropy = 0.0
time_dilation = 1.0      # Speed multiplier

# Boundaries
boundary_mode = "wrap"   # wrap, bounce, destroy, tunnel
```

---

## Entropy Model

### Definition

**Entropy** measures the disorder and information content of the system:

```
S = -Σ p(i) log p(i)    (Shannon entropy)

Where p(i) = normalized probability of microstate i
```

### Microstate Entropy (Per-Pulsar)

Measures energy distribution across arms:

```toml
[pulsar.0.entropy]
energy_distribution = 0.23   # How evenly spread is energy?
phase_coherence = 0.89       # How synchronized are arms?
spatial_symmetry = 0.95      # How symmetric is the shape?
temporal_stability = 0.67    # How stable over time?

# Total microstate entropy
total = 0.44   # Lower = more ordered
```

**Use cases:**
- Damaged pulsars have high entropy
- Coherent pulsars have low entropy
- Entropy increases with collisions
- Energy transfer reduces entropy (sync effect)

### Macrostate Entropy (System-Wide)

Measures global disorder:

```toml
[world.entropy]
position_dispersion = 0.34   # How clustered are pulsars?
velocity_dispersion = 0.12   # How aligned are velocities?
energy_variance = 0.28       # How unequal is energy distribution?
polarity_mixing = 0.50       # How mixed are polarities?

# Total macrostate entropy
total = 0.31
```

**Use cases:**
- Ordered formations have low entropy
- Chaotic swarms have high entropy
- Entropy drives emergent behavior
- Second law: entropy increases without energy input

### Entropy Evolution

```toml
[world.entropy_dynamics]
# Natural processes that increase entropy
collision_entropy_gain = 0.1
thermal_entropy_rate = 0.001  # Gradual disorder

# Processes that decrease entropy (require energy)
synchronization_entropy_loss = -0.05
formation_entropy_loss = -0.1
energy_transfer_entropy_loss = -0.02
```

---

## Platonic Description Space

### Pure State Representation

The **platonic state** is a complete, time-independent description:

```toml
# state.toml - Complete system state
version = "1.0"
timestamp = 1234567890.123

[world]
# ... (world state as above)

[[pulsars]]
id = 0
# ... (macrostate as above)

[[pulsars.arms]]
index = 0
# ... (microstate as above)

[[pulsars.arms]]
index = 1
# ...

[[pulsars]]
id = 1
# ...
```

### State Operations

```bash
# Bash can read entire state
game_state_export > state.toml
game_state_validate state.toml
game_state_diff state1.toml state2.toml

# Bash can edit state
game_state_set "pulsar.0.center_x" 100.0
game_state_set "pulsar.0.arm.0.energy" 0.5
game_state_set "world.gravity_y" -9.8

# Bash can query derived properties
game_state_query "pulsar.0.entropy.total"
game_state_query "world.entropy.total"
game_state_query "pulsar.0.arm.0.tip_x"

# Bash can inject state
game_state_import state.toml
game_state_merge patch.toml
```

---

## Renderer Abstraction

### Generic Renderer Interface

All renderers implement the same protocol:

```toml
# renderer_spec.toml
[renderer]
name = "terminal_braille"
type = "terminal"
version = "1.0"

[renderer.capabilities]
resolution = [160, 96]    # Logical pixels
color_depth = "256color"  # 1bit, 4bit, 8bit, 24bit, 256color
antialiasing = false
alpha_blending = false
z_sorting = true
max_entities = 256

[renderer.coordinate_system]
origin = "top_left"       # top_left, center, bottom_left
x_axis = "right"
y_axis = "down"
z_axis = "out"            # Toward viewer

[renderer.output]
protocol = "ansi_terminal"  # ansi_terminal, html_canvas, webgl
stream = "stdout"           # stdout, file, socket, memory
```

### Renderer Implementations

#### Terminal Braille Renderer

```toml
[renderer.terminal_braille]
cell_width = 2            # Pixels per terminal cell (horizontal)
cell_height = 4           # Pixels per terminal cell (vertical)
char_set = "braille"      # Braille Unicode block U+2800-U+28FF
color_mode = "foreground" # foreground, background, both
cursor_visible = false
buffer_mode = "double"    # single, double, triple
```

#### HTML Canvas Renderer

```toml
[renderer.html_canvas]
canvas_id = "game-canvas"
pixel_ratio = 1.0         # For HiDPI displays
context = "2d"            # 2d, webgl, webgl2
alpha = true
antialiasing = true
```

#### WebGL Renderer

```toml
[renderer.webgl]
canvas_id = "game-canvas"
context = "webgl2"
shader_version = "300 es"
depth_buffer = true
stencil_buffer = false
antialiasing = true
max_texture_size = 4096
```

### Projection Pipeline

State → Projection → Rasterization → Output

```toml
[projection]
type = "orthographic"     # orthographic, perspective, tempest

[projection.orthographic]
left = 0.0
right = 160.0
bottom = 0.0
top = 96.0
near = -100.0
far = 100.0

[projection.perspective]
fov = 60.0                # Field of view (degrees)
aspect = 1.666            # Width / height
near = 0.1
far = 1000.0

[projection.tempest]
vanishing_point = [80, 12]  # Top-center of tunnel
z_scale = 0.5               # Depth perspective strength
tunnel_radius = 40.0
tunnel_segments = 16
```

---

## Input Abstraction

### Generic Input Events

All input sources produce normalized events:

```toml
# Input event format
[[event]]
timestamp = 1234567890.123
source = "keyboard"       # keyboard, gamepad, mouse, touch, network
type = "button_press"     # button_press, button_release, axis_motion, pointer_motion
device_id = 0

[event.data]
# Button events
button = "space"          # or "gamepad_a", "mouse_left"
modifiers = ["shift"]     # shift, ctrl, alt, meta

# Axis events
axis = "left_stick_x"     # or "mouse_x", "touch_0_x"
value = 0.73              # Normalized [-1.0, 1.0] or [0.0, 1.0]
delta = 0.05              # Change since last frame

# Pointer events
x = 80
y = 48
pressure = 1.0
```

### Input Mapping

Map raw events to game actions:

```toml
[input_map.player_movement]
# Multiple inputs can trigger same action
[[input_map.player_movement.move_up]]
source = "keyboard"
button = "w"

[[input_map.player_movement.move_up]]
source = "keyboard"
button = "up"

[[input_map.player_movement.move_up]]
source = "gamepad"
axis = "left_stick_y"
threshold = -0.3          # Negative Y = up
```

---

## Palette and Character System

### External Palette Definition

```toml
# palettes/neon.toml
[palette]
name = "neon"
theme_base = "tokyo_night"  # Inherit from TDS theme

[[palette.colors]]
index = 0
name = "player_core"
hex = "00FFFF"            # Bright cyan
semantic_token = "env:0"  # Link to TDS token
description = "Player pulsar core"

[[palette.colors]]
index = 1
name = "player_arm"
hex = "00AAFF"
semantic_token = "env:1"

[[palette.colors]]
index = 2
name = "enemy_core"
hex = "FF0066"
semantic_token = "verbs:0"

# ... up to 256 colors

[palette.gradients]
# Define color ramps for interpolation
player_energy = [0, 1, 0, 1]  # Low→high energy colors
enemy_energy = [2, 3, 2, 3]
heat_map = [4, 5, 6, 7]
```

### External Character Set

```toml
# charsets/braille_extended.toml
[charset]
name = "braille_extended"
encoding = "utf8"
category = "microgrid"

[charset.properties]
width = 2                 # Pixels per character (horizontal)
height = 4                # Pixels per character (vertical)
base_codepoint = 0x2800   # U+2800 = ⠀

# Bitmap mapping (. = off, # = on)
[charset.glyphs]
0x2800 = """
..
..
..
..
"""

0x2801 = """
#.
..
..
..
"""

# ... (auto-generate 256 Braille patterns)

# Custom extended glyphs
[charset.extended]
circle_small = "●"
circle_large = "◉"
star = "✦"
diamond = "◆"
cross = "✚"
```

### Runtime Character Mapping

```toml
# Pulsar arms can use custom glyphs
[pulsar.0.arm.0]
glyph_type = "braille"    # braille, ascii, unicode, custom
glyph_index = 255         # Full block in Braille
glyph_override = "✦"      # Or explicit character

[pulsar.0.rendering]
arm_glyph_set = [0, 31, 63, 95, 127, 159, 191, 223]  # Gradient
tip_glyph = "●"
center_glyph = "◉"
```

---

## State Observation Protocol

### Bash → Engine Commands

```bash
# Query state
QUERY pulsar.0.center_x
QUERY pulsar.0.entropy.total
QUERY world.pulsars.count

# Response format:
VALUE pulsar.0.center_x 80.5
VALUE pulsar.0.entropy.total 0.234
VALUE world.pulsars.count 4

# Export entire state
EXPORT_STATE
# Returns multi-line TOML

# Validate state
VALIDATE_STATE
# Returns:
OK VALID
# or
ERROR pulsar.2.arm.5.energy out of range [0.0, 1.0]: 1.3

# Get derived properties
DERIVE pulsar.0.arm.3.tip_x
# Returns:
VALUE pulsar.0.arm.3.tip_x 95.234

# Introspect schema
SCHEMA pulsar
SCHEMA world
# Returns type definitions
```

### Watch System

```bash
# Bash can watch state changes
WATCH pulsar.0.entropy.total > entropy_log.txt
WATCH pulsar.*.energy.* > energy_log.txt

# Triggers callback on change
game_state_watch "pulsar.0.center_x" "on_player_move"
```

---

## Evolution of Pulsar Concept

### Current: Rotating Sprite

```
Pulsar = { center, rotation, arms[] }
```

### Near Future: Energy Entity

```
Pulsar = {
    physical_state,
    energy_distribution,
    wave_dynamics,
    interaction_rules
}
```

### Long Term: Emergent Organism

```
Pulsar = {
    genome: { arm_count, polarity, behavior_tree },
    phenotype: { derived from genome + environment },
    memory: { past interactions, learned patterns },
    agency: { goals, strategies, adaptation }
}
```

### Interaction Evolution

**Phase 1: Independent** (current)
- Pulsars exist independently
- No interaction beyond collision detection

**Phase 2: Field Interactions**
- Magnetic attraction/repulsion
- Energy transfer on proximity
- Wave interference patterns

**Phase 3: Emergent Behavior**
- Formation of stable orbits
- Phase synchronization (Kuramoto model)
- Collective oscillations
- Predator-prey dynamics

**Phase 4: Evolution**
- Pulsars can merge/split
- Genetic algorithms for arm configuration
- Fitness based on energy accumulation
- Species emergence

---

## Implementation Strategy

### File Structure

```
bash/game/
├── core/
│   ├── state/
│   │   ├── microstate.sh      # Per-arm state management
│   │   ├── macrostate.sh      # Per-pulsar aggregates
│   │   ├── world_state.sh     # Global state
│   │   ├── entropy.sh         # Entropy calculations
│   │   └── validator.sh       # State validation
│   ├── protocol/
│   │   ├── query.sh           # State query protocol
│   │   ├── export.sh          # State export/import
│   │   └── watch.sh           # State observation
│   └── pulsar/
│       ├── physics.sh         # Pulsar physics
│       ├── interactions.sh    # Inter-pulsar dynamics
│       └── evolution.sh       # Long-term behavior
├── rendering/
│   ├── abstract/
│   │   ├── renderer_base.sh   # Generic renderer interface
│   │   └── projection.sh      # Coordinate projections
│   ├── terminal/
│   │   ├── braille.sh         # Braille renderer
│   │   └── ansi.sh            # ANSI color/cursor
│   ├── canvas/
│   │   └── html_canvas.sh     # HTML5 Canvas (future)
│   └── webgl/
│       └── webgl_renderer.sh  # WebGL (future)
├── input/
│   ├── event_system.sh        # Generic input events
│   ├── keyboard.sh            # Keyboard input
│   ├── gamepad.sh             # Gamepad input
│   └── mapper.sh              # Input → action mapping
├── assets/
│   ├── palettes/
│   │   ├── default.toml
│   │   ├── neon.toml
│   │   └── tokyo_night.toml
│   └── charsets/
│       ├── braille.toml
│       ├── ascii.toml
│       └── unicode_extended.toml
└── config/
    ├── state_schema.toml      # State structure definition
    ├── renderer_terminal.toml
    ├── renderer_canvas.toml
    └── input_bindings.toml
```

### Development Phases

**Phase 1: State Foundation** (Current sprint)
- [ ] Implement microstate/macrostate data structures
- [ ] Build entropy calculation system
- [ ] Create state query protocol
- [ ] Add state export/import
- [ ] Build state validator

**Phase 2: Renderer Abstraction**
- [ ] Define generic renderer interface
- [ ] Refactor current C engine to implement interface
- [ ] Create projection pipeline
- [ ] Add palette system
- [ ] Add character set system

**Phase 3: Input Abstraction**
- [ ] Define generic input event format
- [ ] Implement keyboard event normalization
- [ ] Add gamepad event normalization
- [ ] Create input mapper
- [ ] Build action binding system

**Phase 4: Advanced Physics**
- [ ] Implement energy transfer
- [ ] Add magnetic interactions
- [ ] Implement Kuramoto synchronization
- [ ] Add formation behavior
- [ ] Implement Tempest tunnel geometry

**Phase 5: Emergence**
- [ ] Add pulsar merge/split
- [ ] Implement genetic encoding
- [ ] Build fitness evaluation
- [ ] Add evolutionary dynamics

---

## Example: Complete State File

```toml
# example_state.toml - Complete saved game state
version = "1.0.0"
timestamp = 1735689234.567
frame = 12543

[world]
geometry_type = "flat"
width = 160
height = 96
depth = 100
gravity_x = 0.0
gravity_y = 0.0
drag_coefficient = 0.01
energy_decay_rate = 0.001
magnetic_field_strength = 1.0
synchronization_coupling = 0.1
boundary_mode = "wrap"

[world.entropy]
position_dispersion = 0.34
velocity_dispersion = 0.12
energy_variance = 0.28
polarity_mixing = 0.50
total = 0.31

[[pulsars]]
id = 0
type = "pulsar8"
entity_class = "player"
center_x = 80.0
center_y = 48.0
center_z = 0.0
radius = 18.0
velocity_x = 0.0
velocity_y = 0.0
angular_velocity = 0.5
pulse_frequency = 1.0
pulse_amplitude = 6.0
pulse_phase = 0.0
total_energy = 8.0
coherence = 0.95
polarity_balance = 0.0
entropy = 0.12
mass = 1.0
age = 45.3
palette_name = "neon"

[[pulsars.arms]]
index = 0
angle = 0.0
length = 18.0
amplitude = 6.0
phase = 0.0
energy = 1.0
polarity = 1
color_index = 0
glyph_index = 255
z_order = 0

[[pulsars.arms]]
index = 1
angle = 0.785398  # π/4
length = 18.0
amplitude = 6.0
phase = 0.392699  # π/8
energy = 1.0
polarity = -1
color_index = 1
glyph_index = 255
z_order = 0

# ... (6 more arms)

[[pulsars]]
id = 1
type = "pulsar8"
entity_class = "enemy"
# ... (second pulsar state)
```

This state file is:
- Human-readable and editable
- Machine-parseable
- Version-controlled
- Network-transmittable
- Time-reversible (can recreate exact game state)

---

## Benefits of This Architecture

1. **Separation of Concerns**: State, logic, and rendering are independent
2. **Platform Agnostic**: Same engine, multiple rendering targets
3. **Inspectable**: Bash can read and validate entire state
4. **Configurable**: Palettes and characters are external assets
5. **Replayable**: Complete state snapshots enable replay
6. **Networkable**: Pure state can be synced over network
7. **Testable**: State transitions can be unit tested
8. **Evolvable**: Easy to add new pulsar behaviors and properties
9. **Entropy-Aware**: Physics driven by information theory
10. **Future-Proof**: Architecture supports VR, multiplayer, AI agents

This is a **professional game engine architecture** suitable for commercial titles, not just a terminal toy.
