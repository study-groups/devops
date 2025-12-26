# Tetra Data Protocol (TDP)

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2025-01-19

## Overview

The Tetra Data Protocol (TDP) is a transport-agnostic base protocol for ALL Tetra real-time data. It provides a unified packet structure for routing input controls, game state, audio parameters, and system messages across the Tetra ecosystem.

TDP uses MQTT-style hierarchical topics for routing instead of numeric channels, enabling flexible subscription patterns and semantic addressing.

## Design Principles

1. **Transport-agnostic** - Same packet structure across UDP/OSC, WebSocket, Unix sockets, FIFOs
2. **Hierarchical routing** - MQTT-style topics with wildcard subscriptions
3. **Domain extensible** - Optional metadata extensions (`_browser`, `_terminal`, `_game`, etc.)
4. **Minimal overhead** - Required fields kept small; extensions are optional
5. **Semantic addressing** - Topics describe what the data is, not just where it goes

---

## Protocol Architecture

```
TDP (Tetra Data Protocol) - Transport-agnostic base
├── Core packet structure (headers, routing, payload)
├── MQTT-style hierarchical topics
├── Transport bindings: UDP/OSC, WebSocket, Unix socket, FIFO, postMessage
│
└── Domain Extensions (optional, stackable)
    ├── _browser: { tabId, windowId, workerType, origin, iframeId }
    ├── _terminal: { pty, cols, rows, encoding, pid }
    ├── _game: { tick, matchId }
    ├── _audio: { engine, voices, sampleRate }
    └── _debug: { trace, latency, dropped }
```

---

## Packet Structure

### Core Packet (Required Fields)

```javascript
{
  // Header (required)
  _proto: 'tdp',          // Protocol identifier
  _v: 1,                  // Protocol version
  _t: 1703456789.123,     // Unix timestamp (seconds.milliseconds)
  _id: 'pkt-abc123',      // Unique packet ID

  // Routing (required)
  topic: 'tetra/game/trax/match-xyz/p1/control',

  // Payload envelope (required)
  type: 'control',        // Packet type (see Packet Types)
  payload: { ... }        // The actual data
}
```

### Extended Packet (Optional Fields)

```javascript
{
  // ... core fields ...

  // Optional core metadata
  source: 'midi-mp',      // Origin identifier
  ttl: 5,                 // Time to live (hops or seconds)
  priority: 3,            // Priority level (0-7, 7 = highest)

  // Domain extensions (optional, stackable)
  _browser: {
    tabId: 'tab-1',
    windowId: 'win-1',
    workerType: 'shared',
    origin: 'https://games.tetra.dev',
    iframeId: 'trax-frame'
  },
  _terminal: {
    pty: '/dev/pts/3',
    cols: 120,
    rows: 40,
    encoding: 'utf-8',
    pid: 12345
  },
  _game: {
    tick: 12345
  },
  _audio: {
    engine: 'tia',
    voices: 2,
    sampleRate: 31400
  },
  _debug: {
    trace: ['midi-mp', 'websocket', 'trax'],
    latency: 2.3,
    dropped: 0
  }
}
```

---

## Topic Hierarchy

Topics follow MQTT-style hierarchical addressing with `/` as the separator.

### Standard Topic Structure

```
tetra/
├── midi/{port}/{channel}/cc/{cc}      # tetra/midi/0/1/cc/74
├── midi/{port}/{channel}/note/{note}  # tetra/midi/0/1/note/60
├── gamepad/{index}/{control}          # tetra/gamepad/0/left-y
├── hand/{side}/{control}              # tetra/hand/right/theta
├── game/{type}/{match}/{slot}/{msg}   # tetra/game/trax/xyz/p1/control
├── audio/{engine}/{voice}             # tetra/audio/tia/0
└── system/{msg}                       # tetra/system/heartbeat
```

### Topic Examples

| Topic | Description |
|-------|-------------|
| `tetra/midi/0/1/cc/74` | MIDI port 0, channel 1, CC 74 |
| `tetra/gamepad/0/left-y` | Gamepad 0, left stick Y axis |
| `tetra/hand/right/theta` | Right hand, rotation angle |
| `tetra/game/trax/xyz/p1/control` | Trax match xyz, player 1 control |
| `tetra/audio/tia/0` | TIA engine, voice 0 |
| `tetra/system/heartbeat` | System heartbeat message |

### Subscription Patterns (MQTT Wildcards)

| Pattern | Matches |
|---------|---------|
| `tetra/game/trax/#` | All trax messages |
| `tetra/game/+/+/p1/#` | P1 in any match of any game |
| `tetra/midi/+/1/cc/+` | All CCs on MIDI channel 1, any port |
| `tetra/+/+/control` | All control messages |
| `#` | Everything |

**Wildcard Rules:**
- `+` matches exactly one level
- `#` matches zero or more levels (must be last)
- Wildcards can appear anywhere except in published topics

---

## Packet Types

| Type | Description | Example Use |
|------|-------------|-------------|
| `control` | Real-time input | MIDI CC, gamepad axis, hand tracking |
| `frame` | Visual frame data | Game frames, terminal output |
| `audio` | Audio/synthesis params | TIA voices, OSC messages |
| `state` | Application state sync | Game state, player slots |
| `event` | Discrete events | Triggers, button presses, notifications |
| `command` | Commands/requests | Start, stop, configure |
| `response` | Command responses | Ack, result, error |
| `heartbeat` | Keep-alive/health | Ping, pong |
| `meta` | Protocol metadata | Registration, capabilities |

### Type-Specific Payloads

**control:**
```javascript
{
  type: 'control',
  payload: {
    control: 'left-y',     // Control identifier
    value: 0.75,           // Normalized value (0.0-1.0 for continuous)
    raw: 96                // Optional raw value
  }
}
```

**event:**
```javascript
{
  type: 'event',
  payload: {
    event: 'button-press', // Event identifier
    data: { button: 'A' }  // Event-specific data
  }
}
```

**state:**
```javascript
{
  type: 'state',
  payload: {
    version: 42,           // State version for ordering
    state: { ... }         // Application state
  }
}
```

**command:**
```javascript
{
  type: 'command',
  payload: {
    cmd: 'start',          // Command name
    args: { ... }          // Command arguments
  }
}
```

**response:**
```javascript
{
  type: 'response',
  payload: {
    to: 'pkt-xyz',         // ID of command packet
    status: 'ok',          // ok | error
    result: { ... }        // Result or error details
  }
}
```

---

## Transport Bindings

### UDP/OSC (Local Low-Latency)

Primary transport for midi-mp and local game communication.

**Mapping:**
- OSC address = topic path with `/` prefix
- OSC args = payload values

**Example:**
```
OSC Address: /tetra/game/trax/match-xyz/p1/control
OSC Type Tag: sf
OSC Args: ["left-y", 0.75]
```

**Full packet encoding (optional):**
```
OSC Address: /tdp
OSC Type Tag: s
OSC Args: [JSON.stringify(packet)]
```

### WebSocket (Browser-Server)

JSON-encoded TDP packets over WebSocket.

```javascript
ws.send(JSON.stringify({
  _proto: 'tdp',
  _v: 1,
  _t: Date.now() / 1000,
  _id: crypto.randomUUID(),
  topic: 'tetra/game/trax/xyz/p1/control',
  type: 'control',
  payload: { control: 'left-y', value: 0.75 }
}));
```

### Unix Socket (Local IPC)

Newline-delimited JSON packets.

```
{"_proto":"tdp","_v":1,"_t":1703456789.123,"_id":"pkt-1","topic":"tetra/system/heartbeat","type":"heartbeat","payload":{}}
{"_proto":"tdp","_v":1,"_t":1703456789.456,"_id":"pkt-2","topic":"tetra/midi/0/1/cc/74","type":"control","payload":{"value":0.5}}
```

### FIFO (Process Pipes)

Same as Unix socket: newline-delimited JSON.

### BroadcastChannel (Browser Tabs)

JSON packets with `_browser` extension.

```javascript
const channel = new BroadcastChannel('tetra-tdp');
channel.postMessage({
  _proto: 'tdp',
  // ... packet fields ...
  _browser: {
    tabId: 'tab-1',
    origin: location.origin
  }
});
```

### postMessage (iframes/workers)

JSON packets with `_browser` extension for origin tracking.

```javascript
iframe.contentWindow.postMessage({
  _proto: 'tdp',
  // ... packet fields ...
  _browser: {
    iframeId: 'trax-frame',
    origin: location.origin
  }
}, '*');
```

---

## Domain Extensions

Domain extensions provide optional metadata for specific contexts. They are prefixed with `_` and can be added or stripped as packets traverse the system.

### Extension Lifecycle

1. **Add on entry**: Source adds relevant extension (e.g., browser adds `_browser`)
2. **Preserve through system**: Extensions travel with packet
3. **Strip on exit**: Gateway may strip extensions not relevant to destination
4. **Stack multiple**: Packet can have multiple extensions (e.g., `_browser` + `_game`)

### Standard Extensions

#### _browser

For packets originating from or destined for browser contexts.

```javascript
_browser: {
  tabId: 'tab-1',           // Browser tab identifier
  windowId: 'win-1',        // Browser window identifier
  workerType: 'shared',     // none | dedicated | shared | service
  origin: 'https://...',    // Page origin
  iframeId: 'frame-1'       // iframe element ID
}
```

#### _terminal

For packets related to terminal/TUI applications.

```javascript
_terminal: {
  pty: '/dev/pts/3',        // PTY device
  cols: 120,                // Terminal columns
  rows: 40,                 // Terminal rows
  encoding: 'utf-8',        // Character encoding
  pid: 12345                // Process ID
}
```

#### _game

For game-specific metadata.

```javascript
_game: {
  tick: 12345               // Game tick/frame number
}
```

Note: Match/slot/gameType info belongs in the topic path, not the extension.

#### _audio

For audio synthesis parameters.

```javascript
_audio: {
  engine: 'tia',            // Audio engine identifier
  voices: 2,                // Number of voices
  sampleRate: 31400         // Sample rate in Hz
}
```

#### _debug

For debugging and diagnostics.

```javascript
_debug: {
  trace: ['src', 'hop1'],   // Path through system
  latency: 2.3,             // End-to-end latency in ms
  dropped: 0                // Dropped packet count
}
```

---

## Integration with TSM

### controls.json TDP Section

Games and applications can declare their TDP subscriptions in `controls.json`:

```json
{
  "name": "trax",
  "version": "1.0.0",
  "actions": {
    "move_left": { "type": "continuous", "min": 0, "max": 1 },
    "move_right": { "type": "continuous", "min": 0, "max": 1 }
  },
  "tdp": {
    "topic": "tetra/game/trax",
    "subscribe": [
      "tetra/midi/+/1/cc/40",
      "tetra/midi/+/1/cc/41",
      "tetra/gamepad/+/left-y",
      "tetra/hand/+/x"
    ]
  }
}
```

### TSM Service Definition

```bash
#!/usr/bin/env bash
TSM_NAME="trax"
TSM_ORG="tetra"
TSM_CWD="$TETRA_DIR/orgs/tetra/games/trax"
TSM_PORT="7300"
TSM_COUPLING_MODE="local"
TSM_TDP_TOPIC="tetra/game/trax"
TSM_COMMAND="node trax_host.js --port 7300"
```

### midi-mp Registration

When a game starts, TSM can auto-register it with midi-mp using the TDP configuration:

```bash
# From tsm_midi_register_from_controls()
# Parses controls.json tdp section and registers subscriptions
tsm_midi_register "$service" "$topic" "$subscribe_patterns"
```

---

## Examples

### MIDI CC to Game

```javascript
// midi-mp receives MIDI CC 74 on channel 1, value 96
{
  _proto: 'tdp',
  _v: 1,
  _t: 1703456789.123,
  _id: 'pkt-001',
  topic: 'tetra/midi/0/1/cc/74',
  type: 'control',
  payload: {
    control: 'cc',
    value: 0.756,           // Normalized 96/127
    raw: 96
  }
}

// Game receives (subscribed to tetra/midi/+/1/cc/74)
// Maps to left-y control based on controls.json
```

### Browser to Local Game

```javascript
// Browser sends via WebSocket
{
  _proto: 'tdp',
  _v: 1,
  _t: 1703456789.123,
  _id: 'pkt-002',
  topic: 'tetra/game/trax/match-xyz/p1/control',
  type: 'control',
  payload: {
    control: 'left-y',
    value: 0.75
  },
  _browser: {
    tabId: 'tab-1',
    origin: 'https://games.tetra.dev'
  }
}

// Server strips _browser, forwards to local game via UDP/OSC
```

### Game State Broadcast

```javascript
// Game publishes state
{
  _proto: 'tdp',
  _v: 1,
  _t: 1703456789.123,
  _id: 'pkt-003',
  topic: 'tetra/game/trax/match-xyz/state',
  type: 'state',
  payload: {
    version: 42,
    state: {
      p1: { x: 10, y: 20 },
      p2: { x: 30, y: 40 },
      ball: { x: 50, y: 50 }
    }
  },
  _game: {
    tick: 12345
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-19 | Initial TDP specification |

---

## See Also

- [TSM Documentation](../bash/tsm/README.md)
- [midi-mp Documentation](../go/midi-mp/README.md)
- [ControlDeck Documentation](../../controldeck/README.md)
