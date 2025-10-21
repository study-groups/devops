#!/usr/bin/env bash

# TCurses Simple Example - DEBUG VERSION
# A minimal TUI app demonstrating basic TCurses usage

# Get script directory
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tcurses.sh"

# Debug log
DEBUG_LOG="/tmp/tcurses_simple_debug.log"
echo "=== TCurses Simple Debug $(date) ===" > "$DEBUG_LOG"

# Application state
MESSAGE="Hello, TCurses!"
COUNTER=0

# Render callback
render_frame() {
    local first_render="$1"
    echo "render_frame called: first=$first_render" >> "$DEBUG_LOG"

    # Clear back buffer
    tcurses_buffer_clear

    # Get screen dimensions
    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)

    # Header
    tcurses_buffer_write_line 0 "╔$(printf '═%.0s' $(seq 1 $((width-2))))╗"
    tcurses_buffer_write_line 1 "║ TCurses Simple Example (DEBUG)$(printf ' %.0s' $(seq 1 $((width-36))))║"
    tcurses_buffer_write_line 2 "╚$(printf '═%.0s' $(seq 1 $((width-2))))╝"

    # Content
    tcurses_buffer_write_line 4 "  $MESSAGE"
    tcurses_buffer_write_line 5 ""
    tcurses_buffer_write_line 6 "  Counter: $COUNTER"
    tcurses_buffer_write_line 7 ""
    tcurses_buffer_write_line 8 "  Screen: ${width}x${height}"
    tcurses_buffer_write_line 9 ""
    tcurses_buffer_write_line 10 "  Debug log: $DEBUG_LOG"

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
    local key_name=$(tcurses_input_key_name "$key")
    local hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')

    echo "handle_input called: key='$key' hex=$hex name=$key_name" >> "$DEBUG_LOG"

    case "$key" in
        'q'|'Q')
            echo "  -> QUIT" >> "$DEBUG_LOG"
            return 1  # Exit loop
            ;;
        ' ')
            echo "  -> INCREMENT" >> "$DEBUG_LOG"
            ((COUNTER++))
            ;;
        'r'|'R')
            echo "  -> RESET" >> "$DEBUG_LOG"
            COUNTER=0
            ;;
        *)
            echo "  -> UNHANDLED" >> "$DEBUG_LOG"
            ;;
    esac

    return 0  # Continue loop
}

# Main
main() {
    echo "Starting TCurses Simple Example (DEBUG)..."
    echo "Debug log will be written to: $DEBUG_LOG"
    echo "In another terminal, run: tail -f $DEBUG_LOG"
    sleep 2

    echo "main() started" >> "$DEBUG_LOG"

    # Initialize TCurses
    if ! tcurses_init; then
        echo "Failed to initialize TCurses" >&2
        echo "INIT FAILED" >> "$DEBUG_LOG"
        exit 1
    fi
    echo "tcurses_init OK" >> "$DEBUG_LOG"

    # Set up cleanup trap
    tcurses_setup_cleanup_trap

    echo "Entering simple_loop" >> "$DEBUG_LOG"
    # Run simple loop (no animation)
    tcurses_simple_loop render_frame handle_input

    echo "Exited simple_loop" >> "$DEBUG_LOG"

    # Cleanup
    tcurses_cleanup
    clear
    echo "TCurses Simple Example complete."
    echo "Check debug log: $DEBUG_LOG"
}

main "$@"
