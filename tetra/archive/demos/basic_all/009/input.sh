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

        # Action operations (small a=info, big A=fire)
        'a')
            local actions=($(get_actions))
            if [[ ${#actions[@]} -gt 0 ]]; then
                log_action "Input: Action info requested: ${actions[$ACTION_INDEX]}"
                show_action_info
            fi
            ;;
        'A')
            log_action "Input: Fire action requested (A)"
            execute_current_action
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

# REPL mode input handling with command editing
handle_repl_input() {
    local key="$1"

    case "$key" in
        $'\033') # ESC key
            switch_to_gamepad_mode
            return 0
            ;;
        $'
'|$'\r') # Enter key
            if [[ -n "$REPL_INPUT" ]]; then
                # Add to history
                REPL_HISTORY+=("$REPL_INPUT")
                REPL_HISTORY_INDEX=${#REPL_HISTORY[@]}

                # Execute command
                execute_repl_command "$REPL_INPUT"

                # Clear input
                REPL_INPUT=""
                REPL_CURSOR_POS=0
            fi
            ;;
        $'\177'|$'\b') # Backspace
            if [[ ${#REPL_INPUT} -gt 0 ]]; then
                REPL_INPUT="${REPL_INPUT%?}"
                if [[ $REPL_CURSOR_POS -gt 0 ]]; then
                    ((REPL_CURSOR_POS--))
                fi
            fi
            ;;
        $'\t') # Tab key - command completion
            handle_repl_tab_completion
            ;;
        *) # Regular character input
            if [[ -n "$key" ]] && [[ ${#key} -eq 1 ]]; then
                REPL_INPUT+="$key"
                ((REPL_CURSOR_POS++))
            fi
            ;;
    esac

    return 0
}

# Handle tab completion in REPL
handle_repl_tab_completion() {
    local current_word="$REPL_INPUT"
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"

    # Simple completion for commands and contexts
    case "$current_word" in
        "env "*)
            # Complete environment names
            local partial="${current_word#env }"
            for env_name in "${ENVIRONMENTS[@]}"; do
                if [[ "${env_name,,}" =~ ^"${partial,,}" ]]; then
                    REPL_INPUT="env ${env_name,,}"
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
        "mode "*)
            # Complete mode names
            local partial="${current_word#mode }"
            for mode_name in "${MODES[@]}"; do
                if [[ "${mode_name,,}" =~ ^"${partial,,}" ]]; then
                    REPL_INPUT="mode ${mode_name,,}"
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
        "fire "*)
            # Complete action names
            local partial="${current_word#fire }"
            local actions=($(get_actions))
            for action in "${actions[@]}"; do
                if [[ "$action" =~ ^"$partial" ]]; then
                    REPL_INPUT="fire $action"
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
        *)
            # Complete command names
            local commands=("env" "mode" "fire" "ls" "list" "help" "clear")
            for cmd in "${commands[@]}"; do
                if [[ "$cmd" =~ ^"$current_word" ]]; then
                    REPL_INPUT="$cmd "
                    REPL_CURSOR_POS=${#REPL_INPUT}
                    return
                fi
            done
            ;;
    esac
}

# Mode switching functions
switch_to_gamepad_mode() {
    CURRENT_INPUT_MODE="$INPUT_MODE_GAMEPAD"
    log_action "Input: Switched to gamepad mode"
}

switch_to_repl_mode() {
    CURRENT_INPUT_MODE="$INPUT_MODE_REPL"
    log_action "Input: Switched to REPL mode"
    # Don't echo - let the display system handle it
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

    CONTENT="📋 Action Info: $current_action
$(printf '%.40s' '=======================================')

🎯 Context:
   Environment: $env
   Mode: $mode
   Action: $current_action ($(($ACTION_INDEX + 1))/${#actions[@]})

📁 Module Integration:"

    if [[ -f "$module_file" ]]; then
        CONTENT+="
   ✅ Module file exists: $(basename "$module_file")
   📂 Path: $module_file"

        # Check for execute_action function
        if grep -q "execute_action" "$module_file" 2>/dev/null; then
            CONTENT+="   ✅ execute_action function found
"
        else
            CONTENT+="   ⚠️  execute_action function missing
"
        fi

        # Check for get_actions_for_env function
        if grep -q "get_actions_for_env" "$module_file" 2>/dev/null; then
            CONTENT+="   ✅ get_actions_for_env function found
"
        else
            CONTENT+="   ⚠️  get_actions_for_env function missing
"
        fi
    else
        CONTENT+="   ❌ Module file missing
"
        CONTENT+="   📂 Expected: $module_file
"
        CONTENT+="   💡 Create module directory: mkdir -p $(dirname "$module_file")
"
        CONTENT+="   💡 Create actions.sh with required functions
"
    fi

    CONTENT+="
🎮 Available Actions:
"
    local idx=0
    for action in "${actions[@]}"; do
        if [[ $idx -eq $ACTION_INDEX ]]; then
            CONTENT+="   ▶ $action (SELECTED)
"
        else
            CONTENT+="   • $action
"
        fi
        ((idx++))
    done

    CONTENT+="
🔧 Next Steps:
"
    CONTENT+="   S = Execute this action
"
    CONTENT+="   a/A = Navigate to other actions
"
    CONTENT+="   c = Clear this info
"
}

# Help display (TUI concern)
show_help() {
    CONTENT="🎮 Input Help - Bidirectional Navigation
"
    CONTENT+="=====================================
"
    CONTENT+="
Navigation (Bidirectional):
"
    CONTENT+="  e = Environment right, E = Environment left
"
    CONTENT+="  d = Mode right, D = Mode left
"
    CONTENT+="
Action Handling:
"
    CONTENT+="  s/S = Action select (auto-shows info)
"
    CONTENT+="  f = Fire action (execute), F = Full action info
"
    CONTENT+="  a/A = Legacy execute/info (still supported)
"
    CONTENT+="
UI Controls:
"
    CONTENT+="  c/C = Clear content
"
    CONTENT+="  r/R = Refresh
"
    CONTENT+="  ?/h/H = Show this help
"
    CONTENT+="
Mode Switching:
"
    CONTENT+="  / = Switch to REPL mode
"
    CONTENT+="
Exit:
"
    CONTENT+="  q/Q/ESC = Quit
"
    CONTENT+="
Current Mode: $CURRENT_INPUT_MODE"
}

# Get input mode for display
get_input_mode_display() {
    case "$CURRENT_INPUT_MODE" in
        "$INPUT_MODE_GAMEPAD") echo "🎮" ;;
        "$INPUT_MODE_REPL") echo "💻" ;;
        *) echo "?" ;;
    esac
}