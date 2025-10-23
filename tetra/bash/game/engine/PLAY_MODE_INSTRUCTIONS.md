# Pulsar Play Mode - Quick Instructions

Watch live animations while controlling them from a REPL!

## Setup (Two Terminal Windows)

### Step 1: Terminal 1 - Start Visual Server

```bash
cd ~/src/devops/tetra/bash/game/engine
./pulsar-server.sh
```

You'll see:
```
╔═══════════════════════════════════════╗
║   ⚡ PULSAR SERVER MODE              ║
║   Visual Display + Control Socket    ║
╚═══════════════════════════════════════╝

  Control socket: /tmp/pulsar_control.sock
  In another terminal run:
    ./pulsar-client.sh

  Press Ctrl+C to stop

Starting in 3 seconds...
```

**Keep this terminal visible** - animations will appear here!

---

### Step 2: Terminal 2 - Start REPL Client

Open a **NEW terminal window/tab**, then:

```bash
cd ~/src/devops/tetra/bash/game/engine
./pulsar-client.sh
```

You'll see:
```
╔═══════════════════════════════════════╗
║   ⚡ PULSAR CLIENT                   ║
║   Connected to Visual Server         ║
╚═══════════════════════════════════════╝

  ✓ Connected to: /tmp/pulsar_control.sock

  💡 Look at your SERVER terminal to see animations!

  Quick commands:
    hello      - Spawn single pulsar
    trinity    - Spawn 3 pulsars
    dance      - Spawn 2 counter-rotating
    help       - Full command reference
    quit       - Exit client (server keeps running)

⚡ client ▶
```

---

## Start Playing!

Type commands in **Terminal 2** and watch **Terminal 1** for the animations!

### Try These:

```bash
⚡ client ▶ hello
  → Spawned hello pulsar
```
**Look at Terminal 1** - cyan pulsar appears!

```bash
⚡ client ▶ trinity
  → Spawned trinity formation
```
**Look at Terminal 1** - three more pulsars appear!

```bash
⚡ client ▶ SET 1 dtheta 2.5
  → SET 1 dtheta 2.5
```
**Look at Terminal 1** - first pulsar spins faster!

```bash
⚡ client ▶ SPAWN_PULSAR 100 70 12 4 0.7 0.3 3
  → SPAWN_PULSAR 100 70 12 4 0.7 0.3 3
```
**Look at Terminal 1** - orange pulsar appears!

---

## Terminal Layout Tips

### macOS Terminal App
- **⌘T** - New tab
- **⌘1, ⌘2** - Switch between tabs
- **⌘D** - Split pane (vertical)
- **⌘⇧D** - Split pane (horizontal)

### iTerm2
- **⌘D** - Split vertically
- **⌘⇧D** - Split horizontally
- **⌘[** / **⌘]** - Switch panes
- **⌘⌥Arrow** - Navigate panes

### Arrange Like This:
```
┌─────────────────────────────────────┐
│  TERMINAL 1: SERVER (full screen)   │
│  ┌───────────────────────────────┐  │
│  │  [Animated pulsars here]      │  │
│  │                               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  TERMINAL 2: CLIENT (small window)  │
│  ⚡ client ▶ hello                  │
└─────────────────────────────────────┘
```

Or side-by-side:
```
┌──────────────────┬──────────────────┐
│  TERMINAL 1      │  TERMINAL 2      │
│  SERVER          │  CLIENT          │
│  (visual)        │  (commands)      │
│                  │                  │
│  [Animation]     │  ⚡ client ▶     │
└──────────────────┴──────────────────┘
```

---

## Commands Reference

### Quick Presets
```
hello          Single cyan pulsar at center
trinity        3 pulsars in formation
dance          2 counter-rotating pulsars
```

### Engine Protocol
```
SPAWN_PULSAR <mx> <my> <len0> <amp> <freq> <dtheta> <valence>
SET <id> <key> <value>
KILL <id>
LIST_PULSARS
```

### Examples
```bash
# Spawn a red pulsar
SPAWN_PULSAR 80 48 20 8 0.5 0.6 4

# Make it spin faster
SET 1 dtheta 2.0

# Change frequency
SET 1 freq 0.9

# Kill it
KILL 1
```

### Utility
```
help           Show full help
quit           Exit client (server keeps running)
```

---

## Stopping

### Stop Client
In **Terminal 2**:
```bash
⚡ client ▶ quit
```

### Stop Server
In **Terminal 1**: Press **Ctrl+C**

---

## Troubleshooting

### "Control socket not found"
The server isn't running. Start **Terminal 1** first:
```bash
./pulsar-server.sh
```

### Can't see animations
Make sure **Terminal 1** (server) is visible on your screen!

### Commands not working
Check that server terminal shows "Starting in 3 seconds..." finished and animation is running.

---

## Example Session

**Terminal 1 (visible, watching):**
```
[Empty grid appears after countdown]
[Cyan pulsar appears at center]          ← from "hello"
[3 more pulsars appear]                  ← from "trinity"
[First pulsar spins faster]              ← from "SET 1 dtheta 2.5"
```

**Terminal 2 (typing commands):**
```
⚡ client ▶ hello
  → Spawned hello pulsar

⚡ client ▶ trinity
  → Spawned trinity formation

⚡ client ▶ SET 1 dtheta 2.5
  → SET 1 dtheta 2.5

⚡ client ▶ quit
  Goodbye! (Server still running)
```

---

## What's Happening Behind the Scenes

```
Terminal 2 (client)           Terminal 1 (server)
      ↓                              ↑
  Type "hello"               Read from FIFO
      ↓                              ↑
Write to FIFO socket  →  /tmp/pulsar_control.sock
                                     ↓
                          Execute SPAWN_PULSAR
                                     ↓
                           Update display (RUN 60)
                                     ↓
                            [You see the pulsar!]
```

The FIFO (named pipe) connects the two terminals!

---

## Next Steps

Once you're comfortable, try:
- Loading scripts (see `scripts/*.pql`)
- Creating complex formations
- Experimenting with extreme parameters
- Building your own presets

Enjoy playing with Pulsar! ⚡
