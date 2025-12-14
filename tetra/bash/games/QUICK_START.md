# Pulsar Engine - Quick Start Guide

## 30-Second Start

```bash
# Interactive REPL
game repl
start
hello
quit

# Pipe a script
cd engine
cat scripts/trinity.pql | ./bin/pulsar
```

## Installation

```bash
# Build engine
cd ~/src/devops/tetra/bash/game/engine
make clean && make

# Verify
echo "QUIT" | ./bin/pulsar
```

## Three Ways to Use Pulsar

### 1. Interactive REPL (Recommended for Learning)

```bash
game repl
```

```
⚡ pulsar ▶ start
⚡ pulsar[0] ▶ spawn mystar 80 48 18 6 0.5 0.6 0
⚡ pulsar[1] ▶ set mystar dtheta 1.5
⚡ pulsar[1] ▶ trinity
⚡ pulsar[4] ▶ list
⚡ pulsar[4] ▶ quit
```

**Best for:** Exploration, testing, learning protocol

### 2. Piped Scripts (Recommended for Scenes)

```bash
cd engine
cat scripts/trinity.pql | ./bin/pulsar
```

**Best for:** Reproducible scenes, demos, automation

### 3. Direct Protocol (Recommended for Integration)

```bash
(
    echo "INIT 160 96"
    echo "SPAWN_PULSAR 80 48 18 6 0.5 0.6 0"
    echo "RUN 60"
) | ./bin/pulsar
```

**Best for:** Custom integrations, scripting

## REPL Commands Cheat Sheet

```
start                               Start engine
spawn <name> <params>               Create named pulsar
set <name> <key> <value>            Update sprite
kill <name>                         Remove sprite
list                                Show all sprites
hello / trinity / dance             Quick presets
load scripts/<file>.pql             Load script
status                              Show engine state
help                                Full reference
quit                                Exit
```

## Script File Format

```pql
# Comment
INIT 160 96
SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>
RUN 60
```

**Example:** `scripts/hello.pql`
```pql
# Hello World
INIT 160 96
SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
RUN 60
```

## Parameter Guide

```
mx, my      Position (2× terminal cells)
len0        Arm length (8-30)
amp         Pulse amplitude (2-12)
freq        Pulse frequency (0.1-1.2 Hz)
dtheta      Rotation speed (-3.14 to 3.14 rad/s)
valence     Color: 0=cyan, 1=green, 2=yellow, 3=orange, 4=red, 5=magenta
```

## Common Patterns

### Create and Modify
```
⚡ pulsar ▶ start
⚡ pulsar ▶ spawn test 80 48 18 6 0.5 0.6 0
⚡ pulsar ▶ set test dtheta 1.5
⚡ pulsar ▶ set test freq 0.8
```

### Load and Extend
```
⚡ pulsar ▶ start
⚡ pulsar ▶ load scripts/trinity.pql
⚡ pulsar ▶ spawn extra 100 70 12 4 0.7 0.3 3
```

### Batch Create
```
⚡ pulsar ▶ start
⚡ pulsar ▶ trinity
⚡ pulsar ▶ list
```

## Output Redirection

```bash
# Protocol output only
cat scripts/hello.pql | ./bin/pulsar 2>/dev/null

# Banner to terminal, protocol to file
cat scripts/hello.pql | ./bin/pulsar > output.txt

# Everything to file
cat scripts/hello.pql | ./bin/pulsar 2>&1 > complete.log
```

## Troubleshooting

### Engine binary not found
```bash
cd engine && make clean && make
```

### REPL won't start
```bash
# Check environment
echo $TETRA_SRC
echo $GAME_SRC

# Use test launcher
./test_repl.sh
```

### Script not loading
```bash
# Use full path
load /full/path/to/script.pql

# Or relative to engine/
cd engine
load scripts/hello.pql
```

## Available Scripts

```
hello.pql       Single cyan pulsar (test)
trinity.pql     Three pulsars in formation
spectrum.pql    All six color valences
dance.pql       Two counter-rotating pulsars
orbit.pql       Ring of 8 pulsars
chaos.pql       Extreme parameter variations
```

## Learn More

- [PULSAR_REPL.md](PULSAR_REPL.md) - Complete REPL reference
- [engine/scripts/README.md](engine/scripts/README.md) - Script documentation
- [REPL_IMPLEMENTATION_SUMMARY.md](REPL_IMPLEMENTATION_SUMMARY.md) - Architecture

## Protocol Hierarchy

```
1. Engine Protocol      (Source of Truth)      SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
2. PQL                  (User-Facing)          CREATE user.0.pulsar.0 mx=80 my=48
3. Bash Protocol        (Shell Integration)    pulsar_spawn "pulsar" 0 128 mx=80
4. TOML Config          (Configuration)        [[entities]] type="pulsar"
```

## Example Session

```bash
$ game repl

╔═══════════════════════════════════════╗
║   ⚡ PULSAR REPL v1.0                ║
║   Interactive Engine Protocol Shell  ║
╚═══════════════════════════════════════╝

Type 'help' for commands, 'start' to begin

💤 pulsar ▶ start
🚀 Starting Pulsar Engine...
✓ Engine started (PID: 12345, 160×96)

⚡ pulsar[0] ▶ spawn star1 80 48 18 6 0.5 0.6 0
→ SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
✓ Spawned 'star1' → ID 1

⚡ pulsar[1] ▶ trinity
→ SPAWN_PULSAR 40 48 18 6 0.5 0.8 0
✓ Spawned 'left' → ID 2
→ SPAWN_PULSAR 80 48 20 8 0.4 -0.3 2
✓ Spawned 'center' → ID 3
→ SPAWN_PULSAR 120 48 15 4 0.7 0.6 5
✓ Spawned 'right' → ID 4

⚡ pulsar[4] ▶ list
star1 → ID 1
left → ID 2
center → ID 3
right → ID 4

⚡ pulsar[4] ▶ quit
🛑 Stopping Pulsar Engine...

Goodbye! ⚡
```

---

**Ready to explore?** Run `game repl` now! 🚀
