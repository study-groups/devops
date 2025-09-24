#!/bin/bash

# TSM Process Lifecycle Test Suite
# Tests the complete process lifecycle: start → list → stop/kill → verify cleanup
# This validates the directory path fixes and ensures no phantom processes

# Load the test framework
source "$(dirname "$0")/tsm-test-framework.sh"

# === LIFECYCLE TEST FUNCTIONS ===

# Test basic start and immediate status
test_start_and_status() {
    local test_dir=$(tsm_get_test_dir)
    cd "$test_dir"

    tsm_log_debug "Testing start → immediate status check"

    # Start a simple process
    local output
    output=$(tsm start --port 5001 echo "lifecycle test" 2>&1)
    local exit_code=$?

    tsm_log_debug "Start command output: $output"
    tsm_log_debug "Start exit code: $exit_code"

    if [[ $exit_code -eq 0 ]]; then
        # Extract process name from output
        local process_name
        if [[ "$output" =~ started\ \'([^\']+)\' ]]; then
            process_name="${BASH_REMATCH[1]}"
            tsm_log_debug "Process name: $process_name"
        else
            tsm_log_debug "Could not extract process name from: $output"
            return 1
        fi

        # Check if process appears in list
        local list_output
        list_output=$(tsm ls 2>&1)
        tsm_log_debug "List output: $list_output"

        if echo "$list_output" | grep -q "$process_name"; then
            tsm_log_debug "✅ Process appears in list"
            return 0
        else
            tsm_log_debug "❌ Process missing from list"
            return 1
        fi
    else
        tsm_log_debug "❌ Start command failed"
        return 1
    fi
}

# Test start → list → kill → verify cleanup
test_full_lifecycle() {
    local test_dir=$(tsm_get_test_dir)
    cd "$test_dir"

    tsm_log_debug "Testing complete lifecycle: start → list → kill → verify"

    # Step 1: Start a process
    tsm_log_debug "Step 1: Starting process"
    local start_output
    start_output=$(tsm start --port 5002 sleep 30 2>&1)
    local start_exit=$?

    tsm_log_debug "Start output: $start_output"

    if [[ $start_exit -ne 0 ]]; then
        tsm_log_debug "❌ Failed to start process"
        return 1
    fi

    # Extract process info
    local process_name process_id
    if [[ "$start_output" =~ started\ \'([^\']+)\'.*TSM\ ID:\ ([0-9]+) ]]; then
        process_name="${BASH_REMATCH[1]}"
        process_id="${BASH_REMATCH[2]}"
        tsm_log_debug "Process: $process_name (ID: $process_id)"
    else
        tsm_log_debug "Could not extract process info from: $start_output"
        return 1
    fi

    # Step 2: Verify process is listed
    tsm_log_debug "Step 2: Verifying process in list"
    local list_output
    list_output=$(tsm ls 2>&1)
    tsm_log_debug "List output: $list_output"

    if ! echo "$list_output" | grep -q "$process_name"; then
        tsm_log_debug "❌ Process not found in list after start"
        return 1
    fi
    tsm_log_debug "✅ Process found in list"

    # Step 3: Kill the process
    tsm_log_debug "Step 3: Killing process ID $process_id"
    local kill_output
    kill_output=$(tsm kill "$process_id" 2>&1)
    local kill_exit=$?

    tsm_log_debug "Kill output: $kill_output"
    tsm_log_debug "Kill exit code: $kill_exit"

    if [[ $kill_exit -ne 0 ]]; then
        tsm_log_debug "❌ Kill command failed"
        return 1
    fi

    # Step 4: Verify process is removed from list
    tsm_log_debug "Step 4: Verifying process removed from list"
    local final_list
    final_list=$(tsm ls 2>&1)
    tsm_log_debug "Final list output: $final_list"

    if echo "$final_list" | grep -q "$process_name"; then
        tsm_log_debug "❌ Process still appears in list after kill"
        return 1
    fi
    tsm_log_debug "✅ Process properly removed from list"

    return 0
}

# Test multiple processes lifecycle
test_multiple_processes() {
    local test_dir=$(tsm_get_test_dir)
    cd "$test_dir"

    tsm_log_debug "Testing multiple processes lifecycle"

    # Start multiple processes
    local processes=()
    local ports=(5003 5004 5005)

    for port in "${ports[@]}"; do
        tsm_log_debug "Starting process on port $port"
        local output
        output=$(tsm start --port "$port" sleep 60 2>&1)

        if [[ $? -eq 0 ]]; then
            if [[ "$output" =~ started\ \'([^\']+)\' ]]; then
                local name="${BASH_REMATCH[1]}"
                processes+=("$name")
                tsm_log_debug "Started: $name"
            fi
        else
            tsm_log_debug "Failed to start process on port $port"
            return 1
        fi
    done

    # Verify all processes are listed
    local list_output
    list_output=$(tsm ls 2>&1)
    tsm_log_debug "List with multiple processes: $list_output"

    for process in "${processes[@]}"; do
        if ! echo "$list_output" | grep -q "$process"; then
            tsm_log_debug "❌ Process $process missing from list"
            return 1
        fi
    done
    tsm_log_debug "✅ All processes found in list"

    # Kill all processes using wildcard
    tsm_log_debug "Killing all processes with wildcard"
    local kill_output
    kill_output=$(tsm kill "*" 2>&1)
    tsm_log_debug "Wildcard kill output: $kill_output"

    # Verify all processes are gone
    local final_list
    final_list=$(tsm ls 2>&1)
    tsm_log_debug "Final list after wildcard kill: $final_list"

    for process in "${processes[@]}"; do
        if echo "$final_list" | grep -q "$process"; then
            tsm_log_debug "❌ Process $process still in list after wildcard kill"
            return 1
        fi
    done
    tsm_log_debug "✅ All processes removed after wildcard kill"

    return 0
}

# Test stop vs kill behavior
test_stop_vs_kill() {
    local test_dir=$(tsm_get_test_dir)
    cd "$test_dir"

    tsm_log_debug "Testing stop vs kill behavior"

    # Test stop command
    tsm_log_debug "Testing stop command"
    local stop_output
    stop_output=$(tsm start --port 5006 sleep 30 2>&1)

    if [[ $? -eq 0 && "$stop_output" =~ TSM\ ID:\ ([0-9]+) ]]; then
        local stop_id="${BASH_REMATCH[1]}"

        # Use stop command
        local stop_result
        stop_result=$(tsm stop "$stop_id" 2>&1)
        tsm_log_debug "Stop result: $stop_result"

        # Verify process is gone
        if tsm ls 2>&1 | grep -q "ID.*$stop_id"; then
            tsm_log_debug "❌ Process still listed after stop"
            return 1
        fi
        tsm_log_debug "✅ Stop command works"
    else
        tsm_log_debug "❌ Failed to start process for stop test"
        return 1
    fi

    # Test kill command
    tsm_log_debug "Testing kill command"
    local kill_output
    kill_output=$(tsm start --port 5007 sleep 30 2>&1)

    if [[ $? -eq 0 && "$kill_output" =~ TSM\ ID:\ ([0-9]+) ]]; then
        local kill_id="${BASH_REMATCH[1]}"

        # Use kill command
        local kill_result
        kill_result=$(tsm kill "$kill_id" 2>&1)
        tsm_log_debug "Kill result: $kill_result"

        # Verify process is gone
        if tsm ls 2>&1 | grep -q "ID.*$kill_id"; then
            tsm_log_debug "❌ Process still listed after kill"
            return 1
        fi
        tsm_log_debug "✅ Kill command works"
    else
        tsm_log_debug "❌ Failed to start process for kill test"
        return 1
    fi

    return 0
}

# Test delete command (should also remove stopped processes)
test_delete_cleanup() {
    local test_dir=$(tsm_get_test_dir)
    cd "$test_dir"

    tsm_log_debug "Testing delete command cleanup"

    # Start a short-lived process that will exit on its own
    local output
    output=$(tsm start --port 5008 echo "short lived" 2>&1)

    if [[ $? -eq 0 && "$output" =~ TSM\ ID:\ ([0-9]+) ]]; then
        local process_id="${BASH_REMATCH[1]}"

        # Wait a moment for process to exit
        sleep 2

        # Process should show as stopped in list
        local list_output
        list_output=$(tsm ls 2>&1)
        tsm_log_debug "List after process exit: $list_output"

        if echo "$list_output" | grep -q "stopped"; then
            tsm_log_debug "✅ Process shows as stopped"

            # Now delete it
            local delete_output
            delete_output=$(tsm delete "$process_id" 2>&1)
            tsm_log_debug "Delete output: $delete_output"

            # Verify it's completely gone
            local final_list
            final_list=$(tsm ls 2>&1)
            if echo "$final_list" | grep -q "$process_id"; then
                tsm_log_debug "❌ Process still in list after delete"
                return 1
            fi
            tsm_log_debug "✅ Delete properly removes stopped process"

        else
            tsm_log_debug "❌ Process doesn't show as stopped"
            return 1
        fi
    else
        tsm_log_debug "❌ Failed to start short-lived process"
        return 1
    fi

    return 0
}

# Test edge case: killing non-existent process
test_kill_nonexistent() {
    tsm_log_debug "Testing kill of non-existent process"

    # Try to kill a process that doesn't exist
    local kill_output
    kill_output=$(tsm kill 999 2>&1)
    local kill_exit=$?

    tsm_log_debug "Kill non-existent output: $kill_output"
    tsm_log_debug "Kill non-existent exit code: $kill_exit"

    # Should fail gracefully
    if [[ $kill_exit -ne 0 ]]; then
        if echo "$kill_output" | grep -q "not found"; then
            tsm_log_debug "✅ Proper error message for non-existent process"
            return 0
        else
            tsm_log_debug "❌ Error message unclear: $kill_output"
            return 1
        fi
    else
        tsm_log_debug "❌ Kill should fail for non-existent process"
        return 1
    fi
}

# === MAIN EXECUTION ===

main() {
    # Parse command line arguments
    tsm_parse_test_args "$@"

    # Force integration tests for lifecycle testing
    TSM_TEST_INTEGRATION=true

    # Setup test environment
    tsm_test_setup "TSM Process Lifecycle Test Suite" || exit 1

    # Run lifecycle tests
    run_test "Start and Status Check" test_start_and_status
    run_test "Full Lifecycle (start→list→kill→verify)" test_full_lifecycle
    run_test "Multiple Processes Lifecycle" test_multiple_processes
    run_test "Stop vs Kill Behavior" test_stop_vs_kill
    run_test "Delete Command Cleanup" test_delete_cleanup
    run_test "Kill Non-existent Process" test_kill_nonexistent

    # Show results
    tsm_test_results "TSM Lifecycle Test Results"

    # Teardown happens automatically via trap
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi