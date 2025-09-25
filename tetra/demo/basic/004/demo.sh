#!/usr/bin/env bash

# Version 004: Full E×M+A=R with simple module system
# Discovers actions from mode-specific files

# State
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0

ENVIRONMENTS=("DEMO" "LOCAL" "REMOTE")
MODES=("LEARN" "BUILD" "TEST")

# Get actions for current E×M context
get_actions() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local module_file="$(dirname "$0")/${mode,,}_actions.sh"

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
}

# Execute action from current module
execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local module_file="$(dirname "$0")/${mode,,}_actions.sh"

    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    clear
    echo "🚀 Executing: $action in $env:$mode"
    echo "======================================"
    echo ""

    # Try module execution first
    if [[ -f "$module_file" ]]; then
        source "$module_file"
        if declare -f execute_action >/dev/null 2>&1; then
            execute_action "$action" "$env"
            return
        fi
    fi

    # Fallback execution
    case "$action" in
        "help")
            echo "❓ Help for $env:$mode"
            echo "Available actions: ${actions[*]}"
            ;;
        "refresh")
            echo "🔄 Refreshing $env:$mode context..."
            ;;
        *)
            echo "Action '$action' executed in $env:$mode context"
            echo ""
            echo "🎯 This demonstrates E×M+A=R:"
            echo "   $env × $mode + $action = This Result"
            ;;
    esac

    echo ""
    read -p "Press Enter to continue..."
}

# Display function
show_display() {
    clear
    local hostname=$(hostname -s)
    local current_env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_mode="${MODES[$MODE_INDEX]}"
    local actions=($(get_actions))

    # Ensure action index is valid
    if [[ $ACTION_INDEX -ge ${#actions[@]} ]]; then
        ACTION_INDEX=0
    fi

    local current_action="${actions[$ACTION_INDEX]:-help}"

    # Line 1
    echo "TVIEW $hostname | $current_mode:$current_env"

    # Line 2 - Environments
    local env_line="Env: "
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            env_line+="[${ENVIRONMENTS[$i]}] "
        else
            env_line+="${ENVIRONMENTS[$i]} "
        fi
    done
    echo "$env_line"

    # Line 3 - Modes
    local mode_line="Mode: "
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            mode_line+="[${MODES[$i]}] "
        else
            mode_line+="${MODES[$i]} "
        fi
    done
    echo "$mode_line"

    # Line 4 - Actions
    local action_line="Action: "
    for i in "${!actions[@]}"; do
        if [[ $i -eq $ACTION_INDEX ]]; then
            action_line+="[${actions[$i]}] "
        else
            action_line+="${actions[$i]} "
        fi
    done
    action_line+="($(($ACTION_INDEX + 1))/${#actions[@]})"
    echo "$action_line"

    echo ""
    echo "e=env d=mode a=action l/Enter=execute q=quit"
}

# Navigation functions
next_env() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
}

next_mode() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
}

next_action() {
    local actions=($(get_actions))
    ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
}

# Main loop
main() {
    echo "🚀 Starting TView Demo v004"
    echo "E×M+A=R with module discovery"
    echo ""
    sleep 1

    while true; do
        show_display
        read -n1 -s key

        case "$key" in
            'e') next_env ;;
            'd') next_mode ;;
            'a') next_action ;;
            'l'|$'\n'|$'\r') execute_current_action ;;
            'q') break ;;
        esac
    done

    clear
    echo "Version 004 demo ended - E×M+A=R demonstrated!"
}

main