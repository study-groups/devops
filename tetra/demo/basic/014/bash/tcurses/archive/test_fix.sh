#!/usr/bin/env bash

# Clean test to verify tcurses input fix

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tcurses.sh"

LOG="/tmp/tcurses_fix_test.log"
echo "=== TCurses Fix Test $(date) ===" > "$LOG"

COUNTER=0

render_frame() {
    local first="$1"
    tcurses_buffer_clear

    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)

    tcurses_buffer_write_line 0 "╔════════════════════════════════════════╗"
    tcurses_buffer_write_line 1 "║       TCurses Input Fix Test          ║"
    tcurses_buffer_write_line 2 "╚════════════════════════════════════════╝"
    tcurses_buffer_write_line 4 "  Counter: $COUNTER"
    tcurses_buffer_write_line 6 "  Press SPACE to increment"
    tcurses_buffer_write_line 7 "  Press 'r' to reset"
    tcurses_buffer_write_line 8 "  Press 'q' to quit"
    tcurses_buffer_write_line 10 "  Log: $LOG"

    if [[ "$first" == "true" ]]; then
        tcurses_buffer_render_full
    else
        tcurses_buffer_render_diff
    fi

    echo "render_frame: counter=$COUNTER" >> "$LOG"
}

handle_input() {
    local key="$1"
    local hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')
    echo "INPUT: key='$key' hex=$hex" >> "$LOG"

    case "$key" in
        'q'|'Q')
            echo "QUIT" >> "$LOG"
            return 1
            ;;
        ' ')
            ((COUNTER++))
            echo "INCREMENT -> $COUNTER" >> "$LOG"
            ;;
        'r'|'R')
            COUNTER=0
            echo "RESET -> 0" >> "$LOG"
            ;;
        *)
            echo "UNHANDLED" >> "$LOG"
            ;;
    esac
    return 0
}

main() {
    echo "TCurses Input Fix Test"
    echo "Log: $LOG"
    echo ""
    echo "Starting in 2 seconds..."
    echo "(In another terminal: tail -f $LOG)"
    sleep 2

    if ! tcurses_init; then
        echo "Failed to initialize" >&2
        exit 1
    fi

    tcurses_setup_cleanup_trap
    tcurses_simple_loop render_frame handle_input

    tcurses_cleanup
    clear

    echo ""
    echo "Test complete. Checking log..."
    echo ""
    echo "Key presses recorded:"
    grep "^INPUT:" "$LOG"
    echo ""
    echo "Expected: Each key press should appear ONCE"
    echo "Check log for duplicates: tail -20 $LOG"
}

main "$@"
