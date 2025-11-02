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
            # Native TCurses readline with TAB completion support
            input=$(tcurses_readline "$prompt" "$REPL_HISTORY_FILE")
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
            # Native TCurses readline with TAB completion support
            input=$(tcurses_readline "$prompt" "$REPL_HISTORY_FILE")
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
