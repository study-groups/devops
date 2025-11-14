# midi-mp: MIDI Multiplayer Protocol

**A protocol and router for distributing MIDI control to multiple players/consumers**

## Core Concept

**midi-mp defines HOW to route MIDI messages to multiple endpoints, not WHAT to do with them.**

```
MIDI Controller → midi.js (OSC bridge) → midi-mp router → Players/Apps
                                              ↓
                                        Routing rules
                                        Player management
                                        Message filtering
```

This is the **perfect abstraction** for multiplayer MIDI control - reusable, composable, and standards-based.

## Why midi-mp?

### The Problem
You want to use MIDI controllers for:
- Multiplayer rhythm games (100 players, same beat)
- Multi-screen VJ performances (3 screens, different controls)
- Music education (teacher → students)
- Collaborative DAW control (band members)
- Interactive art installations (combine multiple controllers)

But each use case needs different routing logic.

### The Solution
**One protocol, multiple modes:**
- `broadcast` - All players get all messages
- `split` - Route by control number ranges
- `per-player` - Each player gets assigned controls
- `aggregate` - Combine multiple controllers

## Architecture

```
bash/
├── midi/               # Hardware → OSC bridge
│   └── midi.js         # VMX8 Bluetooth → OSC :1983
│
├── midi-mp/            # Multiplayer routing protocol ← YOU ARE HERE
│   ├── router.js       # Route OSC to players :2020
│   ├── protocol.js     # Message format definitions
│   ├── examples/       # Example configs
│   ├── cymatica-server.js    # Web server + WebSocket bridge :3400
│   ├── tunnel-cymatica.sh    # SSH tunnel for cloud deployment
│   ├── public/cymatica/      # Browser visualization client
│   └── CLOUD_SETUP.md        # Cloud deployment guide
```

## Quick Start

### 1. Start MIDI Bridge

```bash
# In terminal 1: Start MIDI → OSC broadcaster
cd ~/tetra/bash/midi
node midi.js -i "VMX8 Bluetooth" -o "VMX8 Bluetooth" -v

# Broadcasts to UDP :57121
```

### 2. Start midi-mp Router

```bash
# In terminal 2: Start router with config
cd ~/tetra/bash/midi-mp
node router.js examples/cymatica.json
```

### 3. Connect Your App

```javascript
// In your game/app
const osc = require('osc');

const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 57121
});

udpPort.on("message", (oscMsg) => {
  console.log('Received:', oscMsg);
});

udpPort.open();
```

## Use Cases

### 1. Cymatica (Cymatics Game/Visualizer)

**Concept:** Control cymatics patterns (sound vibration patterns) in real-time

**Config:** `examples/cymatica.json`

```json
{
  "mode": "broadcast",
  "filter": {"cc": [40, 41, 42, 43, 44, 45, 46, 47]},
  "transform": {
    "/midi/raw/cc/1/40": {"event": "cymatics.frequency", "normalize": [20, 2000]},
    "/midi/raw/cc/1/41": {"event": "cymatics.amplitude", "normalize": [0, 1]},
    "/midi/raw/cc/1/42": {"event": "cymatics.pattern", "normalize": [0, 1]},
    "/midi/raw/cc/1/43": {"event": "cymatics.particle_density", "normalize": [100, 10000]},
    "/midi/raw/cc/1/44": {"event": "cymatics.damping", "normalize": [0, 1]},
    "/midi/raw/cc/1/45": {"event": "cymatics.phase", "normalize": [0, 6.28318]},
    "/midi/raw/cc/1/46": {"event": "cymatics.resonance", "normalize": [0, 1]},
    "/midi/raw/cc/1/47": {"event": "cymatics.waveform", "normalize": [0, 4]}
  }
}
```

**Result:** All players see synchronized cymatics patterns responding to your MIDI controller.

---

### 2. VJ Split (Multi-Screen Performance)

**Concept:** Control 3 screens independently with one controller

**Config:** `examples/vj-split.json`

```json
{
  "mode": "split",
  "routes": [
    {
      "player": "screen-left",
      "controls": {"cc": [1, 2, 3, 4]}
    },
    {
      "player": "screen-center",
      "controls": {"cc": [5, 6, 7, 8]}
    },
    {
      "player": "screen-right",
      "controls": {"cc": [9, 10, 11, 12]}
    }
  ]
}
```

**Result:** CC 1-4 → left screen, CC 5-8 → center, CC 9-12 → right

---

### 3. Collaborative DAW

**Concept:** Band members control their own instruments simultaneously

**Config:** `examples/collaborative-daw.json`

```json
{
  "mode": "per-player",
  "routes": [
    {"player": "bassist", "controls": {"cc": [20-27]}, "channel": 2},
    {"player": "drummer", "controls": {"cc": [30-37]}, "channel": 3},
    {"player": "synth", "controls": {"cc": [40-47]}, "channel": 4}
  ]
}
```

**Result:** Each player gets only their assigned controls

---

## Protocol Specification

### Message Types

#### 1. Control Message (MIDI → App)
```javascript
{
  type: "control",
  source: "midi-bridge",
  midi: {
    type: "cc",           // or "note", "program", "pitchbend"
    channel: 1,
    controller: 40,
    value: 127
  },
  mapped: {               // Optional: if mapped semantics available
    variant: "a",
    semantic: "VOLUME_1",
    normalized: 1.0
  },
  event: "cymatics.frequency",  // Optional: if transformed
  normalized: 2000.0,           // Optional: transformed value
  timestamp: 1234567890
}
```

#### 2. Player Management
```javascript
// Join
{
  type: "player.join",
  playerId: "player-42",
  metadata: {name: "Alice", color: "#FF0000"}
}

// Leave
{
  type: "player.leave",
  playerId: "player-42"
}
```

#### 3. State Snapshot
```javascript
{
  type: "state.snapshot",
  controls: {
    "cc/1/40": 127,
    "cc/1/41": 64
  },
  players: [...],
  timestamp: 1234567890
}
```

### OSC Addressing

**From midi.js (input):**
```
/midi/raw/cc/{channel}/{controller} [value]
/midi/raw/note/{channel}/{note} [velocity]
/midi/mapped/{variant}/{semantic} [normalized]
```

**To midi-mp (control):**
```
/midi-mp/player/join [playerId, name, color]
/midi-mp/player/leave [playerId]
/midi-mp/route/set [JSON config]
```

## Routing Modes

### broadcast
All players get all messages (after filtering)

**Use for:** Rhythm games, education, synchronized visualizations

### split
Route based on control number ranges

**Use for:** Multi-screen VJ, split controllers

### per-player
Each player has assigned controls

**Use for:** Collaborative DAW, band control, multi-instrument

### aggregate
Combine multiple controllers (weighted average)

**Use for:** Interactive installations, gesture averaging

## Configuration

### Filter
```json
{
  "filter": {
    "channel": 1,           // Only channel 1
    "cc": [40, 41, 42],    // Only these CCs
    "note": [60, 62, 64]   // Only these notes
  }
}
```

### Transform
```json
{
  "transform": {
    "/midi/raw/cc/1/40": "game.beat",              // Simple string
    "/midi/raw/cc/1/41": {                         // Complex
      "event": "cymatics.frequency",
      "normalize": [20, 2000]                      // Map 0-127 → 20-2000
    }
  }
}
```

### Routes (split/per-player modes)
```json
{
  "routes": [
    {
      "player": "screen-left",
      "controls": {"cc": [1, 2, 3]},
      "channel": 1,
      "transform": {...}
    }
  ]
}
```

## API

### Router Class

```javascript
const { MidiMpRouter } = require('./router');

const router = new MidiMpRouter({
  mode: 'broadcast',
  oscHost: '0.0.0.0',
  oscPort: 57121,
  verbose: true
});

// Events
router.on('ready', () => console.log('Router ready'));
router.on('message', (msg) => console.log('Routed:', msg));
router.on('player.join', ({playerId}) => console.log('Player joined:', playerId));

// Player management
router.addPlayer('player-1', {name: 'Alice', color: '#FF0000'});
router.removePlayer('player-1');

// Status
const status = router.getStatus();
// {mode: 'broadcast', players: 2, stats: {...}}

// Cleanup
router.close();
```

### Protocol Helpers

```javascript
const protocol = require('./protocol');

// Build messages
const msg = protocol.buildControlMessage({
  type: 'cc',
  channel: 1,
  controller: 40,
  value: 127
});

// Validate
const {valid, error} = protocol.validateControlMessage(msg);

// OSC helpers
const address = protocol.buildOscAddress('cc', 1, 40);
// "/midi/raw/cc/1/40"

const parsed = protocol.parseOscAddress('/midi/raw/cc/1/40');
// {type: 'cc', channel: 1, controller: 40}
```

## Integration Examples

### With tetra/bash/midi

```bash
# Terminal 1: MIDI bridge
cd ~/tetra/bash/midi
node midi.js -i "VMX8 Bluetooth" --verbose

# Terminal 2: midi-mp router
cd ~/tetra/bash/midi-mp
node router.js examples/cymatica.json
```

### With Node.js Game

```javascript
const osc = require('osc');

const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 57121
});

udpPort.on("message", (oscMsg) => {
  // All routed messages arrive here
  if (oscMsg.address === '/midi-mp/event/cymatics.frequency') {
    const freq = oscMsg.args[0].value;
    updateCymaticsFrequency(freq);
  }
});

udpPort.open();
```

### With WebSocket Relay (Browser Game)

```javascript
// Server: OSC → WebSocket
const router = new MidiMpRouter(config);

router.on('message', (msg) => {
  wss.clients.forEach(client => {
    client.send(JSON.stringify(msg));
  });
});

// Browser client
const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.event === 'cymatics.frequency') {
    updateGame(msg.normalized);
  }
};
```

## Why This Is Powerful

### Reusability
One protocol works for:
- Games (rhythm, cymatics, quadrapong)
- VJ software
- Education tools
- Art installations
- DAW control

### Composability
Stack multiple layers:
```
midi.js → midi-mp (routing) → cymatica game
                            → resolume (VJ)
                            → ableton (DAW)
```

### Standards-Based
- Uses OSC (industry standard)
- Works with existing MIDI controllers
- Integrates with any OSC-capable software

### Event-Driven
```javascript
router.on('cymatics.frequency', (msg) => {
  // React to transformed events
});
```

## Files

```
midi-mp/
├── router.js              # Core routing engine
├── protocol.js            # Message format definitions
├── examples/
│   ├── broadcast.json     # Simple broadcast
│   ├── cymatica.json      # Cymatics game/visualizer
│   ├── vj-split.json      # Multi-screen VJ
│   └── collaborative-daw.json  # Band collaboration
└── README.md              # This file
```

## Dependencies

```json
{
  "dependencies": {
    "osc": "^2.4.4"
  }
}
```

Install:
```bash
cd ~/tetra/bash/midi-mp
npm install osc
```

## Troubleshooting

### Router not receiving messages

**Check:** Is midi.js broadcasting?
```bash
# Terminal 1
cd ~/tetra/bash/midi
node midi.js -i "VMX8 Bluetooth" --verbose

# Move a knob, should see:
# OSC OUT: /midi/raw/cc/1/40 127
```

### Messages filtered out

**Check:** Filter config
```json
{
  "filter": {
    "cc": [40, 41, 42]  // Only these CCs pass through
  }
}
```

### Transform not working

**Check:** OSC address must match exactly
```json
{
  "transform": {
    "/midi/raw/cc/1/40": "event.name"  // Must be exact OSC path
  }
}
```

## Next Steps

1. **Build a game using midi-mp**
   - Cymatica (cymatics visualizer)
   - Rhythm game (beat matching)
   - Quadrapong (4-player pong)

2. **Add WebSocket relay**
   - Browser-based multiplayer games

3. **Add player discovery**
   - Auto-detect players on network

4. **Add recording/replay**
   - Record MIDI sessions
   - Replay for demos

## License

Part of Tetra - see main Tetra LICENSE

## See Also

- `~/tetra/bash/midi/` - MIDI → OSC bridge
- `~/tetra/bash/midi/OSC_API.md` - OSC message format
- VTMP-2400 - Multiplayer game server protocol
