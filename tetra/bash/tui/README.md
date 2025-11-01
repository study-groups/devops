# Tetra TUI Library

**Version:** 1.0.0
**Type:** Tetra Core Library
**Status:** Stable

---

## Overview

The Tetra TUI (Terminal User Interface) library is the unified, canonical system for building terminal-based applications in Tetra. It consolidates the best features from:

- **bash/tcurses** (production v1.0.0) - Terminal control and double buffering
- **demo/basic/014** - Modern TUI patterns and components
- **bash/repl** - Universal REPL integration

## Key Features

✅ **Double Buffering** - Flicker-free rendering with differential updates
✅ **Animation System** - BPM-synchronized animations with musical timing
✅ **REPL Integration** - Seamless integration with bash/repl
✅ **Input Handling** - Robust keyboard input with escape sequences
✅ **Component System** - Reusable header, footer, and modal components
✅ **Terminal Management** - Safe terminal setup/cleanup with state restoration

## Installation

Source the main entry point in your script:

```bash
source ~/tetra/tetra.sh  # Always source tetra first
source "$TETRA_SRC/bash/tui/tui.sh"
```

## Dependencies

- **Required:** Bash 5.2+, TETRA_SRC environment variable
- **Optional:** None (all features are self-contained)

## Quick Start

### Minimal Example

```bash
#!/usr/bin/env bash
source ~/tetra/tetra.sh
source "$TETRA_SRC/bash/tui/tui.sh"

# Initialize
tui_init 30 120  # 30 FPS, 120 BPM

# Setup cleanup trap
trap 'tui_cleanup' EXIT INT TERM

# Main loop
while true; do
    # Clear buffer
    tui_buffer_clear

    # Write content
    tui_buffer_write_line 0 "Hello from Tetra TUI!"
    tui_buffer_write_line 1 "Press 'q' to quit"

    # Render
    tui_buffer_render_diff

    # Read input
    local key=$(tui_read_key 0.1)
    [[ "$key" == "q" ]] && break
done
```

### Complete Example with Animation

See `demo/basic/014/demo.sh` for a comprehensive example showing:
- Full screen layout with header, content, separator, and footer
- BPM-synchronized animations
- State management
- Action system
- REPL integration

## Architecture

```
bash/tui/
├── tui.sh                    # Main entry point
├── core/
│   ├── screen.sh            # Terminal setup & screen control
│   ├── input.sh             # Keyboard input handling
│   ├── buffer.sh            # Double buffering system ⭐
│   └── animation.sh         # Animation & timing
├── components/
│   ├── modal.sh             # Modal dialogs
│   ├── header.sh            # Header component (from demo 014)
│   └── footer.sh            # Footer with log display
└── integration/
    ├── repl.sh              # REPL integration ⭐
    └── actions.sh           # Action system integration
```

## API Reference

### Core Functions

#### Initialization

```bash
tui_init [FPS] [BPM]
```
Initialize TUI system. Sets up terminal, buffer, animation, and input.
- **FPS**: Frames per second (default: 30)
- **BPM**: Beats per minute for animation sync (default: 120)
- **Returns**: 0 on success, 1 on failure

```bash
tui_cleanup
```
Cleanup and restore terminal state. Always call on exit.

```bash
tui_is_initialized
```
Check if TUI is initialized.
- **Returns**: 0 if initialized, 1 otherwise

### Screen Operations

```bash
tui_screen_size
```
Get terminal dimensions.
- **Output**: "HEIGHT WIDTH" (space-separated)

```bash
tui_screen_height
```
Get terminal height.

```bash
tui_screen_width
```
Get terminal width.

```bash
tui_screen_clear
```
Clear entire screen.

```bash
tui_screen_move_cursor ROW COL
```
Move cursor to position (1-based).

### Buffer Operations (Double Buffering)

```bash
tui_buffer_clear
```
Clear back buffer (prepare for new frame).

```bash
tui_buffer_write_line LINE_NUM TEXT
```
Write a line to back buffer.
- **LINE_NUM**: 0-based line number
- **TEXT**: Text to write (can contain ANSI codes)

```bash
tui_buffer_write_at LINE COL TEXT
```
Write text at specific position in back buffer.
- **LINE**: Line number (1-based)
- **COL**: Column number (1-based)
- **TEXT**: Text to write

```bash
tui_buffer_render_full
```
Render entire screen (back buffer → screen).
Use on first render.

```bash
tui_buffer_render_diff
```
Render only changed lines (differential update).
Use for subsequent frames - much faster!

```bash
tui_buffer_render_vsync
```
Render with vsync (differential + cursor hide/restore).
Optimal for animations.

### Input Operations

```bash
tui_read_key [TIMEOUT]
```
Read a single key with timeout.
- **TIMEOUT**: Timeout in seconds (default: 0.05)
- **Returns**: 0 if key read, 1 if timeout
- **Output**: The key character(s) read

```bash
tui_read_key_blocking
```
Read a single key (blocking, no timeout).
- **Output**: The key character(s) read

```bash
tui_read_line [PROMPT] [HISTORY_FILE]
```
Read a line of text with editing support.
- **PROMPT**: Optional prompt string
- **HISTORY_FILE**: Optional history file path
- **Output**: The line read

#### Key Constants

```bash
$TCURSES_KEY_UP         # Up arrow: \x1b[A
$TCURSES_KEY_DOWN       # Down arrow: \x1b[B
$TCURSES_KEY_LEFT       # Left arrow: \x1b[D
$TCURSES_KEY_RIGHT      # Right arrow: \x1b[C
$TCURSES_KEY_ESC        # Escape: \x1b
$TCURSES_KEY_ENTER      # Enter: \n
$TCURSES_KEY_CTRL_C     # Ctrl-C: \x03
$TCURSES_KEY_CTRL_D     # Ctrl-D: \x04
$TCURSES_KEY_BACKSPACE  # Backspace: \x7f
$TCURSES_KEY_TAB        # Tab: \t
```

### Animation Operations

```bash
tui_animation_enable
```
Enable animation loop.

```bash
tui_animation_disable
```
Disable animation loop.

```bash
tui_animation_toggle
```
Toggle animation on/off.

```bash
tui_animation_pause
```
Pause animation (without disabling).

```bash
tui_animation_resume
```
Resume paused animation.

```bash
tui_animation_should_tick
```
Check if animation should tick this frame.
- **Returns**: 0 if should tick, 1 otherwise

```bash
tui_animation_record_frame
```
Record frame for FPS tracking. Call once per frame.

```bash
tui_animation_get_avg_fps
```
Get average FPS over last 30 frames.

```bash
tui_animation_get_stats
```
Get animation stats string (FPS, frames, beats, phase).

```bash
tui_animation_set_fps FPS
```
Set target frames per second.

```bash
tui_animation_set_bpm BPM
```
Set BPM for beat-synchronized animations.

```bash
tui_animation_get_beat_phase
```
Get current beat phase (0.0 to 1.0).

## Component Usage

### Modal Component

```bash
source "$TETRA_SRC/bash/tui/components/modal.sh"

modal_init
modal_set "COMMAND"  # Set mode to COMMAND
modal_is "COMMAND"   # Check if in COMMAND mode
```

### Header Component

```bash
source "$TETRA_SRC/bash/tui/components/header.sh"

header_set_size "med"      # min, med, or max
header_get_lines           # Get current line count
header_render              # Render header (outputs lines)
```

### Footer Component

```bash
source "$TETRA_SRC/bash/tui/components/footer.sh"

log_footer_init
log_footer_add "module" "action" "details"
log_footer_render START_ROW WIDTH
```

## Integration

### REPL Integration

```bash
source "$TETRA_SRC/bash/tui/integration/repl.sh"

repl_init
repl_insert_char "a"
repl_get_input
repl_render START_ROW HEIGHT WIDTH
```

See `bash/repl/` for the universal REPL system that integrates with TUI.

## Best Practices

### 1. Always Source Tetra First

```bash
source ~/tetra/tetra.sh  # FIRST
source "$TETRA_SRC/bash/tui/tui.sh"
```

### 2. Use Cleanup Traps

```bash
trap 'tui_cleanup' EXIT INT TERM
```

### 3. Use Differential Rendering

```bash
# First frame
tui_buffer_render_full

# Subsequent frames
tui_buffer_render_diff
```

### 4. Use TETRA_SRC-based Paths

```bash
# Good
source "$TETRA_SRC/bash/tui/tui.sh"

# Bad
source "bash/tui/tui.sh"
```

### 5. Frame-Based Main Loop

```bash
while true; do
    # Clear buffer
    tui_buffer_clear

    # Build frame
    tui_buffer_write_line 0 "Content"

    # Render
    tui_buffer_render_diff

    # Handle input with frame timing
    local timeout=$(tui_animation_should_tick && echo 0.033 || echo 0)
    local key=$(tui_read_key "$timeout")

    # Handle animation
    if tui_animation_should_tick; then
        # Update animation state
        tui_animation_record_frame
    fi
done
```

## Migration Guide

### From bash/tcurses

Replace:
```bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
tcurses_screen_init
```

With:
```bash
source "$TETRA_SRC/bash/tui/tui.sh"
tui_init
```

All `tcurses_*` functions remain available as-is.

### From demo/basic/014

Demo 014 will be updated to use bash/tui directly. The component files (header, footer, etc.) are now in `bash/tui/components/`.

## Examples

See these files for complete examples:
- **demo/basic/014/demo.sh** - Complete TUI application with all features
- **bash/game/game_repl.sh** - Game with TUI and REPL
- **bash/tcurses/demo.sh** - Original tcurses demo (still works)

## Troubleshooting

### Terminal Not Restored

If your terminal gets stuck in raw mode:
```bash
reset
# or
stty sane
```

Always use cleanup traps to prevent this!

### Flicker Issues

Use differential rendering:
```bash
tui_buffer_render_diff  # Only renders changed lines
```

For animations, use vsync:
```bash
tui_buffer_render_vsync  # Optimal for animated content
```

### Input Not Working

Make sure terminal is initialized:
```bash
tui_init
```

Check that you're reading from the correct timeout:
```bash
# Blocking
key=$(tui_read_key_blocking)

# With timeout
key=$(tui_read_key 0.1)
```

## Version History

### 1.0.0 (2025-11-01)
- Initial unified release
- Consolidated bash/tcurses, demo/basic/014, and bash/repl patterns
- Production-ready API with full documentation
- Double buffering for flicker-free rendering
- BPM-synchronized animation system
- Component system (header, footer, modal)
- REPL integration

## License

Part of the Tetra framework.

## See Also

- **bash/repl/** - Universal REPL system
- **bash/color/** - Color system for TUI styling
- **demo/basic/014/** - Reference implementation
- **bash/game/** - Advanced TUI game engine
