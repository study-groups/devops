# Pulsar REPL - Interactive Engine Protocol Shell

Interactive shell for exploring and controlling the Pulsar Engine with guided help, named sprites, and preset scenes.

## Quick Start

```bash
# From tetra environment
game repl

# Or directly
cd /Users/mricos/src/devops/tetra/bash/game
./test_repl.sh
```

## Features

- ⚡ **Engine Management**: Start/stop/restart Pulsar engine via TSM integration
- 🏷️ **Named Sprites**: Create sprites with friendly names instead of numeric IDs
- 📜 **Script Loading**: Load .pql script files dynamically
- 🎨 **Presets**: Quick-spawn common configurations (hello, trinity, dance)
- 📊 **Status Tracking**: Real-time sprite count and engine state
- 💾 **History**: Command history with readline support
- 🎯 **Raw Protocol**: Direct access to Engine Protocol commands

## Command Reference

### Engine Control

```
start              Start the Pulsar engine (160×96 grid)
stop               Stop the engine and cleanup
restart            Restart the engine
status             Show engine status, PID, and active sprites
```

### High-Level Commands

```bash
# Spawn a named pulsar
spawn <name> <mx> <my> <len0> <amp> <freq> <dtheta> <valence>
spawn mystar 80 48 18 6 0.5 0.6 0

# Update sprite by name
set <name> <key> <value>
set mystar dtheta 1.2
set mystar freq 0.8

# Kill sprite by name
kill <name>
kill mystar

# List all named sprites
list
```

### Presets (Quick Spawns)

```bash
hello              # Single cyan pulsar at center
trinity            # Three pulsars in formation
dance              # Two counter-rotating pulsars
```

### Script Loading

```bash
# Load .pql script file
load scripts/hello.pql
load scripts/trinity.pql
load scripts/orbit.pql
```

### Raw Engine Protocol

```bash
# Send raw commands directly
raw <command>
raw SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
raw SET 1 dtheta 1.2
raw KILL 1
raw LIST_PULSARS

# Or use direct commands (auto-detected)
SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
SET 1 mx 100
KILL 1
```

### Utility

```bash
help, h, ?         Show help
!<cmd>             Execute shell command
quit, exit, q      Exit REPL
```

## Example Session

```
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

⚡ pulsar[4] ▶ set star1 dtheta 1.5
→ SET 1 dtheta 1.5
OK SET

⚡ pulsar[4] ▶ load scripts/orbit.pql
📜 Loading script: scripts/orbit.pql
  → SPAWN_PULSAR 110 48 10 3 0.5 0.4 0
  → SPAWN_PULSAR 101 69 10 3 0.5 0.4 1
  ...
✓ Script loaded

⚡ pulsar[12] ▶ status
Status: ⚡ Running
  PID: 12345
  Grid: 160×96
  Sprites: 12

Active sprites:
  star1 → ID 1
  left → ID 2
  center → ID 3
  right → ID 4

⚡ pulsar[12] ▶ quit
🛑 Stopping Pulsar Engine...
✓ Engine stopped

Goodbye! ⚡
```

## Prompt Indicators

```
💤 pulsar ▶        Engine stopped
⚡ pulsar[0] ▶     Engine running, 0 sprites
⚡ pulsar[4] ▶     Engine running, 4 sprites
```

## Integration

### With Game Module

```bash
# Via game command
game repl

# Automatically sources:
# - bash/repl (universal REPL system)
# - bash/color (color support)
# - core/pulsar.sh (engine integration)
```

### With TSM (Tetra Service Manager)

The REPL integrates with TSM for process lifecycle:

```bash
# Engine is managed as a coprocess
pulsar_start       # Spawns coproc PULSAR
pulsar_stop        # Cleanup and termination
pulsar_cmd         # Send command to stdin
pulsar_read_response  # Read from stdout
```

### Standalone Usage

```bash
# Minimal environment setup
export TETRA_SRC="$HOME/src/devops/tetra"
export TETRA_DIR="$HOME/tetra"
export GAME_SRC="$TETRA_SRC/bash/game"

source "$GAME_SRC/core/pulsar.sh"
source "$GAME_SRC/core/pulsar_repl.sh"

pulsar_repl_run
```

## Architecture

```
┌─────────────────────────────────────────┐
│  User Input (readline)                  │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  REPL Command Processor                 │
│  - Parse: spawn, set, kill, etc.       │
│  - Resolve names → IDs                  │
│  - Build Engine Protocol commands       │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Pulsar Core (pulsar.sh)                │
│  - pulsar_cmd (send to stdin)          │
│  - pulsar_read_response (read stdout)  │
│  - Coprocess management (TSM)          │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Pulsar Engine (C binary)               │
│  - Stdin: Engine Protocol commands      │
│  - Stdout: OK/ID/ERR responses          │
│  - Stderr: Banner + debug logs          │
└─────────────────────────────────────────┘
```

## Files

```
bash/game/
├── core/
│   ├── pulsar.sh              # Engine process management
│   └── pulsar_repl.sh         # REPL implementation
├── engine/
│   ├── bin/pulsar             # C engine binary
│   └── scripts/               # .pql script files
│       ├── hello.pql
│       ├── trinity.pql
│       ├── spectrum.pql
│       ├── dance.pql
│       ├── orbit.pql
│       └── chaos.pql
├── game.sh                    # Module entry point
├── test_repl.sh               # Interactive test launcher
└── test_repl_demo.sh          # Automated demo
```

## Protocol Hierarchy

The REPL bridges multiple protocol layers:

1. **Engine Protocol** (Canonical) - C stdin/stdout commands
   ```
   INIT 160 96
   SPAWN_PULSAR 80 48 18 6 0.5 0.6 0
   SET 1 dtheta 1.2
   ```

2. **REPL Commands** (User-friendly) - Named entities, guided help
   ```
   spawn mystar 80 48 18 6 0.5 0.6 0
   set mystar dtheta 1.2
   ```

3. **Presets** (Shortcuts) - Common configurations
   ```
   trinity
   hello
   dance
   ```

4. **Scripts** (.pql files) - Batch commands
   ```pql
   # trinity.pql
   SPAWN_PULSAR 40 48 18 6 0.5 0.8 0
   SPAWN_PULSAR 80 48 20 8 0.4 -0.3 2
   SPAWN_PULSAR 120 48 15 4 0.7 0.6 5
   ```

## Development

### Adding New Presets

Edit `pulsar_repl.sh`:

```bash
pulsar_repl_preset_mypreset() {
    pulsar_repl_spawn "sprite1" 40 20 15 5 0.6 0.5 0
    pulsar_repl_spawn "sprite2" 120 20 15 5 0.6 -0.5 5
}
```

Add to command processor:

```bash
case "$cmd" in
    ...
    mypreset)
        pulsar_repl_preset_mypreset
        ;;
esac
```

### Adding New Commands

1. Add handler function
2. Add case in `_pulsar_repl_process_input`
3. Update `pulsar_repl_show_help`

### Testing

```bash
# Automated test
./test_repl_demo.sh

# Interactive test
./test_repl.sh
```

## Troubleshooting

### Engine won't start

```bash
# Check binary
ls -l engine/bin/pulsar

# Rebuild
cd engine && make clean && make
```

### Commands not working

```bash
# Check engine status
status

# Restart engine
restart
```

### Script not found

```bash
# Use full path
load /Users/mricos/src/devops/tetra/bash/game/engine/scripts/hello.pql

# Or relative to engine/
load scripts/hello.pql
```

## See Also

- [Engine Protocol Reference](engine/scripts/README.md)
- [PQL Command Reference](../CANONICAL_PQL_COMMAND_REFERENCE.md)
- [Game Module README](README.md)
- [Pulsar Engine Architecture](ARCHITECTURE.md)
