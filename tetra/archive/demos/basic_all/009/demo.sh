#!/usr/bin/env bash

# Version 009: CLI REPL Integration
# Clean TUI architecture with proper separation

# Module environment setup
DEMO_SRC="${DEMO_SRC:-$TETRA_SRC/demo/}"
DEMO_DIR="${DEMO_DIR:-$TETRA_DIR/demo}"

# Logging configuration
LOGFILE="./log.demo"

# Logging function
log_action() {
    echo "$(date '+%H:%M:%S') $1" >> "$LOGFILE"
}

# Source TUI systems
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/input.sh"
source "$SCRIPT_DIR/output.sh"
source "$SCRIPT_DIR/repl.sh"

# Validate module environment
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC not defined. Module system requires tetra environment."
    exit 1
fi

# Core application state
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
CONTENT=""

ENVIRONMENTS=("DEMO" "LOCAL" "REMOTE")
MODES=("LEARN" "BUILD" "TEST")

# TView Interface - Content concerns only
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    # Module-aware action discovery using DEMO_SRC
    local module_file="$DEMO_SRC/tview/modules/${mode,,}/actions.sh"

    # Try to load module actions
    if [[ -f "$module_file" ]]; then
        source "$module_file"
        if declare -f get_actions_for_env >/dev/null 2>&1; then
            get_actions_for_env "$env"
            return
        fi
    fi

    # Fallback actions
    echo "help"
    echo "refresh"
    echo "status"
    echo "module-info"
}

execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local module_file="$DEMO_SRC/tview/modules/${mode,,}/actions.sh"

    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    # Log the action execution
    log_action "Execute: $env:$mode:$action"

    # Build result header
    CONTENT="$action → $env:$mode
$(printf '%.40s' '----------------------------------------')"

    # Try module execution first
    if [[ -f "$module_file" ]]; then
        source "$module_file"
        if declare -f execute_action >/dev/null 2>&1; then
            CONTENT+="
$(execute_action "$action" "$env")"
        else
            CONTENT+="
Module found but execute_action function missing"
        fi
    else
        # Fallback execution
        case "$action" in
            "help")
                CONTENT+="
Actions: ${actions[*]}
Keys: e=env d=mode a/s=action ?=help"
                ;;
            "refresh")
                CONTENT+="
State refreshed: $env:$mode
Time: $(date)"
                ;;
            "status")
                CONTENT+="
Current status:
Environment: $env
Mode: $mode
Actions available: ${#actions[@]}"
                ;;
            "module-info")
                if [[ -f "$module_file" ]]; then
                    CONTENT+="
✅ Module file exists: $(basename "$module_file")
📂 Path: $module_file"
                else
                    CONTENT+="
❌ Module file missing
📂 Expected: $module_file
💡 Create: mkdir -p $(dirname "$module_file")"
                fi
                ;;
            *)
                CONTENT+="
Action '$action' not implemented"
                ;;
        esac
    fi
}

# Content generation functions for TUI
render_header() {
    echo ""
}

render_environment_line() {
    local env_line="Env: "
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            env_line+="[${ENVIRONMENTS[$i]}] "
        else
            env_line+="${ENVIRONMENTS[$i]} "
        fi
    done
    echo "$env_line"
}

render_mode_line() {
    local mode_line="Mode: "
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            mode_line+="[${MODES[$i]}] "
        else
            mode_line+="${MODES[$i]} "
        fi
    done
    echo "$mode_line"
}

render_action_line() {
    local actions=($(get_actions))
    local action_line="Action: "

    for i in "${!actions[@]}"; do
        if [[ $i -eq $ACTION_INDEX ]]; then
            action_line+="[${actions[$i]}] "
        else
            action_line+="${actions[$i]} "
        fi
    done

    # Add context info
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    action_line+="($(($ACTION_INDEX + 1))/${#actions[@]}) | Module: actions.sh"

    echo "$action_line"
}

render_footer() {
    local term_width=${COLUMNS:-80}
    local actions=($(get_actions))
    local action_count=${#actions[@]}
    local module_path="module/tview/$(echo "${MODES[$MODE_INDEX]}" | tr '[:upper:]' '[:lower:]')"

    # Dynamic footer with module info
    local footer_text="[${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}] $action_count actions | $module_path | /help"
    local padding=$(((term_width - ${#footer_text}) / 2))
    [[ $padding -lt 0 ]] && padding=0

    printf "%*s%s" $padding "" "$footer_text"
}

clear_content() {
    local term_width=${COLUMNS:-80}
    local message="✨ Content cleared - Terminal: ${COLUMNS}×${LINES}"
    local padding=$(((term_width - ${#message}) / 2))
    [[ $padding -lt 0 ]] && padding=0

    CONTENT="$(printf '%*s%s' $padding '' "$message")"
}

# Standalone REPL mode (no gamepad interface)
run_standalone_repl() {
    echo "Demo REPL v009 - Standalone CLI Interface"
    echo "Current: ENV=${ENVIRONMENTS[$ENV_INDEX]} MODE=${MODES[$MODE_INDEX]}"
    echo

    while true; do
        local prompt=$(get_repl_prompt)
        local input

        # Use simple readline
        if ! read -e -r -p "$prompt" input; then
            echo "Goodbye!"
            break
        fi

        # Skip empty input
        [[ -z "$input" ]] && continue

        # Add to history
        REPL_HISTORY+=("$input")

        # Execute command
        case "$input" in
            "exit"|"q"|"quit")
                echo "Goodbye!"
                return 0
                ;;
            "/help")
                echo
                echo "🎮 REPL Commands:"
                echo "  env [name]    - Switch environment or list all"
                echo "  mode [name]   - Switch mode or list all"
                echo "  fire <action> - Execute action"
                echo "  ls            - List current actions"
                echo
                echo "🔧 Meta Commands:"
                echo "  /help         - Show this help"
                echo "  /status       - Show system status"
                echo "  /commands     - List all available commands"
                echo "  exit          - Exit REPL"
                echo
                ;;
            "/status")
                echo
                echo "📊 System Status:"
                echo "  Environment: ${ENVIRONMENTS[$ENV_INDEX]}"
                echo "  Mode: ${MODES[$MODE_INDEX]}"
                echo "  Module: module/tview/$(echo "${MODES[$MODE_INDEX]}" | tr '[:upper:]' '[:lower:]')"
                local actions=($(get_actions))
                echo "  Actions: ${#actions[@]} available"
                echo "  REPL: v009 standalone mode"
                echo
                ;;
            "/commands")
                echo
                echo "📋 All Available Commands:"
                echo "Regular:"
                echo "  env, mode, fire, ls, exit"
                echo "Meta (/):"
                echo "  /help, /status, /commands"
                echo
                ;;
            "help"|"h")
                echo "Use '/help' for full help, or try '/commands'"
                ;;
            "ls"|"list")
                echo
                echo "📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                local actions=($(get_actions))
                for action in "${actions[@]}"; do
                    echo "  • $action"
                done
                echo
                ;;
            ls*)
                local ls_type="${input#ls }"
                case "$ls_type" in
                    "env"|"environments")
                        echo
                        echo "🌍 Available environments:"
                        for i in "${!ENVIRONMENTS[@]}"; do
                            if [[ $i -eq $ENV_INDEX ]]; then
                                echo "  • ${ENVIRONMENTS[$i]} (current)"
                            else
                                echo "  • ${ENVIRONMENTS[$i]}"
                            fi
                        done
                        echo
                        ;;
                    "mode"|"modes")
                        echo
                        echo "🔧 Available modes:"
                        for i in "${!MODES[@]}"; do
                            if [[ $i -eq $MODE_INDEX ]]; then
                                echo "  • ${MODES[$i]} (current)"
                            else
                                echo "  • ${MODES[$i]}"
                            fi
                        done
                        echo
                        ;;
                    "all")
                        echo
                        echo "🌍 Environments:"
                        for i in "${!ENVIRONMENTS[@]}"; do
                            if [[ $i -eq $ENV_INDEX ]]; then
                                echo "  • ${ENVIRONMENTS[$i]} (current)"
                            else
                                echo "  • ${ENVIRONMENTS[$i]}"
                            fi
                        done
                        echo
                        echo "🔧 Modes:"
                        for i in "${!MODES[@]}"; do
                            if [[ $i -eq $MODE_INDEX ]]; then
                                echo "  • ${MODES[$i]} (current)"
                            else
                                echo "  • ${MODES[$i]}"
                            fi
                        done
                        echo
                        echo "📋 Actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                        local actions=($(get_actions))
                        for action in "${actions[@]}"; do
                            echo "  • $action"
                        done
                        echo
                        ;;
                    *)
                        echo
                        echo "📋 Available actions for ${ENVIRONMENTS[$ENV_INDEX]}:${MODES[$MODE_INDEX]}:"
                        local actions=($(get_actions))
                        for action in "${actions[@]}"; do
                            echo "  • $action"
                        done
                        echo
                        ;;
                esac
                ;;
            "env")
                echo
                echo "🌍 Available environments:"
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ $i -eq $ENV_INDEX ]]; then
                        echo "  • ${ENVIRONMENTS[$i]} (current)"
                    else
                        echo "  • ${ENVIRONMENTS[$i]}"
                    fi
                done
                echo "Usage: env <name>"
                echo
                ;;
            env*)
                local env_name="${input#env }"
                env_name="${env_name// /}"  # Remove spaces
                env_name="${env_name,,}"  # lowercase
                local found=false
                for i in "${!ENVIRONMENTS[@]}"; do
                    if [[ "${ENVIRONMENTS[$i],,}" == "$env_name" ]]; then
                        ENV_INDEX=$i
                        ACTION_INDEX=0
                        printf "Environment switched to: %s\n" "${ENVIRONMENTS[$ENV_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    echo "Unknown environment: $env_name"
                    echo "Available: ${ENVIRONMENTS[*],,}"
                fi
                ;;
            "mode")
                echo
                echo "🔧 Available modes:"
                for i in "${!MODES[@]}"; do
                    if [[ $i -eq $MODE_INDEX ]]; then
                        echo "  • ${MODES[$i]} (current)"
                    else
                        echo "  • ${MODES[$i]}"
                    fi
                done
                echo "Usage: mode <name>"
                echo
                ;;
            mode*)
                local mode_name="${input#mode }"
                mode_name="${mode_name// /}"  # Remove spaces
                mode_name="${mode_name,,}"  # lowercase
                local found=false
                for i in "${!MODES[@]}"; do
                    if [[ "${MODES[$i],,}" == "$mode_name" ]]; then
                        MODE_INDEX=$i
                        ACTION_INDEX=0
                        printf "Mode switched to: %s\n" "${MODES[$MODE_INDEX]}"
                        found=true
                        break
                    fi
                done
                if [[ "$found" == "false" ]]; then
                    echo "Unknown mode: $mode_name"
                    echo "Available: ${MODES[*],,}"
                fi
                ;;
            fire*)
                local action_name="${input#fire }"
                local actions=($(get_actions))
                for i in "${!actions[@]}"; do
                    if [[ "${actions[$i]}" == "$action_name" ]]; then
                        ACTION_INDEX=$i
                        printf "Executing: %s\n" "$action_name"
                        execute_current_action
                        # Show results
                        echo "$CONTENT"
                        break
                    fi
                done
                ;;
            *)
                printf "Unknown command: %s (type 'help' for commands)\n" "$input"
                ;;
        esac
    done
}

# Main application
main() {
    # Check for command line arguments
    if [[ "$1" == "repl" ]]; then
        run_standalone_repl
        return $?
    fi

    echo "Starting Demo v009 - Clean TUI Architecture"
    echo "DEMO_SRC: $DEMO_SRC"
    echo "Use './demo.sh repl' for standalone REPL mode"
    sleep 1

    # Initialize terminal
    init_terminal
    trap 'cleanup_terminal' EXIT

    while true; do
        # Check if we should enter REPL mode
        if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_REPL" ]]; then
            run_repl_loop
            # After REPL, we're back in gamepad mode
            continue
        fi

        # Show gamepad display
        show_gamepad_display

        # Handle input
        read -n1 -s key
        if ! handle_input "$key"; then
            break
        fi
    done

    echo "Demo v009 ended - Clean TUI Architecture demonstrated!"
}

main "$@"