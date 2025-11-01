# TCurses - Tetra Curses Library

A lightweight, pure-bash ncurses-like library for building terminal user interfaces (TUIs) with animation support.

## Features

- **Raw Terminal Input**: Character-by-character input handling with proper signal control
- **Screen Management**: Alternate buffer, cursor control, terminal state management
- **Double Buffering**: Efficient rendering with differential updates
- **Animation Loop**: Frame-paced updates with FPS control
- **BPM Synchronization**: Beat-synchronized animations for musical/rhythmic UIs
- **Multiplexed Input**: Support for keyboard and external input sources (e.g., gamepad)
- **Zero Dependencies**: Pure bash, works with bash 5.2+

## Quick Start

```bash
#!/usr/bin/env bash

source tcurses.sh

# Initialize
tcurses_init 30 120  # 30 FPS, 120 BPM
tcurses_setup_cleanup_trap

# Render callback
render_frame() {
    local first="$1"
    tcurses_buffer_clear
    tcurses_buffer_write_line 0 "Hello, TCurses!"
    tcurses_buffer_write_line 1 "Press 'q' to quit"

    if [[ "$first" == "true" ]]; then
        tcurses_buffer_render_full
    else
        tcurses_buffer_render_diff
    fi
}

# Input callback
handle_input() {
    local key="$1"
    case "$key" in
        'q'|'Q') return 1 ;;  # Exit loop
    esac
    return 0
}

# Run
tcurses_animation_enable
tcurses_main_loop render_frame handle_input
```

## Architecture

TCurses is organized into focused modules:

### Core Modules

1. **tcurses_screen.sh** - Terminal setup and screen control
   - Initialize/cleanup terminal
   - Alternate buffer management
   - Cursor control
   - Terminal dimension queries

2. **tcurses_input.sh** - Keyboard input handling
   - Raw character input with timeout
   - Escape sequence processing (arrow keys, etc.)
   - Multiplexed input (keyboard + pipe)
   - Key code constants and utilities

3. **tcurses_buffer.sh** - Double buffering
   - Line-based front/back buffers
   - Full screen rendering
   - Differential updates (only changed lines)
   - VSync rendering for flicker-free animation

4. **tcurses_animation.sh** - Animation loop
   - Frame timing and FPS control
   - BPM synchronization
   - Beat phase tracking
   - Performance monitoring
   - Waveform generators (sine, triangle, square)

5. **tcurses.sh** - Main entry point
   - Unified initialization
   - Pre-built event loops
   - Convenience functions

## API Reference

### Initialization

```bash
# Initialize TCurses with FPS and BPM
tcurses_init [FPS] [BPM]

# Set up automatic cleanup on exit
tcurses_setup_cleanup_trap

# Clean up manually
tcurses_cleanup
```

### Screen Management

```bash
# Get terminal dimensions
tcurses_screen_size           # Returns "HEIGHT WIDTH"
tcurses_screen_height         # Returns HEIGHT
tcurses_screen_width          # Returns WIDTH

# Update cached dimensions (call after window resize)
tcurses_screen_update_size

# Cursor control
tcurses_screen_move_cursor ROW COL
tcurses_screen_hide_cursor
tcurses_screen_show_cursor
tcurses_screen_save_cursor
tcurses_screen_restore_cursor

# Screen operations
tcurses_screen_clear
```

### Input Handling

```bash
# Read single key with timeout
tcurses_input_read_key [TIMEOUT]

# Read key (blocking)
tcurses_input_read_key_blocking

# Read full line (REPL mode)
tcurses_input_read_line [PROMPT]

# Multiplexed input (keyboard + pipe)
tcurses_input_read_multiplexed TIMEOUT [PIPE_FD]

# Key utilities
tcurses_input_is_arrow_key KEY
tcurses_input_is_control_key KEY
tcurses_input_key_name KEY
```

#### Key Constants

```bash
$TCURSES_KEY_UP
$TCURSES_KEY_DOWN
$TCURSES_KEY_LEFT
$TCURSES_KEY_RIGHT
$TCURSES_KEY_ESC
$TCURSES_KEY_ENTER
$TCURSES_KEY_CTRL_C
$TCURSES_KEY_CTRL_D
$TCURSES_KEY_CTRL_Z
$TCURSES_KEY_BACKSPACE
$TCURSES_KEY_TAB
```

### Double Buffering

```bash
# Initialize buffer
tcurses_buffer_init [HEIGHT] [WIDTH]

# Write to back buffer
tcurses_buffer_clear
tcurses_buffer_write_line LINE_NUM TEXT
tcurses_buffer_write_at LINE COL TEXT

# Render to screen
tcurses_buffer_render_full      # Render entire screen
tcurses_buffer_render_diff      # Render only changes
tcurses_buffer_render_vsync     # Diff render with cursor hiding

# Advanced
tcurses_buffer_blit SRC_LINE SRC_COL WIDTH HEIGHT DST_LINE DST_COL
```

### Animation

```bash
# Control animation
tcurses_animation_enable
tcurses_animation_disable
tcurses_animation_toggle
tcurses_animation_pause
tcurses_animation_resume

# Configure timing
tcurses_animation_set_fps FPS
tcurses_animation_set_bpm BPM

# Query state
tcurses_animation_get_fps
tcurses_animation_get_bpm
tcurses_animation_get_frame_time
tcurses_animation_get_status
tcurses_animation_should_tick

# BPM synchronization
tcurses_animation_get_beat_phase    # 0.0 to 1.0
tcurses_animation_get_beat_count
tcurses_animation_beat_sine         # -1.0 to 1.0
tcurses_animation_beat_triangle     # -1.0 to 1.0
tcurses_animation_beat_square       # -1.0 or 1.0

# Performance tracking
tcurses_animation_record_frame
tcurses_animation_get_avg_fps
tcurses_animation_get_stats
tcurses_animation_check_performance
```

### Main Loops

```bash
# Full-featured loop with animation
tcurses_main_loop RENDER_CALLBACK INPUT_CALLBACK [TICK_CALLBACK]

# Simple loop (no animation)
tcurses_simple_loop RENDER_CALLBACK INPUT_CALLBACK
```

## Examples

### Minimal TUI

```bash
#!/usr/bin/env bash
source tcurses.sh

tcurses_init
tcurses_setup_cleanup_trap

render() {
    tcurses_buffer_clear
    tcurses_buffer_write_line 0 "Hello World!"
    tcurses_buffer_render_full
}

input() {
    [[ "$1" == "q" ]] && return 1
    return 0
}

tcurses_simple_loop render input
```

### Animated TUI with BPM

```bash
#!/usr/bin/env bash
source tcurses.sh

tcurses_init 30 120
tcurses_setup_cleanup_trap
tcurses_animation_enable

render() {
    tcurses_buffer_clear

    # BPM-synchronized pulsing
    local phase=$(tcurses_animation_get_beat_phase)
    local intensity=$(tcurses_animation_beat_sine)

    tcurses_buffer_write_line 0 "Beat: $phase | Intensity: $intensity"

    [[ "$1" == "true" ]] && tcurses_buffer_render_full || tcurses_buffer_render_diff
}

tick() {
    # Called on each animation frame
    :
}

input() {
    case "$1" in
        'q') return 1 ;;
        ' ') tcurses_animation_toggle ;;
    esac
    return 0
}

tcurses_main_loop render input tick
```

### Multi-region Layout

```bash
render() {
    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)

    tcurses_buffer_clear

    # Header
    tcurses_buffer_write_line 0 "╔$(printf '═%.0s' $(seq 1 $((width-2))))╗"
    tcurses_buffer_write_line 1 "║ My Application $(printf ' %.0s' $(seq 1 $((width-20))))║"
    tcurses_buffer_write_line 2 "╚$(printf '═%.0s' $(seq 1 $((width-2))))╝"

    # Content (lines 3 to height-3)
    for ((i=3; i<height-3; i++)); do
        tcurses_buffer_write_line $i "  Line $((i-2))"
    done

    # Footer
    tcurses_buffer_write_line $((height-2)) "╔$(printf '═%.0s' $(seq 1 $((width-2))))╗"
    tcurses_buffer_write_line $((height-1)) "║ Press 'q' to quit $(printf ' %.0s' $(seq 1 $((width-23))))║"

    [[ "$1" == "true" ]] && tcurses_buffer_render_full || tcurses_buffer_render_diff
}
```

## Dependencies

### Required

- **Bash 5.2+**: TCurses requires modern Bash features
  - macOS: `brew install bash`
  - Linux: Usually pre-installed, or `apt install bash`

### Optional

- **rlwrap**: Enhanced readline editing for REPL-style apps
  - Provides command history, line editing, history search
  - macOS: `brew install rlwrap`
  - Ubuntu: `sudo apt install rlwrap`
  - Fedora: `sudo dnf install rlwrap`
  - Arch: `sudo pacman -S rlwrap`

TCurses will warn on startup if rlwrap is not found, but will work without it.

### Using rlwrap with TCurses

rlwrap wraps entire programs, not individual functions. To use it:

```bash
# Wrap your entire tcurses script
rlwrap ./my_tcurses_app.sh

# Or use the helper function
tcurses_input_with_rlwrap ./my_tcurses_app.sh
```

For line input within tcurses apps, use `tcurses_input_read_line`:

```bash
# Auto-managed ephemeral history (uses /tmp/tcurses/repl/<pid>/history)
line=$(tcurses_input_read_line "> ")

# Module-managed persistent history
line=$(tcurses_input_read_line "> " "$TETRA_DIR/qa/history")
line=$(tcurses_input_read_line "> " "$TETRA_DIR/rag/history")

# Each REPL instance gets isolated history in /tmp
# Cleaned up on reboot, isolated by PID
```

## Terminal Input Details

### Why TCurses Works

TCurses configures the terminal for **raw mode** using:

```bash
stty -echo -icanon -isig min 0 time 0 </dev/tty
```

**Flags explained**:
- `-echo`: Don't echo typed characters
- `-icanon`: Disable line buffering (char-by-char input)
- `-isig`: Disable signal generation (Ctrl-C becomes `\x03`)
- `min 0`: `read()` returns immediately
- `time 0`: No inter-character timeout

This allows:
- Immediate keystroke detection
- Application-level Ctrl-C handling
- Escape sequence processing
- Frame-paced input polling

### Signal Handling

With `-isig`, control keys become regular characters:
- Ctrl-C → `\x03` (can be handled in your input callback)
- Ctrl-Z → `\x1a` (won't suspend process)
- Ctrl-D → `\x04` (won't send EOF)

Your application controls all behavior.

## Performance

### Frame Timing

TCurses uses high-precision timing:
- Frame time calculated from FPS: `1.0 / FPS`
- Input timeout matches frame time
- Animation updates only when needed

### Differential Rendering

Only changed lines are redrawn:
- Initial render: Full screen
- Subsequent renders: Diff only
- VSync mode: Hides cursor during update

### BPM Synchronization

Beat phase is tracked continuously:
- Phase wraps from 0.0 to 1.0
- Beat count increments on phase wrap
- Waveform generators use phase for smooth animation

## Debugging

### Check Terminal State

```bash
tcurses_screen_debug_state
```

### Monitor Key Codes

```bash
tcurses_input_debug_keys  # Interactive key code viewer
```

### View Buffer Contents

```bash
tcurses_buffer_debug front
tcurses_buffer_debug back
```

### Performance Stats

```bash
tcurses_animation_get_stats
# Output: FPS: 29.8/30 | Frames: 1234 | Beats: 41 | Phase: 0.67
```

## macOS Compatibility

TCurses is designed for macOS (bash 5.2+) and explicitly targets `/dev/tty`:
- All `stty` commands use `</dev/tty`
- All `read` commands use `</dev/tty`
- Handles macOS terminal quirks

Should work on Linux too (untested).

## Integration

### With Gamepad Input

```bash
# Open gamepad pipe
exec {GAMEPAD_FD}<>/tmp/gamepad.fifo

# Use multiplexed input
input() {
    local key=$(tcurses_input_read_multiplexed 0.033 "$GAMEPAD_FD")
    # ... handle key
}
```

### With Existing Code

TCurses is modular - use what you need:

```bash
# Just terminal setup
source tcurses_screen.sh
tcurses_screen_init

# Just input handling
source tcurses_input.sh
key=$(tcurses_input_read_key 0.1)

# Full stack
source tcurses.sh
tcurses_init
```

## License

Part of the Tetra project.

## Version

TCurses v1.0.0
