# midi-mp: MIDI Multiplayer Protocol

**256-channel message router for distributing MIDI/gamepad control to games and browsers**

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TETRA AUDIO/GAME STACK                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MIDI Controller / Gamepad                                          │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │   midi.js   │  Binds 1983, broadcasts to multicast 239.1.1.1     │
│  │  (TSM svc)  │  TSM: tsm start midi                               │
│  └──────┬──────┘                                                    │
│         │ multicast 1983/udp                                        │
│         ▼                                                           │
│  ┌─────────────┐     ┌──────────────────┐                           │
│  │ midi-mp.js  │────▶│ control-map.json │  CC 41 → /game/freq 1.5   │
│  │  (TSM svc)  │     └──────────────────┘  256-channel routing      │
│  └──────┬──────┘     TSM: tsm start midi-mp                         │
│         │                                                           │
│         ├────────────▶ 2020/udp ────────▶ Game engines (TGP)        │
│         │              (broadcast)        pulsar, trax, etc.        │
│         │                                                           │
│         └────────────▶ 1986/udp ────────▶ quasar ────▶ browsers     │
│                        (direct)           (WebSocket 1985)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Port Map

| Port | Type | Service | Direction | Description |
|------|------|---------|-----------|-------------|
| 1983 | UDP  | midi.js | bind+multicast | MIDI hardware → OSC broadcast |
| 1983 | UDP  | midi-mp.js | multicast-join | Receives from midi.js |
| 1985 | TCP  | quasar | bind | WebSocket to browsers |
| 1986 | UDP  | quasar | bind | OSC commands from midi-mp |
| 2020 | UDP  | games | send-to | Broadcast to game engines |

## Core Concept

**midi-mp defines HOW to route MIDI messages to multiple endpoints, not WHAT to do with them.**

```
MIDI Controller → midi.js (OSC) → midi-mp (map+route) → Games/Browsers
                                         │
                                  ┌──────┴──────┐
                                  │ 256 channels │
                                  │ Map files    │
                                  │ Subscriptions│
                                  └─────────────┘
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

## Directory Structure

```
bash/
├── midi/               # Hardware → OSC bridge
│   └── midi.js         # MIDI hardware → multicast 239.1.1.1:1983
│
├── midi-mp/            # Multiplayer routing protocol ← YOU ARE HERE
│   ├── midi-mp.js      # 256-channel message router
│   ├── protocol.js     # Message format definitions
│   ├── examples/       # Example configs
│   └── public/         # Static files
│
├── quasar/             # Browser bridge
│   └── quasar_server.js  # WebSocket 1985, OSC 1986
│
├── games/              # Game engines (receive from 2020)
│   ├── pulsar/
│   ├── trax/
│   └── cymatica/
```

## Quick Start

### Using TSM (recommended)

```bash
# Start all services
tsm start midi      # MIDI hardware → multicast 1983
tsm start midi-mp   # Router joins multicast, sends to 2020/1986
tsm start quasar    # Browser bridge on 1985

# Check status
tsm list --ports
```

### Manual Start

```bash
# Terminal 1: MIDI bridge
cd ~/tetra/bash/midi
node midi.js -M -O -v

# Terminal 2: Router
cd ~/tetra/bash/midi-mp
node midi-mp.js --port 1983 --verbose

# Terminal 3: Quasar (for browser clients)
cd ~/tetra/bash/quasar
node quasar_server.js
```

### Connect Your Game

```javascript
// Game listens on 2020/udp for mapped commands
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
  console.log('Game received:', msg.toString());
});

server.bind(2020);
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

### MessageRouter Class

```javascript
const { MessageRouter } = require('./midi-mp');

const router = new MessageRouter({
  port: 1983,
  configDir: process.env.TETRA_DIR + '/midi-mp'
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
├── midi-mp.js             # 256-channel message router (main)
├── protocol.js            # Message format definitions
├── examples/
│   ├── broadcast.json     # Simple broadcast config
│   ├── cymatica.json      # Cymatics game/visualizer
│   └── vj-split.json      # Multi-screen VJ
├── public/                # Static files
└── README.md              # This file
```

## TSM Service

```bash
# Service definition: ~/tetra/orgs/tetra/tsm/services-available/midi-mp.tsm
TSM_NAME="midi-mp"
TSM_PORT="1983"
TSM_PORT_TYPE="udp"
TSM_PORTS="1983:udp:osc:multicast-join:239.1.1.1"
TSM_COMMAND="node midi-mp.js --port 1983"
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
