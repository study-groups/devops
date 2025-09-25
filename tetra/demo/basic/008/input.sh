#!/usr/bin/env bash

# TUI Input System - Interface Concern Only
# Responsibility: Key handling, navigation, mode switching
# Never contains content or business logic

# Input mode constants
declare -g INPUT_MODE_GAMEPAD="gamepad"
declare -g INPUT_MODE_REPL="repl"
declare -g CURRENT_INPUT_MODE="$INPUT_MODE_GAMEPAD"

# Navigation state functions (TUI concerns only)
navigate_env_right() {
    ENV_INDEX=$(( (ENV_INDEX + 1) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
    log_action "Navigation: Environment -> ${ENVIRONMENTS[$ENV_INDEX]}"
}

navigate_env_left() {
    ENV_INDEX=$(( (ENV_INDEX - 1 + ${#ENVIRONMENTS[@]}) % ${#ENVIRONMENTS[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
    log_action "Navigation: Environment <- ${ENVIRONMENTS[$ENV_INDEX]}"
}

navigate_mode_right() {
    MODE_INDEX=$(( (MODE_INDEX + 1) % ${#MODES[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
    log_action "Navigation: Mode -> ${MODES[$MODE_INDEX]}"
}

navigate_mode_left() {
    MODE_INDEX=$(( (MODE_INDEX - 1 + ${#MODES[@]}) % ${#MODES[@]} ))
    ACTION_INDEX=0  # Reset action when changing context
    log_action "Navigation: Mode <- ${MODES[$MODE_INDEX]}"
}

navigate_action_right() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ACTION_INDEX=$(( (ACTION_INDEX + 1) % ${#actions[@]} ))
        log_action "Navigation: Action -> ${actions[$ACTION_INDEX]}"
    fi
}

navigate_action_left() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -gt 0 ]]; then
        ACTION_INDEX=$(( (ACTION_INDEX - 1 + ${#actions[@]}) % ${#actions[@]} ))
        log_action "Navigation: Action <- ${actions[$ACTION_INDEX]}"
    fi
}

# Clear UI content (TUI concern)
clear_ui_content() {
    CONTENT=""
    log_action "UI: Content cleared"
}

# Core input handler - delegates to mode-specific handlers
handle_input() {
    local key="$1"

    case "$CURRENT_INPUT_MODE" in
        "$INPUT_MODE_GAMEPAD")
            handle_gamepad_input "$key"
            ;;
        "$INPUT_MODE_REPL")
            handle_repl_input "$key"
            ;;
        *)
            log_action "Error: Unknown input mode $CURRENT_INPUT_MODE"
            return 0
            ;;
    esac
}

# Gamepad mode input handling
handle_gamepad_input() {
    local key="$1"

    case "$key" in
        # Environment navigation (bidirectional)
        'e') navigate_env_right ;;
        'E') navigate_env_left ;;

        # Mode navigation (bidirectional)
        'd') navigate_mode_right ;;
        'D') navigate_mode_left ;;

        # Action selection (immediate visual change with auto-info)
        's')
            navigate_action_right
            # Auto-show info when selection changes
            local actions=($(get_actions))
            if [[ ${#actions[@]} -gt 0 ]]; then
                show_action_info
            fi
            ;;
        'S')
            navigate_action_left
            # Auto-show info when selection changes
            local actions=($(get_actions))
            if [[ ${#actions[@]} -gt 0 ]]; then
                show_action_info
            fi
            ;;

        # Action execution (fire!)
        'f')
            log_action "Input: Fire action requested"
            execute_current_action
            ;;
        'F')
            local actions=($(get_actions))
            if [[ ${#actions[@]} -gt 0 ]]; then
                log_action "Input: Action info requested: ${actions[$ACTION_INDEX]}"
                show_action_info
            fi
            ;;

        # Legacy action operations (keep for compatibility)
        'a')
            log_action "Input: Execute action requested (legacy)"
            execute_current_action
            ;;
        'A')
            local actions=($(get_actions))
            if [[ ${#actions[@]} -gt 0 ]]; then
                log_action "Input: Action info requested (legacy): ${actions[$ACTION_INDEX]}"
                show_action_info
            fi
            ;;

        # UI controls
        'c'|'C') clear_ui_content ;;
        'r'|'R')
            log_action "Input: Refresh requested"
            clear_ui_content
            ;;

        # Mode switching
        '/')
            switch_to_repl_mode
            return 0
            ;;

        # Help
        '?'|'h'|'H')
            log_action "Input: Help requested"
            show_help
            ;;

        # Exit
        'q'|'Q'|$'\033')
            log_action "Input: Quit requested"
            return 1  # Signal to quit
            ;;

        # Unknown key
        *)
            if [[ -n "$key" ]]; then
                log_action "Input: Unknown key '$key' in gamepad mode"
            fi
            ;;
    esac

    return 0
}

# REPL mode input handling (future extensibility)
handle_repl_input() {
    local key="$1"

    case "$key" in
        $'\033') # ESC key
            switch_to_gamepad_mode
            return 0
            ;;
        *)
            # In future: handle REPL command input
            log_action "Input: REPL mode - ESC to return to gamepad"
            ;;
    esac

    return 0
}

# Mode switching functions
switch_to_gamepad_mode() {
    CURRENT_INPUT_MODE="$INPUT_MODE_GAMEPAD"
    log_action "Input: Switched to gamepad mode"
}

switch_to_repl_mode() {
    CURRENT_INPUT_MODE="$INPUT_MODE_REPL"
    log_action "Input: Switched to REPL mode"
    echo "REPL mode - press ESC to return to gamepad mode"
}

# Input validation and sanitization
validate_action_index() {
    local actions=($(get_actions))
    if [[ $ACTION_INDEX -ge ${#actions[@]} ]]; then
        ACTION_INDEX=0
        log_action "Navigation: Action index reset to 0"
    fi
}

# Show detailed action information (TUI concern)
show_action_info() {
    local actions=($(get_actions))
    if [[ ${#actions[@]} -eq 0 ]]; then
        CONTENT="No actions available"
        return
    fi

    local current_action="${actions[$ACTION_INDEX]}"
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local module_file="$DEMO_SRC/tview/modules/${mode,,}/actions.sh"

    CONTENT="📋 Action Info: $current_action\n"
    CONTENT+="$(printf '%.40s' '=======================================')\n"
    CONTENT+="\n🎯 Context:\n"
    CONTENT+="   Environment: $env\n"
    CONTENT+="   Mode: $mode\n"
    CONTENT+="   Action: $current_action ($(($ACTION_INDEX + 1))/${#actions[@]})\n"
    CONTENT+="\n📁 Module Integration:\n"

    if [[ -f "$module_file" ]]; then
        CONTENT+="   ✅ Module file exists: $(basename "$module_file")\n"
        CONTENT+="   📂 Path: $module_file\n"

        # Check for execute_action function
        if grep -q "execute_action" "$module_file" 2>/dev/null; then
            CONTENT+="   ✅ execute_action function found\n"
        else
            CONTENT+="   ⚠️  execute_action function missing\n"
        fi

        # Check for get_actions_for_env function
        if grep -q "get_actions_for_env" "$module_file" 2>/dev/null; then
            CONTENT+="   ✅ get_actions_for_env function found\n"
        else
            CONTENT+="   ⚠️  get_actions_for_env function missing\n"
        fi
    else
        CONTENT+="   ❌ Module file missing\n"
        CONTENT+="   📂 Expected: $module_file\n"
        CONTENT+="   💡 Create module directory: mkdir -p $(dirname "$module_file")\n"
        CONTENT+="   💡 Create actions.sh with required functions\n"
    fi

    CONTENT+="\n🎮 Available Actions:\n"
    local idx=0
    for action in "${actions[@]}"; do
        if [[ $idx -eq $ACTION_INDEX ]]; then
            CONTENT+="   ▶ $action (SELECTED)\n"
        else
            CONTENT+="   • $action\n"
        fi
        ((idx++))
    done

    CONTENT+="\n🔧 Next Steps:\n"
    CONTENT+="   S = Execute this action\n"
    CONTENT+="   a/A = Navigate to other actions\n"
    CONTENT+="   c = Clear this info\n"
}

# Help display (TUI concern)
show_help() {
    CONTENT="🎮 Input Help - Bidirectional Navigation\n"
    CONTENT+="=====================================\n"
    CONTENT+="\nNavigation (Bidirectional):\n"
    CONTENT+="  e = Environment right, E = Environment left\n"
    CONTENT+="  d = Mode right, D = Mode left\n"
    CONTENT+="\nAction Handling:\n"
    CONTENT+="  s/S = Action select (auto-shows info)\n"
    CONTENT+="  f = Fire action (execute), F = Full action info\n"
    CONTENT+="  a/A = Legacy execute/info (still supported)\n"
    CONTENT+="\nUI Controls:\n"
    CONTENT+="  c/C = Clear content\n"
    CONTENT+="  r/R = Refresh\n"
    CONTENT+="  ?/h/H = Show this help\n"
    CONTENT+="\nMode Switching:\n"
    CONTENT+="  / = Switch to REPL mode\n"
    CONTENT+="\nExit:\n"
    CONTENT+="  q/Q/ESC = Quit\n"
    CONTENT+="\nCurrent Mode: $CURRENT_INPUT_MODE"
}

# Get input mode for display
get_input_mode_display() {
    case "$CURRENT_INPUT_MODE" in
        "$INPUT_MODE_GAMEPAD") echo "🎮" ;;
        "$INPUT_MODE_REPL") echo "💻" ;;
        *) echo "?" ;;
    esac
}