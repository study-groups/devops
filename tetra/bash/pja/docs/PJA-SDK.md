# PJA-SDK Technical Specification

**Version:** 1.0.0
**Location:** `/pja-sdk.js`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLENITH TV (Host)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ MessageBus  │  │ PaddleBox   │  │ CRTEffects / State      │  │
│  │             │  │ (Controller)│  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
│         │                │                                       │
│         └────────┬───────┘                                       │
│                  │ postMessage (source: 'plenith-tv')            │
│                  ▼                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    <iframe>                                │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              GAME CLIENT (Channel)                   │  │  │
│  │  │                                                      │  │  │
│  │  │   ┌─────────────────────────────────────────────┐   │  │  │
│  │  │   │              PJA-SDK (pja-sdk.js)           │   │  │  │
│  │  │   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐  │   │  │  │
│  │  │   │  │ PJA.RT │ │PJA.Game│ │PJA.Deck│ │PJA.MP│  │   │  │  │
│  │  │   │  └────────┘ └────────┘ └────────┘ └──────┘  │   │  │  │
│  │  │   └─────────────────────────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Games are **clients** loaded in iframes. Plenith is the **host** that manages channels, input devices (PaddleBox), and display effects (CRT).

## Communication Protocols

### 1. Host → Client (postMessage)

| Source | Type | Payload | Description |
|--------|------|---------|-------------|
| `plenith-tv` | `channel-init` | `{ channel, name }` | Initialize channel |
| `plenith-tv` | `game:control` | `{ action, ... }` | Game control command |
| `plenith-tv` | `crt-state` | `{ effects }` | CRT effect values |

**game:control actions:**

```javascript
{ action: 'start' }                           // Start game
{ action: 'stop' }                            // Stop game
{ action: 'pause' }                           // Pause game
{ action: 'resume' }                          // Resume game
{ action: 'toggle' }                          // Toggle pause/play
{ action: 'reset' }                           // Reset game state
{ action: 'paddle', player: 1, value: 0.5 }   // Paddle position (0.0-1.0)
```

### 2. Client → Host (postMessage)

| Source | Type | Payload | Description |
|--------|------|---------|-------------|
| `pja-client` | `client:loaded` | `{}` | SDK loaded |
| `plenith-channel` | `channel-loaded` | `{}` | Channel ready (legacy) |
| `plenith-channel` | `change-channel` | `{ target: N }` | Request channel switch |
| `plenith-channel` | `crt-effects` | `{ scanlines, ... }` | Apply CRT effects |
| `plenith-channel` | `request-crt-state` | `{}` | Request current CRT state |
| `plenith-channel` | `toggle-controller` | `{}` | Show/hide PaddleBox |

---

## PJA-SDK Modules

### PJA.RT (Realtime Transport)

Handles iframe ↔ host postMessage communication.

```javascript
// Client sends to host
PJA.RT.send('game:state', { state: 'playing' });
PJA.RT.changeChannel(5);
PJA.RT.sendScore([10, 8, 0, 0]);

// Client receives from host
PJA.RT.on('init', (data) => {
    console.log('Channel:', data.channel, data.name);
});

PJA.RT.on('message', (data) => {
    // Raw message handler
});
```

**Properties:**
- `PJA.RT.channel` — Current channel number
- `PJA.RT.name` — Channel name
- `PJA.RT.ready` — Boolean, true after init received

### PJA.Game (Game State Machine)

Standardized game lifecycle and controls.

```javascript
// State: 'idle' | 'playing' | 'paused' | 'ended'

// Game controls
PJA.Game.start();
PJA.Game.stop();
PJA.Game.pause();
PJA.Game.togglePause();
PJA.Game.end(winner);

// Paddle control (players 1-4, value 0.0-1.0)
PJA.Game.setPaddle(1, 0.75);
PJA.Game.movePaddle(1, 0.05);  // Delta movement

// Scoring
PJA.Game.setScore(1, 10);
PJA.Game.addScore(2, 1);

// Events (from host commands)
PJA.Game.on('start', () => initGame());
PJA.Game.on('stop', () => cleanup());
PJA.Game.on('pause', () => showPauseScreen());
PJA.Game.on('resume', () => hidePauseScreen());
PJA.Game.on('paddle', (player, value) => movePaddle(player, value));
PJA.Game.on('score', (player, score) => updateScoreboard());
PJA.Game.on('end', (winner) => showGameOver(winner));
```

**Properties:**
- `PJA.Game.state` — Current state string
- `PJA.Game.paddles` — Array of 4 paddle positions [0.0-1.0]
- `PJA.Game.score` — Array of 4 player scores
- `PJA.Game.players` — Max supported players (4)

### PJA.Deck (ControlDeck Integration)

BroadcastChannel communication with external controllers (gamepad, AI).

```javascript
PJA.Deck.init('pong');  // Channel name

// Poll axes in game loop (recommended for smooth control)
function gameLoop() {
    const leftY = PJA.Deck.getAxis('left-y');   // -1 to 1
    const rightY = PJA.Deck.getAxis('right-y');

    PJA.Game.movePaddle(1, leftY * 0.02);
    PJA.Game.movePaddle(2, rightY * 0.02);

    requestAnimationFrame(gameLoop);
}

// Event-based (for UI feedback)
PJA.Deck.on('axis', (name, value) => {
    // name: 'left-x', 'left-y', 'right-x', 'right-y'
});

PJA.Deck.on('button', (name, pressed) => {
    // name: 'start', 'a', 'b', etc.
});

// Send state to AI controller
PJA.Deck.sendState({
    ball: { x, y, vx, vy },
    paddles: [p1y, p2y],
    score: [s1, s2]
});
```

**Axis names:** `left-x`, `left-y`, `right-x`, `right-y`

**BroadcastChannel names:**
- `controldeck-{game}` — Input from controller to game
- `controldeck-{game}-state` — Game state to AI

### PJA.MP (Multiplayer Protocol)

OSC-style WebSocket protocol for multiplayer servers.

```javascript
PJA.MP.connect('ws://localhost:1985');

PJA.MP.on('connected', () => {
    PJA.MP.join('PlayerName', '#FF0000');
});

PJA.MP.on('joined', ({ playerId }) => {
    console.log('Joined as:', playerId);
});

PJA.MP.on('game:paddle', ({ gameId, player, value }) => {
    PJA.Game.setPaddle(player, value);
});

PJA.MP.on('disconnected', () => {
    // Handle reconnection
});

// Send OSC-style messages
PJA.MP.send('/game/123/player/1/paddle', 0.75);
PJA.MP.send('/lobby/player/join', 'Alice', '#00FF00');

// Convenience methods
PJA.MP.join(name, color);
PJA.MP.leave();
PJA.MP.queueJoin(gameType);
PJA.MP.sendPaddle(gameId, player, value);
PJA.MP.query();
PJA.MP.stats();
```

**OSC Address Schema:**

```
Lobby:
  /lobby/player/join      [name:s, color:s]
  /lobby/player/leave     [playerId:s]
  /lobby/queue/join       [playerId:s, gameType:s]
  /lobby/queue/leave      [playerId:s]
  /lobby/query            []
  /lobby/stats            []

Game:
  /game/{id}/state              [state:s]
  /game/{id}/player/{n}/paddle  [value:f]
  /game/{id}/player/{n}/action  [action:s]
  /game/{id}/ball               [x:f, y:f, vx:f, vy:f]
  /game/{id}/score              [p1:i, p2:i, p3:i, p4:i]

Audio:
  /audio/volume           [level:f]
  /audio/mute             [muted:i]
```

**Type codes:** `s` = string, `f` = float32, `i` = int32

### PJA.Theme (CSS Variables / TUT Protocol)

Theme token communication for consistent styling across host and clients.

```javascript
// Get/set CSS variables
PJA.Theme.get('--accent-primary');
PJA.Theme.set('--bg-primary', '#1a1a2e');
PJA.Theme.setAll({ '--bg-primary': '#1a1a2e', '--text-primary': '#fff' });

// Apply theme object (TUT format)
PJA.Theme.applyTheme({
    tokens: {
        'accent-primary': { css: '--accent-primary', value: '#e94560' }
    }
});

// Request theme from parent (for iframes)
PJA.Theme.requestFromParent();

// Broadcast to other windows via BroadcastChannel
PJA.Theme.broadcast('pja-theme');
PJA.Theme.listen('pja-theme');

// Reset to defaults
PJA.Theme.reset();
```

**Default tokens:**
```javascript
'--bg-primary': '#1a1a2e'
'--bg-secondary': '#16213e'
'--text-primary': '#c0c0d0'
'--accent-primary': '#e94560'
'--accent-secondary': '#3b82c4'
'--success': '#4ade80'
'--warning': '#fbbf24'
'--error': '#f87171'
```

---

## Initialization

### Minimal (auto RT only)

PJA.RT auto-initializes on DOMContentLoaded. Just add event handlers:

```html
<script src="../../pja-sdk.js"></script>
<script>
    PJA.Game.on('start', () => startGame());
    PJA.Game.on('paddle', (p, v) => movePaddle(p, v));
</script>
```

### Full Setup

```javascript
PJA.init({
    deck: true,               // Enable ControlDeck (default: true)
    deckChannel: 'mygame',    // BroadcastChannel name (default: 'pong')
    server: 'ws://...',       // Multiplayer server URL (default: null)
    theme: true,              // Enable theming (default: true)
    themeChannel: 'pja-theme' // Theme BroadcastChannel (default: 'pja-theme')
});
```

---

## Message Flow Example

```
1. Plenith loads channel 7 in iframe

2. Host sends:
   { source: 'plenith-tv', type: 'channel-init', channel: 7, name: 'Pong' }

3. PJA.RT receives, sets channel/name, emits 'init' event

4. Client sends:
   { source: 'pja-client', type: 'client:loaded' }

5. User moves PaddleBox wheel

6. Host sends:
   { source: 'plenith-tv', type: 'game:control',
     action: 'paddle', player: 1, value: 0.7 }

7. PJA.RT routes to PJA.Game._handleControl()

8. PJA.Game.setPaddle(1, 0.7) called internally

9. PJA.Game emits 'paddle' event with (1, 0.7)

10. Game code receives event, updates paddle position
```

---

## Adding PJA-SDK to a New Channel

1. Include the SDK:
   ```html
   <script src="../../pja-sdk.js"></script>
   ```

2. Add event handlers:
   ```javascript
   PJA.Game.on('start', () => { /* start game */ });
   PJA.Game.on('stop', () => { /* cleanup */ });
   PJA.Game.on('paddle', (player, value) => { /* move paddle */ });
   ```

3. (Optional) Initialize ControlDeck for gamepad/AI:
   ```javascript
   PJA.init({ deck: true, deckChannel: 'mygame' });
   ```

4. (Optional) Send game state for AI:
   ```javascript
   // In game loop
   PJA.Deck.sendState({ ball: {x, y}, paddles: [p1, p2] });
   ```

---

## Backwards Compatibility

The SDK accepts messages from both `pja-host` and `plenith-tv` sources for backwards compatibility with older Plenith versions.

Clients can send messages with either `pja-client` or `plenith-channel` source — Plenith handles both.
