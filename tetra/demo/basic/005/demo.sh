#!/usr/bin/env bash

# Version 005: Show results in the page instead of clearing screen
# Results appear in content area below the 4-line header

# State
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
CONTENT=""

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

# Execute action and capture result
execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local module_file="$(dirname "$0")/${mode,,}_actions.sh"

    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    # Build result header
    CONTENT="🚀 Executing: $action in $env:$mode"
    CONTENT+="\n======================================"
    CONTENT+="\n"

    # Try module execution first
    if [[ -f "$module_file" ]]; then
        source "$module_file"
        if declare -f execute_action >/dev/null 2>&1; then
            CONTENT+="\n$(execute_action "$action" "$env")"
        else
            CONTENT+="\nModule found but execute_action function missing"
        fi
    else
        # Fallback execution
        case "$action" in
            "help")
                CONTENT+="\n❓ Help for $env:$mode"
                CONTENT+="\nAvailable actions: ${actions[*]}"
                ;;
            "refresh")
                CONTENT+="\n🔄 Refreshing $env:$mode context..."
                CONTENT+="\nAction cache cleared"
                ;;
            *)
                CONTENT+="\nAction '$action' executed in $env:$mode context"
                CONTENT+="\n"
                CONTENT+="\n🎯 This demonstrates E×M+A=R:"
                CONTENT+="\n   $env × $mode + $action = This Result"
                ;;
        esac
    fi

    CONTENT+="\n"
    CONTENT+="\n(Press 'c' to clear, or navigate to see other actions)"
}

# Display function with content area
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

    # 4-line header
    echo "TVIEW $hostname | $current_mode:$current_env"

    # Environment line
    local env_line="Env: "
    for i in "${!ENVIRONMENTS[@]}"; do
        if [[ $i -eq $ENV_INDEX ]]; then
            env_line+="[${ENVIRONMENTS[$i]}] "
        else
            env_line+="${ENVIRONMENTS[$i]} "
        fi
    done
    echo "$env_line"

    # Mode line
    local mode_line="Mode: "
    for i in "${!MODES[@]}"; do
        if [[ $i -eq $MODE_INDEX ]]; then
            mode_line+="[${MODES[$i]}] "
        else
            mode_line+="${MODES[$i]} "
        fi
    done
    echo "$mode_line"

    # Action line
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

    # Separator line
    echo "----------------------------------------"

    # Content area
    if [[ -n "$CONTENT" ]]; then
        echo -e "$CONTENT"
    else
        echo "Welcome to TView v005!"
        echo ""
        echo "This version shows action results in the content area below."
        echo ""
        echo "Try:"
        echo "- Navigate with e/d/a keys"
        echo "- Execute actions with l/Enter"
        echo "- See results appear here instead of clearing the screen"
        echo ""
        echo "The 4-line header stays persistent while content changes."
    fi

    # Bottom help line
    echo ""
    echo "e=env d=mode a=action l/Enter=execute c=clear q=quit"
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

clear_content() {
    CONTENT=""
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
            'l'|$'\n'|$'\r') execute_current_action ;;
            'c') clear_content ;;
            'q') break ;;
        esac
    done

    clear
    echo "Version 005 demo ended - Persistent header with content area!"
}

main