#!/usr/bin/env bash

# Version 006: Implementation of TUI/TView separation principles
# Based on documentation analysis and architecture specifications
# Next: insist on:
#     DEMO_SRC=$TETRA_SRC/demo/
#     DEMO_DIR=$TETRA_SRC/demo/docs  (typically $TETRA_DIR/<module>)

# State
ENV_INDEX=0
MODE_INDEX=0
ACTION_INDEX=0
CONTENT=""

ENVIRONMENTS=("DEMO" "LOCAL" "REMOTE")
MODES=("LEARN" "BUILD" "TEST")

# Environment color definitions
declare -A ENV_COLORS=(
    ["DEMO"]="cyan"
    ["LOCAL"]="green"
    ["REMOTE"]="magenta"
)

# TView Interface - Content concerns
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
    echo "status"
}

execute_current_action() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local module_file="$(dirname "$0")/${mode,,}_actions.sh"

    local actions=($(get_actions))
    local action="${actions[$ACTION_INDEX]}"

    # Build result header following TView principles
    CONTENT="🚀 Action: $action | Context: $env:$mode"
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
        # Fallback execution demonstrating E×M+A=R formula
        case "$action" in
            "help")
                CONTENT+="\n📖 Help for $env:$mode"
                CONTENT+="\nAvailable actions: ${actions[*]}"
                CONTENT+="\nNavigation: e=env d=mode a=action l=execute"
                ;;
            "refresh")
                CONTENT+="\n🔄 Refreshing $env:$mode context..."
                CONTENT+="\nAction cache cleared"
                CONTENT+="\nModule discovery refreshed"
                ;;
            "status")
                CONTENT+="\n📊 Status for $env:$mode"
                CONTENT+="\nEnvironment: $env (${ENV_COLORS[$env]:-default} theme)"
                CONTENT+="\nMode: $mode"
                CONTENT+="\nActions available: ${#actions[@]}"
                CONTENT+="\nVersion: 006 (TUI/TView separation)"
                ;;
            *)
                CONTENT+="\nAction '$action' executed in $env:$mode context"
                CONTENT+="\n"
                CONTENT+="\n🎯 E×M+A=R Formula Demonstration:"
                CONTENT+="\n   Environment: $env"
                CONTENT+="\n   Mode: $mode"
                CONTENT+="\n   Action: $action"
                CONTENT+="\n   Result: Context-specific execution"
                ;;
        esac
    fi

    CONTENT+="\n"
    CONTENT+="\n💡 TUI/TView Separation: Content logic handled by TView system"
    CONTENT+="\n(Press 'c' to clear, or navigate to explore other actions)"
}

# TUI Interface - Display concerns
render_header() {
    local hostname=$(hostname -s)
    local current_env="${ENVIRONMENTS[$ENV_INDEX]}"
    local current_mode="${MODES[$MODE_INDEX]}"

    # Line 1: Title and context
    echo "TVIEW $hostname | $current_env:$current_mode"
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
    action_line+="($(($ACTION_INDEX + 1))/${#actions[@]})"
    echo "$action_line"
}

render_content() {
    if [[ -n "$CONTENT" ]]; then
        echo -e "$CONTENT"
    else
        echo "Welcome to TView v006!"
        echo ""
        echo "🏗️  Architecture: TUI/TView separation implemented"
        echo "📋 Interface: 4-line header with persistent content area"
        echo "🎮 Navigation: Gamepad mode (single key presses)"
        echo ""
        echo "Key Features:"
        echo "- Environment × Mode + Action = Result (E×M+A=R)"
        echo "- Module system for extensible actions"
        echo "- Persistent UI with content accumulation"
        echo "- Clean separation between interface and content"
        echo ""
        echo "Try navigating and executing actions to see the system in action!"
    fi
}

# Navigation functions (TUI concerns)
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
    if [[ ${#actions[@]} -gt 0 ]]; then
        ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
    fi
}

clear_content() {
    CONTENT=""
}

# Input handling (TUI concerns)
handle_input() {
    local key="$1"
    case "$key" in
        'e') next_env ;;
        'd') next_mode ;;
        'a') next_action ;;
        'l'|$'\n'|$'\r') execute_current_action ;;
        'c') clear_content ;;
        'q') return 1 ;;  # Signal to quit
    esac
    return 0
}

# Validate action index on context changes
validate_action_index() {
    local actions=($(get_actions))
    if [[ $ACTION_INDEX -ge ${#actions[@]} ]]; then
        ACTION_INDEX=0
    fi
}

# Complete display function following TUI principles
show_display() {
    validate_action_index
    clear

    render_header
    render_environment_line
    render_mode_line
    render_action_line

    echo "----------------------------------------"

    render_content

    echo ""
    echo "e=env d=mode a=action l/Enter=execute c=clear q=quit | v006 TUI/TView"
}

# Main loop
main() {
    echo "Starting TView v006 - TUI/TView Separation Demo"
    sleep 1

    while true; do
        show_display
        read -n1 -s key

        if ! handle_input "$key"; then
            break
        fi
    done

    clear
    echo "TView v006 ended - TUI/TView separation principles demonstrated!"
    echo ""
    echo "Architecture achievements:"
    echo "✅ Clean separation between interface (TUI) and content (TView)"
    echo "✅ Modular action system with graceful fallbacks"
    echo "✅ Persistent header with content area"
    echo "✅ E×M+A=R formula implementation"
    echo "✅ Responsive navigation and execution"
}

main
