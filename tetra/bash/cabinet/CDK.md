# Cabinet Developer Kit (CDK)

Documentation for developing games that run in the ANSI Cabinet framework.

## Overview

The Cabinet is a WebSocket-based game viewer that renders ANSI frames and provides standardized controls for game interaction. Games run server-side as Node.js processes and communicate with the Cabinet via WebSocket.

## Cabinet Layout Sections

```
+------------------+
|     MARQUEE      |  Header area (game title, branding)
+------------------+
|                  |
|      GAME        |  ANSI display area (pre element)
|                  |
+------------------+
|     STATUS       |  Connection info (slot, players)
+------------------+
|    CONTROLS      |  Game controls (PLAY button)
+------------------+
|   CONNECTIONS    |  Join panel + AI controls
+------------------+
```

## Message Protocol

### Cabinet -> Game Host

```javascript
// Start the game (from PLAY button)
{ t: 'game.play' }

// Reset the game
{ t: 'game.reset' }

// Player input
{
  t: 'input',
  src: 'keyboard' | 'gamepad' | 'ai',
  key: 'w',           // Key name
  ctrl: 'KeyW',       // Key code
  val: 1 | 0,         // 1 = pressed, 0 = released
  pressed: true,      // Boolean state
  axis?: number       // For gamepad/AI: -1 to 1
}

// Player identification
{
  t: 'identify',
  cid: 'cab_abc123',  // Cabinet ID
  nick: 'Player1',    // Nickname
  visits: 5,          // Visit count
  requestSlot: 'p1',  // Requested slot
  takeover: false     // Boot existing player
}
```

### Game Host -> Cabinet

```javascript
// Welcome message (on connect/identify)
{
  t: 'welcome',
  slot: 'p1',               // Assigned slot
  cid: 'cab_abc123',
  nick: 'Player1',
  game: 'ASCIIPONG',        // Game name
  players: [...]            // Current players
}

// Game frame (every tick, typically 30fps)
{
  t: 'frame',
  seq: 1234,                // Frame sequence
  ts: 1704307200000,        // Timestamp
  display: '...',           // ANSI-colorized text
  state: {
    waitingForStart: true,  // Waiting for PLAY
    gameOver: false,
    winner: null,
    // Game-specific state...
  },
  snd: { ... }              // Optional sound data
}

// Player list update
{
  t: 'players',
  players: [
    { slot: 'p1', nick: 'Alice', cid: 'cab_abc' },
    { slot: 'p2', nick: 'Bob', cid: 'cab_xyz' }
  ],
  spectators: 2
}
```

## Required Game States

Games should track these states for Cabinet integration:

| State | Type | Description |
|-------|------|-------------|
| `waitingForStart` | boolean | Game is waiting for PLAY button |
| `gameOver` | boolean | Game has ended |
| `winner` | string | Winner slot (e.g., 'p1') or null |

## Required Game Methods

### Gamepak Interface

Games should extend the `Gamepak` class and implement:

```javascript
const { Gamepak } = require('$TETRA_SRC/bash/cabinet/lib/gamepak.js');

class MyDriver extends Gamepak {
  constructor(options) {
    super({
      name: 'mygame',
      version: '1.0.0',
      slots: 4,          // Max players
      ...options
    });

    this.waitingForStart = true;
  }

  // Called by host on startup
  start() {
    super.start();
    this.waitingForStart = true;
    // Start tick loop...
    return this;
  }

  // Called when PLAY button pressed
  play() {
    if (!this.waitingForStart) return;
    this.waitingForStart = false;
    // Start game logic...
  }

  // Called when RESET button pressed
  reset() {
    // Reset game state...
    this.waitingForStart = true;
  }

  // Called on player input
  sendInput(slot, input) {
    // Handle input from slot (p1, p2, etc.)
  }

  // Called on game loop tick
  _tick() {
    if (this.waitingForStart) {
      // Emit waiting screen frame
      return;
    }
    // Normal game logic...
    this.emitFrame({ display, state });
  }
}
```

## Frame Rendering

Games emit frames with ANSI escape codes for color:

```javascript
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[97;1m',
};

const display = C.cyan + 'SCORE: 42' + C.reset;
this.emitFrame({ display, state: this._getState() });
```

The Cabinet converts ANSI codes to HTML for browser display.

## Input Handling

Player inputs arrive with slot identification:

```javascript
sendInput(slot, input) {
  const key = input.key || input.ctrl;

  // Keyboard keys
  if (key === 'w' || key === 'ArrowUp') {
    this.moveUp(slot);
  }

  // AI/gamepad axis (-1 to 1)
  if (input.axis !== undefined) {
    this.setAxis(slot, input.axis);
  }
}
```

## Slot Configuration

Standard slot assignments:
- `p1` - Player 1 (typically keyboard: W/S)
- `p2` - Player 2 (typically keyboard: Up/Down)
- `p3` - Player 3 (keyboard: I/K)
- `p4` - Player 4 (keyboard: T/G)
- `spectator` - Read-only viewers

## Game Configuration

Create a `game.toml` for TSM integration:

```toml
[game]
name = "mygame"
players = 4
fps = 30
win_score = 7

[network]
port = 1605
```

## File Structure

```
games/mygame/
  mygame_driver.js    # Game logic (extends Gamepak)
  mygame_host.js      # Host setup (creates Host + Driver)
  mygame.tsm          # TSM service config
  game.toml           # Game metadata
  controls.json       # Input mappings (optional)
  sound.json          # TIA sound config (optional)
```

## Example: Minimal Game

```javascript
#!/usr/bin/env node
const { Gamepak } = require(process.env.TETRA_SRC + '/bash/cabinet/lib/gamepak.js');
const { Host } = require(process.env.TETRA_SRC + '/bash/cabinet/lib/host.js');

class MinimalGame extends Gamepak {
  constructor() {
    super({ name: 'minimal', slots: 2 });
    this.waitingForStart = true;
    this.count = 0;
  }

  start() {
    super.start();
    setInterval(() => this._tick(), 1000 / 30);
    return this;
  }

  play() {
    this.waitingForStart = false;
  }

  reset() {
    this.count = 0;
    this.waitingForStart = true;
  }

  _tick() {
    if (!this.waitingForStart) this.count++;
    const display = this.waitingForStart
      ? 'PRESS PLAY TO START'
      : `Count: ${this.count}`;
    this.emitFrame({
      display,
      state: { waitingForStart: this.waitingForStart, count: this.count }
    });
  }
}

const driver = new MinimalGame();
const host = new Host({ port: 8080, driver });
host.start();
driver.start();
```
