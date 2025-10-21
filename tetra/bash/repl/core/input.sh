#!/usr/bin/env bash
# REPL Input Handling
# Mode-specific input reading

repl_read_input() {
    local prompt="$1"
    local input=""

    case "${REPL_MODE}" in
        basic)
            # Simple read with prompt
            read -r -p "$prompt" input
            local status=$?
            echo "$input"
            return $status
            ;;
        enhanced)
            # TCurses readline with mode-aware history
            # Use current history file based on execution mode
            local history_file=$(repl_get_history_file)
            input=$(tcurses_input_read_line "$prompt" "$history_file")
            local status=$?
            echo "$input"
            return $status
            ;;
        tui)
            # TUI mode - use output handler
            if [[ -n "$REPL_OUTPUT_HANDLER" ]]; then
                # TUI handles its own input
                read -r -p "$prompt" input
                echo "$input"
                return $?
            else
                # Fallback to basic
                read -r -p "$prompt" input
                echo "$input"
                return $?
            fi
            ;;
        *)
            echo "Error: Unknown REPL mode: $REPL_MODE" >&2
            return 1
            ;;
    esac
}

export -f repl_read_input
