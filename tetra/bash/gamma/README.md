# GAMMA - Game Allocation & Match-Making Architecture

Control plane for multiplayer ASCII game sessions.

## What It Does

- Creates ephemeral match codes (e.g., `XKCD`, `9F3A`)
- Manages player slots and join/leave lifecycle
- Spawns game processes on demand
- Registers player routes with midi-mp

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 1980 | HTTP | REST API + dashboard |
| 1985 | UDP | Quick CLI status queries |
| unix | socket | `/tmp/tetra/gamma.sock` |

## API

```bash
# Create match
curl -X POST localhost:1980/api/match/create \
  -d '{"game":"magnetar","slots":2,"spawn":true}'

# Join match
curl -X POST localhost:1980/api/match/join \
  -d '{"code":"XKCD"}'

# List matches
curl localhost:1980/api/matches

# Status
curl localhost:1980/api/status
```

## CLI

```bash
gamma create magnetar    # Create match, get join code
gamma join XKCD          # Join as player
gamma list               # Show active matches
gamma status             # Quick status check
```

## Usage

```bash
# As TSM service
tsm start gamma

# Or directly
node gamma-api.js --http-port 1980 --udp-port 1985
```

## Architecture

GAMMA is the control plane only - it sets up matches then gets out of the way.
Game data flows directly between players and game hosts via midi-mp.

```
Player ──► gamma (get match info) ──► game host address
       └──────────────────────────────► game host (direct)
```

## See Also

- [midi-mp](../midi-mp/) - Message routing layer
- [quasar](../quasar/) - Sound daemon + WebSocket relay
- [ansicab](../ansicab/) - ANSI terminal game cabinet
