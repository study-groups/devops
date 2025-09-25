#!/usr/bin/env bash

# Version 003: Add action execution with l/Enter keys
# Hardcoded action responses to demonstrate E×M+A=R

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
    echo "e=env d=mode a=action l/Enter=execute q=quit"
}

# Execute current action
execute_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local action="${ACTIONS[$ACTION_INDEX]}"

    clear
    echo "🚀 Executing: $action in $env:$mode"
    echo "======================================"
    echo ""

    # Simple E×M+A=R demonstration
    case "$action:$env:$mode" in
        "explain_formula:DEMO:LEARN")
            echo "📚 E×M+A=R Formula (Demo Level)"
            echo ""
            echo "E (Environment) = $env (tutorial context)"
            echo "M (Mode) = $mode (educational mode)"
            echo "A (Action) = $action (this explanation)"
            echo "R (Result) = You're seeing it now!"
            echo ""
            echo "This demonstrates the formula in action."
            ;;
        "explain_formula:LOCAL:BUILD")
            echo "🔧 E×M+A=R Formula (Build Context)"
            echo ""
            echo "In LOCAL:BUILD context, this action would show:"
            echo "- How to create ACTION_DEF structures"
            echo "- Build system integration"
            echo "- Local development workflow"
            ;;
        "show_structure:"*":"*)
            echo "🏗️ System Structure"
            echo ""
            echo "Current context: $env:$mode"
            echo ""
            echo "Simple 3-part structure:"
            echo "1. State management (ENV/MODE/ACTION indices)"
            echo "2. Display rendering (4-line header)"
            echo "3. Input handling (e/d/a/l/q keys)"
            ;;
        "help:"*":"*)
            echo "❓ Help for $env:$mode"
            echo ""
            echo "Available keys:"
            echo "  e - Cycle environments (DEMO→LOCAL→REMOTE)"
            echo "  d - Cycle modes (LEARN→BUILD→TEST)"
            echo "  a - Cycle actions"
            echo "  l/Enter - Execute selected action"
            echo "  q - Quit"
            echo ""
            echo "Try different E×M combinations to see how"
            echo "the same actions behave differently!"
            ;;
        *)
            echo "Action '$action' in context '$env:$mode'"
            echo "This demonstrates how the same action can"
            echo "produce different results in different contexts."
            ;;
    esac

    echo ""
    echo "🎯 This was: $env × $mode + $action = This Result"
    echo ""
    read -p "Press Enter to continue..."
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
            'l'|$'\n'|$'\r') execute_action ;;
            'q') break ;;
        esac
    done

    clear
    echo "Version 003 demo ended"
}

main