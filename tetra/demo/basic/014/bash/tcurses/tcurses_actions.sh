#!/usr/bin/env bash

# TCurses Action Handler
# Systematic execution with logging (RAG pattern)

# Execute action with module:action pattern
# Usage: execute_action MODULE ACTION [ARGS...]
# Returns: exit code from action
execute_action() {
    local module="$1"
    local action="$2"
    shift 2
    local args=("$@")

    case "$module:$action" in
        shell:exec)
            # Execute shell command
            local cmd="${args[*]}"
            local output=""
            local exit_code=0

            output=$(eval "$cmd" 2>&1)
            exit_code=$?

            # Return output and code
            echo "$output"
            return $exit_code
            ;;

        repl:command)
            # Future: structured REPL commands
            echo "Structured commands not yet implemented"
            return 1
            ;;

        *)
            echo "Unknown action: $module:$action"
            return 1
            ;;
    esac
}

# Format status for logging
format_status() {
    local exit_code="$1"
    if [[ $exit_code -eq 0 ]]; then
        echo "ok"
    else
        echo "error"
    fi
}

# Colorize status
colorize_status() {
    local status="$1"
    if [[ $COLOR_ENABLED -ne 1 ]]; then
        echo "$status"
        return
    fi

    case "$status" in
        ok|success|0)
            echo "$(text_color "9ECE6A")${status}$(reset_color)"
            ;;
        error|fail|failed)
            echo "$(text_color "F7768E")${status}$(reset_color)"
            ;;
        warning|pending)
            echo "$(text_color "E0AF68")${status}$(reset_color)"
            ;;
        *)
            echo "$status"
            ;;
    esac
}

# Export
export -f execute_action
export -f format_status
export -f colorize_status
