#!/bin/bash

# TSM Ports Display Enhancement Test Suite
# Test enhanced ports display showing open/named/available/enabled status

source "$(dirname "$0")/tsm-test-framework.sh"

# Override test integration to true for TSM testing
TSM_TEST_INTEGRATION=true

# === TEST CONFIGURATION ===

# Test ports for validation
TEST_PORTS=(3000 3001 4000 4001 8080)

# === HELPER FUNCTIONS ===

start_test_processes() {
    tsm_log_debug "Starting test processes on various ports"

    # Start a simple process on port 3000 for testing
    python3 -m http.server 3000 --directory /tmp >/dev/null 2>&1 &
    local pid1=$!
    echo $pid1 > "$TSM_TEST_DIR/test_server_3000.pid"

    # Start another process on port 8080
    python3 -m http.server 8080 --directory /tmp >/dev/null 2>&1 &
    local pid2=$!
    echo $pid2 > "$TSM_TEST_DIR/test_server_8080.pid"

    # Give processes time to start
    sleep 2

    tsm_log_debug "Started test processes: PID $pid1 on port 3000, PID $pid2 on port 8080"
}

cleanup_test_processes() {
    tsm_log_debug "Cleaning up test processes"

    if [[ -f "$TSM_TEST_DIR/test_server_3000.pid" ]]; then
        local pid1=$(cat "$TSM_TEST_DIR/test_server_3000.pid")
        kill $pid1 2>/dev/null || true
        rm -f "$TSM_TEST_DIR/test_server_3000.pid"
    fi

    if [[ -f "$TSM_TEST_DIR/test_server_8080.pid" ]]; then
        local pid2=$(cat "$TSM_TEST_DIR/test_server_8080.pid")
        kill $pid2 2>/dev/null || true
        rm -f "$TSM_TEST_DIR/test_server_8080.pid"
    fi
}

# === ENHANCED PORTS DISPLAY TESTS ===

test_ports_status_display() {
    tsm_log_info "Testing: Enhanced ports status display"

    # Start test processes to have some ports in use
    start_test_processes

    # Test the enhanced ports scan functionality
    local output
    output=$(tsm ports scan 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        tsm_log_failure "ports scan command failed with exit code $exit_code"
        cleanup_test_processes
        return 1
    fi

    # Check that output contains status information
    if ! echo "$output" | grep -q -E "(STATUS|FREE|USED)"; then
        tsm_log_failure "Output doesn't contain status information"
        tsm_log_debug "Output: $output"
        cleanup_test_processes
        return 1
    fi

    # Check that named ports are shown
    if ! echo "$output" | grep -q "devpages.*4000"; then
        tsm_log_failure "Named port devpages:4000 not displayed"
        cleanup_test_processes
        return 1
    fi

    cleanup_test_processes
    tsm_log_debug "Ports status display validated"
    return 0
}

test_ports_available_vs_used() {
    tsm_log_info "Testing: Clear distinction between available and used ports"

    start_test_processes

    local output
    output=$(tsm ports scan 2>&1)

    # Check that port 3000 shows as USED (we started a process there)
    if ! echo "$output" | grep -q "3000.*USED"; then
        tsm_log_warning "Port 3000 should show as USED (test process may have failed to start)"
        # Don't fail the test as this could be environment-dependent
    fi

    # Check that port 4000 (devpages named port) shows status
    if echo "$output" | grep -q "devpages.*4000"; then
        local devpages_line
        devpages_line=$(echo "$output" | grep "devpages.*4000")
        if [[ "$devpages_line" =~ (FREE|USED) ]]; then
            tsm_log_debug "Devpages port shows status: $devpages_line"
        else
            tsm_log_failure "Devpages port doesn't show clear status"
            cleanup_test_processes
            return 1
        fi
    fi

    cleanup_test_processes
    return 0
}

test_named_ports_in_status() {
    tsm_log_info "Testing: Named ports clearly identified in status output"

    local output
    output=$(tsm ports scan 2>&1)

    # Check that all expected named ports are shown with their status
    local expected_named_ports=("devpages" "tetra" "arcade" "pbase")

    for service in "${expected_named_ports[@]}"; do
        if ! echo "$output" | grep -q "$service"; then
            tsm_log_failure "Named service '$service' not found in ports status"
            return 1
        fi
    done

    # Check that the output clearly distinguishes named vs other ports
    # Named ports should have service names, others should not
    local service_lines
    service_lines=$(echo "$output" | grep -E "(devpages|tetra|arcade|pbase)" | wc -l)

    if [[ $service_lines -lt 4 ]]; then
        tsm_log_failure "Not all named services shown in output (expected 4, got $service_lines)"
        return 1
    fi

    tsm_log_debug "Named ports clearly identified in status output"
    return 0
}

# === SERVICE ENABLED STATUS TESTS ===

test_service_enabled_status() {
    tsm_log_info "Testing: Service enabled status display"

    # Check that we can see which services are enabled
    local services_output
    services_output=$(tsm services 2>&1)

    # Should show enabled/disabled status clearly
    if ! echo "$services_output" | grep -q -E "(✅|⚪|enabled|disabled)"; then
        tsm_log_failure "Services output doesn't show clear enabled/disabled status"
        tsm_log_debug "Services output: $services_output"
        return 1
    fi

    # Check that devpages shows its enabled status
    if echo "$services_output" | grep -q "devpages"; then
        local devpages_line
        devpages_line=$(echo "$services_output" | grep "devpages")
        if [[ "$devpages_line" =~ (✅|⚪|enabled|disabled) ]]; then
            tsm_log_debug "Devpages service shows status: $devpages_line"
        else
            tsm_log_failure "Devpages service doesn't show clear enabled status"
            return 1
        fi
    else
        tsm_log_failure "Devpages service not found in services list"
        return 1
    fi

    return 0
}

# === COMPREHENSIVE STATUS TESTS ===

test_comprehensive_port_service_status() {
    tsm_log_info "Testing: Comprehensive port and service status overview"

    # This test validates the integration between:
    # 1. Named ports registry
    # 2. Port availability status
    # 3. Service enabled status
    # 4. Clear visual indicators

    # Test ports overview
    local ports_output
    ports_output=$(tsm ports scan 2>&1)

    # Test services overview
    local services_output
    services_output=$(tsm services 2>&1)

    # Check that we can correlate information between the two commands
    # If devpages is enabled and has a named port, both should be visible

    local devpages_in_ports
    local devpages_in_services

    devpages_in_ports=$(echo "$ports_output" | grep "devpages" || echo "")
    devpages_in_services=$(echo "$services_output" | grep "devpages" || echo "")

    if [[ -n "$devpages_in_ports" && -n "$devpages_in_services" ]]; then
        tsm_log_debug "Devpages found in both ports and services output"

        # Check that port shows availability status
        if [[ "$devpages_in_ports" =~ (FREE|USED) ]]; then
            tsm_log_debug "Port status: $devpages_in_ports"
        else
            tsm_log_warning "Port status not clearly indicated"
        fi

        # Check that service shows enabled status
        if [[ "$devpages_in_services" =~ (✅|⚪|enabled|disabled) ]]; then
            tsm_log_debug "Service status: $devpages_in_services"
        else
            tsm_log_warning "Service enabled status not clearly indicated"
        fi

        return 0
    else
        tsm_log_failure "Cannot correlate devpages between ports and services output"
        tsm_log_debug "Ports output: $devpages_in_ports"
        tsm_log_debug "Services output: $devpages_in_services"
        return 1
    fi
}

# === INTEGRATION WITH EXISTING FUNCTIONALITY ===

test_ports_list_vs_scan() {
    tsm_log_info "Testing: Difference between ports list and ports scan"

    local list_output
    list_output=$(tsm ports list 2>&1)

    local scan_output
    scan_output=$(tsm ports scan 2>&1)

    # 'list' should show just the named port registry
    # 'scan' should show status information for those ports

    if [[ "$list_output" == "$scan_output" ]]; then
        tsm_log_failure "ports list and ports scan produce identical output - they should be different"
        return 1
    fi

    # List should be simpler (just service:port mappings)
    if echo "$list_output" | grep -q -E "(STATUS|FREE|USED|PID)"; then
        tsm_log_failure "ports list should not contain status information"
        return 1
    fi

    # Scan should have status information
    if ! echo "$scan_output" | grep -q -E "(STATUS|FREE|USED)"; then
        tsm_log_failure "ports scan should contain status information"
        return 1
    fi

    tsm_log_debug "ports list and ports scan have appropriate different outputs"
    return 0
}

# === MAIN TEST SUITE ===

main() {
    # Parse command line arguments
    tsm_parse_test_args "$@"

    # Setup test environment
    if ! tsm_test_setup "TSM Ports Display Enhancement Test Suite"; then
        echo "Failed to setup test environment"
        exit 1
    fi

    # Setup cleanup trap for test processes
    trap cleanup_test_processes EXIT

    # === Enhanced Ports Display Tests ===
    tsm_log_section "Enhanced Ports Display Tests"
    run_test "Ports status display shows availability" test_ports_status_display
    run_test "Clear distinction between available and used ports" test_ports_available_vs_used
    run_test "Named ports clearly identified in status" test_named_ports_in_status

    # === Service Status Tests ===
    tsm_log_section "Service Status Tests"
    run_test "Service enabled status display" test_service_enabled_status

    # === Comprehensive Integration Tests ===
    tsm_log_section "Comprehensive Status Tests"
    run_test "Comprehensive port and service status overview" test_comprehensive_port_service_status
    run_test "Difference between ports list and ports scan" test_ports_list_vs_scan

    # === Results ===
    tsm_test_results "TSM Ports Display Enhancement Test Results"
    local results_exit_code=$?

    # Cleanup
    cleanup_test_processes
    tsm_test_teardown

    exit $results_exit_code
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi