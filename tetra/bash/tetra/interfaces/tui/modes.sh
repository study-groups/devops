#!/usr/bin/env bash
# Tetra TUI - Modes & Actions
# Mode switching, action execution, and command handling

# Execute selected action
execute_action() {
    local action="${CONTENT_MODEL[action]}"
    [[ -z "$action" ]] && return

    local env="${CONTENT_MODEL[env]}"
    local module="${CONTENT_MODEL[module]}"

    # Drop into Module REPL for this context
    # Save terminal state
    local saved_state=$(stty -g 2>/dev/null)

    # Launch module REPL
    mode_repl_run "$env" "$module"

    # Restore terminal state
    stty "$saved_state" 2>/dev/null || stty sane
    tput smcup 2>/dev/null
    tput civis 2>/dev/null
    stty -echo -icanon 2>/dev/null

    # Recalculate layout and force redraw
    calculate_layout
    needs_redraw=true
    is_first_render=true
}

# Execute command from command mode
execute_command() {
    local cmd="$1"

    case "$cmd" in
        help)
            TUI_BUFFERS["@tui[content]"]="⁘ Command Mode Help

Available commands:
  help     - Show this help
  clear    - Clear content
  env      - Show environments
  quit     - Exit tetra"
            ;;
        clear)
            TUI_BUFFERS["@tui[content]"]=""
            ;;
        quit)
            exit 0
            ;;
        *)
            TUI_BUFFERS["@tui[content]"]="⁘ Unknown command: $cmd"
            ;;
    esac
}

# Cycle header size
cycle_header_size() {
    case "${CONTENT_MODEL[header_size]}" in
        max) CONTENT_MODEL[header_size]="med" ;;
        med) CONTENT_MODEL[header_size]="min" ;;
        min) CONTENT_MODEL[header_size]="max" ;;
    esac
    calculate_layout
}

# Toggle animation
toggle_animation() {
    if [[ "${CONTENT_MODEL[animation_enabled]}" == "true" ]]; then
        CONTENT_MODEL[animation_enabled]="false"
    else
        CONTENT_MODEL[animation_enabled]="true"
    fi
}

# Enter bug mode (unicode explorer easter egg)
enter_bug_mode() {
    # Save terminal state
    local saved_state=$(stty -g 2>/dev/null)

    # Clear screen and launch bug mode
    clear
    tetra_bug_mode

    # Restore terminal and tetra TUI
    stty "$saved_state" 2>/dev/null || stty sane
    tput smcup 2>/dev/null
    tput civis 2>/dev/null
    stty -echo -icanon 2>/dev/null
    calculate_layout
    needs_redraw=true
    is_first_render=true
}

# Toggle web dashboard
toggle_web_dashboard() {
    # TODO: Toggle web server
    TUI_BUFFERS["@tui[content]"]="⁘ Web Dashboard

Coming soon: HTTP server with code analyzer!"
}
