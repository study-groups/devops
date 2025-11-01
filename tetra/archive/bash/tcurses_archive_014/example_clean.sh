#!/usr/bin/env bash

# Clean TCurses Example using State Machine
# This should have ZERO spurious inputs or duplicates

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/tcurses_v2.sh"

# Enable state machine debug (optional)
# export INPUT_SM_DEBUG=true

# Application state
MESSAGE="TCurses V2 (State Machine)"
COUNTER=0
LOG_FILE="/tmp/tcurses_clean_test.log"

# Setup log
echo "=== TCurses Clean Test $(date) ===" > "$LOG_FILE"
echo "Using state machine for robust input" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Render callback
render_frame() {
    local first="$1"

    tcurses_buffer_clear

    local height=$(tcurses_screen_height)
    local width=$(tcurses_screen_width)

    # Header
    tcurses_buffer_write_line 0 "╔════════════════════════════════════════════════════╗"
    tcurses_buffer_write_line 1 "║  TCurses V2 - State Machine Input Demo           ║"
    tcurses_buffer_write_line 2 "╚════════════════════════════════════════════════════╝"

    # Content
    tcurses_buffer_write_line 4 "  Message: $MESSAGE"
    tcurses_buffer_write_line 5 ""
    tcurses_buffer_write_line 6 "  Counter: $COUNTER"
    tcurses_buffer_write_line 7 ""
    tcurses_buffer_write_line 8 "  Screen: ${width}x${height}"

    # Controls
    local ctrl_y=$((height - 8))
    tcurses_buffer_write_line $ctrl_y "  Controls:"
    tcurses_buffer_write_line $((ctrl_y + 1)) "    SPACE     - Increment counter"
    tcurses_buffer_write_line $((ctrl_y + 2)) "    r         - Reset counter"
    tcurses_buffer_write_line $((ctrl_y + 3)) "    Arrow keys - Test escape sequences"
    tcurses_buffer_write_line $((ctrl_y + 4)) "    q         - Quit"
    tcurses_buffer_write_line $((ctrl_y + 6)) "  Log: $LOG_FILE"

    # Render
    if [[ "$first" == "true" ]]; then
        tcurses_buffer_render_full
    else
        tcurses_buffer_render_diff
    fi
}

# Detect control character
is_control_char() {
    local key="$1"
    local byte_val=$(printf '%d' "'$key")
    # Control chars are 0x00-0x1F (0-31)
    [[ $byte_val -ge 0 && $byte_val -le 31 ]]
}

# Get control character name (Ctrl-A = ^A)
get_control_name() {
    local key="$1"
    local byte_val=$(printf '%d' "'$key")

    # Special cases
    case "$byte_val" in
        0) echo "Ctrl-@" ;;
        8) echo "Ctrl-H (Backspace)" ;;
        9) echo "Ctrl-I (Tab)" ;;
        10) echo "Ctrl-J (Enter)" ;;
        13) echo "Ctrl-M (Return)" ;;
        27) echo "Ctrl-[ (ESC)" ;;
        127) echo "Ctrl-? (DEL)" ;;
        *)
            if [[ $byte_val -ge 1 && $byte_val -le 26 ]]; then
                # Ctrl-A through Ctrl-Z
                local letter=$(printf "\\$(printf '%03o' $((byte_val + 64)))")
                echo "Ctrl-$letter"
            else
                echo "Ctrl-?"
            fi
            ;;
    esac
}

# Input callback
handle_input() {
    local key="$1"
    local hex=$(echo -n "$key" | od -An -tx1 | tr -d ' ')
    local timestamp=$(date +%H:%M:%S)

    # Detect if this is a control character
    local key_type="KEY"
    if [[ ${#key} -eq 1 ]] && is_control_char "$key"; then
        key_type="CTRL"
        local ctrl_name=$(get_control_name "$key")
        echo "[$timestamp] INPUT: $ctrl_name (hex: $hex)" >> "$LOG_FILE"
    else
        echo "[$timestamp] INPUT: '$key' (hex: $hex)" >> "$LOG_FILE"
    fi

    case "$key" in
        'q'|'Q')
            echo "[$timestamp] QUIT" >> "$LOG_FILE"
            return 1  # Exit
            ;;
        ' ')
            ((COUNTER++))
            echo "[$timestamp] INCREMENT -> $COUNTER" >> "$LOG_FILE"
            ;;
        'r'|'R')
            COUNTER=0
            echo "[$timestamp] RESET -> 0" >> "$LOG_FILE"
            ;;
        $'\x1b[A')
            MESSAGE="Up Arrow"
            echo "[$timestamp] UP ARROW" >> "$LOG_FILE"
            ;;
        $'\x1b[B')
            MESSAGE="Down Arrow"
            echo "[$timestamp] DOWN ARROW" >> "$LOG_FILE"
            ;;
        $'\x1b[C')
            MESSAGE="Right Arrow"
            echo "[$timestamp] RIGHT ARROW" >> "$LOG_FILE"
            ;;
        $'\x1b[D')
            MESSAGE="Left Arrow"
            echo "[$timestamp] LEFT ARROW" >> "$LOG_FILE"
            ;;
        $'\x1b')
            MESSAGE="ESC key"
            echo "[$timestamp] ESC" >> "$LOG_FILE"
            ;;
        $'\x08'|$'\x7f')
            MESSAGE="Backspace (Ctrl-H)"
            echo "[$timestamp] BACKSPACE" >> "$LOG_FILE"
            ;;
        $'\x01')
            MESSAGE="Ctrl-A detected"
            echo "[$timestamp] CTRL-A" >> "$LOG_FILE"
            ;;
        *)
            if [[ "$key_type" == "CTRL" ]]; then
                MESSAGE="Control: $(get_control_name "$key")"
                echo "[$timestamp] CTRL_OTHER: $(get_control_name "$key")" >> "$LOG_FILE"
            else
                MESSAGE="Key: '$key' (0x$hex)"
                echo "[$timestamp] OTHER: '$key'" >> "$LOG_FILE"
            fi
            ;;
    esac

    return 0  # Continue
}

# Main
main() {
    echo "TCurses V2 - Clean State Machine Example"
    echo "=========================================="
    echo ""
    echo "$(tcurses_version)"
    echo ""
    echo "This example uses a state machine for robust input handling."
    echo "Every keypress will be logged to: $LOG_FILE"
    echo ""
    echo "In another terminal, monitor with:"
    echo "  tail -f $LOG_FILE"
    echo ""
    echo "Starting in 2 seconds..."
    sleep 2

    # Initialize
    if ! tcurses_init; then
        echo "Failed to initialize TCurses" >&2
        exit 1
    fi

    # Setup cleanup
    tcurses_setup_cleanup_trap

    # Run event loop
    tcurses_loop render_frame handle_input

    # Cleanup
    tcurses_cleanup
    clear

    # Show summary
    echo ""
    echo "TCurses V2 Test Complete"
    echo "========================"
    echo ""
    echo "Summary:"
    echo "  Final counter: $COUNTER"
    echo ""
    echo "Input log:"
    grep "^\\[.*\\] INPUT:" "$LOG_FILE" | tail -20
    echo ""
    echo "Full log: $LOG_FILE"
    echo ""
}

main "$@"
