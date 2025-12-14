# Pulsar Client-Server Mode

Run Pulsar engine with live visualization while controlling it from a separate REPL client.

## Architecture

```
┌──────────────────────────────────────┐
│  Terminal 1: SERVER                  │
│  ┌────────────────────────────────┐  │
│  │  ⚡ PULSAR ENGINE (Visual)     │  │
│  │  Running animation (RUN 60)    │  │
│  │  Listens on control socket     │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
                 ↕ FIFO
                 /tmp/pulsar_control.sock
                 ↕
┌──────────────────────────────────────┐
│  Terminal 2: CLIENT                  │
│  ┌────────────────────────────────┐  │
│  │  ⚡ REPL CLIENT                │  │
│  │  Send commands to server       │  │
│  │  No visualization, just prompt │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Quick Start

### Terminal 1: Start Server

```bash
cd engine
./pulsar-server.sh

# You'll see:
#   ╔═══════════════════════════════════════╗
#   ║   ⚡ PULSAR SERVER MODE              ║
#   ║   Visual Display + Control Socket    ║
#   ╚═══════════════════════════════════════╝
#
#   Control socket: /tmp/pulsar_control.sock
#   In another terminal run:
#     ./pulsar-client.sh
#
# Then animation starts...
```

### Terminal 2: Connect Client

```bash
cd engine
./pulsar-client.sh

# You'll see:
#   ╔═══════════════════════════════════════╗
#   ║   ⚡ PULSAR CLIENT                   ║
#   ║   Connected to Visual Server         ║
#   ╚═══════════════════════════════════════╝
#
# ⚡ client ▶
```

### Send Commands

```bash
⚡ client ▶ hello
  → Spawned hello pulsar

⚡ client ▶ trinity
  → Spawned trinity formation

⚡ client ▶ SPAWN_PULSAR 100 70 12 4 0.7 0.3 3
  → SPAWN_PULSAR 100 70 12 4 0.7 0.3 3

⚡ client ▶ SET 1 dtheta 2.0
  → SET 1 dtheta 2.0

⚡ client ▶ quit
  Goodbye! (Server still running)
```

**Watch Terminal 1** - you'll see pulsars appear and change in real-time!

## Client Commands

### Shortcuts (Presets)

```
hello          Spawn single cyan pulsar at center
trinity        Spawn 3 pulsars in formation
dance          Spawn 2 counter-rotating pulsars
```

### Raw Engine Protocol

```
SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>
SET <id> <key> <value>
KILL <id>
LIST_PULSARS
```

### Utility

```
help           Show command reference
quit           Exit client (server keeps running)
```

## Parameter Reference

```
mx, my      Position (microgrid coords, 2× terminal cells)
len0        Arm length (8-30)
amp         Amplitude (2-12)
freq        Frequency (0.1-1.2 Hz)
dtheta      Rotation speed (-3.14 to 3.14 rad/s)
valence     Color: 0=cyan, 1=green, 2=yellow, 3=orange, 4=red, 5=magenta
```

## Example Session

```bash
# Terminal 1
$ ./pulsar-server.sh
# [Animation running, showing empty grid]

# Terminal 2
$ ./pulsar-client.sh
⚡ client ▶ hello
  → Spawned hello pulsar
# [Terminal 1 now shows cyan pulsar]

⚡ client ▶ trinity
  → Spawned trinity formation
# [Terminal 1 now shows 4 pulsars total]

⚡ client ▶ SET 1 dtheta 2.5
  → SET 1 dtheta 2.5
# [Terminal 1 shows first pulsar spinning faster]

⚡ client ▶ KILL 1
  → KILL 1
# [Terminal 1 shows first pulsar disappear]

⚡ client ▶ quit
  Goodbye! (Server still running)

# Terminal 1: Press Ctrl+C to stop server
^C
Server stopped.
```

## Advanced Usage

### Custom Socket Path

```bash
# Terminal 1
./pulsar-server.sh /tmp/my_pulsar.sock

# Terminal 2
./pulsar-client.sh /tmp/my_pulsar.sock
```

### Load Scripts

```bash
# In client terminal
⚡ client ▶ !cat scripts/hello.pql > /tmp/pulsar_control.sock
```

Or better, create a load function in the client.

### Multiple Clients

Multiple REPL clients can connect to the same server (FIFO allows sequential writes).

## Stopping

### Stop Client
```bash
⚡ client ▶ quit
```

### Stop Server
Press `Ctrl+C` in Terminal 1

The FIFO socket is automatically cleaned up.

## Troubleshooting

### "Control socket not found"

Server isn't running. Start server first:
```bash
# Terminal 1
./pulsar-server.sh
```

### Commands not appearing

Check that server is running and showing animation.

### Socket permission errors

```bash
rm -f /tmp/pulsar_control.sock
```

Then restart server.

## Future: Multiplayer Relay

This local client-server architecture is the foundation for future multiplayer:

```
Player 1 Visual ─┐
Player 2 Visual ─┤
Player 3 Visual ─┼──→ Relay Server ──→ Authoritative Engine
REPL Client 1   ─┤
REPL Client 2   ─┘
```

The protocol is already in place - we just need to add:
- Network relay (TCP/WebSocket)
- State broadcast
- User authentication
- Conflict resolution

## Files

```
engine/
├── pulsar-server.sh       Server: visual display + control socket
├── pulsar-client.sh       Client: REPL command sender
└── CLIENT_SERVER_MODE.md  This file
```

## Comparison with Other Modes

### Interactive REPL (game repl)
- **Use case**: Learning, exploration
- **Terminals**: 1
- **Visualization**: No (coprocess mode)
- **Best for**: Understanding protocol

### Piped Scripts (cat x.pql | pulsar)
- **Use case**: Reproducible scenes
- **Terminals**: 1
- **Visualization**: Yes (animation plays)
- **Best for**: Demos, automation

### Client-Server Mode (pulsar-server.sh + pulsar-client.sh)
- **Use case**: Live interactive control with visualization
- **Terminals**: 2 (split/tmux recommended)
- **Visualization**: Yes (in server terminal)
- **Best for**: Interactive play, development, multiplayer foundation

## Recommended tmux Setup

```bash
# Create split session
tmux new-session -d -s pulsar
tmux split-window -v
tmux select-pane -t 0
tmux send-keys 'cd engine && ./pulsar-server.sh' C-m
tmux select-pane -t 1
tmux send-keys 'cd engine && sleep 4 && ./pulsar-client.sh' C-m
tmux attach-session -t pulsar
```

This creates:
```
┌─────────────────────────────────────┐
│  SERVER (visual animation)          │
│                                     │
├─────────────────────────────────────┤
│  CLIENT (command REPL)              │
└─────────────────────────────────────┘
```
