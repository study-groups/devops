# MIDI Architecture Explained - From Slider to Game

**Date:** 2025-11-05
**Status:** Documentation
**Goal:** Explain how MIDI events flow from controller to applications

## The Correct Architecture

### Layer 1: Hardware → OSC Broadcast (TSM-managed service)

```
┌─────────────────────────────────────────────────────────────┐
│ MIDI Controller (USB)                                       │
│ - VMX8 Bluetooth Controller                                 │
│ - You move a slider                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ USB MIDI Protocol
                       │ (CC message: channel=1, controller=7, value=127)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ midi_bridge (C binary using PortMIDI)                       │
│ - Reads USB MIDI device                                     │
│ - Parses MIDI messages                                      │
│ - Started by: tsm start midi-bridge                         │
│ - Runs continuously (PID: 12345)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ Internal pipe/socket
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ midi.js (Node.js OSC broadcaster)                           │
│ - Receives MIDI from bridge                                 │
│ - Broadcasts OSC UDP on 0.0.0.0:1983                        │
│ - Runs continuously                                          │
│ - TSM-managed service                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ OSC/UDP Broadcast on :1983
                       │ (pub/sub - anyone can listen)
                       │
        ┌──────────────┴──────────────┬─────────────────────┐
        │                             │                     │
        ↓                             ↓                     ↓
┌──────────────┐           ┌──────────────────┐    ┌──────────────┐
│ midi repl    │           │ midi-mp          │    │ Game         │
│ (subscribe)  │           │ (subscribe)      │    │ (subscribe)  │
│ - Listens on │           │ - Listens on     │    │ - Listens on │
│   :1983      │           │   :2020?         │    │   :1983      │
│ - Shows CC   │           │ - Routes to      │    │ - Reads OSC  │
│   values     │           │   players        │    │ - Controls   │
└──────────────┘           └──────────────────┘    └──────────────┘
```

## Tracing a Slider Movement

### Example: You Move Slider 1 to Maximum

**Step 1: Hardware → USB MIDI**
```
You: Move slider 1 to max
Controller: Sends MIDI CC message
  - Channel: 1
  - Controller: 7
  - Value: 127 (max)
```

**Step 2: USB → C Bridge**
```
midi_bridge.c receives:
  status_byte: 0xB0 (CC on channel 1)
  controller: 7
  value: 127

Parses to:
  type: "CC"
  channel: 1
  controller: 7
  value: 127
```

**Step 3: C Bridge → Node.js**
```
midi_bridge → midi.js (via pipe/socket)
Message: {"type":"cc","channel":1,"controller":7,"value":127}
```

**Step 4: Node.js → OSC Broadcast**
```javascript
// In midi.js
function handleMidiEvent(event) {
    // Raw MIDI (always broadcast)
    oscPort.send({
        address: '/midi/raw/cc/1/7',
        args: [{ type: 'i', value: 127 }]  // integer
    });

    // If device loaded: Map to semantic
    if (currentMap) {
        let semantic = mapController(1, 7);  // → "VOLUME_1"
        let normalized = 127 / 127.0;        // → 1.0

        oscPort.send({
            address: '/midi/mapped/a/VOLUME_1',
            args: [{ type: 'f', value: 1.0 }]  // float
        });
    }
}
```

**Broadcast on UDP :1983:**
```
/midi/raw/cc/1/7 127
/midi/mapped/a/VOLUME_1 1.0
```

**Step 5: REPL Receives**
```bash
# osc_repl_listener.js running in REPL
oscPort.on('message', (msg) => {
    // msg.address = '/midi/raw/cc/1/7'
    // msg.args = [127]

    console.log('CC 1/7 = 127');
    updatePrompt();  // Update display
});
```

**Step 6: Game Receives**
```javascript
// In your game (JavaScript/Unity/Godot)
oscPort.on('message', (msg) => {
    if (msg.address === '/midi/mapped/a/VOLUME_1') {
        let volume = msg.args[0];  // 1.0

        // Control game volume
        Audio.setMasterVolume(volume);
    }
});
```

## How MIDI-MP Would Work

### MIDI-MP: Multiplayer MIDI Router

```
┌─────────────────────────────────────────────────────────────┐
│ midi.js (OSC broadcaster)                                   │
│ Broadcasting on :1983                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ OSC/UDP :1983
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ midi-mp (Node.js/Bash Multiplayer Router)                  │
│ - Listens on :1983 (receives MIDI events)                  │
│ - Routes to multiple players                                │
│ - Re-broadcasts on :2020                                    │
│                                                             │
│ Player Assignment:                                          │
│   Player 1: Sliders 1-4  → /player/1/VOLUME, /player/1/PAN │
│   Player 2: Sliders 5-8  → /player/2/VOLUME, /player/2/PAN │
│   Player 3: Pots 1-4     → /player/3/PARAM_A               │
│   Player 4: Pots 5-8     → /player/4/PARAM_B               │
└──────────────────────┬──────────────────────────────────────┘
                       │ Re-broadcast :2020
                       │ (player-specific messages)
                       ↓
        ┌──────────────┴──────────────┬─────────────────┐
        ↓                             ↓                 ↓
┌──────────────┐           ┌──────────────┐    ┌──────────────┐
│ Game Client  │           │ Game Client  │    │ Game Client  │
│ Player 1     │           │ Player 2     │    │ Player 3     │
│ :2020        │           │ :2020        │    │ :2020        │
└──────────────┘           └──────────────┘    └──────────────┘
```

### MIDI-MP Message Flow

**Input (from :1983):**
```
/midi/raw/cc/1/7 127        # Slider 1
/midi/mapped/a/VOLUME_1 1.0
```

**Output (to :2020):**
```
/player/1/volume 1.0        # Player 1's volume
/player/1/control/slider1 127
```

**Multiple players from one controller:**
```
# Slider 1 → Player 1 Volume
/midi/raw/cc/1/7 127  →  /player/1/volume 1.0

# Slider 5 → Player 2 Volume
/midi/raw/cc/1/11 100 →  /player/2/volume 0.79

# Pot 1 → Player 3 Parameter A
/midi/raw/cc/1/1 64   →  /player/3/param_a 0.5
```

## How Games Read MIDI

### Option 1: Direct OSC (Simple)

Game listens directly on :1983:

```javascript
// In game.js
const osc = require('osc');

const oscPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 1983
});

oscPort.on('message', (msg) => {
    if (msg.address === '/midi/mapped/a/VOLUME_1') {
        gameAudio.volume = msg.args[0];
    }

    if (msg.address === '/midi/mapped/a/TRIGGER_KICK') {
        player.jump();
    }
});

oscPort.open();
```

### Option 2: Via MIDI-MP (Multiplayer)

Game listens on :2020 for player-specific events:

```javascript
// Game listens on :2020
const oscPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 2020
});

oscPort.on('message', (msg) => {
    // Player 1's controls
    if (msg.address === '/player/1/volume') {
        player1.volume = msg.args[0];
    }

    if (msg.address === '/player/1/jump') {
        player1.character.jump();
    }

    // Player 2's controls
    if (msg.address === '/player/2/volume') {
        player2.volume = msg.args[0];
    }
});
```

### Option 3: Unity/Godot Native

```csharp
// Unity C# example
using UnityEngine;
using extOSC;

public class MidiController : MonoBehaviour {
    private OSCReceiver receiver;

    void Start() {
        receiver = gameObject.AddComponent<OSCReceiver>();
        receiver.LocalPort = 1983;

        receiver.Bind("/midi/mapped/a/VOLUME_1", OnVolumeChanged);
        receiver.Bind("/midi/mapped/a/TRIGGER_KICK", OnJump);
    }

    void OnVolumeChanged(OSCMessage message) {
        float volume = message.Values[0].FloatValue;
        AudioListener.volume = volume;
    }

    void OnJump(OSCMessage message) {
        playerController.Jump();
    }
}
```

## The Fix: Separate Service from REPL

### Current (Wrong)

```bash
midi repl
# → Starts osc_repl_listener.js in background [1] 3085
# → REPL uses that listener
# → If REPL exits, listener dies
# → If listener crashes, REPL broken
```

### Correct Architecture

```bash
# 1. Start MIDI service (once, via TSM)
tsm start midi-bridge
# → Runs continuously
# → Always broadcasting on :1983
# → Managed by TSM (restart on crash, logging, etc.)

# 2. Start REPL (multiple times, as needed)
midi repl
# → Connects to existing :1983 broadcast
# → Just reads, doesn't start service
# → Can exit/restart without affecting service
# → Multiple REPLs can run simultaneously
```

## Implementation Fix

### Phase 1: Separate midi-bridge Service

**Create:** `bash/midi/services/midi-bridge.sh`
```bash
#!/usr/bin/env bash
# MIDI Bridge Service - TSM-managed background service

# Start C bridge
./midi_bridge --device "$MIDI_INPUT_DEVICE" --output "$MIDI_OUTPUT_DEVICE" &
BRIDGE_PID=$!

# Start Node.js OSC broadcaster
node midi.js --osc-port 1983 &
NODE_PID=$!

# Wait for either to die
wait -n
```

**Register with TSM:**
```bash
tsm save midi-bridge "bash $MIDI_SRC/services/midi-bridge.sh"
tsm enable midi-bridge
```

### Phase 2: Update REPL to Connect Only

**Update:** `bash/midi/core/repl.sh`
```bash
midi_repl() {
    # Check if service is running
    if ! nc -z localhost 1983 2>/dev/null; then
        echo "⚠ MIDI service not running"
        echo "Start with: tsm start midi-bridge"
        return 1
    fi

    # Connect to existing service (don't start it)
    echo "MIDI REPL - Connected to :1983"

    # Run REPL that just reads OSC
    # ... existing REPL code ...
}
```

### Phase 3: MIDI-MP Router Service

**Create:** `bash/midi-mp/router.js`
```javascript
// Listen on :1983 (MIDI events)
const inputPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 1983
});

// Broadcast on :2020 (player events)
const outputPort = new osc.UDPPort({
    remoteAddress: "0.0.0.0",
    remotePort: 2020
});

// Route MIDI to players
inputPort.on('message', (msg) => {
    let playerEvent = routeToPlayer(msg);
    outputPort.send(playerEvent);
});
```

**Register with TSM:**
```bash
tsm save midi-mp "node $MIDI_SRC/midi-mp/router.js"
tsm start midi-mp
```

## Complete Workflow

### Setup (Once)

```bash
# 1. Build C bridge
cd ~/tetra/bash/midi
gcc -o midi_bridge midi_bridge.c -lportmidi

# 2. List devices
./midi_bridge -l
# Input devices: [0] VMX8 Bluetooth
# Output devices: [0] VMX8 Bluetooth

# 3. Configure
export MIDI_INPUT_DEVICE=0
export MIDI_OUTPUT_DEVICE=0

# 4. Start service via TSM
tsm start midi-bridge
# ✓ Started midi-bridge (TSM ID: 0, PID: 12345)

# 5. Verify broadcasting
lsof -i :1983
# node  12346  user  UDP *:1983
```

### Daily Use

```bash
# REPL (connects to service)
midi repl
# Connected to :1983
# ●0 midi>

# Start multiplayer router
tsm start midi-mp

# Start game (listens on :1983 or :2020)
node game.js

# Move sliders → see events in REPL → game responds
```

### Multiple Subscribers

All can run simultaneously:

```bash
# Terminal 1: REPL
midi repl

# Terminal 2: MIDI-MP router
tsm start midi-mp

# Terminal 3: Game
node game.js

# Terminal 4: Visualizer
python visualizer.py --osc-port 1983

# All receive the same MIDI events!
```

## Benefits of Correct Architecture

✅ **Service independence** - REPL doesn't manage service
✅ **TSM management** - Auto-restart, logging, monitoring
✅ **Multiple subscribers** - REPL + game + visualizer simultaneously
✅ **Clean separation** - Service runs, clients connect
✅ **Debugging** - Can restart REPL without affecting service
✅ **Scalability** - Add more listeners without touching service

## Next Steps

1. ✅ Document correct architecture
2. Create `services/midi-bridge.sh` service wrapper
3. Update `repl.sh` to connect-only (no service start)
4. Register midi-bridge with TSM
5. Create midi-mp router service
6. Test full flow: slider → OSC → REPL + game

---

**Status:** 📝 Documented, needs implementation
**Current:** REPL incorrectly starts service
**Correct:** TSM starts service, REPL connects
**Benefit:** Clean separation, multiple subscribers
