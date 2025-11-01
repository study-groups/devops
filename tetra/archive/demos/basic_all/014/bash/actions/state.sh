#!/usr/bin/env bash

# Action State Machine - From 013
# States: idle, executing, success, error

declare -gA ACTION_STATES
declare -gA ACTION_STATUS_INFO
declare -gA ACTION_ERROR_MSGS

# Get action state
get_action_state() {
    local action="$1"
    echo "${ACTION_STATES[$action]:-idle}"
}

# Set action state
set_action_state() {
    local action="$1"
    local state="$2"
    ACTION_STATES[$action]="$state"
}

# Get state symbol for display
get_state_symbol() {
    local state="$1"
    case "$state" in
        idle) echo "○" ;;
        executing) echo "▶" ;;
        success) echo "✓" ;;
        error) echo "✗" ;;
        *) echo "?" ;;
    esac
}

# Set action status (contextual info)
set_action_status() {
    local action="$1"
    local status="$2"
    ACTION_STATUS_INFO[$action]="$status"
}

# Get action status
get_action_status() {
    local action="$1"
    echo "${ACTION_STATUS_INFO[$action]}"
}

# Set error state with message
set_action_error() {
    local action="$1"
    local error_msg="$2"

    ACTION_STATES[$action]="error"
    ACTION_ERROR_MSGS[$action]="$error_msg"
}

# Get error message
get_action_error() {
    local action="$1"
    echo "${ACTION_ERROR_MSGS[$action]}"
}

# Clear error
clear_action_error() {
    local action="$1"
    unset ACTION_ERROR_MSGS[$action]
}

# TES Lifecycle helpers
is_fully_qualified() {
    local action="$1"
    # For now, all actions are qualified (no inputs)
    return 0
}

qualify_action() {
    local action="$1"
    # Mark as qualified
    return 0
}

is_action_ready() {
    local action="$1"
    # For now, qualified = ready
    return 0
}

mark_action_ready() {
    local action="$1"
    # No-op for now
    return 0
}
