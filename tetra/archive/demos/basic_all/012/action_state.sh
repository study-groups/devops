#!/usr/bin/env bash

# Action State Machine
# States: idle → pending → executing → success/error → idle

# State symbols for display
declare -A STATE_SYMBOLS=(
    [idle]="●"
    [pending]="○"
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
