#!/usr/bin/env bash

# TCurses Simple Example
# A minimal TUI app demonstrating basic TCurses usage

# Get script directory
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tcurses.sh"

# Application state
MESSAGE="Hello, TCurses!"
COUNTER=0

# Render callback
render_frame() {
    local first_render="$1"

    # Clear back buffer
    tcurses_buffer_clear

    # Get screen dimensions
    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)

    # Header
    tcurses_buffer_write_line 0 "╔$(printf '═%.0s' $(seq 1 $((width-2))))╗"
    tcurses_buffer_write_line 1 "║ TCurses Simple Example$(printf ' %.0s' $(seq 1 $((width-27))))║"
    tcurses_buffer_write_line 2 "╚$(printf '═%.0s' $(seq 1 $((width-2))))╝"

    # Content
    tcurses_buffer_write_line 4 "  $MESSAGE"
    tcurses_buffer_write_line 5 ""
    tcurses_buffer_write_line 6 "  Counter: $COUNTER"
    tcurses_buffer_write_line 7 ""
    tcurses_buffer_write_line 8 "  Screen: ${width}x${height}"

    # Controls
    local ctrl_line=$((height - 5))
    tcurses_buffer_write_line $ctrl_line "  Controls:"
    tcurses_buffer_write_line $((ctrl_line + 1)) "    SPACE - Increment counter"
    tcurses_buffer_write_line $((ctrl_line + 2)) "    r     - Reset counter"
    tcurses_buffer_write_line $((ctrl_line + 3)) "    q     - Quit"

    # Render to screen
    if [[ "$first_render" == "true" ]]; then
        tcurses_buffer_render_full
    else
        tcurses_buffer_render_diff
    fi
}

# Input callback
handle_input() {
    local key="$1"

    case "$key" in
        'q'|'Q')
            return 1  # Exit loop
            ;;
        ' ')
            ((COUNTER++))
            ;;
        'r'|'R')
            COUNTER=0
            ;;
    esac

    return 0  # Continue loop
}

# Main
main() {
    echo "Starting TCurses Simple Example..."
    sleep 1

    # Initialize TCurses
    tcurses_init

    # Set up cleanup trap
    tcurses_setup_cleanup_trap

    # Run simple loop (no animation)
    tcurses_simple_loop render_frame handle_input

    # Cleanup
    tcurses_cleanup
    clear
    echo "TCurses Simple Example complete."
}

main "$@"
