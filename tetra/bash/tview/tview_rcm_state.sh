#!/usr/bin/env bash

# RCM State Management - React-like state handling for command execution
# Single responsibility: Manage command execution states and results

# Set command state
rcm_set_command_state() {
    local command_id="$1"
    local new_state="$2"
    RCM_COMMAND_STATES["$command_id"]="$new_state"
    RCM_COMMAND_TIMESTAMPS["$command_id"]=$(date '+%s')
}

# Get command state
rcm_get_command_state() {
    local command_id="$1"
    echo "${RCM_COMMAND_STATES[$command_id]:-idle}"
}

# Set command result
rcm_set_command_result() {
    local command_id="$1"
    local result="$2"
    local exit_code="$3"

    RCM_COMMAND_RESULTS["$command_id"]="$result"
    RCM_COMMAND_EXIT_CODES["$command_id"]="$exit_code"
}

# Get command result
rcm_get_command_result() {
    local command_id="$1"
    echo "${RCM_COMMAND_RESULTS[$command_id]:-}"
}

# Get command exit code
rcm_get_command_exit_code() {
    local command_id="$1"
    echo "${RCM_COMMAND_EXIT_CODES[$command_id]:-0}"
}

# Toggle command expansion
rcm_toggle_command_expansion() {
    local command_id="$1"
    if [[ "${RCM_COMMAND_EXPANDED[$command_id]:-false}" == "true" ]]; then
        RCM_COMMAND_EXPANDED["$command_id"]="false"
    else
        RCM_COMMAND_EXPANDED["$command_id"]="true"
    fi
}

# Check if command is expanded
rcm_is_command_expanded() {
    local command_id="$1"
    echo "${RCM_COMMAND_EXPANDED[$command_id]:-false}"
}

# Set command PID for background tracking
rcm_set_command_pid() {
    local command_id="$1"
    local pid="$2"
    RCM_COMMAND_PIDS["$command_id"]="$pid"
}

# Get command PID
rcm_get_command_pid() {
    local command_id="$1"
    echo "${RCM_COMMAND_PIDS[$command_id]:-}"
}

# Clear command PID
rcm_clear_command_pid() {
    local command_id="$1"
    unset RCM_COMMAND_PIDS["$command_id"]
}

# Clear all command data
rcm_clear_command_data() {
    local command_id="$1"
    unset RCM_COMMAND_STATES["$command_id"]
    unset RCM_COMMAND_RESULTS["$command_id"]
    unset RCM_COMMAND_EXIT_CODES["$command_id"]
    unset RCM_COMMAND_PIDS["$command_id"]
    unset RCM_COMMAND_EXPANDED["$command_id"]
    unset RCM_COMMAND_TIMESTAMPS["$command_id"]
}

# Get command timestamp
rcm_get_command_timestamp() {
    local command_id="$1"
    echo "${RCM_COMMAND_TIMESTAMPS[$command_id]:-0}"
}

# Check if command is currently running
rcm_is_command_running() {
    local command_id="$1"
    local state=$(rcm_get_command_state "$command_id")
    [[ "$state" == "executing" ]]
}

# Get all command IDs for an environment
rcm_get_command_ids_for_env() {
    local env="$1"
    for command_name in "${!RCM_COMMANDS[@]}"; do
        echo "${command_name}_${env}"
    done
}

# Clean up completed/failed commands older than specified seconds
rcm_cleanup_old_commands() {
    local max_age="${1:-3600}"  # Default 1 hour
    local current_time=$(date '+%s')

    for command_id in "${!RCM_COMMAND_TIMESTAMPS[@]}"; do
        local timestamp="${RCM_COMMAND_TIMESTAMPS[$command_id]}"
        local age=$((current_time - timestamp))

        if [[ $age -gt $max_age ]]; then
            local state=$(rcm_get_command_state "$command_id")
            # Only cleanup non-running commands
            if [[ "$state" != "executing" ]]; then
                rcm_clear_command_data "$command_id"
            fi
        fi
    done
}