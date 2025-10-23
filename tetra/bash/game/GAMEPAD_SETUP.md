# Gamepad Setup Guide

## Current Status

✓ **Gamepads Detected:**
- Xbox 360 Controller (Microsoft GamePad-1)
- DUALSHOCK 4 Wireless Controller

❌ **Input Reading:** Not yet functional - need pygame

## Quick Start

### Install pygame (Required)

```bash
# Install pygame for Python gamepad support
pip3 install pygame

# Or with homebrew Python
/opt/homebrew/bin/pip3 install pygame
```

### Test Gamepad

```bash
# Run Python gamepad reader (outputs stick/button events)
python3 bash/game/core/input/gamepad_reader.py

# Move sticks and press buttons - you should see:
# AXIS 0 0.534    # Left stick X
# AXIS 1 -0.123   # Left stick Y
# BUTTON 0 1      # Button A pressed
# BUTTON 0 0      # Button A released
```

### Run Pulsar Demo with Gamepad

```bash
# Once pygame is installed:
cd ~/tetra/bash/game
./demos/gamepad_pulsar.sh   # (to be created)
```

## Why macOS is Different

### Linux
- Gamepads appear as `/dev/input/js0`, `/dev/input/js1`
- Can read directly with `cat /dev/input/js0`
- Simple file I/O

### macOS
- No `/dev/input/js*` devices
- Must use IOKit framework or Game Controller API
- Options:
  1. **pygame** (easiest, cross-platform)
  2. **SDL2** (C library, good performance)
  3. **IOKit** (native, complex)
  4. **Game Controller framework** (Swift/Obj-C only)

We're using **pygame** because:
- Simple Python API
- Works with Xbox, PlayStation, Nintendo controllers
- Easy to pipe to bash
- Cross-platform

## Gamepad Architecture

```
Gamepad Hardware
     ↓
macOS IOKit/HID
     ↓
pygame (Python)
     ↓
stdout (AXIS/BUTTON events)
     ↓
bash script (parse events)
     ↓
Pulsar C engine (via protocol)
```

## Common Controllers

### Xbox 360/One Controller
- Left Stick: AXIS 0 (X), AXIS 1 (Y)
- Right Stick: AXIS 2 (X), AXIS 3 (Y)
- Triggers: AXIS 4 (LT), AXIS 5 (RT)
- Buttons: 0=A, 1=B, 2=X, 3=Y, 4=LB, 5=RB, 6=Back, 7=Start

### PlayStation DualShock 4
- Left Stick: AXIS 0 (X), AXIS 1 (Y)
- Right Stick: AXIS 2 (X), AXIS 5 (Y)
- Triggers: AXIS 3 (L2), AXIS 4 (R2)
- Buttons: 0=X, 1=O, 2=□, 3=△, 4=L1, 5=R1, 6=L2, 7=R2

## Troubleshooting

### "No gamepads detected"

1. **Check physical connection:**
   ```bash
   system_profiler SPUSBDataType | grep -i game
   ```

2. **Check ioreg:**
   ```bash
   ioreg -c IOHIDDevice -r | grep -i -E "(game|controller)"
   ```

3. **Check System Settings:**
   - Go to System Settings → Game Controllers
   - Your gamepad should appear

### "pygame not installed"

```bash
# Try pip3
pip3 install pygame

# Or homebrew Python
/opt/homebrew/bin/pip3 install pygame

# Or system Python
/usr/bin/python3 -m pip install --user pygame
```

### "Permission denied"

Gamepads should work without special permissions on macOS 10.15+

If issues persist:
```bash
# Grant Terminal "Input Monitoring" permission
# System Settings → Privacy & Security → Input Monitoring → Terminal
```

### Wireless controller won't connect

**DualShock 4:**
1. Hold PS + Share buttons until light bar flashes
2. Go to Bluetooth settings on Mac
3. Pair "Wireless Controller"

**Xbox One:**
1. Press pairing button on controller (top edge)
2. Go to Bluetooth settings
3. Pair "Xbox Wireless Controller"

## Next Steps

Once pygame is installed:

1. Test gamepad reader works
2. Create bash wrapper to parse events
3. Send commands to Pulsar engine
4. Map sticks to pulsar movement
5. Map buttons to actions (boost, grab, etc.)

## Alternative: SDL2 (Advanced)

If you want C-level gamepad support:

```bash
brew install sdl2
brew install sdl2_image sdl2_ttf sdl2_mixer

# Test with:
sdl2-config --version
```

Then modify C engine to link against SDL2 and use `SDL_GameController` API.

## Files

- `core/input/gamepad_reader.py` - Python gamepad→stdout bridge
- `core/input/gamepad_dual.sh` - Bash wrapper (to be created)
- `core/input_detect.sh` - Gamepad detection
- `GAMEPAD_SETUP.md` - This file

## Status Summary

| Component | Status |
|-----------|--------|
| Gamepad detection | ✓ Working |
| pygame installed | ❌ Need to install |
| Input reader | ✓ Created |
| Bash integration | ⏳ Pending |
| Pulsar engine protocol | ⏳ Pending |
| Demo | ⏳ Pending |

**Next:** Install pygame, test gamepad reader, create bash wrapper
