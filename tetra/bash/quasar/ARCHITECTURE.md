# Quasar Audio System

## Overview

Quasar is the tetra audio system with two modes:
- **Browser mode**: WebSocket server + Web Audio API (tia-worklet.js)
- **Local mode**: FIFO-based Node.js daemon (quasar_local.js)

## TIA: Tetra Instrument Architecture

TIA is a multi-engine synthesis system with a uniform 4-voice interface.

### Voice Parameters
```
gate (g): 0-1     # Sound on/off
freq (f): 0-31    # Frequency (lower = higher pitch)
wave (w): 0-15    # Waveform type (engine-specific)
vol  (v): 0-15    # Volume level
```

### Engines

| Engine | Style | Wave Interpretation |
|--------|-------|---------------------|
| atari2600 | Atari TIA poly-counters | 0-15 = AUDC waveforms |
| sid | C64 SID | 0=tri, 1=saw, 2=pulse, 3=noise |
| fm | 2-op FM synthesis | 0-15 = mod ratio/depth |

### Key Files
```
quasar/tia/
├── engine-interface.js    # Base class for engines
├── index.js               # TIA manager, engine registry
└── engines/
    ├── atari2600.js       # Atari poly-counter synthesis
    ├── sid.js             # C64 SID-style
    └── fm.js              # 2-operator FM
```

## Local Sound Daemon

FIFO-based sound player for terminal games (no browser needed).

### Usage
```bash
quasar local sid          # Start foreground (SID engine)
quasar local-bg sid       # Start background
quasar local-kill         # Stop daemon
quasar sound collision    # Trigger preset
```

### Presets
collision, spawn, death, pew, boom, hit, pickup, score

### FIFO Protocol
```bash
echo "collision" > /tmp/pulsar_sound.fifo  # Play preset
echo "engine:fm" > /tmp/pulsar_sound.fifo  # Switch engine
echo "quit" > /tmp/pulsar_sound.fifo       # Shutdown
```

## Browser Mode

WebSocket server with OSC input.

### Ports
- 1985: HTTP + WebSocket
- 1986: OSC/UDP input

### Usage
```bash
quasar start              # Start server
quasar open               # Open browser
quasar osc /quasar/0/set 1 20 4 12  # Set voice via OSC
```

## Architecture

```
┌─────────────────┐
│  Pulsar Engine  │  C binary, outputs ANSI + events
│  (game engine)  │
└────────┬────────┘
         │ writes to FIFO: collision, spawn, death
         ▼
┌─────────────────┐
│  Quasar Local   │  Node.js, TIA synthesis
│  quasar_local.js│
└────────┬────────┘
         │ speaker npm package
         ▼
      🔊 Audio

--- OR (browser mode) ---

┌─────────────────┐     ┌─────────────────┐
│  Game Bridge    │────▶│  Quasar Server  │
│  (Node.js)      │ WS  │  :1985          │
└─────────────────┘     └────────┬────────┘
                                 │ WS broadcast
                                 ▼
                        ┌─────────────────┐
                        │  Browser        │
                        │  tia-worklet.js │
                        └────────┬────────┘
                                 ▼
                              🔊 Audio
```

## Game Integration

### Magnetar (uses Pulsar engine)

```
~/tetra/orgs/tetra/games/magnetar/
├── play.sh              # Quick launcher (quasar + demo)
├── demo.sh              # Collision demo
├── magnetar_host.js     # WebSocket host with GAMMA
├── magnetar_driver.js   # Spawns pulsar engine
└── magnetar_repl.sh     # Full game REPL
```

### Running Magnetar with Sound
```bash
# Option 1: Quick demo
cd ~/tetra/orgs/tetra/games/magnetar
./play.sh sid

# Option 2: WebSocket host with GAMMA matchmaking
node magnetar_host.js --gamma --port 8080
# Browser: open cabinet/join.html, connect to ws://localhost:8080
```

### Cabinet (game hosting)
```
cabinet/
├── cabinet.sh           # CLI for hosting games
├── join.html            # Browser client
└── lib/
    ├── host.js          # WebSocket host
    ├── pty_driver.js    # PTY spawner
    └── tetra-input.js   # Input routing
```

## Current Issue (for next session)

Magnetar host connects to browser but frames aren't displaying:
- WebSocket connection works ("Connected as P1")
- Browser shows "Waiting for connection..." (no frames)

**Fix applied but untested:**
1. Changed frame separator from `\x1b[H` to `\x1b[2J\x1b[H` in magnetar_driver.js
2. Changed `RUN 0` to `RUN 9000` (engine exits after RUN completes)

**To test:**
```bash
# Terminal 1: Start quasar sound
quasar local sid

# Terminal 2: Start magnetar host
node ~/tetra/orgs/tetra/games/magnetar/magnetar_host.js --gamma --port 8080

# Browser: Open cabinet/join.html, connect to ws://localhost:8080
# Press A or L to fire
```

## Quick Reference

### Quasar Commands
```bash
quasar local [engine]    # Start local daemon
quasar local-kill        # Stop daemon
quasar sound <preset>    # Trigger preset
quasar start             # Start WebSocket server
quasar stop              # Stop server
```

### TIA Engines
```bash
atari2600   # Poly-counter waveforms (default)
sid         # Triangle, saw, pulse, noise
fm          # 2-op FM synthesis
```

### Common Waveforms (atari2600)
```
3  = Engine rumble (5→4 poly)
4  = Square wave (pure tone)
7  = Engine rev (5→÷6)
8  = White noise
12 = Melodic (÷6)
```
