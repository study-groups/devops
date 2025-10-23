# Pulsar Engine Scripts

Pre-made animation scenes in Engine Protocol format.

## Usage

```bash
cd /Users/mricos/src/devops/tetra/bash/game/engine

# Run any script
cat scripts/hello.pql | ./bin/pulsar

# Save output log
cat scripts/trinity.pql | ./bin/pulsar 2>&1 > output.log

# Redirect stderr to see banner only
cat scripts/spectrum.pql | ./bin/pulsar 2>/dev/null
```

## Available Scenes

### hello.pql
Single cyan pulsar centered on screen. Perfect for testing.

**Parameters:**
- Position: Center (80, 48)
- Valence: 0 (Cyan)
- Simple steady pulse

```bash
cat scripts/hello.pql | ./bin/pulsar
```

---

### trinity.pql
Three pulsars in balanced formation.

**Formation:**
- Left: Cyan (fast rotation)
- Center: Yellow (slow rotation)
- Right: Magenta (medium rotation)

```bash
cat scripts/trinity.pql | ./bin/pulsar
```

---

### spectrum.pql
All six valence colors displayed horizontally.

**Colors:** Cyan → Green → Yellow → Orange → Red → Magenta

```bash
cat scripts/spectrum.pql | ./bin/pulsar
```

---

### dance.pql
Two pulsars spinning in opposite directions.

**Choreography:**
- Left dancer: Clockwise rotation (dtheta = 1.2)
- Right dancer: Counter-clockwise (dtheta = -1.2)

```bash
cat scripts/dance.pql | ./bin/pulsar
```

---

### orbit.pql
Eight small pulsars arranged in a circle.

**Pattern:**
- Ring formation around center
- Each pulsar has different valence
- Synchronized pulse frequency

```bash
cat scripts/orbit.pql | ./bin/pulsar
```

---

### chaos.pql
Five pulsars with extreme parameter variations.

**Features:**
- Varied sizes (len0: 8-30)
- Mixed frequencies (0.2-1.2 Hz)
- Extreme rotation speeds (0.1-3.0 rad/s)

```bash
cat scripts/chaos.pql | ./bin/pulsar
```

---

## Creating Custom Scenes

### File Format

```pql
# Comments start with #
INIT <width> <height>

# Spawn pulsars
SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>

# Start animation
RUN <fps>
```

### Parameter Guide

```
mx, my    - Position (microgrid: 2× terminal cells)
len0      - Base arm length (8-30)
amp       - Pulse amplitude (2-12)
freq      - Pulse frequency (0.1-1.2 Hz)
dtheta    - Rotation speed (-3.14 to 3.14 rad/s)
valence   - Color: 0=cyan, 1=green, 2=yellow, 3=orange, 4=red, 5=magenta
```

### Example Custom Scene

```pql
# my_scene.pql
INIT 160 96
SPAWN_PULSAR 80 48 20 8 0.5 0.6 0
SPAWN_PULSAR 40 24 15 5 0.8 -0.4 5
RUN 60
```

Save and run:
```bash
cat my_scene.pql | ./bin/pulsar
```

---

## Output Redirection

### Save protocol output only
```bash
cat scripts/trinity.pql | ./bin/pulsar 2>/dev/null > protocol.log
```

### Save stderr (banner + errors) only
```bash
cat scripts/trinity.pql | ./bin/pulsar 2> errors.log
```

### Save everything
```bash
cat scripts/trinity.pql | ./bin/pulsar 2>&1 > complete.log
```

### See banner but save protocol output
```bash
cat scripts/trinity.pql | ./bin/pulsar > protocol.log
# Banner goes to stderr (terminal), responses go to file
```

---

## Engine Protocol Reference

See: `/Users/mricos/src/devops/tetra/bash/game/engine/README.md`

Commands:
- `INIT <w> <h>` - Initialize grid
- `SPAWN_PULSAR ...` - Create pulsar sprite
- `SET <id> <key> <val>` - Update property
- `KILL <id>` - Remove sprite
- `RUN <fps>` - Start animation loop
- `QUIT` - Exit engine

Responses:
- `OK READY` - Engine initialized
- `OK <cmd>` - Command succeeded
- `ID <n>` - Sprite created with ID n
- `ERR <code>` - Error occurred
