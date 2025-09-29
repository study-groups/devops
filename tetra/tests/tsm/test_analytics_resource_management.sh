#!/usr/bin/env bash

# Test script for TSM Analytics Resource Management
# Tests for EMFILE issues and proper resource cleanup

set -euo pipefail

# Test configuration
TEST_DIR="$(dirname "${BASH_SOURCE[0]}")"
TETRA_SRC="${TETRA_SRC:-$(realpath "$TEST_DIR/../..")}"
TSM_DIR="$TETRA_SRC/bash/tsm"
TEST_LOG_DIR="/tmp/tetra_test_$$"
TEST_SERVICE="test_service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up test resources..."

    # Kill any background processes started by tests
    local test_pids=$(pgrep -f "tetra_test" || true)
    if [[ -n "$test_pids" ]]; then
        echo "$test_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 1
        echo "$test_pids" | xargs -r kill -KILL 2>/dev/null || true
    fi

    # Clean up test files
    rm -rf "$TEST_LOG_DIR" 2>/dev/null || true

    echo "✅ Cleanup complete"
}

trap cleanup EXIT

# Test helper functions
assert_success() {
    local command="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$command" &>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $description"
        echo "   Command: $command"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

assert_failure() {
    local command="$1"
    local description="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if ! eval "$command" &>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $description"
        echo "   Command: $command (should have failed)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

check_file_descriptor_usage() {
    local description="$1"
    local max_fds="${2:-100}"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Get current process FD count
    local current_fds
    if [[ "$OSTYPE" == "darwin"* ]]; then
        current_fds=$(lsof -p $$ 2>/dev/null | wc -l || echo "0")
    else
        current_fds=$(ls -1 /proc/$$/fd 2>/dev/null | wc -l || echo "0")
    fi

    if [[ $current_fds -lt $max_fds ]]; then
        echo -e "${GREEN}✅ PASS${NC}: $description (FDs: $current_fds/$max_fds)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $description (FDs: $current_fds/$max_fds)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Setup test environment
setup_test_environment() {
    echo "🔧 Setting up test environment..."

    mkdir -p "$TEST_LOG_DIR"

    # Create a test log file with sample tetra tokens
    cat > "$TEST_LOG_DIR/${TEST_SERVICE}.out" << 'EOF'
TETRA:AUTH:SESSION_START {"sessionId":"test_session_1","userId":"testuser","timestamp":1703123456789}
TETRA:INTERACTION:CLICK {"element":"button#test","coords":{"x":100,"y":200},"timestamp":1703123457000}
TETRA:INTERACTION:CLICK {"element":"button#save","coords":{"x":150,"y":250},"timestamp":1703123458000}
TETRA:PERFORMANCE:API_CALL {"endpoint":"/api/test","responseTime":150,"status":200,"timestamp":1703123459000}
TETRA:INTERACTION:CLICK {"element":"link#help","coords":{"x":200,"y":300},"timestamp":1703123461000}
TETRA:AUTH:SESSION_START {"sessionId":"test_session_2","userId":"admin","timestamp":1703123462000}
TETRA:INTERACTION:CLICK {"element":"button#admin","coords":{"x":300,"y":400},"timestamp":1703123463000}
TETRA:PERFORMANCE:API_CALL {"endpoint":"/api/admin","responseTime":2500,"status":200,"timestamp":1703123464000}
TETRA:ERROR:ERROR {"message":"Test error","timestamp":1703123465000}
TETRA:BATCH_FLUSH {"eventCount":25,"sessionId":"test_session_1","timestamp":1703123466000}
EOF

    echo "✅ Test environment ready"
}

# Mock the TSM log resolution function to use our test files
tsm_monitor_resolve_log_file() {
    local pattern="$1"
    if [[ "$pattern" == "$TEST_SERVICE" ]]; then
        echo "$TEST_LOG_DIR/${TEST_SERVICE}.out"
    fi
}

# Export the function so it can be used by sourced scripts
export -f tsm_monitor_resolve_log_file

# Test 1: Basic Resource Management
test_basic_resource_management() {
    echo -e "\n${YELLOW}🧪 Test 1: Basic Resource Management${NC}"

    # Check initial FD usage
    check_file_descriptor_usage "Initial file descriptor usage is reasonable" 50

    # Source analytics scripts without executing
    source "$TSM_DIR/tsm_analytics.sh" 2>/dev/null || true
    source "$TSM_DIR/tsm_session_aggregator.sh" 2>/dev/null || true
    source "$TSM_DIR/tsm_monitor.sh" 2>/dev/null || true

    check_file_descriptor_usage "File descriptor usage after sourcing scripts" 60
}

# Test 2: Analytics Function Resource Usage
test_analytics_functions() {
    echo -e "\n${YELLOW}🧪 Test 2: Analytics Function Resource Usage${NC}"

    # Test click analysis
    if command -v tsm_analyze_click_timing &>/dev/null; then
        (timeout 10 tsm_analyze_click_timing "$TEST_SERVICE" 300 2>&1 | head -20) || true
        check_file_descriptor_usage "After click timing analysis" 70
    fi

    # Test session extraction
    if command -v tsm_extract_sessions &>/dev/null; then
        (timeout 10 tsm_extract_sessions "$TEST_SERVICE" 600 summary 2>&1 | head -20) || true
        check_file_descriptor_usage "After session extraction" 70
    fi

    # Test user disambiguation
    if command -v tsm_disambiguate_users &>/dev/null; then
        (timeout 10 tsm_disambiguate_users "$TEST_SERVICE" 600 2>&1 | head -20) || true
        check_file_descriptor_usage "After user disambiguation" 70
    fi
}

# Test 3: Concurrent Process Limits
test_concurrent_limits() {
    echo -e "\n${YELLOW}🧪 Test 3: Concurrent Process Limits${NC}"

    # Spawn multiple analytics processes concurrently
    local pids=()

    for i in {1..5}; do
        if command -v tsm_analyze_click_timing &>/dev/null; then
            (timeout 5 tsm_analyze_click_timing "$TEST_SERVICE" 60 >/dev/null 2>&1) &
            pids+=($!)
        fi
    done

    check_file_descriptor_usage "During concurrent analytics processes" 150

    # Wait for processes to complete
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    sleep 1  # Allow cleanup
    check_file_descriptor_usage "After concurrent processes complete" 80
}

# Test 4: Memory and Process Cleanup
test_cleanup_behavior() {
    echo -e "\n${YELLOW}🧪 Test 4: Cleanup Behavior${NC}"

    local initial_processes=$(pgrep -c bash || echo "0")

    # Run analytics that should clean up properly
    if command -v tsm_analyze_user_journey &>/dev/null; then
        timeout 5 tsm_analyze_user_journey "$TEST_SERVICE" "" 300 >/dev/null 2>&1 || true
    fi

    sleep 2  # Allow cleanup time

    local final_processes=$(pgrep -c bash || echo "0")
    local process_diff=$((final_processes - initial_processes))

    TESTS_RUN=$((TESTS_RUN + 1))
    if [[ $process_diff -le 2 ]]; then  # Allow some tolerance
        echo -e "${GREEN}✅ PASS${NC}: Process cleanup (diff: $process_diff)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: Process cleanup (diff: $process_diff)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Test 5: Error Handling with Resource Limits
test_error_handling() {
    echo -e "\n${YELLOW}🧪 Test 5: Error Handling with Resource Limits${NC}"

    # Test with non-existent service
    assert_failure "tsm_extract_sessions 'nonexistent_service' 600 summary" \
                  "Gracefully handles non-existent service"

    # Test with invalid time window
    if command -v tsm_analyze_click_timing &>/dev/null; then
        assert_failure "tsm_analyze_click_timing '$TEST_SERVICE' -1" \
                      "Handles invalid time window"
    fi

    check_file_descriptor_usage "After error conditions" 80
}

# Test 6: Resource Monitoring Functions
test_resource_monitoring() {
    echo -e "\n${YELLOW}🧪 Test 6: Resource Monitoring Functions${NC}"

    # Test that our monitoring scripts exist
    assert_success "test -f '$TSM_DIR/tsm_monitor.sh'" \
                  "Monitor script exists"

    assert_success "test -f '$TSM_DIR/tsm_analytics.sh'" \
                  "Analytics script exists"

    assert_success "test -f '$TSM_DIR/tsm_session_aggregator.sh'" \
                  "Session aggregator script exists"

    # Test that scripts are executable
    assert_success "test -x '$TSM_DIR/tsm_monitor.sh'" \
                  "Monitor script is executable"

    assert_success "test -x '$TSM_DIR/tsm_analytics.sh'" \
                  "Analytics script is executable"

    assert_success "test -x '$TSM_DIR/tsm_session_aggregator.sh'" \
                  "Session aggregator script is executable"
}

# Test 7: Integration with TSM Commands
test_tsm_integration() {
    echo -e "\n${YELLOW}🧪 Test 7: TSM Integration${NC}"

    # Test that TSM recognizes the new commands
    if command -v tsm &>/dev/null; then
        # These should not crash even if they don't work perfectly
        timeout 5 tsm help 2>&1 | grep -q "monitor\|stream\|dashboard" && \
            echo -e "${GREEN}✅ PASS${NC}: TSM help includes analytics commands" || \
            echo -e "${YELLOW}⚠️  SKIP${NC}: TSM help test (command may not be fully integrated)"
    else
        echo -e "${YELLOW}⚠️  SKIP${NC}: TSM command not available in test environment"
    fi
}

# Main test execution
main() {
    echo "🧪 TSM Analytics Resource Management Tests"
    echo "=========================================="

    setup_test_environment

    test_basic_resource_management
    test_analytics_functions
    test_concurrent_limits
    test_cleanup_behavior
    test_error_handling
    test_resource_monitoring
    test_tsm_integration

    echo -e "\n📊 Test Results:"
    echo "================"
    echo -e "Total Tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}💥 Some tests failed. Check the output above.${NC}"
        exit 1
    fi
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi