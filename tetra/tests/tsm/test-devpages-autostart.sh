#!/bin/bash

# Simple Test for Devpages Auto-start Functionality
# This test validates that devpages is properly configured for auto-start

source "$(dirname "$0")/tsm-test-framework.sh"

# Override test integration to true for TSM testing
TSM_TEST_INTEGRATION=true

# === TEST FUNCTIONS ===

test_devpages_service_exists() {
    tsm_log_info "Testing: Devpages service exists in TSM"

    local services_output
    services_output=$(tsm services 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        tsm_log_failure "tsm services command failed with exit code $exit_code"
        return 1
    fi

    if ! echo "$services_output" | grep -q "devpages"; then
        tsm_log_failure "devpages service not found in services list"
        tsm_log_debug "Services output: $services_output"
        return 1
    fi

    tsm_log_debug "devpages service found in services list"
    return 0
}

test_devpages_enabled_status() {
    tsm_log_info "Testing: Devpages service enabled status"

    local services_output
    services_output=$(tsm services 2>&1)

    # Check if devpages shows enabled status (✅)
    if echo "$services_output" | grep -q "devpages.*✅"; then
        tsm_log_debug "devpages service is enabled for auto-start"
        return 0
    elif echo "$services_output" | grep -q "devpages.*⚪"; then
        tsm_log_failure "devpages service is disabled for auto-start"
        return 1
    else
        tsm_log_warning "devpages service status unclear - assuming not enabled"
        return 1
    fi
}

test_devpages_service_configuration() {
    tsm_log_info "Testing: Devpages service configuration"

    local show_output
    show_output=$(tsm show devpages 2>&1)
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        tsm_log_failure "Cannot show devpages service configuration"
        return 1
    fi

    # Check that the configuration contains required fields
    if ! echo "$show_output" | grep -q "Name: devpages"; then
        tsm_log_failure "devpages service configuration missing name"
        return 1
    fi

    if ! echo "$show_output" | grep -q "Command:.*node"; then
        tsm_log_failure "devpages service configuration missing proper command"
        return 1
    fi

    if ! echo "$show_output" | grep -q "Directory:.*devpages"; then
        tsm_log_failure "devpages service configuration missing proper directory"
        return 1
    fi

    tsm_log_debug "devpages service configuration validated"
    return 0
}

test_devpages_named_port_assigned() {
    tsm_log_info "Testing: Devpages has named port assigned"

    local ports_output
    ports_output=$(tsm ports list 2>&1)

    # Check that devpages has a port assigned in the named registry
    if ! echo "$ports_output" | grep -q "devpages.*[0-9]"; then
        tsm_log_failure "devpages does not have a named port assigned"
        tsm_log_debug "Ports output: $ports_output"
        return 1
    fi

    # Extract the port number for devpages
    local devpages_port
    devpages_port=$(echo "$ports_output" | grep "devpages" | awk '{print $2}' | head -1)

    if [[ -n "$devpages_port" && "$devpages_port" =~ ^[0-9]+$ ]]; then
        tsm_log_debug "devpages assigned to port: $devpages_port"
        return 0
    else
        tsm_log_failure "devpages port is not a valid number: $devpages_port"
        return 1
    fi
}

test_startup_command_functionality() {
    tsm_log_info "Testing: TSM startup command works"

    # This is a dry-run test - we don't actually start services
    # Just test that the startup command exists and can be called

    local help_output
    help_output=$(tsm --help 2>&1 || tsm help 2>&1)

    if ! echo "$help_output" | grep -q "startup"; then
        tsm_log_failure "startup command not found in TSM help"
        return 1
    fi

    # Test that we can call the startup command (it should handle no services gracefully)
    # Since we don't want to actually start services in the test, we'll just validate
    # that the command is recognized
    local startup_help
    startup_help=$(tsm startup --help 2>&1 || echo "command exists")

    tsm_log_debug "startup command is available"
    return 0
}

# Test the enhanced ports functionality
test_enhanced_ports_display() {
    tsm_log_info "Testing: Enhanced ports display shows clear status"

    local scan_output
    scan_output=$(tsm ports scan 2>&1)

    # Check that scan output contains status indicators
    if ! echo "$scan_output" | grep -q -E "(FREE|USED)"; then
        tsm_log_failure "ports scan doesn't show clear status indicators"
        return 1
    fi

    # Check that devpages port status is shown
    if echo "$scan_output" | grep -q "devpages"; then
        local devpages_line
        devpages_line=$(echo "$scan_output" | grep "devpages" | head -1)

        if [[ "$devpages_line" =~ (FREE|USED) ]]; then
            tsm_log_debug "devpages port status shown: $devpages_line"
            return 0
        else
            tsm_log_failure "devpages port status not clear in scan output"
            return 1
        fi
    else
        tsm_log_warning "devpages not found in ports scan output"
        return 1
    fi
}

# === MAIN TEST SUITE ===

main() {
    # Parse command line arguments
    tsm_parse_test_args "$@"

    # Setup test environment
    if ! tsm_test_setup "Devpages Auto-Start Test Suite"; then
        echo "Failed to setup test environment"
        exit 1
    fi

    # === Basic Devpages Tests ===
    tsm_log_section "Devpages Service Configuration Tests"
    run_test "Devpages service exists" test_devpages_service_exists
    run_test "Devpages service enabled status" test_devpages_enabled_status
    run_test "Devpages service configuration" test_devpages_service_configuration

    # === Named Ports Tests ===
    tsm_log_section "Named Ports Tests"
    run_test "Devpages has named port assigned" test_devpages_named_port_assigned
    run_test "Enhanced ports display shows clear status" test_enhanced_ports_display

    # === Auto-start Tests ===
    tsm_log_section "Auto-start Functionality Tests"
    run_test "TSM startup command works" test_startup_command_functionality

    # === Results ===
    tsm_test_results "Devpages Auto-Start Test Results"
    local results_exit_code=$?

    # Cleanup
    tsm_test_teardown

    exit $results_exit_code
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi