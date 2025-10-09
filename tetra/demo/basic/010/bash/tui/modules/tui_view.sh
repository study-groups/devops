#!/usr/bin/env bash

# TUI View Layer - Pure Rendering with Event Subscription
# Responsibility: UI rendering, event subscription, no state mutation
# Uses pure pub/sub event system

# ===== EVENT SUBSCRIBERS =====

# Subscribe to environment changes - updates display
on_env_changed() {
    local env_name="$1"
    local env_index="$2"

    # Update display components
    if command -v log_action >/dev/null 2>&1; then
        log_action "View: Environment changed to $env_name (index $env_index)"
    fi

    # Trigger display refresh if in TUI mode
    if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_GAMEPAD" ]]; then
        # Display will refresh on next render cycle
        true
    fi
}

# Subscribe to mode changes - updates display
on_mode_changed() {
    local mode_name="$1"
    local mode_index="$2"

    # Update display components
    if command -v log_action >/dev/null 2>&1; then
        log_action "View: Mode changed to $mode_name (index $mode_index)"
    fi

    # Trigger display refresh if in TUI mode
    if [[ "$CURRENT_INPUT_MODE" == "$INPUT_MODE_GAMEPAD" ]]; then
        # Display will refresh on next render cycle
        true
    fi
}

# Subscribe to action changes - updates footer dynamically
on_action_changed() {
    local action_name="$1"
    local action_index="$2"

    # Generate dynamic footer content based on current action
    if command -v generate_dynamic_footer >/dev/null 2>&1; then
        generate_dynamic_footer "$action_name"
    fi

    # Log the change for debugging
    if command -v log_action >/dev/null 2>&1; then
        log_action "View: Action changed to $action_name (index $action_index)"
    fi
}

# ===== DYNAMIC FOOTER GENERATORS =====

# Generate footer content based on current action
generate_dynamic_footer() {
    local current_action="$1"

    if [[ -n "$current_action" ]]; then
        local env="${ENVIRONMENTS[$ENV_INDEX]}"
        local mode="${MODES[$MODE_INDEX]}"
        local context="$env:$mode"

        # Check if get_actions function is available before calling
        local action_count=0
        if command -v get_actions >/dev/null 2>&1; then
            action_count=$(get_actions | wc -l)
        fi

        # Generate action-specific footer
        local footer="$context | $current_action | ${action_count} actions"
        FOOTER_CONTENT="$footer"
    else
        local env="${ENVIRONMENTS[$ENV_INDEX]}"
        local mode="${MODES[$MODE_INDEX]}"
        local context="$env:$mode"
        local footer="$context | No actions available"
        FOOTER_CONTENT="$footer"
    fi
}

# Generate mode-specific footer
generate_mode_footer() {
    local mode="$1"

    case "$mode" in
        "actionList")
            local footer="Action List Mode | i/k navigate | Enter executes | c clear"
            ;;
        "actionDetails")
            local footer="Action Details Mode | View details | a for list | c clear"
            ;;
        *)
            local env="${ENVIRONMENTS[$ENV_INDEX]}"
            local mode_name="${MODES[$MODE_INDEX]}"
            local footer="$env:$mode_name | a=actions A=details /?=help"
            ;;
    esac

    FOOTER_CONTENT="$footer"
}

# Generate navigation-context footer
generate_navigation_footer() {
    local nav_type="$1"
    local current_index="$2"

    case "$nav_type" in
        "env")
            local env_name="${ENVIRONMENTS[$current_index]}"
            local footer="Environment: $env_name | e/E navigate envs | d/D navigate modes"
            ;;
        "mode")
            local mode_name="${MODES[$current_index]}"
            local footer="Mode: $mode_name | d/D navigate modes | f/F navigate actions"
            ;;
    esac

    FOOTER_CONTENT="$footer"
}

# ===== PURE VIEW FUNCTIONS =====

# Pure render function - no state mutation
render_dynamic_footer() {
    local term_width=${COLUMNS:-80}

    if [[ -n "$FOOTER_CONTENT" ]]; then
        # Center the dynamic footer content
        local footer_text="$FOOTER_CONTENT"
        local padding=$(((term_width - ${#footer_text}) / 2))
        [[ $padding -lt 0 ]] && padding=0

        printf "%*s%s" $padding "" "$footer_text"
    else
        # Fallback footer
        local env="${ENVIRONMENTS[$ENV_INDEX]}"
        local mode="${MODES[$MODE_INDEX]}"
        local default_footer="$env:$mode | e,d,f nav | a=actions | ?=help"
        local padding=$(((term_width - ${#default_footer}) / 2))
        [[ $padding -lt 0 ]] && padding=0

        printf "%*s%s" $padding "" "$default_footer"
    fi
}

# Enhanced view refresh - updates all components
view_refresh_all() {
    # Update footer based on current state
    local actions=($(get_actions 2>/dev/null || true))
    local current_action="${actions[$ACTION_INDEX]:-no-action}"
    generate_dynamic_footer "$current_action"

    # Refresh content display if needed
    if [[ -n "$CONTENT_MODE" ]]; then
        refresh_content_display 2>/dev/null || true
    fi

    if command -v log_action >/dev/null 2>&1; then
        log_action "View: Full refresh completed"
    fi
}

# Initialize view layer subscribers
init_tui_view() {
    # Subscribe to events using the new pub/sub system
    if command -v subscribe >/dev/null 2>&1; then
        subscribe "env_changed" "on_env_changed"
        subscribe "mode_changed" "on_mode_changed"
        subscribe "action_changed" "on_action_changed"
    fi

    # Generate initial dynamic footer
    generate_dynamic_footer "no-action"

    # Check if log_action is available before calling
    if command -v log_action >/dev/null 2>&1; then
        log_action "View: TUI View layer initialized with pub/sub event subscribers"
    fi
}

# Call initialization
init_tui_view