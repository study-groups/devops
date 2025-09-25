#!/usr/bin/env bash

# TUI Input - Key handling and mode switching
# Manages gamepad navigation and REPL mode

# Input modes
declare -g INPUT_MODE="gamepad"  # gamepad | repl
declare -g REPL_HISTORY=()
declare -g REPL_HISTORY_INDEX=0

# Gamepad key mappings
declare -gA GAMEPAD_KEYS=(
    ["e"]="next_environment"      # Cycle environments forward
    ["E"]="prev_environment"      # Cycle environments backward
    ["d"]="next_mode"             # Cycle modes forward
    ["D"]="prev_mode"             # Cycle modes backward
    ["a"]="next_action"           # Cycle actions forward
    ["A"]="prev_action"           # Cycle actions backward
    ["l"]="execute_action"        # Execute selected action
    ["\n"]="execute_action"       # Enter also executes
    ["\r"]="execute_action"       # Carriage return also executes
    ["q"]="quit"                  # Exit application
    ["Q"]="quit"                  # Shift+Q also quits
    ["r"]="refresh"               # Refresh current view
    ["R"]="refresh"               # Shift+R also refreshes
    ["/"]="enter_repl_mode"       # Switch to REPL mode
    ["h"]="show_help"             # Show help
    ["H"]="show_help"             # Shift+H also shows help
    ["?"]="show_help"             # ? also shows help
)

# REPL command mappings
declare -gA REPL_COMMANDS=(
    ["env"]="set_environment"
    ["environment"]="set_environment"
    ["mode"]="set_mode"
    ["action"]="execute_action_by_name"
    ["exec"]="execute_action_by_name"
    ["execute"]="execute_action_by_name"
    ["list"]="list_current_actions"
    ["ls"]="list_current_actions"
    ["help"]="show_help"
    ["gamepad"]="enter_gamepad_mode"
    ["exit"]="enter_gamepad_mode"
    ["quit"]="quit"
    ["q"]="quit"
    ["refresh"]="refresh"
    ["r"]="refresh"
)

# Input event handlers (to be implemented by main application)
declare -gA INPUT_HANDLERS=(
    ["next_environment"]=""
    ["prev_environment"]=""
    ["next_mode"]=""
    ["prev_mode"]=""
    ["next_action"]=""
    ["prev_action"]=""
    ["execute_action"]=""
    ["quit"]=""
    ["refresh"]=""
    ["show_help"]=""
    ["set_environment"]=""
    ["set_mode"]=""
    ["execute_action_by_name"]=""
    ["list_current_actions"]=""
    ["enter_repl_mode"]=""
    ["enter_gamepad_mode"]=""
)

# Set input handler
set_input_handler() {
    local event="$1"
    local handler="$2"

    INPUT_HANDLERS["$event"]="$handler"
}

# Call input handler
call_input_handler() {
    local event="$1"
    shift
    local args=("$@")

    local handler="${INPUT_HANDLERS[$event]}"
    if [[ -n "$handler" && $(type -t "$handler") == "function" ]]; then
        "$handler" "${args[@]}"
    else
        echo "Handler not found for event: $event" >&2
        return 1
    fi
}

# Read single key (gamepad mode)
read_key() {
    local key
    read -n1 -s key
    echo "$key"
}

# Read line with history (REPL mode)
read_repl_line() {
    local prompt="$1"
    local line

    # Simple line reading (no fancy history for now)
    echo -n "$prompt"
    read line
    echo "$line"

    # Add to history if not empty
    if [[ -n "$line" ]]; then
        REPL_HISTORY+=("$line")
        REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}
    fi

    echo "$line"
}

# Process gamepad input
process_gamepad_input() {
    local key="$1"

    # Map key to action (safely check if key exists)
    local action=""
    if [[ -n "${GAMEPAD_KEYS[$key]:-}" ]]; then
        action="${GAMEPAD_KEYS[$key]}"
    fi

    if [[ -n "$action" ]]; then
        case "$action" in
            "enter_repl_mode")
                INPUT_MODE="repl"
                call_input_handler "$action"
                ;;
            *)
                call_input_handler "$action"
                ;;
        esac
    else
        # Unknown key - could show help or ignore
        call_input_handler "unknown_key" "$key"
    fi
}

# Process REPL command
process_repl_command() {
    local command_line="$1"

    # Parse command and arguments
    read -ra parts <<< "$command_line"
    local command="${parts[0]}"
    local args=("${parts[@]:1}")

    # Handle empty command
    if [[ -z "$command" ]]; then
        return 0
    fi

    # Map command to action
    local action="${REPL_COMMANDS[$command]}"

    if [[ -n "$action" ]]; then
        case "$action" in
            "enter_gamepad_mode")
                INPUT_MODE="gamepad"
                call_input_handler "$action"
                ;;
            "set_environment"|"set_mode")
                if [[ ${#args[@]} -eq 0 ]]; then
                    echo "Usage: $command <name>"
                    return 1
                fi
                call_input_handler "$action" "${args[0]}"
                ;;
            "execute_action_by_name")
                if [[ ${#args[@]} -eq 0 ]]; then
                    echo "Usage: $command <action_name>"
                    return 1
                fi
                call_input_handler "$action" "${args[0]}"
                ;;
            *)
                call_input_handler "$action" "${args[@]}"
                ;;
        esac
    else
        # Unknown command
        call_input_handler "unknown_command" "$command" "${args[@]}"
    fi
}

# Main input processing loop
process_input() {
    case "$INPUT_MODE" in
        "gamepad")
            local key=$(read_key)
            process_gamepad_input "$key"
            ;;
        "repl")
            local prompt="tview> "
            local command_line=$(read_repl_line "$prompt")
            process_repl_command "$command_line"
            ;;
        *)
            echo "Unknown input mode: $INPUT_MODE" >&2
            return 1
            ;;
    esac
}

# Get current input mode
get_input_mode() {
    echo "$INPUT_MODE"
}

# Set input mode
set_input_mode() {
    local mode="$1"

    case "$mode" in
        "gamepad"|"repl")
            INPUT_MODE="$mode"
            ;;
        *)
            echo "Invalid input mode: $mode" >&2
            return 1
            ;;
    esac
}

# Show available gamepad keys
show_gamepad_help() {
    echo "Gamepad Mode Keys:"
    echo "  e/E     - Navigate environments"
    echo "  d/D     - Navigate modes"
    echo "  a/A     - Navigate actions"
    echo "  l/Enter - Execute selected action"
    echo "  r/R     - Refresh current view"
    echo "  /       - Enter REPL mode"
    echo "  h/H/?   - Show this help"
    echo "  q/Q     - Quit application"
}

# Show available REPL commands
show_repl_help() {
    echo "REPL Mode Commands:"
    echo "  env <name>        - Change environment"
    echo "  mode <name>       - Change mode"
    echo "  action <name>     - Execute action by name"
    echo "  exec <name>       - Execute action by name"
    echo "  list              - List available actions"
    echo "  gamepad           - Return to gamepad mode"
    echo "  refresh           - Refresh current view"
    echo "  help              - Show this help"
    echo "  quit              - Quit application"
}

# Show context-appropriate help
show_help() {
    case "$INPUT_MODE" in
        "gamepad")
            show_gamepad_help
            ;;
        "repl")
            show_repl_help
            ;;
    esac
}

# Initialize input system
init_input() {
    INPUT_MODE="gamepad"
    REPL_HISTORY=()
    REPL_HISTORY_INDEX=0

    # Set up signal handlers for cleanup
    trap 'cleanup_input' EXIT INT TERM

    # Configure terminal for raw input
    if command -v stty >/dev/null 2>&1; then
        # Save original settings
        ORIGINAL_STTY=$(stty -g 2>/dev/null || echo "")

        # Set raw mode for single-character input
        stty raw -echo 2>/dev/null || true
    fi
}

# Cleanup input system
cleanup_input() {
    # Restore original terminal settings
    if [[ -n "${ORIGINAL_STTY:-}" ]]; then
        stty "$ORIGINAL_STTY" 2>/dev/null || true
    fi
}

# Input validation helpers
validate_environment() {
    local env="$1"
    local valid_envs=("$@")

    for valid_env in "${valid_envs[@]:1}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done

    return 1
}

validate_mode() {
    local mode="$1"
    local valid_modes=("$@")

    for valid_mode in "${valid_modes[@]:1}"; do
        if [[ "$mode" == "$valid_mode" ]]; then
            return 0
        fi
    done

    return 1
}

validate_action() {
    local action="$1"
    local valid_actions=("$@")

    for valid_action in "${valid_actions[@]:1}"; do
        local action_name=$(echo "$valid_action" | cut -d':' -f1)
        if [[ "$action" == "$action_name" ]]; then
            return 0
        fi
    done

    return 1
}