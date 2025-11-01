# Pair Dynamics: Dual Control Gameplay

## Core Concept

**The minimum playable unit is a PAIR of pulsars.**

Not for metaphysical reasons, but for mechanical ones:
- Two control points (dual-stick)
- Power exchange based on distance
- Field manipulation between them
- Emergent coordination challenges

## Three Game Modes

### Mode 1: Dual-Stick Solo

**Setup:**
- One player, one gamepad
- Left stick controls Pulsar A
- Right stick controls Pulsar B
- Shoulder button activates "plasmic-thumb"

**Core Mechanic: Distance-Based Power**

```
Power = f(distance_between_pair)

Close together:
  - High energy transfer
  - Bright, powerful pulsars
  - Strong field effects
  - Slower movement (coupled)

Far apart:
  - Low energy
  - Dim, weaker pulsars
  - Weak field effects
  - Faster movement (independent)
```

**Gameplay Tension:**
- Need to spread apart to cover ground
- Need to be close for power
- Constant tradeoff: coverage vs. strength

**Plasmic-Thumb Ability:**
- Hold shoulder button
- Area between your two pulsars becomes "active zone"
- Any other pulsar in that zone can be grabbed
- Push/pull with stick movement
- Release button to let go

**Win Condition (if any):**
- Gather N catalyst pulsars
- Form specific pattern
- Achieve resonance with all field pulsars
- Or: no win condition, pure sandbox

### Mode 2: Multiplayer Emergent (1v1 or FFA)

**Setup:**
- Each player controls ONE pulsar
- Single stick + buttons
- No explicit objectives
- Pure sandbox/experimentation

**Core Mechanic: Spontaneous Interaction**

Players discover:
- Phase synchronization (pulsars lock rhythm)
- Orbital patterns (circle each other)
- Energy transfer (one feeds the other)
- Resonance chains (A affects B affects C)
- Formation emergence (triangle, square, hexagon)

**No Win/Lose:**
- Just exploration
- Find beautiful patterns
- Share discoveries
- Export configurations

**Social Dynamics:**
- Players can cooperate or compete naturally
- No rules enforce either
- Emergent social contracts
- "Let's try to make a hexagon" vs. "Let's see what chaos looks like"

### Mode 3: Multiplayer Paired (Advanced)

**Setup:**
- Each player controls TWO pulsars
- Dual-stick per player
- All pairs are aware of each other
- Plasmic-thumb can affect other players' pulsars

**Chaos Potential:**
- Player 1's pair grabs Player 2's pulsar
- Player 2 tries to pull back with their plasmic-thumb
- Tug-of-war emerges
- Or: cooperative manipulation of shared field objects

**Requires:**
- Good communication (or enjoy chaos)
- Multiple gamepads
- Larger play area
- Probably screen partitions or shared view

## Pair Bond Mechanics

### Energy Transfer

```
Energy flows between pair members:

dE_A/dt = k * (E_B - E_A) / distance
dE_B/dt = k * (E_A - E_B) / distance

Where:
  k = transfer rate constant
  distance = euclidean distance between pair
```

**Effect:**
- Close pulsars equilibrate energy quickly
- Distant pulsars maintain independent energy
- One pulsar can "feed" the other

**Visual:**
- Bright pulse travels along connecting line
- Thicker line = more energy transfer
- Color shifts based on energy level

### Maximum Separation (Elastic Tether)

```
If distance > max_separation:
    Apply spring force toward pair center
    F = k * (distance - max_separation)
```

**Feel:**
- Not a rigid wall, but increasing resistance
- Like stretching a rubber band
- Can "fight" the tether briefly
- Eventually pulls back

**Max separation: 60-80 pixels** (tunable)

### Minimum Separation (Repulsion)

```
If distance < min_separation:
    Apply repulsion force
    F = -k / distance²
```

**Prevents:**
- Pulsars stacking on top of each other
- Visual confusion
- Degenerate strategies

**Min separation: 10-15 pixels**

## Plasmic-Thumb Mechanics

### Activation

```
While shoulder_button_pressed:
    Calculate grab_zone (area between pair)
    Detect targets in grab_zone
    Highlight closest target
    If stick moved:
        Apply force to target
```

### Grab Zone (The Field Between)

```
Shape: Ellipse or rotated rectangle
  - Point A: Pulsar A position
  - Point B: Pulsar B position
  - Width: distance between A and B
  - Height: distance * 0.3

Any pulsar inside zone can be affected.
```

**Visual:**
- Faint glow/outline when activated
- Target pulsar pulses when selected
- Force lines from pair to target

### Force Application

```
force_direction = stick_input (x, y)
force_magnitude = |stick_input| * power_factor

power_factor = f(pair_energy, pair_distance)
  - More energy = stronger grab
  - Closer pair = stronger grab
  - Distant/weak pair = weak grab
```

**Cooldown/Cost:**
- Drains energy from pair
- Can't spam continuously
- Must "recharge" by bringing pair close

### What Can Be Grabbed?

**Mode 1 (solo):**
- Catalyst pulsars (yellow)
- Anchor pulsars (grey)
- Resonant pulsars (purple)
- NOT conjugate pulsars (they resist)

**Mode 2 (multiplayer):**
- Other players' pulsars (with consent mechanic?)
- Field objects only
- Or: everything, chaos ensues

**Mode 3 (paired multi):**
- Everything fair game
- Including other players' pairs
- Tug-of-war city

## Control Schemes

### Dual-Stick (Mode 1 & 3)

```
Left Stick:   Pulsar A movement (X, Y)
Right Stick:  Pulsar B movement (X, Y)
L1/LT:        Plasmic-thumb activate
L2:           Boost Pulsar A
R2:           Boost Pulsar B
D-pad:        Camera control (if needed)
Start:        Pause
Select:       Mode toggle / help
```

### Single-Stick (Mode 2)

```
Left Stick:   Pulsar movement (X, Y)
Right Stick:  Fine rotation control? Energy pulse direction?
Triggers:     Boost / special ability
Buttons:      Quick actions (sync attempt, energy gift)
```

## Visual Feedback

### Pair Connection Line

```
Always visible between pair members.

Properties:
  - Color: Gradients from A color to B color
  - Thickness: Energy transfer rate
  - Opacity: Distance (close = opaque, far = faint)
  - Animation: Pulse travels A→B or B→A (energy flow)
```

### Energy Level

```
Pulsar brightness/size = energy level

High energy:
  - Large, bright, many arms
  - Fast rotation
  - Strong pulse

Low energy:
  - Small, dim, few arms
  - Slow rotation
  - Weak pulse
```

### Plasmic-Thumb Active

```
When activated:
  - Grab zone outline appears
  - Target pulsar highlights
  - Force lines from pair to target
  - Stick input shows force direction
```

## Gameplay Examples

### Solo Mode Example

```
[Start]
Your pair spawns (cyan pulsars A & B)
They're close, energy is balanced

[Exploration]
You spread them apart to explore
Energy drops, pulsars dim
You spot a yellow catalyst in distance

[Decision]
Too far for one pulsar to reach
You bring pair closer (energy up)
Use plasmic-thumb to pull catalyst toward you

[Collection]
Catalyst energizes your pair
Now brighter, can explore wider
Repeat to gather more resources
```

### Multiplayer Example

```
[Player 1 spawns cyan pair]
[Player 2 spawns magenta pair]

[Initial chaos]
Pulsars randomly moving
Patterns emerge coincidentally

[Discovery]
P1 and P2 pulsars sync by accident
Beautiful beating pattern forms
Both players stop to watch

[Collaboration]
Players realize: "What if we form a square?"
Coordinate positions
Achieve stable formation
Screenshot moment

[New experiment]
"What happens if we orbit each other?"
Try circular motion
Create spiral trails
Laughter ensues
```

## Tunable Parameters

All in `config/pair_dynamics.toml`:

```toml
[pair_bond]
max_separation = 80.0
min_separation = 10.0
spring_constant = 0.5
repulsion_constant = 2.0

[energy_transfer]
transfer_rate = 0.1
equilibrium_speed = 5.0  # seconds to equilibrate
distance_scaling = "inverse"  # or "inverse_square"

[plasmic_thumb]
grab_zone_aspect = 0.3  # height/width ratio
force_scaling = 2.0
energy_cost_per_second = 0.2
cooldown = 1.0  # seconds
max_targets = 1  # or multiple?

[power_curve]
distance_power_min = 0.2  # power at max separation
distance_power_max = 1.0  # power at min separation
curve_exponent = 2.0  # how quickly power drops
```

## Edge Cases

### What if one pulsar is destroyed?

**Option A: Partner evaporates**
- Lose one, lose both
- Respawn as pair

**Option B: New partner spawns**
- Automatic replacement
- Maintains gameplay

**Choice:** Probably A (emphasizes pair bond)

### What if pair gets stuck?

**Unstick mechanic:**
- Hold both triggers
- Briefly override separation limits
- "Teleport snap" back to stable distance

### What about obstacles/walls?

**Collision:**
- Pulsars bounce off walls
- Tether stretches
- Creates physics puzzles

## Difficulty Scaling

### Easy Mode
- High energy at all distances
- Strong plasmic-thumb
- Slow field dynamics

### Normal Mode
- Distance matters
- Moderate thumb strength
- Medium field dynamics

### Hard Mode
- Must manage distance carefully
- Weak thumb (must coordinate pair)
- Fast chaotic field

### Zen Mode
- Infinite energy
- No objectives
- Just create patterns
- Sandbox

## Future Expansions

### Asymmetric Pairs
- Pulsar A is large, slow
- Pulsar B is small, fast
- Different roles

### Special Abilities
- A can shield, B can attack
- A scouts, B anchors
- Complementary powers

### Environmental Hazards
- Magnetic fields (push/pull pair)
- Energy wells (drain if pass through)
- Tunnels (force close proximity)

### Multiplayer Modes
- 2v2 (paired teams)
- Relay race (coordinate pair through course)
- Formation contest (build shape fastest)

## Success Metrics

The game works if:
1. Players naturally oscillate pair distance
2. Plasmic-thumb feels satisfying to use
3. Multiplayer spawns emergent behaviors
4. Players say "Just one more round"
5. Screenshots are shared

Not about score or completion, but about **feel** and **flow**.

## Technical Implementation

### State Tracking

```bash
# Pair bond structure
declare -A PAIR_BONDS
PAIR_BONDS[pair_0]="pulsar_0:pulsar_1"
PAIR_BONDS[pair_1]="pulsar_2:pulsar_3"

# Energy levels
declare -A PULSAR_ENERGY
PULSAR_ENERGY[pulsar_0]=1.0
PULSAR_ENERGY[pulsar_1]=0.8

# Plasmic-thumb state
declare -A PLASMIC_THUMB_ACTIVE
PLASMIC_THUMB_ACTIVE[player_0]=false

declare -A PLASMIC_THUMB_TARGET
PLASMIC_THUMB_TARGET[player_0]="pulsar_5"
```

### Update Loop

```bash
game_loop() {
    while running; do
        # Input
        read_gamepad_input

        # Update pairs
        for pair in "${!PAIR_BONDS[@]}"; do
            update_pair_energy "$pair"
            apply_tether_forces "$pair"
        done

        # Update plasmic-thumb
        for player in "${!PLASMIC_THUMB_ACTIVE[@]}"; do
            if [[ "${PLASMIC_THUMB_ACTIVE[$player]}" == "true" ]]; then
                apply_plasmic_force "$player"
            fi
        done

        # Physics
        update_positions
        check_collisions

        # Render
        render_frame
    done
}
```

This is the foundation. Let's build it.
