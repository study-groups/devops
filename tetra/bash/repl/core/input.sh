#!/usr/bin/env bash
# REPL Input Handling
# Mode-specific input reading

repl_read_input() {
    local prompt="$1"
    local input=""

    case "${REPL_MODE}" in
        simple)
            # Simple read with prompt
            read -r -p "$prompt" input
            local status=$?
            echo "$input"
            return $status
            ;;
        readline)
            # TCurses readline with history support
            input=$(tcurses_input_read_line "$prompt" "$REPL_HISTORY_FILE")
            local status=$?
            echo "$input"
            return $status
            ;;
        # Legacy compatibility
        basic)
            read -r -p "$prompt" input
            local status=$?
            echo "$input"
            return $status
            ;;
        enhanced)
            input=$(tcurses_input_read_line "$prompt" "$REPL_HISTORY_FILE")
            local status=$?
            echo "$input"
            return $status
            ;;
        *)
            echo "Error: Unknown REPL mode: $REPL_MODE" >&2
            return 1
            ;;
    esac
}

export -f repl_read_input
