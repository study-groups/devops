#!/usr/bin/env bash

# TUI View Mode Controllers - Game Scene Architecture
# Phase 3: View mode controllers implementing game-like scenes

# Source required dependencies
source "$(dirname "${BASH_SOURCE[0]}")/../input.sh"

# View mode registry
declare -A VIEW_CONTROLLERS=()
declare CURRENT_VIEW_MODE="actions"
declare PREVIOUS_VIEW_MODE=""

# View mode constants
declare -r VIEW_ACTIONS="actions"
declare -r VIEW_PALETTE="palette"
declare -r VIEW_INFO="info"
declare -r VIEW_REPL="repl"
declare -r VIEW_DEBUG="debug"

# Base view controller interface
register_view_controller() {
    local view_name="$1"
    local controller_prefix="$2"

    VIEW_CONTROLLERS[$view_name]="$controller_prefix"
    log_action "ViewController: Registered $view_name -> $controller_prefix"
}

# Switch to a view mode with proper lifecycle management
switch_view_mode() {
    local new_view="$1"
    local transition_data="$2"

    # Validate view exists
    if [[ -z "${VIEW_CONTROLLERS[$new_view]}" ]]; then
        log_action "ViewController: Unknown view mode '$new_view'"
        return 1
    fi

    # Don't switch if already in the target view
    if [[ "$CURRENT_VIEW_MODE" == "$new_view" ]]; then
        return 0
    fi

    local old_view="$CURRENT_VIEW_MODE"
    PREVIOUS_VIEW_MODE="$old_view"

    # Exit current view
    if [[ -n "$old_view" && -n "${VIEW_CONTROLLERS[$old_view]}" ]]; then
        local old_controller="${VIEW_CONTROLLERS[$old_view]}"
        local exit_func="${old_controller}_exit"
        if declare -F "$exit_func" >/dev/null; then
            "$exit_func" "$transition_data"
        fi
    fi

    # Enter new view
    CURRENT_VIEW_MODE="$new_view"
    local new_controller="${VIEW_CONTROLLERS[$new_view]}"
    local enter_func="${new_controller}_enter"
    if declare -F "$enter_func" >/dev/null; then
        "$enter_func" "$transition_data"
    fi

    # Update components for new view
    local update_func="${new_controller}_update"
    if declare -F "$update_func" >/dev/null; then
        "$update_func"
    fi

    mark_all_dirty
    log_action "ViewController: Switched from $old_view to $new_view"
}

# Handle input for current view mode
handle_view_input() {
    local key="$1"

    local controller="${VIEW_CONTROLLERS[$CURRENT_VIEW_MODE]}"
    local input_func="${controller}_input"

    if declare -F "$input_func" >/dev/null; then
        "$input_func" "$key"
    else
        # Default input handling
        handle_default_view_input "$key"
    fi
}

# Default input handling for view switching
handle_default_view_input() {
    local key="$1"

    case "$key" in
        '1') switch_view_mode "$VIEW_ACTIONS" ;;
        '2') switch_view_mode "$VIEW_PALETTE" ;;
        '3') switch_view_mode "$VIEW_INFO" ;;
        '4') switch_view_mode "$VIEW_REPL" ;;
        '5') switch_view_mode "$VIEW_DEBUG" ;;
        'a') switch_view_mode "$VIEW_ACTIONS" ;;
        'p') switch_view_mode "$VIEW_PALETTE" ;;
        'i') switch_view_mode "$VIEW_INFO" ;;
        'r') switch_view_mode "$VIEW_REPL" ;;
        'd') switch_view_mode "$VIEW_DEBUG" ;;
    esac
}

# Actions View Controller
ActionsViewController_enter() {
    local transition_data="$1"
    CONTENT_MODE="actions"

    # Use handler system instead of legacy show_actions_view
    if command -v route_action_execution >/dev/null 2>&1; then
        # Execute current action using handler system
        local actions=($(get_actions))
        local action="${actions[$ACTION_INDEX]}"
        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"
            route_action_execution "$verb" "$noun"
        else
            show_actions_view  # Fallback to old system
        fi
    else
        show_actions_view  # Fallback if handler system not available
    fi

    # Set appropriate footer for actions view
    FOOTER_CONTENT="$(format_footer_combined "Actions View" "e/d/f=nav | Enter=exec | 1-4=views | View: actions")"
    mark_component_dirty "footer"

    log_action "ActionsViewController: Entered"
}

ActionsViewController_update() {
    # Use handler system for updates too
    if command -v route_action_execution >/dev/null 2>&1; then
        local actions=($(get_actions))
        local action="${actions[$ACTION_INDEX]}"
        if [[ "$action" == *:* ]]; then
            local verb="${action%%:*}"
            local noun="${action##*:}"
            route_action_execution "$verb" "$noun"
        else
            show_actions_view
        fi
    else
        show_actions_view
    fi
    update_all_components
}

ActionsViewController_exit() {
    local transition_data="$1"
    log_action "ActionsViewController: Exited"
}

ActionsViewController_input() {
    local key="$1"

    case "$key" in
        $'\n'|$'\r') # Execute current action
            # Use new handler system for action execution
            if command -v route_action_execution >/dev/null 2>&1; then
                local actions=($(get_actions))
                local action="${actions[$ACTION_INDEX]}"
                if [[ "$action" == *:* ]]; then
                    local verb="${action%%:*}"
                    local noun="${action##*:}"
                    route_action_execution "$verb" "$noun"
                else
                    execute_current_action
                fi
            else
                execute_current_action
            fi
            ActionsViewController_update
            ;;
        'f')
            navigate_action_right
            ActionsViewController_update
            ;;
        'F')
            navigate_action_left
            ActionsViewController_update
            ;;
        'e')
            navigate_env_right
            ActionsViewController_update
            ;;
        'E')
            navigate_env_left
            ActionsViewController_update
            ;;
        'd')
            navigate_mode_right
            ActionsViewController_update
            ;;
        'D')
            navigate_mode_left
            ActionsViewController_update
            ;;
        'c')
            clear_content
            ActionsViewController_update
            ;;
        *)
            handle_default_view_input "$key"
            ;;
    esac
}

# Palette View Controller
PaletteViewController_enter() {
    local transition_data="$1"
    CONTENT_MODE="palette"
    show_palette_demonstration

    # Set appropriate footer for palette view
    FOOTER_CONTENT="$(format_footer_combined "Palette View" "r=refresh | q=actions | 1-4=views | View: palette")"
    mark_component_dirty "footer"

    log_action "PaletteViewController: Entered"
}

PaletteViewController_update() {
    show_palette_demonstration
    update_all_components
}

PaletteViewController_exit() {
    local transition_data="$1"
    log_action "PaletteViewController: Exited"
}

PaletteViewController_input() {
    local key="$1"

    case "$key" in
        'r') # Refresh palette
            PaletteViewController_update
            ;;
        'q') # Return to actions
            switch_view_mode "$VIEW_ACTIONS"
            ;;
        *)
            handle_default_view_input "$key"
            ;;
    esac
}

# Info View Controller
InfoViewController_enter() {
    local transition_data="$1"
    CONTENT_MODE="info"
    show_info_view

    # Set appropriate footer for info view
    FOOTER_CONTENT="$(format_footer_combined "Info View" "q=actions | 1-4=views | View: info")"
    mark_component_dirty "footer"

    log_action "InfoViewController: Entered"
}

InfoViewController_update() {
    show_info_view
    update_all_components
}

InfoViewController_exit() {
    local transition_data="$1"
    log_action "InfoViewController: Exited"
}

InfoViewController_input() {
    local key="$1"

    case "$key" in
        'h') # Help
            show_help
            InfoViewController_update
            ;;
        *)
            handle_default_view_input "$key"
            ;;
    esac
}

# REPL View Controller
ReplViewController_enter() {
    local transition_data="$1"
    CURRENT_INPUT_MODE="$INPUT_MODE_REPL"
    mount_repl_component
    show_cursor
    CONTENT_MODE="repl"

    # Clear content for REPL mode
    CONTENT="REPL Mode Active
$(generate_section_separator)

Type commands or '/help' for assistance.
Use ESC to return to gamepad mode."

    log_action "ReplViewController: Entered"
}

ReplViewController_update() {
    update_all_components
    position_repl_input
}

ReplViewController_exit() {
    local transition_data="$1"
    CURRENT_INPUT_MODE="$INPUT_MODE_GAMEPAD"
    unmount_repl_component
    hide_cursor
    clear_repl_region
    log_action "ReplViewController: Exited"
}

ReplViewController_input() {
    local key="$1"

    case "$key" in
        $'\033') # ESC - exit REPL mode
            switch_view_mode "$VIEW_ACTIONS"
            ;;
        *)
            # Handle REPL input normally
            handle_repl_input "$key"
            ReplViewController_update
            ;;
    esac
}

# Debug View Controller
DebugViewController_enter() {
    local transition_data="$1"
    CONTENT_MODE="debug"
    show_debug_view
    log_action "DebugViewController: Entered"
}

DebugViewController_update() {
    show_debug_view
    update_all_components
}

DebugViewController_exit() {
    local transition_data="$1"
    log_action "DebugViewController: Exited"
}

DebugViewController_input() {
    local key="$1"

    case "$key" in
        'c') # Show component status
            show_debug_components
            DebugViewController_update
            ;;
        'r') # Show render stats
            show_debug_rendering
            DebugViewController_update
            ;;
        's') # Show system stats
            show_debug_system
            DebugViewController_update
            ;;
        *)
            handle_default_view_input "$key"
            ;;
    esac
}

# Debug view content generators
show_debug_view() {
    CONTENT="🐛 Debug View Mode
$(generate_section_separator)

System State:
• Current View: $CURRENT_VIEW_MODE
• Previous View: $PREVIOUS_VIEW_MODE
• Input Mode: $CURRENT_INPUT_MODE
• Frame Dirty: ${FRAME_DIRTY:-unknown}

$(generate_section_separator)

Debug Commands:
• c - Component status
• r - Render statistics
• s - System information
• 1-5 - Switch view modes

$(generate_section_separator)

Component Status:
$(show_component_status 2>/dev/null || echo "Component system not initialized")

$(generate_section_separator)

Render Statistics:
$(show_render_stats 2>/dev/null || echo "Render system not initialized")"

    FOOTER_CONTENT="$(format_footer_combined "Debug Mode" "Current: $CURRENT_VIEW_MODE | Press c/r/s for detailed info")"
}

show_debug_components() {
    local component_info="$(show_component_status 2>/dev/null || echo "Component system not available")"

    CONTENT="🔧 Component Debug Information
$(generate_section_separator)

$component_info

$(generate_section_separator)

Component Architecture:
• HeaderComponent: Navigation state display
• ContentComponent: View-specific content rendering
• FooterComponent: Status and help information
• ReplComponent: Interactive command interface

Component Lifecycle:
mount → update → render → unmount"
}

show_debug_rendering() {
    local render_info="$(show_render_stats 2>/dev/null || echo "Render system not available")"

    CONTENT="🎨 Rendering Debug Information
$(generate_section_separator)

$render_info

$(generate_section_separator)

Rendering Pipeline:
1. Mark components dirty
2. Build frame in back buffer
3. Calculate frame hash
4. Present frame if changed
5. Copy to frame buffer

Performance Optimizations:
• Double buffering
• Component dirty tracking
• Frame hash comparison
• Color calculation caching"
}

show_debug_system() {
    CONTENT="💻 System Debug Information
$(generate_section_separator)

Terminal:
• Size: ${COLUMNS:-80}×${LINES:-24}
• Type: ${TERM:-unknown}

Environment:
• ENV_INDEX: $ENV_INDEX/${#ENVIRONMENTS[@]}
• MODE_INDEX: $MODE_INDEX/${#MODES[@]}
• ACTION_INDEX: $ACTION_INDEX

Regions:
• Header: 1-$UI_HEADER_LINES
• Content: $REGION_CONTENT_START-$REGION_CONTENT_END
• Footer: $REGION_FOOTER_START-$REGION_FOOTER_END
• REPL: ${REGION_REPL_LINE:-none}

Memory:
• View Controllers: ${#VIEW_CONTROLLERS[@]}
• Components: ${#COMPONENTS[@]}
• Component Cache: ${#COMPONENT_CACHE[@]}"
}

# Initialize view controller system
init_view_controllers() {
    register_view_controller "$VIEW_ACTIONS" "ActionsViewController"
    register_view_controller "$VIEW_PALETTE" "PaletteViewController"
    register_view_controller "$VIEW_INFO" "InfoViewController"
    register_view_controller "$VIEW_REPL" "ReplViewController"
    register_view_controller "$VIEW_DEBUG" "DebugViewController"

    # Start in actions view
    CURRENT_VIEW_MODE="$VIEW_ACTIONS"
    log_action "ViewController: System initialized, starting in $VIEW_ACTIONS"
}

# Get current view mode for display
get_current_view_mode() {
    echo "$CURRENT_VIEW_MODE"
}

# Check if in specific view mode
in_view_mode() {
    local view_mode="$1"
    [[ "$CURRENT_VIEW_MODE" == "$view_mode" ]]
}