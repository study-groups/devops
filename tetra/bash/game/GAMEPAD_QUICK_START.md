# Gamepad Quick Start Guide

## TL;DR

```bash
# One-time setup
brew install sdl2
cd ~/tetra/bash/game
./gamepad setup

# Check status
./gamepad status

# Test input
./gamepad test
```

## System Architecture

```
Physical Gamepad
      ↓
SDL2 (sender.c)
      ↓
Unix Domain Socket (/tmp/gamepad.sock)
      ↓
Pulsar Engine (receives datagrams)
      ↓
Game Logic
```

## Components

### 1. sender.c (SDL2 Gamepad Reader)
- Detects up to 4 gamepads
- Hot-plug support (connect/disconnect while running)
- Sends binary datagrams via Unix domain socket
- Built automatically by discovery system

### 2. gamepad_discovery.sh (Auto-Setup)
- Checks if SDL2 installed
- Scans for connected gamepads
- Builds sender tool if needed
- Prepares socket path
- Starts sender in background

### 3. gamepad Command (CLI)
- `./gamepad setup` - One command to rule them all
- `./gamepad status` - Check what's working
- `./gamepad test` - See live input
- `./gamepad stop` - Clean shutdown

## Setup Steps

### Step 1: Install SDL2

```bash
brew install sdl2
```

Verify:
```bash
sdl2-config --version
# Should show: 2.x.x
```

### Step 2: Connect Gamepad

**Xbox Controller:**
- USB: Just plug in
- Wireless: Press pairing button, connect via Bluetooth

**PlayStation DualShock 4:**
- Hold PS + Share until light flashes
- Connect via Bluetooth

**Verify detection:**
```bash
system_profiler SPUSBDataType | grep -i game
# or
ioreg -c IOHIDDevice -r | grep -i game -A 5
```

### Step 3: Run Auto-Setup

```bash
cd ~/tetra/bash/game
./gamepad setup
```

Expected output:
```
=== Gamepad Auto-Discovery ===

✓ SDL2 installed: 2.30.0

Scanning for gamepads...
✓ Gamepad(s) detected:
    Product: Xbox Wireless Controller

✓ Gamepad tool ready

✓ Ready for socket: /tmp/gamepad.sock
✓ Gamepad sender started (PID: 12345)

✓ Gamepad system ready!
  Socket: /tmp/gamepad.sock
  Player ID: 0
  Sender PID: 12345
```

### Step 4: Test Input

```bash
./gamepad test
```

This will check if the sender is running. To actually see gamepad input, you need to run the Pulsar engine which receives the datagrams:

```bash
cd engine
echo "OPEN_SOCKET /tmp/gamepad.sock" | ./bin/pulsar
```

Move sticks and press buttons in the engine to see the pulsars respond.

## Using with Pulsar Engine

Once setup, connect the engine to the socket:

```bash
# In your game script
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/game/game.sh"

# Setup gamepad
./gamepad setup

# Start engine (will receive datagrams)
game quadrapole-gfx
```

Or manually:
```bash
# Terminal 1: Start gamepad sender
./gamepad start

# Terminal 2: Start engine
cd engine
(
    echo "INIT 80 24"
    echo "SPAWN_PULSAR 80 48 18 6 0.5 0.6 0"
    echo "OPEN_SOCKET /tmp/gamepad.sock"
    echo "RUN 60"
) | ./bin/pulsar
```

## Troubleshooting

### "SDL2 not installed"

```bash
brew install sdl2
```

### "No gamepads detected"

1. Check physical connection
2. For wireless: ensure paired in Bluetooth settings
3. Verify with: `system_profiler SPUSBDataType | grep -i game`
4. Try hot-plug: connect gamepad AFTER running `./gamepad setup`

### "Failed to build sender tool"

```bash
# Check SDL2
sdl2-config --cflags --libs

# Try manual build
cd tools
make clean && make
```

### "Socket already exists"

```bash
# Clean up old socket
./gamepad stop
```

### Gamepad detected but no input

1. Press buttons to wake gamepad
2. Check debug mode: run engine with `d` key pressed
3. Verify sender is running:
   ```bash
   ./gamepad status
   ```
4. Check sender logs for errors in the console where you ran setup

## Advanced

### Custom Socket Path

```bash
export GAME_INPUT_SOCKET="/tmp/my_custom.sock"
./gamepad setup
```

### Multiple Players

The system supports up to 4 gamepads automatically. Each sender instance can handle all connected gamepads, with hot-plug support:

- Player 0: First gamepad connected
- Player 1: Second gamepad connected
- etc.

All events include player ID in the datagram message structure.

### Hot-Plug Support

You can connect/disconnect gamepads while the sender is running. The SDL2 system will automatically detect changes and the sender will output messages like:
```
[GAMEPAD] Added controller 1: Xbox Wireless Controller
[GAMEPAD] Removed controller 0
```

### Binary Protocol

The datagram format uses a binary structure:
```c
struct gp_msg {
    uint32_t version;     // = 1
    uint32_t player_id;
    uint32_t seq;
    uint32_t buttons;     // bitfield
    int16_t  axes[6];     // [-32768,32767]: LX, LY, RX, RY, LT, RT
    uint16_t n_axes;
    uint64_t t_mono_ns;   // CLOCK_MONOTONIC timestamp
};
```

## Status Check

```bash
./gamepad status
```

Example output:
```
=== Gamepad Status ===
SDL2: ✓ 2.30.0
Tool: ✓ /path/to/sender
Socket: ✓ /tmp/gamepad.sock
Sender: ✓ Running (PID: 12345)

Connected Gamepads:
  Xbox Wireless Controller
  DUALSHOCK 4 Wireless Controller
```

## Files

```
bash/game/
├── gamepad                          # CLI command
├── tools/
│   ├── sender.c                     # SDL2 gamepad sender (C)
│   ├── Makefile                     # Build system
│   └── gamecontrollerdb.txt         # SDL2 mappings (optional)
├── core/input/
│   └── gamepad_discovery.sh         # Auto-setup system
├── engine/src/
│   └── pulsar.c                     # Engine with datagram receiver
└── GAMEPAD_QUICK_START.md          # This file
```

## Summary

1. **Install SDL2:** `brew install sdl2`
2. **Connect gamepad:** USB or Bluetooth
3. **Run setup:** `./gamepad setup`
4. **Test:** `./gamepad test`
5. **Play:** Start your game, gamepad input flows automatically

That's it! The system handles detection, building, FIFO creation, and background reader management.
