#!/usr/bin/env bash
# REPL Mode Detection
# Determines input mode (basic/enhanced/tui) and execution mode (augment/takeover)

# Input mode: how input is read
repl_detect_mode() {
    # TUI mode if explicitly requested
    if [[ -n "$REPL_OUTPUT_HANDLER" ]]; then
        echo "tui"
        return
    fi

    # Enhanced mode if tcurses available and interactive terminal
    if [[ -t 0 && -e /dev/tty ]] && command -v tcurses_input_read_line >/dev/null 2>&1; then
        echo "enhanced"
        return
    fi

    # Fallback to basic
    echo "basic"
}

# Execution mode state
REPL_EXECUTION_MODE="${REPL_EXECUTION_MODE:-augment}"  # augment or takeover

# Set execution mode
repl_set_execution_mode() {
    local mode="$1"

    case "$mode" in
        augment|shell)
            REPL_EXECUTION_MODE="augment"
            ;;
        takeover|repl)
            REPL_EXECUTION_MODE="takeover"
            ;;
        *)
            echo "Error: Unknown execution mode: $mode" >&2
            echo "Valid modes: shell, repl (aliases: augment, takeover)" >&2
            return 1
            ;;
    esac
}

# Get current execution mode
repl_get_execution_mode() {
    echo "$REPL_EXECUTION_MODE"
}

# Check if in takeover mode
repl_is_takeover() {
    [[ "$REPL_EXECUTION_MODE" == "takeover" ]]
}

# Check if in augment mode
repl_is_augment() {
    [[ "$REPL_EXECUTION_MODE" == "augment" ]]
}

export -f repl_detect_mode
export -f repl_set_execution_mode
export -f repl_get_execution_mode
export -f repl_is_takeover
export -f repl_is_augment
