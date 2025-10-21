# tcurses - Terminal Curses Library

**Version:** 1.0.0
**Type:** Tetra Library
**Status:** Stable

---

## Overview

TCurses is a coordination layer for terminal applications, providing primitives for TUI (Terminal User Interface) development. It manages terminal mode transitions (raw/cooked), screen control, input handling, animation timing, and state management - enabling seamless coordination between TUI, REPL, and Transaction Manager components.

## Installation

No installation needed - just source the entry point:

```bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"
```

## Dependencies

- **Required:** Bash 5.2+
- **Optional:** None

## Quick Start

See the interactive demo for a complete working example:

```bash
cd $TETRA_SRC/bash/tcurses
./demo.sh
```

Or try this minimal example:

```bash
#!/usr/bin/env bash

render() {
    clear
    echo "Hello from TCurses"
    echo "Press 'q' to quit"
}

handle_input() {
    [[ "$1" == "q" ]] && return 1
    return 0
}

# Setup terminal
trap 'tput cnorm; tput rmcup; stty sane' EXIT
tput smcup
tput civis
stty -echo -icanon min 0 time 0

# Main loop
while true; do
    render
    local key
    if IFS= read -rsn1 -t 0.1 key; then
        handle_input "$key" || break
    fi
done
```

## Architecture

TCurses is composed of several subsystems:

### Core Subsystems

- **tcurses_screen.sh** - Screen management (clear, move cursor, save/restore)
- **tcurses_input.sh** - Input handling (key codes, sequences)
- **tcurses_buffer.sh** - Double-buffering for flicker-free rendering
- **tcurses_animation.sh** - Animation loop with frame timing
- **tcurses_modal.sh** - Modal dialogs and overlays
- **tcurses_repl.sh** - REPL integration for TUI applications
- **tcurses_log_footer.sh** - Footer with log display
- **tcurses_actions.sh** - Action system integration

## API Reference

### Initialization

#### tcurses_init()
Initialize the tcurses library and set up terminal for TUI mode.

**Usage:** `tcurses_init`
**Returns:** 0 on success, 1 on error

#### tcurses_cleanup()
Clean up and restore terminal state.

**Usage:** `tcurses_cleanup`
**Returns:** 0

#### tcurses_setup_cleanup_trap()
Set up trap to ensure cleanup on exit.

**Usage:** `tcurses_setup_cleanup_trap`

### Main Loop

#### tcurses_simple_loop(render_fn, input_fn)
Simple render/input loop.

**Parameters:**
- `render_fn`: Function called each frame (receives first_render boolean)
- `input_fn`: Function called for each key press (receives key character)

**Returns:** When input_fn returns non-zero (break condition)

**Example:**
```bash
tcurses_simple_loop my_render my_input_handler
```

### Screen Management (tcurses_screen.sh)

Key functions from tcurses_screen subsystem:

- `tcurses_screen_init()` - Initialize screen
- `tcurses_screen_cleanup()` - Restore screen
- `tcurses_screen_clear()` - Clear screen
- `tcurses_screen_move_cursor(row, col)` - Move cursor
- `tcurses_screen_hide_cursor()` - Hide cursor
- `tcurses_screen_show_cursor()` - Show cursor

### Input Handling (tcurses_input.sh)

Key functions from tcurses_input subsystem:

- `tcurses_input_read_key([timeout])` - Read single key with timeout (default 0.05s)
- `tcurses_input_read_key_blocking()` - Read key without timeout
- `tcurses_input_read_line()` - Read full line of input
- `tcurses_input_is_arrow_key(key)` - Check if key is arrow key
- `tcurses_input_is_control_key(key)` - Check if key is control key
- `tcurses_input_key_name(key)` - Get human-readable name for key

**Note:** Input handling typically uses direct `read` in main loop (see demo patterns above). Terminal setup via `stty -echo -icanon min 0 time 0`.

### Animation (tcurses_animation.sh)

- `tcurses_animation_loop(render_fn, fps)` - Run animation at specified FPS
- Frame timing and rate control

### Buffer (tcurses_buffer.sh)

- `tcurses_buffer_start()` - Start capturing output
- `tcurses_buffer_end()` - End capture and render
- Double-buffering to prevent flicker

### Modal State Management (tcurses_modal.sh)

Provides a flexible state machine for managing application modes:

- `modal_init()` - Initialize modal system (defaults to NORMAL mode)
- `modal_set(mode)` - Transition to new mode (tracks previous mode)
- `modal_get()` - Get current mode
- `modal_get_prev()` - Get previous mode
- `modal_is(mode)` - Check if in specific mode
- `modal_info(mode)` - Get mode description

**Built-in modes:** NORMAL, COMMAND, REPL

**Custom modes:** Define your own via `MODE_INFO` associative array:
```bash
MODE_INFO[NAVIGATION]="Navigation mode"
MODE_INFO[RAW]="Raw input mode"
```

## Usage Patterns

### Pattern 1: Simple TUI Application

```bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"

render() {
    clear
    echo "╔═══════════════╗"
    echo "║  My TUI App   ║"
    echo "╚═══════════════╝"
    echo ""
    echo "Status: Running"
}

handle_input() {
    case "$1" in
        q) return 1 ;;  # Quit
        r) ;;           # Refresh (do nothing, will re-render)
    esac
    return 0
}

tcurses_init
tcurses_setup_cleanup_trap
tcurses_simple_loop render handle_input
```

### Pattern 2: Mode Switching with State Management

```bash
#!/usr/bin/env bash
source "$TETRA_SRC/bash/tcurses/tcurses.sh"

# Define custom modes
MODE_INFO[NAVIGATION]="Navigation mode"
MODE_INFO[RAW]="Raw input mode"

# Initialize
modal_init
MODE="NAVIGATION"

render() {
    clear
    echo "Current mode: $MODE"
    if [[ "$MODE" == "NAVIGATION" ]]; then
        echo "Press 'i' for RAW mode, 'q' to quit"
    else
        echo "Press ESC to return to NAVIGATION"
    fi
}

handle_input() {
    local key=$1

    # ESC always returns to navigation
    if [[ "$key" == $'\x1b' ]]; then
        MODE="NAVIGATION"
        return 0
    fi

    # Mode-specific handling
    if [[ "$MODE" == "RAW" ]]; then
        echo "Logged: $key"
        return 0
    fi

    # Navigation mode
    case "$key" in
        q) return 1 ;;  # Quit
        i) MODE="RAW" ;;
    esac
    return 0
}

# Run with direct terminal control (see demo.sh for full example)
trap 'tput cnorm; tput rmcup; stty sane' EXIT
tput smcup
tput civis
stty -echo -icanon min 0 time 0

while true; do
    render
    local key
    if IFS= read -rsn1 -t 0.1 key; then
        handle_input "$key" || break
    fi
done
```

### Pattern 3: Animation Control

```bash
#!/usr/bin/env bash

COUNTER=0
ANIMATION_PAUSED=false

render() {
    clear

    # Animated spinner (only when not paused)
    if [[ "$ANIMATION_PAUSED" == "false" ]]; then
        local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
        local idx=$((COUNTER % ${#spinner[@]}))
        echo "${spinner[$idx]} Processing..."
        ((COUNTER++))
    else
        echo "◼ Paused (press 'p' to resume)"
    fi

    echo "Press 'p' to pause/resume, 'q' to quit"
}

handle_input() {
    case "$1" in
        p)
            if [[ "$ANIMATION_PAUSED" == "true" ]]; then
                ANIMATION_PAUSED=false
            else
                ANIMATION_PAUSED=true
            fi
            ;;
        q) return 1 ;;
    esac
    return 0
}

# Main loop - only render when not paused
trap 'tput cnorm; tput rmcup; stty sane' EXIT
tput smcup
tput civis
stty -echo -icanon min 0 time 0

while true; do
    if [[ "$ANIMATION_PAUSED" == "false" ]]; then
        render
    fi

    local key
    if IFS= read -rsn1 -t 0.1 key; then
        handle_input "$key" || break
        [[ "$ANIMATION_PAUSED" == "false" ]] && render
    fi
done
```

## Integration with Tetra Modules

TCurses is used by:

- **tetra-tui** - Visual interface for tetra orchestrator
- **demo/basic/014** - TCurses demonstration and testing
- Other TUI-based modules

## Promotion from Demo

This library was promoted from `demo/basic/014/bash/tcurses/` to become a reusable Tetra library. The demo now references this library version.

## Best Practices

1. **Terminal mode management** - Use `tput smcup/rmcup` for alternate screen buffer
2. **Clean up properly** - Always set cleanup trap: `trap 'tput cnorm; tput rmcup; stty sane' EXIT`
3. **Mode transitions** - Use ESC as universal "return to navigation" key
4. **Animation control** - Stop rendering when paused to enable copy/paste
5. **Input handling** - Use `read -rsn1 -t 0.1` for responsive, non-blocking input
6. **State management** - Leverage `tcurses_modal.sh` for clean mode switching
7. **Coordination layer** - Design for TUI/REPL/TM interoperability from the start

## Error Handling

```bash
if ! tcurses_init; then
    echo "Failed to initialize tcurses" >&2
    exit 1
fi
```

## Try the Demo

Run the interactive demo to see tcurses in action:

```bash
cd $TETRA_SRC/bash/tcurses
./demo.sh
```

**Demo features:**
- Mode switching (NAVIGATION ↔ RAW input)
- Animation control (pause/resume)
- Key logging with circular buffer
- Colorful UI showcase
- Terminal state management

**Keys:**
- `1-5` - Display different tcurses features (colored messages)
- `p` - Pause/resume animation (freezes screen for copy/paste)
- `i` - Enter RAW input mode (logs all keypresses)
- `ESC` - Return to NAVIGATION mode
- `r` - Reset counter
- `q` - Quit

For a more advanced demo with REPL and modal dialogs:
```bash
cd $TETRA_SRC/demo/basic/014/bash/tcurses
./demo.sh
```

## Version History

- **1.0.0** (2025-10-17) - Promoted to library from demo/014
  - Extracted from demo/basic/014/bash/tcurses
  - Added library entry point (tcurses.sh)
  - Standardized API and documentation
  - Positioned as coordination layer for TUI/REPL/TM
  - Added interactive demo with mode switching and animation control

## Related Documentation

- [Tetra Library Convention](../../../docs/Tetra_Library_Convention.md)
- [TDS (Tetra Design System)](../tds/README.md)
- [Demo 014](../../demo/basic/014/README.md)

---

**Maintained by:** Tetra Project
**License:** Part of Tetra ecosystem
