# Numbered Panels & Event Logging System

## Overview

The Pulsar engine now uses **numbered panels** (1-9) for toggling debug/info displays, leaving regular keyboard keys (WASD, etc.) free for gameplay and gamepad simulation.

### Key Design Philosophy

- **Numbered panels**: Press 1-9 to toggle different info overlays
- **Free keyboard**: Letters reserved for gameplay controls
- **Event logging**: All input events (gamepad, keyboard) are logged with user context
- **Anonymous PUIDs**: Each player has a Pixeljam Universal ID for tracking

---

## Numbered Panel System

### Available Panels

| Key | Panel | Location | Content |
|-----|-------|----------|---------|
| `1` | Debug Info | Top-left | Pulsar count, FPS, gamepad status, panel flags |
| `2` | Event Log | Bottom (4 lines) | Last 4 events with timestamps |
| `3` | Player Stats | Top-right | PUID, score, tokens, active status |
| `0` | All Off | - | Disable all panels |
| `h` | Help | Center | Control reference (traditional toggle) |

### Usage

```bash
# In game, press number keys to toggle panels
1  # Toggle debug info
2  # Toggle event log
3  # Toggle player stats
0  # Turn off all panels

# Still available
h  # Toggle help overlay
q  # Quit
```

### Panel Display Example

```
[PANEL 1: DEBUG]
 Pulsars: 2 | FPS: 60 | Gamepad: YES
 Panels: 0x03 | Help: h | Quit: q

                   [Game Graphics Here]

[PANEL 2: EVENT LOG - Last 4 Events]
GAMEPAD    Player0    45ms | L[0.54,-0.32] R[0.00,0.00]
GAMEPAD    Player0    89ms | btn=00000001 seq=1234
KEYBOARD   Player0   123ms | key='2' (0x32)
SYSTEM     Player0   4567ms | Engine initialized
```

---

## Event Logging System

### Event Structure

```c
typedef struct {
    char type[16];        // Event type: GAMEPAD, KEYBOARD, SYSTEM
    uint32_t user_id;     // Anonymous user ID (0-3 for players)
    uint64_t timestamp_ns;
    char data[64];        // Event-specific data
} Event;
```

### Event Types

**GAMEPAD Events**
- Button changes: `btn=00000001 seq=1234`
- Axis movements: `L[0.54,-0.32] R[0.00,0.00]`
- Logged when buttons change OR stick magnitude > 0.3

**KEYBOARD Events**
- All keypresses: `key='2' (0x32)`
- Includes hex code for debugging

**SYSTEM Events**
- Engine lifecycle: `Engine initialized`
- Errors: `Unknown version: 2`
- Configuration changes

### Event Log Display (Panel 2)

Shows last 4 events in reverse chronological order:
```
TYPE       USERNAME  AGE    | DATA
GAMEPAD    Player0   45ms   | L[0.54,-0.32] R[0.00,0.00]
KEYBOARD   Player0   123ms  | key='h' (0x68)
```

---

## Pixeljam Universal ID (PUID) System

### Purpose

Anonymous user identification for:
- **Score tracking**: Per-session gameplay scores
- **Token/credit system**: In-game currency and account ledger
- **Social networking**: Basic profile (like LinkedIn for games)
- **Privacy**: Game-local IDs, not tied to external accounts

### PUID Structure

```c
typedef struct {
    uint64_t puid;        /* Unique identifier (session-based) */
    int32_t score;        /* Current score */
    int32_t tokens;       /* Game tokens */
    int32_t credits;      /* Account credits */
    char username[32];    /* Anonymous display name */
    uint64_t created_at;  /* Account creation timestamp */
} PUID_Account;
```

### PUID Generation

Currently **session-based** (resets each game):
```c
// Generated from engine start time + player slot
puid = engine_start_ns + player_slot;
username = "Player0", "Player1", etc.
```

**Future**: Persistent PUIDs via:
- File-based storage: `~/.pixeljam/puid.dat`
- Server-based auth: REST API for account sync
- Blockchain: Decentralized PUID registry (optional)

### Player Stats Panel (Panel 3)

```
[PANEL 3: PLAYERS]
Player0 ACTIVE
  PUID: 0x7f8a4b2c1d9e3f01
  Score:  125 Tokens: 10

Player1 idle
  PUID: 0x7f8a4b2c1d9e3f02
  Score:    0 Tokens:  0
```

**Active Status:**
- `ACTIVE`: Received input in last 5 seconds
- `idle`: No recent input

---

## Implementation Details

### Event Logging

**Circular Buffer:**
- 16 event capacity (MAX_EVENT_LOG)
- Oldest events overwritten
- Panel 2 shows last 4

**Filtering:**
- Gamepad: Only log button changes or significant axis movement (>0.3)
- Keyboard: Log all keypresses
- System: Log critical events only

**Performance:**
- < 1μs per event
- No heap allocation
- Zero-copy display

### USER Field

The `user_id` in events maps to:
- **Player slot** (0-3) for gamepad events
- **0** for keyboard/system events (host player)

This provides:
- **Anonymity**: No real names, only slot IDs
- **Session-local**: No persistent tracking
- **Multi-player ready**: Supports 4 simultaneous players

### Future PUID Integration

**Persistence Layer (Planned):**
```bash
~/.pixeljam/
├── puid.dat          # Binary PUID database
├── scores.json       # Score history
├── tokens.ledger     # Transaction log
└── profile.toml      # User preferences
```

**Server API (Optional):**
```http
POST /api/puid/register
GET  /api/puid/:id/profile
PUT  /api/puid/:id/tokens
GET  /api/leaderboard
```

**Social Features:**
- Friend lists
- Achievement sharing
- Clan/team support
- Tournament brackets

---

## Keyboard Layout Strategy

### Reserved for Gameplay

```
W A S D   - Gamepad simulation (left stick)
I J K L   - Gamepad simulation (right stick)
Space     - Jump / Action
Shift     - Sprint / Modifier
E R T F   - Game-specific actions
```

### UI Controls

```
1-9       - Toggle numbered panels
0         - All panels off
H         - Help overlay
Q / ESC   - Quit
P         - Pause
```

### Future: Gamepad Simulation

When no physical gamepad connected, keyboard can simulate:

```
W A S D → Gamepad Player0 Left Stick
I J K L → Gamepad Player0 Right Stick
Arrows  → D-pad
Z X C   → A B X buttons
```

---

## Testing the New System

### Quick Test

```bash
cd /Users/mricos/src/devops/tetra/bash/game
source ~/tetra/tetra.sh
source game.sh
game quadrapole-gfx

# In-game:
1  # Show debug info - see "Gamepad: YES"
2  # Show event log - see your inputs logged
3  # Show player stats - see your PUID
h  # Show help with new panel info
```

### Event Log Test

1. Press `2` to enable event log
2. Move gamepad sticks - see GAMEPAD events
3. Press buttons - see button events
4. Press keyboard keys - see KEYBOARD events
5. Each event shows:
   - Type (GAMEPAD/KEYBOARD/SYSTEM)
   - Username (Player0, etc.)
   - Age in milliseconds
   - Event data

### Player Stats Test

1. Press `3` to enable player stats
2. Move gamepad - player status becomes "ACTIVE"
3. Wait 5 seconds - status returns to "idle"
4. See your PUID (hex format)
5. Score/tokens currently always 0 (no gameplay logic yet)

---

## Architecture

### Data Flow

```
Physical Input
      ↓
SDL2 / Keyboard
      ↓
log_event() ───→ Circular Buffer
      ↓               ↓
Game Logic      Panel 2 Display
      ↓
PUID_Account Update
      ↓
Panel 3 Display
```

### Panel Rendering Order

```c
render_frame() {
    // 1. Game graphics (pulsars, etc.)
    draw_sprites();

    // 2. Help overlay (if enabled)
    draw_help_hud();

    // 3. Numbered panels (if enabled)
    draw_panel_1_debug();
    draw_panel_2_event_log();
    draw_panel_3_player_stats();
}
```

### Panel State Management

```c
static int panel_flags = 0;  // Bitfield: bit N = panel N+1

// Toggle panel 1
panel_flags ^= (1 << 0);  // Flip bit 0

// Check if panel 2 enabled
if (panel_flags & (1 << 1)) {
    draw_panel_2();
}
```

---

## Benefits

### For Players

✓ **Clean UI**: Toggle only what you need
✓ **No flashing**: Panels update smoothly, not on every input
✓ **Debug friendly**: Panel 1 shows connection status
✓ **Event visibility**: See exactly what engine receives

### For Developers

✓ **Free keyboard**: WASD available for gameplay
✓ **Extensible**: Add panels 4-9 as needed
✓ **Observable**: All inputs logged for debugging
✓ **Multi-player ready**: PUID system supports 4 players

### For Future Features

✓ **Gamepad sim**: Keyboard → synthetic gamepad events
✓ **Replay system**: Event log → replay file
✓ **Analytics**: PUID → player behavior tracking
✓ **Leaderboards**: PUID → persistent scores

---

## Future Panels (Ideas)

| Key | Panel | Purpose |
|-----|-------|---------|
| `4` | Performance | Frame times, memory usage, GC stats |
| `5` | Network | Latency, packet loss, sync state |
| `6` | Physics | Collision debugging, force vectors |
| `7` | Audio | Active sounds, mixer levels |
| `8` | Scripting | Lua/JS console output |
| `9` | Developer | Custom per-game debug info |

---

## Files Modified

```
engine/src/pulsar.c
├── Event system (lines 60-93)
├── PUID system (lines 69-77)
├── Panel functions (lines 408-472)
├── Event logging (lines 137-147, 204-221)
└── Keyboard handler (lines 679-703)

core/pulsar.sh
└── Auto-connect gamepad socket (lines 63-75)
```

## Summary

The numbered panel system provides:
- **Organized UI**: 1-9 for panels, letters for gameplay
- **Event transparency**: See all input events in real-time
- **User context**: Anonymous PUIDs track per-player data
- **Extensible foundation**: Ready for persistent accounts, leaderboards, social features

Press `1`, `2`, `3` in your game to see it in action! 🎮
