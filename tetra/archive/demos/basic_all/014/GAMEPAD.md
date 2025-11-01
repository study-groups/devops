# Gamepad Control for Tetra TUI

Real-time gamepad input for demo/basic/014 via tetra-4444 server.

## Architecture

```
Physical Gamepad
      ↓
tetra-4444 Server (Node.js)
  ├─ gamepad-handler.js (node-hid)
  ├─ Raw Data API (GET /api/gamepad/raw)
  ├─ Button/Axis Mapping (optional)
  └─ Named Pipe (/tmp/tetra-gamepad.fifo)
      ↓
Bash TUI (demo.sh)
  └─ gamepad_input.sh
      ↓
Multiplexed Input (keyboard + gamepad)
```

## Features

### Optional & Graceful Degradation
- **No gamepad? No problem!** Server and TUI work fine with keyboard only
- Automatically detects gamepad presence
- Falls back to keyboard seamlessly

### Layered Design
1. **Raw Layer**: Physical buttons/axes (0-15, -1.0 to 1.0)
2. **Mapping Layer**: Raw → Keyboard events (configurable)
3. **Semantic Layer**: (Future) Raw → Actions/Commands

### API-First
- `GET /api/gamepad/status` - Check if gamepad is connected
- `GET /api/gamepad/raw` - Get current button/axis state
- Event-based: Subscribe to `button`, `axis`, `raw` events

## Usage

### 1. Start tetra-4444 Server

```bash
source ~/tetra/tetra.sh && tna
cd ~/src/devops/tetra/server
node server.js
```

The server will:
- ✅ Start on port 4443
- 🎮 Detect gamepad (if present)
- 📡 Create named pipe `/tmp/tetra-gamepad.fifo`
- ⌨️  Fall back to keyboard if no gamepad

### 2. Run TUI

```bash
cd ~/src/devops/tetra/demo/basic/014
./demo.sh
```

The TUI will:
- Try to connect to gamepad pipe
- Work with keyboard if gamepad unavailable
- Multiplex inputs (gamepad has priority)

## Button Mapping

Default mapping (configurable in `gamepad-handler.js`):

```
Face Buttons:
  A (0)      → Enter (execute action)
  B (1)      → ESC (back/cancel)
  X (2)      → c (clear content)
  Y (3)      → v (view mode toggle)

Shoulder Buttons:
  L1 (4)     → e (navigate environment)
  R1 (5)     → E (navigate environment reverse)
  L2 (6)     → d (navigate mode)
  R2 (7)     → D (navigate mode reverse)

Special:
  Select (8) → q (quit)
  Start (9)  → h (toggle header size)
  L3 (10)    → o (toggle oscillator)
  R3 (11)    → / (toggle REPL)

D-Pad:
  Up (12)    → ↑ (Arrow up)
  Down (13)  → ↓ (Arrow down)
  Left (14)  → ← (Arrow left)
  Right (15) → → (Arrow right)

Analog Sticks:
  Left X     → a/A (action navigation)
  Left Y     → i/k (action up/down)
  Right X    → ←/→ (oscillator control)
  Right Y    → m/M (mode navigation)
```

## API Examples

### Check Gamepad Status

```bash
curl http://localhost:4443/api/gamepad/status
```

Response (connected):
```json
{
  "available": true,
  "connected": true,
  "timestamp": 1736750000000
}
```

Response (no gamepad):
```json
{
  "available": false,
  "reason": "Gamepad module not initialized"
}
```

### Get Raw State

```bash
curl http://localhost:4443/api/gamepad/raw
```

Response:
```json
{
  "buttons": [false, false, false, ...],
  "axes": [0.0, 0.0, -0.15, 0.8],
  "timestamp": 1736750000000,
  "connected": true
}
```

## Customizing Mappings

### Option 1: Edit Button Map (gamepad-handler.js)

```javascript
const BUTTON_MAP = {
  0: '\n',      // A -> Enter
  1: '\x1b',    // B -> ESC
  // ... customize here
};
```

### Option 2: Disable Mapping, Use Raw Data

Start server with raw-only mode:

```javascript
gamepadHandler = new GamepadHandler({
  optional: true,
  pipe: false,      // Disable pipe
  mapping: false    // Raw data only
});

// Subscribe to raw events
gamepadHandler.on('button', (data) => {
  console.log(`Button ${data.button} pressed`);
  // Custom logic here
});
```

### Option 3: Add Semantic Layer (Future)

```javascript
// In your application code
gamepadHandler.on('button', (data) => {
  const semanticAction = mapButtonToAction(data.button, currentContext);
  executeAction(semanticAction);
});
```

## Troubleshooting

### Gamepad Not Detected

1. Check permissions (macOS):
   ```bash
   # May need to allow terminal to access input devices
   System Settings → Privacy & Security → Input Monitoring
   ```

2. List HID devices:
   ```bash
   node -e "console.log(require('node-hid').devices())"
   ```

3. Check logs:
   ```bash
   # Server will log gamepad status on startup
   node server.js
   # Look for: "🎮 Connecting to: [gamepad name]"
   ```

### Named Pipe Issues

If the pipe doesn't work:

```bash
# Remove stale pipe
rm /tmp/tetra-gamepad.fifo

# Restart server (it will recreate)
node server.js
```

### Input Not Working

1. Check server is running: `curl http://localhost:4443/health`
2. Check gamepad status: `curl http://localhost:4443/api/gamepad/status`
3. Test pipe manually:
   ```bash
   # In one terminal
   cat /tmp/tetra-gamepad.fifo

   # Press gamepad buttons, you should see characters appear
   ```

## Files

- `server/gamepad-handler.js` - Node.js gamepad handler with API
- `server/server.js` - Integration into tetra-4444
- `demo/basic/014/bash/tui/gamepad_input.sh` - Bash pipe reader
- `demo/basic/014/demo.sh` - TUI with multiplexed input

## Future Enhancements

- [ ] WebSocket streaming for real-time gamepad state to browser
- [ ] Multiple gamepad support (player 1, 2, etc.)
- [ ] Configurable mappings via API/config file
- [ ] Semantic action layer (button → context-aware commands)
- [ ] Gamepad calibration UI
- [ ] Rumble/force feedback support
- [ ] Recording/playback for macros
