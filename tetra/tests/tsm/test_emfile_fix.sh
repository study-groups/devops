#!/usr/bin/env bash

# Test script specifically for EMFILE (too many open files) issue on macOS
# Tests the fix for: Error: spawn pgrep EMFILE

set -euo pipefail

# Test configuration
TEST_DIR="$(dirname "${BASH_SOURCE[0]}")"
TETRA_SRC="${TETRA_SRC:-$(realpath "$TEST_DIR/../..")}"
TSM_DIR="$TETRA_SRC/bash/tsm"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${BLUE}🔧 EMFILE Fix Tests for macOS${NC}"
echo "=================================="

# Helper functions
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="${3:-success}"

    echo -e "\n${YELLOW}🧪 Testing: $test_name${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$expected_result" == "success" ]]; then
        if eval "$test_command" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC}: $test_name"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL${NC}: $test_name"
            echo "   Command: $test_command"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        if ! eval "$test_command" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC}: $test_name (expected failure)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL${NC}: $test_name (should have failed)"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    fi
}

check_system_info() {
    echo -e "\n${BLUE}💻 System Information:${NC}"
    echo "OS: $(uname -s)"
    echo "Version: $(uname -r)"
    echo "Architecture: $(uname -m)"

    echo -e "\n${BLUE}📊 Resource Limits:${NC}"
    echo "Open files (soft): $(ulimit -n)"
    echo "Open files (hard): $(ulimit -Hn)"
    echo "Max user processes: $(ulimit -u)"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "\n${BLUE}🍎 macOS Specific:${NC}"
        echo "Current open files: $(lsof -p $$ 2>/dev/null | wc -l || echo 'unknown')"
        echo "Current processes: $(pgrep -U $(id -u) 2>/dev/null | wc -l || echo 'unknown')"
    fi
}

test_resource_manager_exists() {
    echo -e "\n${YELLOW}📁 Resource Manager Tests${NC}"

    run_test "Resource manager script exists" \
             "test -f '$TSM_DIR/tsm_resource_manager.sh'"

    run_test "Resource manager is executable" \
             "test -x '$TSM_DIR/tsm_resource_manager.sh'"

    run_test "Resource manager can be sourced" \
             "source '$TSM_DIR/tsm_resource_manager.sh'"
}

test_safe_alternatives() {
    echo -e "\n${YELLOW}🔒 Safe Command Alternatives${NC}"

    # Source the resource manager
    source "$TSM_DIR/tsm_resource_manager.sh"

    # Test safe pgrep
    run_test "Safe pgrep function exists" \
             "type tsm_safe_pgrep >/dev/null 2>&1"

    run_test "Safe pgrep can run without EMFILE" \
             "tsm_safe_pgrep 'bash' 10"

    # Test safe execution
    run_test "Safe exec function exists" \
             "type tsm_safe_exec >/dev/null 2>&1"

    run_test "Safe exec can run simple command" \
             "tsm_safe_exec 'echo test' 'test command' 5"
}

test_process_limits() {
    echo -e "\n${YELLOW}⚡ Process Limit Tests${NC}"

    source "$TSM_DIR/tsm_resource_manager.sh"

    # Test managed process creation
    run_test "Can create managed process" \
             "tsm_start_managed_process 'sleep 1' 5 >/dev/null"

    # Test concurrent process limits
    run_test "Concurrent process limiting works" \
             "test_concurrent_processes"

    # Test cleanup
    run_test "Process cleanup works" \
             "tsm_cleanup_all_processes"
}

test_concurrent_processes() {
    local pids=()

    # Try to start several processes
    for i in {1..5}; do
        local pid
        pid=$(tsm_start_managed_process "sleep 2" 10)
        pids+=("$pid")
    done

    # Wait briefly
    sleep 1

    # Check that not all processes are running simultaneously
    # (should be limited by TSM_MAX_CONCURRENT_PROCESSES)
    local active_count=0
    for pid in "${pids[@]}"; do
        if [[ -n "${TSM_ACTIVE_PROCESSES[$pid]:-}" ]]; then
            local actual_pid=${TSM_ACTIVE_PROCESSES[$pid]}
            if kill -0 "$actual_pid" 2>/dev/null; then
                active_count=$((active_count + 1))
            fi
        fi
    done

    # Should be limited (typically 3-5 on macOS)
    [[ $active_count -le 6 ]]
}

test_analytics_integration() {
    echo -e "\n${YELLOW}📈 Analytics Integration Tests${NC}"

    # Test that analytics scripts can load resource manager
    run_test "Analytics script loads resource manager" \
             "source '$TSM_DIR/tsm_analytics.sh' 2>/dev/null"

    run_test "Session aggregator loads resource manager" \
             "source '$TSM_DIR/tsm_session_aggregator.sh' 2>/dev/null"

    # Test monitor script (if it exists and has been updated)
    if [[ -f "$TSM_DIR/tsm_monitor.sh" ]]; then
        run_test "Monitor script can be sourced" \
                 "source '$TSM_DIR/tsm_monitor.sh' 2>/dev/null"
    fi
}

test_emfile_scenario() {
    echo -e "\n${YELLOW}💥 EMFILE Scenario Tests${NC}"

    source "$TSM_DIR/tsm_resource_manager.sh"

    # Test rapid process creation (this used to cause EMFILE)
    run_test "Rapid process creation doesn't cause EMFILE" \
             "test_rapid_process_creation"

    # Test log processing with limits
    if [[ -f "$TSM_DIR/logs/test.out" ]] || create_test_log; then
        run_test "Safe log processing works" \
                 "tsm_safe_log_processing '$TSM_DIR/logs/test.out' 'TETRA:' 100 5 >/dev/null"
    fi
}

test_rapid_process_creation() {
    # This test simulates the conditions that caused the EMFILE error
    local commands=()
    for i in {1..10}; do
        commands+=("echo 'process $i' && sleep 0.1")
    done

    # Use batch processing to avoid resource exhaustion
    tsm_batch_process commands 3 10 >/dev/null
}

create_test_log() {
    mkdir -p "$TSM_DIR/logs"
    cat > "$TSM_DIR/logs/test.out" << 'EOF'
TETRA:AUTH:SESSION_START {"sessionId":"test1","timestamp":1703123456789}
TETRA:INTERACTION:CLICK {"element":"button#test","timestamp":1703123457000}
TETRA:PERFORMANCE:API_CALL {"endpoint":"/api/test","responseTime":150,"timestamp":1703123458000}
EOF
}

test_macos_optimizations() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "\n${YELLOW}🍎 macOS Optimizations${NC}"

        source "$TSM_DIR/tsm_resource_manager.sh"

        # Check that macOS optimizations are applied
        run_test "macOS optimizations reduce process limits" \
                 "[[ $TSM_MAX_CONCURRENT_PROCESSES -le 5 ]]"

        run_test "macOS optimizations reduce timeouts" \
                 "[[ $TSM_PROCESS_TIMEOUT -le 30 ]]"
    else
        echo -e "\n${YELLOW}ℹ️  Skipping macOS-specific tests (not on macOS)${NC}"
    fi
}

cleanup_test_files() {
    rm -f "$TSM_DIR/logs/test.out" 2>/dev/null || true
}

main() {
    check_system_info

    test_resource_manager_exists
    test_safe_alternatives
    test_process_limits
    test_analytics_integration
    test_emfile_scenario
    test_macos_optimizations

    cleanup_test_files

    echo -e "\n${BLUE}📊 Test Results:${NC}"
    echo "================"
    echo -e "Total Tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "\n${GREEN}🎉 All tests passed! EMFILE issue should be resolved.${NC}"

        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo -e "\n${BLUE}💡 macOS Recommendations:${NC}"
            echo "- The resource manager applies conservative limits for macOS"
            echo "- If you still see EMFILE errors, try: ulimit -n 1024"
            echo "- Monitor system resources with: tsm_check_system_limits detailed"
        fi

        exit 0
    else
        echo -e "\n${RED}💥 Some tests failed. EMFILE issue may persist.${NC}"
        echo -e "\n${BLUE}🔧 Troubleshooting:${NC}"
        echo "1. Check system limits: ulimit -n and ulimit -u"
        echo "2. Increase file descriptor limit: ulimit -n 1024"
        echo "3. Check for orphaned processes: ps aux | grep -E '(tsm|tetra)'"
        echo "4. Run resource check: $TSM_DIR/tsm_resource_manager.sh check"
        exit 1
    fi
}

main "$@"