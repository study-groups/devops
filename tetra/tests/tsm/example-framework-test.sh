#!/bin/bash

# Example TSM Test using the TSM Test Framework
# This demonstrates how to use the generic setup/teardown framework

# Load the test framework
source "$(dirname "$0")/tsm-test-framework.sh"

# === TEST FUNCTIONS ===

test_framework_setup() {
    # Verify test environment is created
    if tsm_is_test_env; then
        tsm_log_debug "✅ Test environment detected: $(tsm_get_test_dir)"
    else
        tsm_log_debug "❌ No test environment found"
        return 1
    fi

    # Check if env files were created
    local env_dir=$(tsm_get_test_env_dir)
    if [[ -f "$env_dir/local.env" ]]; then
        tsm_log_debug "✅ Test env files created"
    else
        tsm_log_debug "❌ Test env files missing"
        return 1
    fi

    return 0
}

test_env_file_extraction() {
    local env_dir=$(tsm_get_test_env_dir)

    # Test standard extraction
    local port name
    port=$(source "$env_dir/local.env" 2>/dev/null && echo "${PORT:-}")
    name=$(source "$env_dir/local.env" 2>/dev/null && echo "${NAME:-}")

    tsm_log_debug "Extracted from local.env: PORT='$port', NAME='$name'"

    if [[ "$port" == "4000" && "$name" == "testapp" ]]; then
        return 0
    else
        tsm_log_debug "Expected PORT=4000, NAME=testapp"
        return 1
    fi
}

test_edge_case_handling() {
    local env_dir=$(tsm_get_test_env_dir)

    # Test port-only file
    local port name
    port=$(source "$env_dir/port-only.env" 2>/dev/null && echo "${PORT:-}")
    name=$(source "$env_dir/port-only.env" 2>/dev/null && echo "${NAME:-}")

    tsm_log_debug "Port-only file: PORT='$port', NAME='$name'"

    if [[ "$port" == "3001" && -z "$name" ]]; then
        return 0
    else
        tsm_log_debug "Expected PORT=3001, empty NAME"
        return 1
    fi
}

test_integration_tsm_available() {
    if [[ "$TSM_TEST_INTEGRATION" != "true" ]]; then
        tsm_log_debug "Skipping integration test (use --integration)"
        return 0
    fi

    # Check if TSM command is available
    if command -v tsm >/dev/null 2>&1; then
        tsm_log_debug "✅ TSM command available"

        # Test basic TSM command
        local output
        output=$(tsm --help 2>&1)
        if echo "$output" | grep -q "Usage: tsm"; then
            tsm_log_debug "✅ TSM help command works"
            return 0
        else
            tsm_log_debug "❌ TSM help command failed"
            return 1
        fi
    else
        tsm_log_debug "❌ TSM command not available"
        return 1
    fi
}

# === MAIN EXECUTION ===

main() {
    # Parse command line arguments
    tsm_parse_test_args "$@"

    # Setup test environment
    tsm_test_setup "TSM Framework Example Test" || exit 1

    # Run tests
    run_test "Framework Setup Verification" test_framework_setup
    run_test "Environment File Extraction" test_env_file_extraction
    run_test "Edge Case Handling" test_edge_case_handling
    run_test "Integration TSM Available" test_integration_tsm_available

    # Show results
    tsm_test_results "Example Test Results"

    # Teardown happens automatically via trap
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi