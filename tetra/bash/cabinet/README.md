# Cabinet - ASCII Game Client

Browser-based client for playing terminal games via WebSocket.

## What It Does

- Renders ASCII/ANSI frames to a 60×24 monospace canvas
- Captures keyboard input (WASD, IJKL, arrows)
- Polls gamepad state (buttons, axes)
- Forwards all input to game host via WebSocket

## Usage

### Browser

Open `join.html` and enter a WebSocket URL:
```
ws://localhost:8080
```

Or pass via URL parameter:
```
join.html?host=ws://localhost:8080
```

### As Host

```bash
# Start cabinet with a game driver
node cabinet.js --port 8080 --game magnetar

# Or via TSM
tsm start cabinet
```

## Input Protocol

Cabinet sends JSON input events to the game host:

```json
{"type":"key","key":"a","player":"p1"}
{"type":"gamepad","buttons":[0,0,1,0],"axes":[0.5,-0.2]}
```

## Frame Protocol

Game hosts send frames as plain text (ANSI escape sequences supported):

```
\x1b[2J\x1b[H      <- clear screen
█████████████     <- game content
  SCORE: 100
```

## Controls

| Player 1 | Player 2 | Action |
|----------|----------|--------|
| A | L | Fire |
| W/S | I/K | Up/Down |
| A/D | J/L | Left/Right |
| Q | P | Quit |

Gamepad: D-pad or left stick for movement, A/X buttons for actions.

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│  join.html  │ ◄────────────────► │  Game Host  │
│  (browser)  │   frames + input   │  (terminal) │
└─────────────┘                    └─────────────┘
```

Cabinet is display-only - all game logic runs on the host.

## See Also

- [gamma](../gamma/) - Match-making to find game hosts
- [quasar](../quasar/) - Alternative client with sound support
