# Games Module Architecture Diagrams

## Overview

The Games module is a **multi-game management platform** providing:
- Game launcher framework with org-style REPL interface
- Support for multiple game types (TUI, bash-based, C-compiled)
- Organization system supporting multiple game libraries
- Integration with MIDI input, gamepad controls, and audio-visual synthesis

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           GAMES MODULE                                    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    games.sh (dispatcher)                            │ │
│  │                                                                     │ │
│  │  games list        - List installed games                           │ │
│  │  games play <game> - Launch a game (with optional --controls)       │ │
│  │  games org [name]  - Manage game organizations                      │ │
│  │  games pak <game>  - Archive/backup games                           │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    Game Registry                                    │ │
│  │                                                                     │ │
│  │  /tetra/orgs/<org>/games/available/   (all games)                   │ │
│  │  /tetra/orgs/<org>/games/enabled/     (active games - symlinks)     │ │
│  │                                                                     │ │
│  │  Each game has: game.toml (metadata), core/*.sh (REPL), bin/*       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    Game Instance                                    │ │
│  │                                                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │ │
│  │  │  estoface   │  │   pulsar    │  │    trax     │                  │ │
│  │  │  (formant)  │  │  (C engine) │  │ (tank game) │                  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Input Methods

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         THREE INPUT CHANNELS                              │
│                                                                           │
│  A. MIDI + Gamepad (via midi_bridge)                                      │
│     ┌───────────────────────────────────────────────────────────────┐    │
│     │  midi_bridge (C binary)                                       │    │
│     │       │                                                       │    │
│     │       ▼                                                       │    │
│     │  controls.fifo ($TETRA_DIR/games/<game>/controls.fifo)        │    │
│     │       │                                                       │    │
│     │       ▼                                                       │    │
│     │  Game process reads formatted control stream                  │    │
│     └───────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  B. Keyboard Input (Terminal)                                             │
│     ┌───────────────────────────────────────────────────────────────┐    │
│     │  stdin → tcurses_input_read_key()                             │    │
│     │       │                                                       │    │
│     │       ▼                                                       │    │
│     │  Frame-limited via game loop FPS target                       │    │
│     └───────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  C. Network/API (pbase-2600)                                              │
│     ┌───────────────────────────────────────────────────────────────┐    │
│     │  HTTP client → localhost:2600/*                               │    │
│     │       │                                                       │    │
│     │       ▼                                                       │    │
│     │  Arcade token machine integration                             │    │
│     └───────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Engine Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          TWO ENGINE SYSTEMS                               │
│                                                                           │
│  A. Flax Engine (Modern)                                                  │
│     ┌───────────────────────────────────────────────────────────────┐    │
│     │  engines/flax/                                                │    │
│     │                                                               │    │
│     │  "Dumb and fast" buffer-based engine                          │    │
│     │                                                               │    │
│     │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │    │
│     │  │ buffer.sh   │  │ draw.sh     │  │ sprites.sh  │            │    │
│     │  │ (frame buf) │  │ (primitives)│  │ (animation) │            │    │
│     │  └─────────────┘  └─────────────┘  └─────────────┘            │    │
│     │                                                               │    │
│     │  Optional C accelerator: bin/flaxd (FIFO /tmp/flaxd_<sess>)   │    │
│     └───────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  B. Pulsar Engine (C-based)                                               │
│     ┌───────────────────────────────────────────────────────────────┐    │
│     │  engine/bin/pulsar                                            │    │
│     │                                                               │    │
│     │  High-performance sprite animation in C                        │    │
│     │                                                               │    │
│     │  Input:  FIFO socket (/tmp/pulsar_control.sock)               │    │
│     │  Output: Direct terminal rendering                            │    │
│     │                                                               │    │
│     │  Protocol: Text commands (SPAWN_PULSAR, SET, KILL, LIST)      │    │
│     └───────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Game Loop Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         GAME LOOP CYCLE                                   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │    ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     │ │
│  │    │  INPUT  │ ──▶ │ UPDATE  │ ──▶ │ RENDER  │ ──▶ │  SLEEP  │ ──┐ │ │
│  │    │         │     │         │     │         │     │         │   │ │ │
│  │    │ • MIDI  │     │ • State │     │ • Draw  │     │ • FPS   │   │ │ │
│  │    │ • Keys  │     │ • Logic │     │ • Buffer│     │ • Sync  │   │ │ │
│  │    │ • FIFO  │     │ • Collis│     │ • Flush │     │         │   │ │ │
│  │    └─────────┘     └─────────┘     └─────────┘     └─────────┘   │ │ │
│  │         ▲                                                        │ │ │
│  │         └────────────────────────────────────────────────────────┘ │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Target: 15-30 FPS depending on game                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Integration with Quasar

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    GAMES → QUASAR PIPELINE                                │
│                                                                           │
│  Game REPL/Engine                                                         │
│       │                                                                   │
│       │ controls.fifo (MIDI input)                                        │
│       ▼                                                                   │
│  Game logic (bash/C)                                                      │
│       │                                                                   │
│       │ stdout (ASCII frames + game state)                                │
│       ▼                                                                   │
│  quasar/bridges/trax_bridge.js                                            │
│       │                                                                   │
│       │ WebSocket {type: "frame", display, snd}                           │
│       ▼                                                                   │
│  quasar_server.js (:1985)                                                 │
│       │                                                                   │
│       │ WebSocket broadcast                                               │
│       ▼                                                                   │
│  Browser (terminal.js + tia-worklet.js)                                   │
│       │                                                                   │
│       ▼                                                                   │
│  Display + Audio Output                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## TGP → OSC Bridge (Animation Frame Broadcast)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    TGP OSC BRIDGE                                         │
│                                                                           │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     │
│  │  Game Process   │     │  tgp_osc_bridge │     │  OSC Listeners  │     │
│  │                 │     │      .js        │     │                 │     │
│  │  Writes frames  │────▶│                 │────▶│  Visualizers    │     │
│  │  to FIFO        │     │  Converts to    │     │  DAWs           │     │
│  │                 │     │  OSC UDP        │     │  Other clients  │     │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘     │
│                                                                           │
│  FIFO: /tmp/tgp_<SESSION>_frame.sock                                      │
│  Target: localhost:1984                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
/tetra/bash/games/
├── games.sh              # Main command interface
├── includes.sh           # Module loader
├── available/            # Available games
│   └── estoface/         # Example game
│       ├── game.toml     # Metadata
│       ├── core/         # REPL scripts
│       └── bin/          # Compiled binaries
├── enabled/              # Symlinks to active games
├── engines/
│   └── flax/             # Modern bash engine
│       ├── buffer.sh
│       ├── draw.sh
│       ├── loop.sh
│       └── sprites.sh
├── engine/               # Archived C engine
│   ├── src/              # C source (pulsar.c, etc.)
│   └── bash/             # Bash wrappers
│       ├── pulsar-server.sh
│       └── pulsar-client.sh
└── core/
    ├── games_complete.sh # Tab completion
    ├── gamepak.sh        # Archive management
    └── help.sh           # Help system
```

---

## Key Design Patterns

| Pattern | Description |
|---------|-------------|
| **Available/Enabled** | nginx-style game management via symlinks |
| **IPC via FIFO** | Lightweight pipe-based communication |
| **Protocol Flexibility** | Text-based protocols (OSC, HTTP, commands) |
| **Org Multi-tenancy** | Multiple game organizations per system |
| **Backend Abstraction** | Flax engine uses native bash OR C daemon |

---

## Ports & Communication

| Port/Path | Protocol | Purpose |
|-----------|----------|---------|
| FIFO | pipe | controls.fifo for MIDI/gamepad input |
| 2600 | HTTP | pbase arcade token machine |
| 1984 | OSC/UDP | TGP frame broadcast |
| Unix socket | binary | Pulsar control socket |

---

*Generated: 2024-12-16*
