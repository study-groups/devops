# Pulsar OSC Mode

## Overview

Pulsar now supports **OSC (Open Sound Control) mode** - a simple, robust way to control the game via MIDI without any fragile socket connections!

## Architecture

```
MIDI Controller
     ↓
  midi.js (with --map option)
     ↓
  OSC Multicast (224.0.0.1:1983)
     ↓
  pulsar --osc
     ↓
  Terminal Animation
```

### Key Benefits

✅ **No stale sockets** - Uses UDP multicast, no connection state
✅ **No PID discovery** - Everything listens on 1983
✅ **Resilient to crashes** - No cleanup needed
✅ **Multiple listeners** - Any number of apps can receive same MIDI
✅ **Simple setup** - Just run `pulsar --osc` and `midi.js`

## Quick Start

### 1. Start midi.js with pulsar map

```bash
cd $TETRA_SRC/bash/midi
node midi.js -i "Your MIDI Controller" \
  --map maps/pulsar[0].json -v
```

### 2. Start pulsar in OSC mode

```bash
cd $TETRA_SRC/bash/game/games/pulsar
./run_osc.sh
```

### 3. Move your MIDI controls!

The pulsar sprite will auto-spawn and respond to your controls.

## Control Mapping

Default mapping (variant 'a'):

| CC  | Control | Semantic   | Effect                          |
|-----|---------|------------|---------------------------------|
| 40  | k1      | speed      | Rotation speed (0-1)            |
| 41  | k2      | intensity  | Pulse frequency (0-1)           |
| 42  | k3      | x          | X position (normalized 0-1)     |
| 43  | k4      | y          | Y position (normalized 0-1)     |
| 44  | k5      | size       | Amplitude/size (0-1)            |

## How It Works

### midi.js Side

1. Reads MIDI events from your controller
2. Maps CC values through `maps/pulsar[0].json`
3. Broadcasts OSC messages like:
   ```
   /midi/mapped/a/speed 0.65
   /midi/mapped/a/intensity 0.42
   /midi/mapped/a/x 0.5
   ```
4. Sends to multicast group 224.0.0.1:1983

### pulsar Side

1. Joins multicast group 224.0.0.1:1983
2. Receives OSC messages in real-time
3. Auto-spawns a sprite on first control input
4. Maps semantic controls to sprite parameters:
   - `speed` → rotation speed (dtheta)
   - `intensity` → pulse frequency
   - `x`, `y` → position
   - `size` → amplitude

## Customization

### Change Control Mapping

Edit `midi/maps/pulsar[0].json`:

```json
{
  "variants": {
    "a": {
      "mappings": {
        "k1": { "semantic": "speed", "min": 0.0, "max": 2.0 },
        ...
      }
    }
  }
}
```

### Add More Semantic Controls

1. Edit `pulsar/src/pulsar.c` in `process_osc_message()`
2. Add new `else if (strcmp(semantic, "yourcontrol") == 0)` block
3. Map to sprite parameter
4. Rebuild: `cd game/engine && make`

## Comparison to TGP Mode

| Feature                  | TGP Mode (old)          | OSC Mode (new)          |
|--------------------------|-------------------------|-------------------------|
| Connection type          | Unix domain sockets     | UDP multicast           |
| State management         | Stateful (connected)    | Stateless (fire-forget) |
| Stale connections        | Yes, frequent problem   | Never                   |
| PID discovery needed     | Yes                     | No                      |
| Multiple listeners       | No (1:1)                | Yes (broadcast)         |
| Crash recovery           | Manual cleanup needed   | Automatic               |
| Setup complexity         | High                    | Low                     |

## Troubleshooting

### "No OSC messages received"

1. Check midi.js is running with `--map` option
2. Check MIDI controller is connected: `node midi.js -l`
3. Run midi.js with `-v` to see OSC output
4. Verify port 1983 is not blocked by firewall

### "Sprite not responding"

1. Make sure you're using variant 'a' (default)
2. Check CC numbers match your controller
3. Run midi.js with `-v` to see mapped messages

### "Permission denied on socket"

OSC mode uses UDP (no special permissions needed). If you see this, you're probably running in TGP mode by accident.

## Files

- `game/engine/src/osc.c` - OSC parser
- `game/engine/src/osc.h` - OSC header
- `game/engine/src/pulsar.c` - Pulsar engine (line 773+: OSC handler)
- `midi/midi.js` - MIDI→OSC bridge (line 19, 356+: OSC output)
- `midi/maps/pulsar[0].json` - Control mapping
- `game/games/pulsar/run_osc.sh` - Quick start script

## Next Steps

- Add more semantic controls (color, trails, effects)
- Support multiple sprites via OSC channels
- Add OSC control messages (/pulsar/spawn, /pulsar/kill)
- Web viewer using WebSocket→OSC bridge
