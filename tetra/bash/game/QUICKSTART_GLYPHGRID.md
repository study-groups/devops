# GlyphGrid Quick Start

Get up and running with the C-based game engine in 3 minutes.

## 1. Build the Engine

```bash
cd $TETRA_SRC/engine
make
```

Expected output:
```
mkdir -p ../bin
cc -O3 -std=c99 -Wall -Wextra -o ../bin/glyphgrid src/glyphgrid.c
```

## 2. Run the Demo

```bash
source ~/tetra/tetra.sh
tmod load game
game quadrapole-gfx
```

You should see two rotating pulsars with smooth Braille graphics!

**Controls:**
- `q` - Quit
- `p` - Pause

## 3. Try the Examples

### Simple C Engine Test (No Bash)
```bash
cd $TETRA_SRC
./scripts/run_demo.sh
```

### Bash Integration Test
```bash
bash/game/test_glyphgrid_basic.sh
```

### Interactive Pulsar
```bash
bash/game/test_glyphgrid_pulsar.sh
```

## 4. Write Your First GlyphGrid Script

Create `my_game.sh`:

```bash
#!/usr/bin/env bash
source ~/tetra/tetra.sh
tmod load game

# Initialize GlyphGrid (60 FPS, 80×24 terminal)
game_loop_glyphgrid_init 60 80 24

# Create pulsar at center
my_init() {
    local pulsar_id
    pulsar_glyphgrid_create 40 12 "accent" 2000 pulsar_id
    echo "Pulsar created!" >&2
}

# Update loop (no-op for static sprites)
my_update() {
    local delta=$1
    # Your game logic here
}

# Run!
game_loop_glyphgrid_run my_init my_update
```

Run it:
```bash
chmod +x my_game.sh
./my_game.sh
```

## 5. Understanding the Architecture

```
Your Bash Script
      ↓
  Entity Creation (pulsar_glyphgrid_create)
      ↓
  GlyphGrid Protocol (SPAWN_PULSAR command)
      ↓
  C Engine Process (glyphgrid)
      ↓
  Braille Rendering (160×96 microgrid)
      ↓
  Your Terminal (80×24 cells)
```

## Common Tasks

### Create Multiple Pulsars
```bash
my_init() {
    local p1 p2 p3
    pulsar_glyphgrid_create 20 12 "accent" 2000 p1
    pulsar_glyphgrid_create 40 12 "danger" 1500 p2
    pulsar_glyphgrid_create 60 12 "success" 1800 p3
}
```

### Change Rotation Speed
```bash
pulsar_glyphgrid_create 40 12 "accent" 2000 pulsar_id
pulsar_glyphgrid_set_rotation "$pulsar_id" 1.5  # rad/s (CW)
pulsar_glyphgrid_set_rotation "$pulsar_id" -0.8 # rad/s (CCW)
```

### Adjust Arm Count
```bash
pulsar_glyphgrid_set_arm_count "$pulsar_id" 4  # 4 arms
pulsar_glyphgrid_set_arm_count "$pulsar_id" 8  # 8 arms (default)
```

### Change Pulse Speed
```bash
pulsar_glyphgrid_set_period "$pulsar_id" 1000  # Fast (1s)
pulsar_glyphgrid_set_period "$pulsar_id" 3000  # Slow (3s)
```

### Move a Pulsar
```bash
pulsar_glyphgrid_set_position "$pulsar_id" 60 20
```

### Change Color (Valence)
Create a new pulsar with different valence:
```bash
# Available: neutral, info, success, warning, danger, accent
pulsar_glyphgrid_create 40 12 "danger" 2000 pulsar_id
```

## Next Steps

- Read [`GLYPHGRID_INTEGRATION.md`](./GLYPHGRID_INTEGRATION.md) for detailed architecture
- Study [`demos/quadrapole_glyphgrid.sh`](./demos/quadrapole_glyphgrid.sh) for example code
- Check [`core/glyphgrid.sh`](./core/glyphgrid.sh) for all available functions
- Explore the C source: [`engine/src/glyphgrid.c`](../../engine/src/glyphgrid.c)

## Troubleshooting

**"GlyphGrid not available"**
```bash
cd $TETRA_SRC/engine && make
```

**"Failed to start GlyphGrid"**
```bash
# Test binary directly
$TETRA_SRC/engine/bin/glyphgrid
# Should print: OK READY
```

**Terminal looks garbled**
```bash
# Reset terminal
reset
# Or
tput reset
```

**Slow performance**
```bash
# Lower FPS
game_loop_glyphgrid_init 30 80 24  # 30 FPS instead of 60
```

---

Have fun! 🎮✨
