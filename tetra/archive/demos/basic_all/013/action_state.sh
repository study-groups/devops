#!/usr/bin/env bash

# Action State Machine - TES Compliant
# TES Lifecycle: template → qualified → ready → executing → success/error → idle
#
# States:
#   template  - Action declared, needs inputs/resolution
#   qualified - Inputs provided, needs validation
#   ready     - Validated, can execute safely
#   executing - Currently running
#   success   - Completed successfully
#   error     - Failed with error
#   idle      - Neutral state (for simple actions without lifecycle)

# State symbols for display
declare -A STATE_SYMBOLS=(
    [idle]="●"
    [template]="○"
    [qualified]="◐"
    [ready]="◉"
    [executing]="▶"
    [success]="✓"
    [error]="✗"
)

# Get current state of an action
get_action_state() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "idle"
        return
    fi

    local -n _state_action="ACTION_${action_name}"
    echo "${_state_action[state]:-idle}"
}

# Set action state
set_action_state() {
    local action="$1"
    local new_state="$2"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _state_action="ACTION_${action_name}"
    _state_action[state]="$new_state"
}

# Get state symbol for display
get_state_symbol() {
    local state="$1"
    echo "${STATE_SYMBOLS[$state]:-●}"
}

# Check if action executes immediately on selection
is_immediate_action() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1  # Default to not immediate
    fi

    local -n _imm_action="ACTION_${action_name}"
    [[ "${_imm_action[immediate]}" == "true" ]]
}

# Get action capability description
get_action_can() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "Unknown capability"
        return
    fi

    local -n _can_action="ACTION_${action_name}"
    echo "${_can_action[can]:-No description}"
}

# Get action limitation description
get_action_cannot() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo "Unknown limitations"
        return
    fi

    local -n _cannot_action="ACTION_${action_name}"
    echo "${_cannot_action[cannot]:-No limitations defined}"
}

# Reset all action states to idle
reset_all_states() {
    for action_name in "${ACTION_REGISTRY[@]}"; do
        if declare -p "ACTION_${action_name}" &>/dev/null; then
            local -n _reset_action="ACTION_${action_name}"
            _reset_action[state]="idle"
        fi
    done
}

# TES: Check if action is fully qualified (has all inputs resolved)
is_fully_qualified() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _qual_action="ACTION_${action_name}"

    # If action has no inputs, it's always qualified
    if [[ -z "${_qual_action[inputs]}" ]]; then
        return 0
    fi

    # Check if inputs contain unresolved symbols (@ prefix)
    if [[ "${_qual_action[inputs]}" =~ @[a-zA-Z] ]]; then
        return 1  # Has unresolved symbols
    fi

    return 0
}

# TES: Validate action is ready to execute (qualified + validated)
is_action_ready() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _ready_action="ACTION_${action_name}"

    # Must be fully qualified
    is_fully_qualified "$action" || return 1

    # Check validated flag if present
    if [[ -n "${_ready_action[validated]}" && "${_ready_action[validated]}" != "true" ]]; then
        return 1
    fi

    return 0
}

# TES: Qualify action (mark as having inputs resolved)
qualify_action() {
    local action="$1"

    if is_fully_qualified "$action"; then
        set_action_state "$action" "qualified"
        return 0
    fi

    return 1
}

# TES: Mark action as ready (validated and safe to execute)
mark_action_ready() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _mark_action="ACTION_${action_name}"
    _mark_action[validated]="true"
    set_action_state "$action" "ready"
}

# Get action error message (if any)
get_action_error() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return
    fi

    local -n _error_action="ACTION_${action_name}"
    echo "${_error_action[error_msg]:-}"
}

# Set action error message
set_action_error() {
    local action="$1"
    local error_msg="$2"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _error_action="ACTION_${action_name}"
    _error_action[error_msg]="$error_msg"
    _error_action[state]="error"
}

# Get action status info (contextual info to display)
get_action_status() {
    local action="$1"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        echo ""
        return
    fi

    local -n _status_action="ACTION_${action_name}"
    echo "${_status_action[status_info]:-}"
}

# Set action status info
set_action_status() {
    local action="$1"
    local status_info="$2"
    local action_name="${action//:/_}"

    if ! declare -p "ACTION_${action_name}" &>/dev/null; then
        return 1
    fi

    local -n _status_action="ACTION_${action_name}"
    _status_action[status_info]="$status_info"
}

# Clear action status info
clear_action_status() {
    local action="$1"
    set_action_status "$action" ""
}
