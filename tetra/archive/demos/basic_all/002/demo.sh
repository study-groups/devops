#!/usr/bin/env bash

# Version 002: Basic navigation with e/d/a keys
# Simple state management with live updates

# State
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0

ENVIRONMENTS=("DEMO" "LOCAL" "REMOTE")
MODES=("LEARN" "BUILD" "TEST")
ACTIONS=("explain_formula" "show_structure" "help")

# Display function
show_display() {
    clear
    local hostname=$(hostname -s)
    local current_env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_mode="${MODES[$MODE_INDEX]}"
    local current_action="${ACTIONS[$ACTION_INDEX]}"

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
    for i in "${!ACTIONS[@]}"; do
        if [[ $i -eq $ACTION_INDEX ]]; then
            action_line+="[$current_action] "
        else
            action_line+="${ACTIONS[$i]} "
        fi
    done
    action_line+="($(($ACTION_INDEX + 1))/${#ACTIONS[@]})"
    echo "$action_line"

    echo ""
    echo "e=next env  d=next mode  a=next action  q=quit"
}

# Navigation functions
next_env() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
}

next_mode() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
}

next_action() {
    ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#ACTIONS[@]} ))
}

# Main loop
main() {
    while true; do
        show_display
        read -n1 -s key

        case "$key" in
            'e') next_env ;;
            'd') next_mode ;;
            'a') next_action ;;
            'q') break ;;
        esac
    done

    clear
    echo "Version 002 demo ended"
}

main