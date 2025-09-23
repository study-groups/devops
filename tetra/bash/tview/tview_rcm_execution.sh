#!/usr/bin/env bash

# RCM Execution - Async command execution and SSH handling
# Single responsibility: Execute commands locally and remotely with proper error handling

# Execute command with current SSH prefix
rcm_execute_command() {
    local command_name="$1"
    local env="$2"

    if [[ -z "$command_name" || -z "$env" ]]; then
        echo "Usage: rcm_execute_command <command_name> <environment>"
        return 1
    fi

    local command="${RCM_COMMANDS[$command_name]}"
    local ssh_prefix="${CURRENT_SSH_PREFIXES[$env]}"

    if [[ -z "$command" ]]; then
        echo "Command '$command_name' not found"
        return 1
    fi

    if [[ -z "$ssh_prefix" && "$env" != "local" ]]; then
        echo "SSH prefix for environment '$env' not found"
        return 1
    fi

    # Build full command
    local full_command
    if [[ -n "$ssh_prefix" ]]; then
        full_command="$ssh_prefix \"$command\""
    else
        full_command="$command"
    fi

    echo "Executing: $full_command"
    eval "$full_command"
}

# Execute command asynchronously with state management
rcm_execute_command_async() {
    local command_name="$1"
    local env="$2"
    local command_id="${command_name}_${env}"

    # Set executing state
    rcm_set_command_state "$command_id" "executing"

    # Execute in background with output capture
    {
        local result
        local exit_code

        local command="${RCM_COMMANDS[$command_name]}"
        local ssh_prefix="${CURRENT_SSH_PREFIXES[$env]}"

        if [[ -z "$command" ]]; then
            result="Error: Command '$command_name' not found"
            exit_code=1
        elif [[ -z "$ssh_prefix" && "$env" != "local" ]]; then
            result="Error: SSH prefix for environment '$env' not configured"
            exit_code=1
        else
            # Build and execute full command
            local full_command
            if [[ -n "$ssh_prefix" ]]; then
                full_command="$ssh_prefix \"$command\""
            else
                full_command="$command"
            fi

            result=$(eval "$full_command" 2>&1)
            exit_code=$?
        fi

        # Store results using state management functions
        rcm_set_command_result "$command_id" "$result" "$exit_code"

        # Update state based on result
        if [[ $exit_code -eq 0 ]]; then
            rcm_set_command_state "$command_id" "success"
        else
            rcm_set_command_state "$command_id" "error"
        fi

        # Clear PID since command completed
        rcm_clear_command_pid "$command_id"

    } &

    # Store background PID for potential cancellation
    rcm_set_command_pid "$command_id" $!

    echo "$command_id"  # Return command ID for tracking
}

# Cancel running command
rcm_cancel_command() {
    local command_id="$1"
    local pid=$(rcm_get_command_pid "$command_id")

    if [[ -n "$pid" ]]; then
        kill "$pid" 2>/dev/null
        rcm_set_command_state "$command_id" "idle"
        rcm_clear_command_pid "$command_id"
        # Clear results since command was cancelled
        unset RCM_COMMAND_RESULTS["$command_id"]
        unset RCM_COMMAND_EXIT_CODES["$command_id"]
        echo "Command $command_id cancelled"
    else
        echo "No running process found for command $command_id"
        return 1
    fi
}

# Cancel all running commands for an environment
rcm_cancel_all_commands() {
    local env="$1"
    local cancelled_count=0

    for command_id in $(rcm_get_command_ids_for_env "$env"); do
        if rcm_is_command_running "$command_id"; then
            rcm_cancel_command "$command_id"
            ((cancelled_count++))
        fi
    done

    echo "Cancelled $cancelled_count running commands for environment: $env"
}

# Test SSH connectivity for an environment
rcm_test_ssh_connectivity() {
    local env="$1"
    local ssh_prefix="${CURRENT_SSH_PREFIXES[$env]}"

    if [[ -z "$ssh_prefix" ]]; then
        if [[ "$env" == "local" ]]; then
            echo "local: OK (direct execution)"
            return 0
        else
            echo "$env: ERROR (no SSH prefix configured)"
            return 1
        fi
    fi

    # Extract SSH command components for testing
    local ssh_cmd="$ssh_prefix echo 'SSH connectivity test'"

    if timeout 5 $ssh_cmd >/dev/null 2>&1; then
        echo "$env: OK"
        return 0
    else
        echo "$env: FAILED"
        return 1
    fi
}

# Test all SSH connections
rcm_test_all_connections() {
    echo "Testing SSH connectivity for all environments:"
    local failed_count=0

    for env in "${!CURRENT_SSH_PREFIXES[@]}"; do
        if ! rcm_test_ssh_connectivity "$env"; then
            ((failed_count++))
        fi
    done

    if [[ $failed_count -eq 0 ]]; then
        echo "All SSH connections successful"
    else
        echo "$failed_count SSH connections failed"
        return 1
    fi
}

# Build SSH command for testing/debugging
rcm_build_ssh_command() {
    local command_name="$1"
    local env="$2"

    local command="${RCM_COMMANDS[$command_name]}"
    local ssh_prefix="${CURRENT_SSH_PREFIXES[$env]}"

    if [[ -z "$command" ]]; then
        echo "Error: Command '$command_name' not found"
        return 1
    fi

    if [[ -z "$ssh_prefix" && "$env" != "local" ]]; then
        echo "Error: SSH prefix for environment '$env' not configured"
        return 1
    fi

    # Build full command
    if [[ -n "$ssh_prefix" ]]; then
        echo "$ssh_prefix \"$command\""
    else
        echo "$command"
    fi
}