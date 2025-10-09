#!/usr/bin/env bash

# Display Synchronization Module - Event-Driven Display Updates
# Responsibility: Subscribe to state change events and trigger display refreshes
# Pure pub/sub integration for display synchronization

# Display refresh trigger - respects current input mode
trigger_display_refresh() {
    # Only refresh visual display if in TUI mode
    # REPL mode doesn't need visual updates, just state consistency

    if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_GAMEPAD" ]]; then
        # In TUI mode: trigger full display refresh (but avoid during initialization)
        if [[ -n "$COLUMNS" && -n "$LINES" ]]; then
            if command -v update_gamepad_display >/dev/null 2>&1; then
                update_gamepad_display
            elif command -v show_gamepad_display >/dev/null 2>&1; then
                show_gamepad_display
            fi

            if command -v log_action >/dev/null 2>&1; then
                log_action "Display: TUI display refreshed immediately"
            fi
        else
            if command -v log_action >/dev/null 2>&1; then
                log_action "Display: TUI not ready, skipping refresh"
            fi
        fi
    else
        # In REPL mode: no visual refresh needed, state already updated
        if command -v log_action >/dev/null 2>&1; then
            log_action "Display: State updated (REPL mode, no visual refresh)"
        fi
    fi
}

# Environment change handler - updates all environment-dependent display elements
on_display_env_changed() {
    local env_name="$1"
    local env_index="$2"

    # Update any environment-specific display elements
    trigger_display_refresh

    if command -v log_action >/dev/null 2>&1; then
        log_action "Display: Environment display updated for $env_name"
    fi
}

# Mode change handler - updates all mode-dependent display elements
on_display_mode_changed() {
    local mode_name="$1"
    local mode_index="$2"

    # Update any mode-specific display elements
    trigger_display_refresh

    if command -v log_action >/dev/null 2>&1; then
        log_action "Display: Mode display updated for $mode_name"
    fi
}

# Action change handler - updates action-dependent display elements (like footer)
on_display_action_changed() {
    local action_name="$1"
    local action_index="$2"

    # Update footer and other action-dependent elements
    if command -v generate_dynamic_footer >/dev/null 2>&1; then
        generate_dynamic_footer "$action_name"
    fi

    trigger_display_refresh

    if command -v log_action >/dev/null 2>&1; then
        log_action "Display: Action display updated for $action_name"
    fi
}

# Initialize display synchronization
init_display_sync() {
    # Subscribe to all relevant events for display updates
    if command -v subscribe >/dev/null 2>&1; then
        subscribe "env_changed" "on_display_env_changed"
        subscribe "mode_changed" "on_display_mode_changed"
        subscribe "action_changed" "on_display_action_changed"

        if command -v log_action >/dev/null 2>&1; then
            log_action "Display: Synchronization subscribers initialized"
        fi
    else
        echo "Warning: Event system not available for display sync" >&2
    fi
}

# Auto-initialize
init_display_sync