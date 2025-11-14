# Pulsar + TGP: Live Game REPL

## Overview

Pulsar now supports **two protocols**:

1. **Stdio Protocol** (original) - Text commands via stdin/stdout
2. **TGP Protocol** (new) - Binary datagrams over Unix sockets

The TGP protocol enables **live interaction**: send commands while the game engine runs!

## Quick Start

### Option 1: Simple Stdio REPL (Original)

```bash
cd $TETRA_SRC/bash/game
bash games/pulsar/pulsar_simple_repl.sh

pulsar ▶ start
pulsar ▶ hello
pulsar ▶ run        # Fullscreen animation, press 'q' to return
pulsar ▶ quit
```

**Pros:** Simple, direct rendering
**Cons:** Can't send commands during animation

### Option 2: TGP REPL (New!)

```bash
cd $TETRA_SRC/bash/game
bash games/pulsar/pulsar_tgp_repl.sh

💤 pulsar[0] ▶ hello      # Spawns sprite
⚡ pulsar[1] ▶ run        # Starts engine
⚡ pulsar[1] ▶ trinity    # Add more sprites WHILE RUNNING!
⚡ pulsar[4] ▶ dance      # Keeps adding...
⚡ pulsar[6] ▶ list       # See all sprites
⚡ pulsar[6] ▶ stop       # Pause engine
⚡ pulsar[6] ▶ quit       # Exit
```

**Pros:** Live updates, non-blocking commands
**Cons:** Frame rendering is in metadata only (for now)

## TGP REPL Commands

### Basic Commands

| Command | Description | Example |
|---------|-------------|---------|
| `spawn <name> [params]` | Spawn a pulsar sprite | `spawn star1 80 48 18 6 0.5 0.6 0` |
| `run [fps]` | Start the engine | `run 60` |
| `stop` | Stop the engine | `stop` |
| `kill <name>` | Destroy sprite | `kill star1` |
| `list` | List all sprites | `list` |
| `help` | Show help | `help` |
| `quit` | Exit REPL | `quit` |

### Preset Commands

| Command | Description |
|---------|-------------|
| `hello` | Single cyan pulsar at center |
| `trinity` | Three pulsars (left, center, right) |
| `dance` | Two counter-rotating pulsars |

### Spawn Parameters

```
spawn <name> <x> <y> <len> <amp> <freq> <rot> <color>
```

- `name` - Sprite identifier
- `x, y` - Position (80, 48 = center)
- `len` - Arm length (1-30)
- `amp` - Pulse amplitude (1-15)
- `freq` - Pulse frequency (0.1-2.0 Hz)
- `rot` - Rotation speed (-2.0 to 2.0)
- `color` - Color (0=Cyan 1=Green 2=Yellow 3=Red 4=Magenta 5=Blue)

## Architecture

### Stdio Mode

```
Bash REPL ←→ stdin/stdout ←→ C Engine → /dev/tty (fullscreen)
```

### TGP Mode

```
Bash REPL ──TGP commands──→ C Engine
          ←─TGP responses─┤
          ←─TGP frames────┤  (runs continuously)
          ←─TGP events────┤
```

**4 independent socket channels:**
- `/tmp/tgp_<session>_cmd.sock` - Commands (client → engine)
- `/tmp/tgp_<session>_resp.sock` - Responses (engine → client)
- `/tmp/tgp_<session>_frame.sock` - Frames (engine → client)
- `/tmp/tgp_<session>_event.sock` - Events (engine → client)

## Manual TGP Usage

### Start Engine

```bash
$TETRA_SRC/bash/game/engine/bin/pulsar --tgp my_session &
ENGINE_PID=$!
```

### Connect Client

```bash
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/tgp/tgp.sh"

tgp_init "my_session"
```

### Send Commands

```bash
# Initialize
tgp_send_init 160 96 60

# Spawn sprite
tgp_send_spawn 0 0 80 48 18 6 500 600  # floats as fixed-point (*1000)

# Start engine
tgp_send_run 60

# Receive responses
tgp_recv_response 1000
echo "Response: $TGP_RESP_TYPE"

# Quit
tgp_send_quit
```

### Cleanup

```bash
tgp_cleanup
kill $ENGINE_PID
wait $ENGINE_PID
```

## Files

```
bash/game/games/pulsar/
├── pulsar_simple_repl.sh    # Stdio REPL (original)
├── pulsar_tgp_repl.sh      # TGP REPL (new!)
└── README_TGP.md           # This file

bash/tgp/
├── TGP_SPECIFICATION.md    # Complete protocol spec
├── README.md               # TGP documentation
├── tgp.sh                  # Bash TGP library
└── examples/
    └── test_pulsar_tgp.sh  # TGP test script

bash/game/engine/
├── bin/pulsar              # Compiled engine
└── src/
    ├── pulsar.c            # Engine (with TGP support)
    ├── tgp.h               # TGP header
    └── tgp.c               # TGP implementation
```

## Development

### Build Pulsar with TGP

```bash
cd $TETRA_SRC/bash/game/engine
make clean && make
```

### Run Tests

```bash
# Simple test
bash $TETRA_SRC/bash/tgp/examples/test_pulsar_tgp.sh

# Interactive REPL
bash $TETRA_SRC/bash/game/games/pulsar/pulsar_tgp_repl.sh
```

## Differences: Stdio vs TGP

| Feature | Stdio | TGP |
|---------|-------|-----|
| **Blocking** | Yes (RUN blocks) | No (always responsive) |
| **Commands during animation** | No | Yes! |
| **Protocol** | Text | Binary |
| **Speed** | Text parsing | Fast binary |
| **Channels** | 1 (stdin/stdout) | 4 (cmd/resp/frame/event) |
| **Multi-client** | No | Yes |
| **Frame streaming** | Direct to TTY | Via socket |
| **Network ready** | No | Yes (future) |

## Future Enhancements

### Short Term
- [ ] Full frame rendering (ANSI text) via TGP
- [ ] Frame viewer script (displays streamed frames)
- [ ] Property queries (GET commands)

### Medium Term
- [ ] Split-screen TUI (frames on top, REPL on bottom)
- [ ] Differential frame updates
- [ ] Event stream visualization

### Long Term
- [ ] UDP transport for network multiplayer
- [ ] Frame compression
- [ ] Shared memory for zero-copy frames

## Troubleshooting

### Sockets not found
- Ensure engine is running with `--tgp <session>`
- Check `/tmp/tgp_*` for socket files
- Verify session name matches

### Commands not working
- Check engine stderr for TGP messages
- Verify TGP initialization: `tgp_init` returned 0
- Try manual socket test: `ls -la /tmp/tgp_*`

### Engine crashes
- Check for errors in engine stderr
- Verify parameters are in valid ranges
- Try simpler commands first

## Examples

### Example 1: Spawn and Run

```bash
bash games/pulsar/pulsar_tgp_repl.sh

⚡ pulsar[0] ▶ hello
✓ Spawned 'hello'
⚡ pulsar[1] ▶ run
✓ Engine running at 60 FPS
⚡ pulsar[1] ▶ quit
```

### Example 2: Build Scene Live

```bash
⚡ pulsar[0] ▶ spawn star1 60 48 20 8 0.5 1.0 0
⚡ pulsar[1] ▶ run
⚡ pulsar[1] ▶ spawn star2 100 48 20 8 0.5 -1.0 5
⚡ pulsar[2] ▶ spawn star3 80 30 15 5 0.8 0.5 2
⚡ pulsar[3] ▶ list
Sprites:
  • star1 (ID 1)
  • star2 (ID 2)
  • star3 (ID 3)
⚡ pulsar[3] ▶ kill star2
✓ Killed 'star2'
⚡ pulsar[2] ▶ stop
✓ Engine stopped
```

## See Also

- `bash/tgp/TGP_SPECIFICATION.md` - Complete TGP protocol
- `bash/tgp/README.md` - TGP library documentation
- `bash/game/TGP_INTEGRATION_PLAN.md` - Integration design
- `bash/game/TGP_PULSAR_SUMMARY.md` - Project summary

---

**Status:** Production ready!
**Version:** TGP 1.0 + Pulsar 1.0
**Date:** 2025-11-05
