#!/usr/bin/env bash

# TUI Game-like Input System - Enhanced Input Handling
# Phase 4: Game-like input mapping with immediate responsiveness

# Input mapping registry
declare -A GAME_INPUT_MAP=(
    # Navigation keys (home row)
    [e]="navigate_env_right"
    [E]="navigate_env_left"
    [d]="navigate_mode_right"
    [D]="navigate_mode_left"
    [f]="navigate_action_right"
    [F]="navigate_action_left"

    # View switching (number keys)
    [1]="switch_view:actions"
    [2]="switch_view:palette"
    [3]="switch_view:info"
    [4]="switch_view:repl"
    [5]="switch_view:debug"

    # Navigation keys
    [i]="navigate_action_up"
    [k]="navigate_action_down"

    # View switching (letter keys)
    [a]="show_action_catalog"
    [p]="switch_view:palette"
    [r]="switch_view:repl"

    # Action controls
    [c]="action_clear"
    [R]="action_refresh"

    # System controls
    [q]="system_quit"
    [Q]="system_quit"
    [h]="system_help"
)

# Input action handlers
input_action_navigate_env_right() {
    navigate_env_right
    refresh_current_view
}

input_action_navigate_env_left() {
    navigate_env_left
    refresh_current_view
}

input_action_navigate_mode_right() {
    navigate_mode_right
    refresh_current_view
}

input_action_navigate_mode_left() {
    navigate_mode_left
    refresh_current_view
}

input_action_navigate_action_right() {
    navigate_action_right

    # Auto-execute show actions for better UX
    if in_view_mode "$VIEW_ACTIONS"; then
        local actions=($(get_actions))
        if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
            local action="${actions[$ACTION_INDEX]}"
            if [[ "$action" == show:* ]]; then
                execute_current_action
            fi
        fi
    fi

    refresh_current_view
}

input_action_navigate_action_left() {
    navigate_action_left

    # Auto-execute show actions for better UX
    if in_view_mode "$VIEW_ACTIONS"; then
        local actions=($(get_actions))
        if [[ ${#actions[@]} -gt 0 && $ACTION_INDEX -lt ${#actions[@]} ]]; then
            local action="${actions[$ACTION_INDEX]}"
            if [[ "$action" == show:* ]]; then
                execute_current_action
            fi
        fi
    fi

    refresh_current_view
}

input_action_switch_view() {
    local view_mode="$1"
    switch_view_mode "$view_mode"
}

input_action_action_execute() {
    if in_view_mode "$VIEW_ACTIONS"; then
        execute_current_action
        refresh_current_view
    fi
}

input_action_action_clear() {
    clear_content
    refresh_current_view
}

input_action_action_refresh() {
    mark_all_dirty
    refresh_current_view
}

input_action_system_quit() {
    return 1  # Signal to quit
}

input_action_system_help() {
    switch_view_mode "$VIEW_INFO"
}

input_action_show_action_catalog() {
    show_action_catalog
    refresh_current_view
}

input_action_navigate_action_up() {
    navigate_action_up
    refresh_current_view
}

input_action_navigate_action_down() {
    navigate_action_down
    refresh_current_view
}

input_action_arrow_up() {
    case "$CURRENT_VIEW_MODE" in
        "$VIEW_ACTIONS")
            navigate_action_up
            refresh_current_view
            ;;
        "$VIEW_REPL")
            # REPL history navigation
            handle_repl_history_up
            ;;
    esac
}

input_action_arrow_down() {
    case "$CURRENT_VIEW_MODE" in
        "$VIEW_ACTIONS")
            navigate_action_down
            refresh_current_view
            ;;
        "$VIEW_REPL")
            # REPL history navigation
            handle_repl_history_down
            ;;
    esac
}

input_action_arrow_left() {
    case "$CURRENT_VIEW_MODE" in
        "$VIEW_ACTIONS")
            navigate_env_left
            refresh_current_view
            ;;
        "$VIEW_REPL")
            # REPL cursor movement
            handle_repl_cursor_left
            ;;
    esac
}

input_action_arrow_right() {
    case "$CURRENT_VIEW_MODE" in
        "$VIEW_ACTIONS")
            navigate_env_right
            refresh_current_view
            ;;
        "$VIEW_REPL")
            # REPL cursor movement
            handle_repl_cursor_right
            ;;
    esac
}

# Enhanced input processing with game-like responsiveness
process_game_input() {
    local key="$1"

    # Handle special keys first
    case "$key" in
        $'\n'|$'\r') # Enter/Return keys
            input_action_action_execute
            return $?
            ;;
        '?') # Help key
            input_action_system_help
            return $?
            ;;
    esac

    # Check for mapped action (with safety check)
    local mapped_action=""
    if [[ -v "GAME_INPUT_MAP[$key]" ]]; then
        mapped_action="${GAME_INPUT_MAP[$key]}"
    fi

    if [[ -n "$mapped_action" ]]; then
        # Parse action and parameters
        local action_func="input_action_${mapped_action%:*}"
        local action_param="${mapped_action#*:}"

        # Remove switch_view prefix if present
        if [[ "$action_func" == "input_action_switch_view" ]]; then
            action_func="input_action_switch_view"
        fi

        # Execute mapped action
        if declare -F "$action_func" >/dev/null; then
            if [[ "$mapped_action" == *:* ]]; then
                "$action_func" "$action_param"
            else
                "$action_func"
            fi
        else
            log_action "GameInput: Unknown action function $action_func"
        fi
    else
        # Handle unmapped input
        handle_unmapped_input "$key"
    fi
}

# Handle unmapped input based on current view mode
handle_unmapped_input() {
    local key="$1"

    # Let view controller handle it first
    handle_view_input "$key"

    # Log unmapped input for debugging
    if [[ -n "$key" && "$key" != $'\033' ]]; then
        log_action "GameInput: Unmapped key '$key' in view $CURRENT_VIEW_MODE"
    fi
}

# Escape sequence processing for arrow keys
process_escape_sequence() {
    local next_char
    local arrow_seq

    # Read next character with timeout
    if read -t 0.1 -n1 next_char 2>/dev/null; then
        if [[ "$next_char" == "[" ]]; then
            # Read arrow key
            if read -t 0.1 -n1 arrow_seq 2>/dev/null; then
                local full_sequence=$'\033'"[$arrow_seq"
                process_game_input "$full_sequence"
                return 0
            fi
        fi
    fi

    # Handle bare ESC (exit REPL or help)
    if in_view_mode "$VIEW_REPL"; then
        switch_view_mode "$VIEW_ACTIONS"
    else
        input_action_system_help
    fi

    return 0
}

# Enhanced input loop with stable rendering
run_game_input_loop() {
    # Initial render
    present_frame

    while true; do
        # Read input without timeout to prevent constant redraws
        local key
        if read -n1 -s key 2>/dev/null; then
            # Handle escape sequences
            if [[ "$key" == $'\033' ]]; then
                if ! process_escape_sequence; then
                    break
                fi
                continue
            fi

            # Process regular input
            if ! process_game_input "$key"; then
                break
            fi

            # Only render after input
            present_frame
        fi

        # Handle terminal resize
        if [[ "$COLUMNS" != "${LAST_COLUMNS:-80}" || "$LINES" != "${LAST_LINES:-24}" ]]; then
            handle_terminal_resize
            present_frame
            LAST_COLUMNS="$COLUMNS"
            LAST_LINES="$LINES"
        fi
    done
}

# Refresh current view after input
refresh_current_view() {
    local controller="${VIEW_CONTROLLERS[$CURRENT_VIEW_MODE]}"
    local update_func="${controller}_update"

    if declare -F "$update_func" >/dev/null; then
        "$update_func"
    fi
}

# REPL-specific input handling functions
handle_repl_history_up() {
    if [[ $REPL_HISTORY_INDEX -gt 0 ]]; then
        ((REPL_HISTORY_INDEX--))
        REPL_INPUT="${REPL_HISTORY[$REPL_HISTORY_INDEX]}"
        REPL_CURSOR_POS=${#REPL_INPUT}
        mark_component_dirty "repl"
    fi
}

handle_repl_history_down() {
    if [[ $REPL_HISTORY_INDEX -lt ${#REPL_HISTORY[@]} ]]; then
        ((REPL_HISTORY_INDEX++))
        if [[ $REPL_HISTORY_INDEX -lt ${#REPL_HISTORY[@]} ]]; then
            REPL_INPUT="${REPL_HISTORY[$REPL_HISTORY_INDEX]}"
        else
            REPL_INPUT=""
        fi
        REPL_CURSOR_POS=${#REPL_INPUT}
        mark_component_dirty "repl"
    fi
}

handle_repl_cursor_left() {
    if [[ $REPL_CURSOR_POS -gt 0 ]]; then
        ((REPL_CURSOR_POS--))
        mark_component_dirty "repl"
    fi
}

handle_repl_cursor_right() {
    if [[ $REPL_CURSOR_POS -lt ${#REPL_INPUT} ]]; then
        ((REPL_CURSOR_POS++))
        mark_component_dirty "repl"
    fi
}

# Input system initialization
init_game_input_system() {
    # Initialize input state
    LAST_COLUMNS="$COLUMNS"
    LAST_LINES="$LINES"

    log_action "GameInput: System initialized with ${#GAME_INPUT_MAP[@]} mappings"
}

# Debug: Show input mappings
show_input_mappings() {
    echo "Game Input Mappings:"
    for key in "${!GAME_INPUT_MAP[@]}"; do
        local action="${GAME_INPUT_MAP[$key]}"
        local display_key="$key"

        # Make special keys readable
        case "$key" in
            $'\n') display_key="Enter" ;;
            $'\r') display_key="Return" ;;
            $'\033[A') display_key="↑" ;;
            $'\033[B') display_key="↓" ;;
            $'\033[C') display_key="→" ;;
            $'\033[D') display_key="←" ;;
            *) ;;
        esac

        printf "  %-8s → %s\n" "$display_key" "$action"
    done
}