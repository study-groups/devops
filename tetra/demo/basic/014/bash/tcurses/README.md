# TCurses - Terminal UI Framework

A minimal, modular terminal UI framework for Bash 5.2+ with modal editing, REPL support, and Emacs-style keybindings.

## Quick Start

```bash
cd /Users/mricos/src/devops/tetra/demo/basic/014/bash/tcurses
./demo.sh
```

## Features

- **Modal Interface**: NORMAL, COMMAND, and REPL modes (Vim-inspired)
- **REPL with History**: Interactive command execution with up/down arrow history
- **Emacs Keybindings**: Ctrl+A/E/K/U/W/D/F/B/P/N for efficient editing
- **Double Buffering**: Smooth rendering with diff-based updates
- **Animation System**: BPM/FPS-based timing for smooth animations
- **Colored Logging**: Tokyo Night themed status footer
- **Action System**: Systematic command execution with status tracking

## Modes

### NORMAL Mode
- Press `/` to enter REPL mode
- Press `:` to enter COMMAND mode (not yet implemented)
- Press `q` to quit

### REPL Mode
Type shell commands and execute them interactively.

**Keyboard Shortcuts:**
- `Enter` - Execute command
- `ESC` - Return to NORMAL mode
- `←/→` or `Ctrl+B/F` - Move cursor
- `Ctrl+A` - Move to beginning of line
- `Ctrl+E` - Move to end of line
- `Ctrl+K` - Kill to end of line
- `Ctrl+U` - Kill entire line
- `Ctrl+W` - Kill word backward
- `Ctrl+D` - Delete character at cursor
- `↑/↓` or `Ctrl+P/N` - Navigate command history
- `Backspace` - Delete character before cursor

## Architecture

### Core Modules

```
tcurses/
├── demo.sh                    # Main demo application
├── tcurses_screen.sh          # Terminal initialization & raw mode
├── tcurses_input.sh           # Keyboard input handling
├── tcurses_buffer.sh          # Double buffering & diff rendering
├── tcurses_animation.sh       # BPM/FPS timing system
├── tcurses_modal.sh           # Mode management
├── tcurses_repl.sh            # REPL component with history
├── tcurses_log_footer.sh      # Status footer with logging
├── tcurses_actions.sh         # Action execution system
└── archive/                   # Example files and tests
```

### Module Responsibilities

- **tcurses_screen.sh** - Raw terminal mode, cursor control, screen dimensions
- **tcurses_input.sh** - Read keys from /dev/tty, handle escape sequences
- **tcurses_buffer.sh** - Double buffering with diff-based rendering
- **tcurses_animation.sh** - Frame timing, BPM/FPS conversion
- **tcurses_modal.sh** - Mode switching (NORMAL/COMMAND/REPL)
- **tcurses_repl.sh** - REPL input editing, cursor management, history
- **tcurses_log_footer.sh** - Colored logging footer
- **tcurses_actions.sh** - Systematic action execution

## Integration with Tetra

TCurses follows Tetra conventions:

```bash
# Uses TETRA_SRC global
: "${TETRA_SRC:=$(cd "$SCRIPT_DIR/../../../../.." && pwd)}"

# Sources bash/color as library (not module)
source "$TETRA_SRC/bash/color/color_core.sh"
```

## Color System

Uses Tokyo Night color palette via `bash/color`:

- Success: `#9ECE6A` (green)
- Error: `#F7768E` (red)
- Info: `#7DCFFF` (cyan)
- Command: `#BB9AF7` (purple)
- Accent: `#7AA2F7` (blue)

## Platform Notes

### macOS Terminal Behavior
- Enter key in raw mode may produce `\r`, `\n`, or empty read
- Backspace sends DEL (0x7F)
- Arrow keys are 3-byte escape sequences: ESC + `[` + direction

All platform differences are handled transparently by the input system.

## Requirements

- Bash 5.2+
- POSIX terminal with /dev/tty
- Standard terminal escape sequences (VT100 compatible)

## Development

### Testing Input
```bash
# The demo logs all key presses in REPL mode
# Watch the footer to see hex codes: [HH:MM:SS] repl:key | 0x<hex> len=<n>
```

### Adding New Modes
1. Add mode to `tcurses_modal.sh`
2. Create handler function in `demo.sh` (e.g., `handle_new_mode()`)
3. Wire up in `handle_input()` switch statement

### Extending REPL Functions
Add new editing functions to `tcurses_repl.sh` and wire them up in `demo.sh:handle_repl_mode()`.

## Future Enhancements

- COMMAND mode implementation (ex commands like `:quit`, `:help`)
- Tab completion
- Multi-line editing
- Syntax highlighting via chroma
- Mouse support
- Split windows / panes
- Status line customization
