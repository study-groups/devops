# Gamepad FIFO Protocol

## Overview

Simple text-based protocol for sending gamepad input via a named pipe (FIFO).

**Benefits:**
- Language agnostic (any tool can write to pipe)
- C engine just reads lines
- Easy to test with `echo` commands
- Can swap input sources without recompiling

## Protocol Format

One event per line, newline-terminated:

```
AXIS <player_id> <axis_index> <value>
BUTTON <player_id> <button_index> <0|1>
HAT <player_id> <hat_index> <x> <y>
```

### Values

- **player_id**: 0-3 (supports up to 4 players)
- **axis_index**: 0-7 (0=LX, 1=LY, 2=RX, 3=RY, 4=LT, 5=RT, ...)
- **value**: -1.0 to 1.0 (float, 3 decimal places)
- **button_index**: 0-15
- **button_state**: 0 (released) or 1 (pressed)
- **hat**: D-pad (-1, 0, or 1 for each axis)

## Examples

```bash
# Left stick right (player 0)
AXIS 0 0 0.534

# Left stick up (player 0)
AXIS 0 1 -0.820

# Right stick centered (player 0)
AXIS 0 2 0.000
AXIS 0 3 0.000

# A button pressed (player 0)
BUTTON 0 0 1

# A button released (player 0)
BUTTON 0 0 0

# D-pad right (player 0)
HAT 0 0 1 0

# Player 1 left stick
AXIS 1 0 -0.654
AXIS 1 1 0.234
```

## Standard Axis Mapping

Based on Xbox/PlayStation controller layout:

```
0 = Left Stick X  (-1.0 left, +1.0 right)
1 = Left Stick Y  (-1.0 up, +1.0 down)
2 = Right Stick X
3 = Right Stick Y
4 = Left Trigger  (0.0 released, +1.0 pressed)
5 = Right Trigger
```

## Standard Button Mapping

```
0 = A / Cross (✕)
1 = B / Circle (○)
2 = X / Square (□)
3 = Y / Triangle (△)
4 = Left Shoulder (LB/L1)
5 = Right Shoulder (RB/R1)
6 = Back / Select
7 = Start / Options
8 = Left Stick Click (L3)
9 = Right Stick Click (R3)
```

## FIFO Setup

### Create Pipe

```bash
GAME_FIFO="/tmp/pulsar_input"
mkfifo "$GAME_FIFO"
```

### Writer Side (Gamepad Tool)

```bash
# Any tool writes to pipe
while read_gamepad; do
    echo "AXIS 0 0 $left_x" > "$GAME_FIFO"
    echo "AXIS 0 1 $left_y" > "$GAME_FIFO"
done
```

### Reader Side (C Engine)

```c
FILE *fifo = fopen("/tmp/pulsar_input", "r");
char line[256];

while (fgets(line, sizeof(line), fifo)) {
    if (strncmp(line, "AXIS", 4) == 0) {
        int player, axis;
        float value;
        sscanf(line, "AXIS %d %d %f", &player, &axis, &value);
        handle_axis(player, axis, value);
    }
    else if (strncmp(line, "BUTTON", 6) == 0) {
        int player, button, state;
        sscanf(line, "BUTTON %d %d %d", &player, &button, &state);
        handle_button(player, button, state);
    }
}
```

## Test Without Gamepad

```bash
# Mock input for testing
GAME_FIFO="/tmp/pulsar_input"

# In one terminal (run engine)
./bin/pulsar

# In another terminal (send fake input)
echo "AXIS 0 0 0.5" > "$GAME_FIFO"
echo "AXIS 0 1 -0.3" > "$GAME_FIFO"
echo "BUTTON 0 0 1" > "$GAME_FIFO"
echo "BUTTON 0 0 0" > "$GAME_FIFO"
```

## Dual-Stick Control Protocol

For Mode 1 (one player, two pulsars):

```
AXIS 0 0 <value>  # Left stick X  → Pulsar A
AXIS 0 1 <value>  # Left stick Y  → Pulsar A
AXIS 0 2 <value>  # Right stick X → Pulsar B
AXIS 0 3 <value>  # Right stick Y → Pulsar B
BUTTON 0 4 1      # Left shoulder → Plasmic-thumb activate
```

## Multiplayer Protocol

Each player gets their own player_id:

```
# Player 0
AXIS 0 0 0.5
AXIS 0 1 -0.3

# Player 1
AXIS 1 0 -0.7
AXIS 1 1 0.2

# Player 2
AXIS 2 0 0.1
AXIS 2 1 0.9
```

## Error Handling

**Invalid lines:** Silently ignored

**Out of range values:** Clamped to valid range
- Axes: [-1.0, 1.0]
- Buttons: [0, 1]

**Unknown player_id:** Ignored (only 0-3 valid)

## Performance

- Text protocol overhead is minimal (~20 bytes per event)
- At 60 FPS, 2 sticks = 240 events/sec = ~5KB/sec
- FIFO buffering handles bursts
- Non-blocking reads prevent engine stalls

## Implementation Files

```
core/input/fifo_protocol.h    - C header with protocol definitions
core/input/fifo_reader.c       - C implementation for engine
core/input/gamepad_writer.sh  - Bash wrapper for any gamepad tool
tools/sdl_gamepad.c            - SDL2-based gamepad→FIFO writer (optional)
demos/test_fifo_input.sh       - Mock input tester
```

## Alternative Input Sources

Since it's just a text protocol, you can use:

1. **SDL2 tool** (C binary that reads gamepad, writes to FIFO)
2. **Python script** (pygame → FIFO)
3. **Keyboard emulation** (WASD → fake stick values)
4. **Network bridge** (receive input over socket, write to FIFO)
5. **Replay file** (cat recording.txt > FIFO)
6. **AI agent** (computed values → FIFO)

## Extensions

Future protocol additions (backward compatible):

```
ANALOG <player_id> <control_id> <value>  # Generic analog input
TRIGGER <player_id> <trigger_id> <value> # Explicit trigger values
GYRO <player_id> <x> <y> <z>             # Motion controls
TOUCH <player_id> <x> <y> <pressure>     # Touchpad
```

## Example Session

```bash
# Terminal 1: Start engine
cd ~/tetra/bash/game/engine
mkfifo /tmp/pulsar_input
./bin/pulsar < /tmp/pulsar_input

# Terminal 2: Send input
while true; do
    # Circular motion
    echo "AXIS 0 0 $(bc -l <<< "s($t)")"
    echo "AXIS 0 1 $(bc -l <<< "c($t)")"
    t=$(bc -l <<< "$t + 0.1")
    sleep 0.016
done > /tmp/pulsar_input
```

Simple, testable, flexible!
