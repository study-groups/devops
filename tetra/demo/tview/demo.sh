#!/usr/bin/env bash

# Demo Main - Integration of TUI and TView systems
# Run this to start the self-explaining TView demo

# Get demo directory
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source TUI system (interface)
source "$DEMO_DIR/tui/render.sh"  # This sources colors, layout, input

# Source TView system (content)
source "$DEMO_DIR/tview/actions.sh"
source "$DEMO_DIR/tview/workflows.sh"

# Demo state
CURRENT_ENV="DEMO"
CURRENT_MODE="LEARN"
CURRENT_ACTION_INDEX=0
HOSTNAME=$(hostname -s)

# Main application loop
main_loop() {
    local quit_requested=false

    while [[ "$quit_requested" != "true" ]]; do
        # Get current actions
        local actions_array=()
        while IFS= read -r action_line; do
            [[ -n "$action_line" ]] && actions_array+=("$action_line")
        done < <(get_actions_for_context "$CURRENT_ENV" "$CURRENT_MODE")

        # Ensure action index is valid
        if [[ $CURRENT_ACTION_INDEX -ge ${#actions_array[@]} ]]; then
            CURRENT_ACTION_INDEX=0
        fi
        if [[ $CURRENT_ACTION_INDEX -lt 0 ]]; then
            CURRENT_ACTION_INDEX=$((${#actions_array[@]} - 1))
        fi

        # Convert arrays to strings for render function
        local envs_str=$(IFS=','; echo "${DEMO_ENVIRONMENTS[*]}")
        local modes_str=$(IFS=','; echo "${DEMO_MODES[*]}")
        local actions_str=$(IFS=','; echo "${actions_array[*]}")

        # Render full screen
        render_full_screen "$HOSTNAME" "$CURRENT_ENV" "$CURRENT_MODE" "$CURRENT_ACTION_INDEX" "$envs_str" "$modes_str" "$actions_str"

        # Process input
        quit_requested=$(process_input_loop)
    done
}

# Input processing loop
process_input_loop() {
    # Set up input handlers
    set_input_handler "next_environment" "handle_next_env"
    set_input_handler "prev_environment" "handle_prev_env"
    set_input_handler "next_mode" "handle_next_mode"
    set_input_handler "prev_mode" "handle_prev_mode"
    set_input_handler "next_action" "handle_next_action"
    set_input_handler "prev_action" "handle_prev_action"
    set_input_handler "execute_action" "handle_execute_action"
    set_input_handler "quit" "handle_quit"
    set_input_handler "refresh" "handle_refresh"
    set_input_handler "show_help" "handle_show_help"
    set_input_handler "enter_repl_mode" "handle_enter_repl"
    set_input_handler "enter_gamepad_mode" "handle_enter_gamepad"
    set_input_handler "unknown_key" "handle_unknown_key"

    # Process single input
    process_input

    # Return quit status
    [[ "${QUIT_REQUESTED:-false}" == "true" ]]
}

# Input handlers
handle_next_env() {
    CURRENT_ENV=$(get_next_environment "$CURRENT_ENV")
    CURRENT_ACTION_INDEX=0
    mark_dirty
}

handle_prev_env() {
    CURRENT_ENV=$(get_prev_environment "$CURRENT_ENV")
    CURRENT_ACTION_INDEX=0
    mark_dirty
}

handle_next_mode() {
    CURRENT_MODE=$(get_next_mode "$CURRENT_MODE")
    CURRENT_ACTION_INDEX=0
    mark_dirty
}

handle_prev_mode() {
    CURRENT_MODE=$(get_prev_mode "$CURRENT_MODE")
    CURRENT_ACTION_INDEX=0
    mark_dirty
}

handle_next_action() {
    local actions_array=()
    while IFS= read -r action_line; do
        [[ -n "$action_line" ]] && actions_array+=("$action_line")
    done < <(get_actions_for_context "$CURRENT_ENV" "$CURRENT_MODE")

    CURRENT_ACTION_INDEX=$(( (CURRENT_ACTION_INDEX + 1) % ${#actions_array[@]} ))
    mark_dirty
}

handle_prev_action() {
    local actions_array=()
    while IFS= read -r action_line; do
        [[ -n "$action_line" ]] && actions_array+=("$action_line")
    done < <(get_actions_for_context "$CURRENT_ENV" "$CURRENT_MODE")

    CURRENT_ACTION_INDEX=$(( (CURRENT_ACTION_INDEX - 1 + ${#actions_array[@]}) % ${#actions_array[@]} ))
    mark_dirty
}

handle_execute_action() {
    # Get current actions
    local actions_array=()
    while IFS= read -r action_line; do
        [[ -n "$action_line" ]] && actions_array+=("$action_line")
    done < <(get_actions_for_context "$CURRENT_ENV" "$CURRENT_MODE")

    if [[ ${#actions_array[@]} -eq 0 ]]; then
        render_status_only "No actions available" "warning"
        return
    fi

    # Get selected action
    local selected_action="${actions_array[$CURRENT_ACTION_INDEX]}"
    local action_id=$(echo "$selected_action" | cut -d':' -f1)

    # Execute action
    local result
    if result=$(execute_action "$action_id" "$CURRENT_ENV" "$CURRENT_MODE" 2>&1); then
        mark_dirty  # Force full redraw after action
    else
        render_status_only "Action failed: $action_id" "error"
        sleep 2
        mark_dirty
    fi
}

handle_quit() {
    QUIT_REQUESTED=true
}

handle_refresh() {
    # Clear action cache
    ACTION_CACHE=()
    mark_dirty
    render_status_only "Refreshed" "ok"
    sleep 1
    mark_dirty
}

handle_show_help() {
    render_help_modal
    # Wait for any key
    read -n1 -s
    close_modal
    mark_dirty
}

handle_enter_repl() {
    render_status_only "REPL mode - type 'help' for commands, 'gamepad' to return" "info"
}

handle_enter_gamepad() {
    render_status_only "Gamepad mode" "info"
}

handle_unknown_key() {
    local key="$1"
    # Ignore unknown keys silently, or show brief help
    if [[ "$key" == "h" || "$key" == "H" || "$key" == "?" ]]; then
        handle_show_help
    fi
    # Ignore other unknown keys
}

# Initialize and run demo
main() {
    echo "🚀 Starting TView Demo..."
    echo "   Environments: ${DEMO_ENVIRONMENTS[*]}"
    echo "   Modes: ${DEMO_MODES[*]}"
    echo "   Starting at: $CURRENT_ENV:$CURRENT_MODE"
    echo ""
    sleep 2

    # Initialize systems
    init_render
    init_input
    init_actions

    # Set up cleanup on exit
    trap cleanup EXIT INT TERM

    # Run main loop
    main_loop
}

# Cleanup function
cleanup() {
    cleanup_render
    cleanup_input
    cleanup_actions
    echo "👋 Demo ended. Thanks for exploring TView!"
}

# Start the demo
main "$@"