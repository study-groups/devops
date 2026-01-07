# Tetra SDK

Unified TDP-Lite protocol implementation for browser IPC (postMessage, WebSocket, BroadcastChannel).

## Quick Start

### Iframe (Panel/Game)

```html
<script src="/js/tetra-sdk.js"></script>
<script>
  Tetra.init({ identity: 'my-panel', debug: true });

  // Subscribe to environment changes
  Tetra.onEnvChange(({ org, env }) => {
    console.log(`Environment: ${org}/${env}`);
  });

  // Send custom events
  Tetra.emit('data-loaded', { count: 42 });
</script>
```

### Parent Window (Hub)

```html
<script src="/js/tetra-sdk.js"></script>
<script>
  Tetra.init({
    identity: 'parent',
    isHub: true,
    debug: true
  });

  // Listen for panel ready events
  Tetra.on('terrain/panel/+/ready', (pkt) => {
    console.log(`Panel ready: ${pkt.source}`);
  });

  // Broadcast environment change
  Tetra.setEnvironment('tetra', 'dev', 'mricos');
</script>
```

### With WebSocket (Server Connection)

```html
<script src="/js/tetra-sdk.js"></script>
<script>
  Tetra.init({
    identity: 'console',
    ws: 'ws://localhost:4444/tdp',
    onConnect: () => console.log('Server connected'),
    onDisconnect: () => console.log('Server disconnected')
  });
</script>
```

---

## Protocol Format (TDP-Lite)

Every message follows this structure:

```javascript
{
  // Required envelope
  _proto: 'tdp',           // Protocol marker
  _v: 1,                   // Protocol version

  // Required routing
  topic: 'terrain/panel/deploy/ready',  // MQTT-style topic

  // Required payload
  type: 'event',           // control | event | command | state | response
  payload: {},             // Application data

  // Metadata (optional but recommended)
  source: 'deploy',        // Origin identifier
  _ts: 1704307200.123,     // Timestamp (seconds)
  _id: 'pkt-abc123',       // Packet ID

  // Routing trace (added by hubs)
  _trace: ['deploy', 'parent'],

  // Domain extensions (optional)
  _browser: { iframeId: 'deploy' },
  _game: { tick: 12345 }
}
```

---

## Topic Hierarchy

```
tetra/
├── terrain/
│   ├── panel/{name}/ready      # Panel lifecycle
│   ├── panel/{name}/title      # Title updates
│   ├── panel/{name}/status     # Status updates
│   ├── env/{org}/{env}         # Environment changes
│   ├── service/{name}/+        # TSM service events
│   └── system/tokens           # CSS token injection
│
├── pja/
│   ├── game/{gameId}/ready     # Game loaded
│   ├── game/{gameId}/state     # Game state sync
│   ├── game/{gameId}/input     # Player input
│   ├── game/{gameId}/score     # Score updates
│   ├── iframe/{id}/+           # Generic iframe events
│   └── host/+                  # Host commands
│
└── custom/
    └── {namespace}/{...}       # Custom namespaces
```

---

## API Reference

### Initialization

```javascript
Tetra.init({
  identity: 'my-panel',      // Required: unique identifier
  namespace: 'custom/myapp', // Optional: topic prefix
  isHub: false,              // Optional: hub mode (default: auto-detect)
  ws: 'ws://host/tdp',       // Optional: WebSocket URL
  broadcastChannel: 'tetra', // Optional: BroadcastChannel name
  debug: false,              // Optional: enable debug logging

  // Lifecycle hooks
  onReady: (tetra) => {},
  onConnect: () => {},
  onDisconnect: () => {},
  onError: (err) => {}
});
```

### Sending Messages

```javascript
// Basic send
Tetra.send('terrain/panel/deploy/status', 'event', { connected: true });

// With options
Tetra.send('pja/game/quadrapong/state', 'state', gameState, {
  id: 'custom-id',         // Custom packet ID
  _game: { tick: 1234 }    // Game extension
});

// Request/response pattern
const result = await Tetra.request('terrain/system/get-tokens', {});

// Respond to a request
Tetra.respond(requestId, 'ok', { tokens: {...} });
```

### Subscribing

```javascript
// Exact topic
Tetra.on('terrain/panel/deploy/ready', (pkt) => { ... });

// Single-level wildcard (+)
Tetra.on('terrain/panel/+/ready', (pkt) => { ... });

// Multi-level wildcard (#)
Tetra.on('pja/game/#', (pkt) => { ... });

// All messages
Tetra.onAny((pkt) => console.log(pkt.topic, pkt.payload));

// Unsubscribe
const unsub = Tetra.on('topic', handler);
unsub();  // Remove subscription
```

### Convenience Methods

#### Terrain Panels

```javascript
Tetra.sendReady();                    // Send ready event
Tetra.sendTitle('My Panel');          // Update title
Tetra.onEnvChange(({ org, env }) => {}); // Environment changes
```

#### PJA Games

```javascript
Tetra.gameLoaded({ maxFPS: 60 });     // Game ready
Tetra.gameState(state, tick);          // State sync
Tetra.gameInput(playerId, inputs, tick); // Player input
Tetra.gameScore([{ id: 'p1', score: 10 }]); // Scores
Tetra.onHostCommand((cmd, data) => {}); // Host commands
```

#### Custom Iframes

```javascript
// With namespace: custom/myapp
Tetra.init({ namespace: 'custom/myapp' });
Tetra.emit('data-loaded', { count: 42 }); // custom/myapp/data-loaded
Tetra.setState('counter', 10);            // custom/myapp/state/counter
```

#### Hub (Parent Window)

```javascript
Tetra.registerIframe('deploy', iframe.contentWindow);
Tetra.sendToIframe('deploy', 'topic', 'command', data);
Tetra.broadcast('terrain/env/tetra/dev', 'command', { env: 'dev' });
Tetra.setEnvironment('tetra', 'dev', 'mricos');
Tetra.injectTokens({ '--bg': '#000' });
```

---

## Backward Compatibility

### Legacy Terrain.Iframe

```javascript
// Old code
Terrain.Iframe.send({ type: 'ready', from: 'deploy' });

// New code (equivalent)
Tetra.sendReady();

// Compatibility shim
const iframe = Tetra.asTerrainIframe();
iframe.send({ type: 'custom', from: 'deploy' });
```

### Legacy PJA SDK

```javascript
// Old code
window.pjaGameSdk.sendMessage(types.GAME_LOADED, { ... });

// New code (equivalent)
Tetra.gameLoaded({ ... });

// Compatibility shim
const pja = Tetra.asPjaSdk();
pja.sendMessage(pja.types.GAME_LOADED, { ... });
```

### Message Normalization

The SDK automatically normalizes legacy message formats:

| Legacy Format | Normalized Topic |
|--------------|------------------|
| `{ type: 'ready', from: 'deploy' }` | `terrain/panel/deploy/ready` |
| `{ source: 'pja-iframe', type: 'GAME_LOADED' }` | `pja/iframe/{id}/game-loaded` |
| `{ type: 'game_ready', ... }` | `pja/game/{gameId}/game_ready` |

---

## Examples

### Terrain Panel (tsm.iframe.html)

```javascript
Tetra.init({ identity: 'tsm' });

// Listen for env changes
Tetra.onEnvChange(({ org, env }) => {
  loadServicesForEnv(env);
});

// Send log watch updates
function toggleLogWatch(service) {
  Tetra.send('terrain/service/log-watch', 'command', {
    services: [...watchedServices]
  });
}
```

### PJA Game (quadrapong)

```javascript
Tetra.init({ identity: 'quadrapong' });

Tetra.gameLoaded({
  maxFPS: 60,
  inputMethods: ['keyboard', 'gamepad'],
  audioSupport: true
});

Tetra.onHostCommand((cmd, data) => {
  switch (cmd) {
    case 'start': startGame(); break;
    case 'pause': pauseGame(); break;
    case 'resume': resumeGame(); break;
  }
});

// Game loop
function tick() {
  // Send state every 10 ticks
  if (tickCount % 10 === 0) {
    Tetra.gameState({
      players: playerStates,
      ball: ballState
    }, tickCount);
  }
}
```

### Custom Iframe (custom.iframe.html)

```javascript
Tetra.init({
  identity: 'my-widget',
  namespace: 'custom/widgets/my-widget'
});

// All topics prefixed: custom/widgets/my-widget/...
Tetra.emit('initialized', { version: '1.0' });
Tetra.setState('count', 0);

// Listen to own namespace
Tetra.on('+', (pkt) => {
  console.log('Widget event:', pkt.topic, pkt.payload);
});
```

### Server WebSocket Bridge

```javascript
// In server.js
const tdpWss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, 'http://localhost');

  if (pathname === '/tdp') {
    tdpWss.handleUpgrade(request, socket, head, (ws) => {
      ws.on('message', (data) => {
        const pkt = JSON.parse(data);
        if (pkt._proto !== 'tdp') return;

        // Route by topic
        if (pkt.topic.startsWith('tetra/midi/')) {
          forwardToMidiMp(pkt);
        } else {
          broadcastToClients(pkt);
        }
      });
    });
  }
});
```

---

## Packet Types

| Type | Usage | Example |
|------|-------|---------|
| `control` | Real-time input (60Hz) | Player movement |
| `event` | Discrete events | Button click, game over |
| `command` | Requests | Set theme, pause game |
| `response` | Command replies | Token response |
| `state` | State sync | Game state, settings |
| `heartbeat` | Keep-alive | Ping/pong |
| `meta` | Protocol info | Version negotiation |

---

## Topic Wildcards

| Pattern | Matches |
|---------|---------|
| `terrain/panel/deploy/ready` | Exact match only |
| `terrain/panel/+/ready` | Any panel ready |
| `terrain/panel/#` | All panel events |
| `pja/game/+/state` | Any game state |
| `#` | Everything |

---

## Migration Guide

### From terrain-iframe.js

```diff
- <script src="/js/terrain-iframe.js"></script>
+ <script src="/js/tetra-sdk.js"></script>

- Terrain.Iframe.init({ name: 'deploy', onReady: () => {} });
+ Tetra.init({ identity: 'deploy', onReady: () => {} });

- Terrain.Iframe.send({ type: 'ready', from: 'deploy' });
+ Tetra.sendReady();
```

### From pja-iframe.js

```diff
- <script src="/js/pja-iframe.js"></script>
+ <script src="/js/tetra-sdk.js"></script>

- window.APP.sdk.sendMessage('pja-title-update', { title });
+ Tetra.sendTitle(title);

- window.addEventListener('message', (e) => {
-   if (e.data.type === 'pja-set-theme') { ... }
- });
+ Tetra.on('pja/host/set-theme', (pkt) => { ... });
```

### From pjaGameSdk

```diff
- import { pjaGameSdk } from 'pjaGameSdk.module.js';
+ <script src="/js/tetra-sdk.js"></script>

- pjaGameSdk.sendMessage(types.GAME_LOADED, capabilities);
+ Tetra.gameLoaded(capabilities);

- pjaGameSdk.sendMessage(types.STATE_UPDATE, state);
+ Tetra.gameState(state, tick);
```
