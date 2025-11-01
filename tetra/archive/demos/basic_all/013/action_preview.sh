#!/usr/bin/env bash

# Action Preview and Validation
# Shows what an action can/cannot do before execution

# Generate action preview for deferred actions
preview_action() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "Unknown action: $action"
        return
    fi

    local -n _prev_action="ACTION_${action_name}"

    local verb="${_prev_action[verb]}"
    local noun="${_prev_action[noun]}"
    local routes="${_prev_action[routes]}"
    local can="${_prev_action[can]}"
    local cannot="${_prev_action[cannot]}"

    echo "🔍 Action Preview: $verb:$noun"
    echo "$(printf '%*s' "${TUI_SEPARATOR_WIDTH:-60}" '' | tr ' ' '─')"
    echo ""
    echo "This action CAN:"
    echo "  $TUI_BULLET_CHAR $can"
    echo ""
    echo "This action CANNOT:"
    echo "  $TUI_BULLET_CHAR $cannot"
    echo ""
    echo "Output routing:"
    echo "  $TUI_BULLET_CHAR $routes"
    echo ""
    echo "$(printf '%*s' "${TUI_SEPARATOR_WIDTH:-60}" '' | tr ' ' '─')"
    echo ""
    echo "Press Enter to execute, ESC to cancel"
}

# Validate action before execution
validate_action() {
    local action="$1"
    local action_name="${action//:/_}"

    # Check if action exists
    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    # Add capability checks here when integrated with PData
    # For now, all actions are valid
    return 0
}

# Check if action requires confirmation
requires_confirmation() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _conf_action="ACTION_${action_name}"

    # Deferred actions (immediate=false) require confirmation
    [[ "${_conf_action[immediate]}" != "true" ]]
}
