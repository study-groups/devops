#!/bin/bash

# Simple TSM Test Runner
# Runs only our proven working tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${CYAN}=== Simple TSM Test Runner ===${NC}"
echo ""

# Test runner function
run_simple_test() {
    local test_name="$1"
    local test_file="$2"

    ((TESTS_RUN++))
    echo -e "${BLUE}[TEST]${NC} Running: $test_name"

    if [[ ! -f "$test_file" ]]; then
        echo -e "${RED}[FAIL]${NC} Test file not found: $test_file"
        ((TESTS_FAILED++))
        return 1
    fi

    # Run test with timeout
    local start_time=$(date +%s)
    if timeout 30s bash "$test_file" --no-cleanup >/dev/null 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${GREEN}[PASS]${NC} $test_name (${duration}s)"
        ((TESTS_PASSED++))
        return 0
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        if [[ $exit_code -eq 124 ]]; then
            echo -e "${RED}[FAIL]${NC} $test_name (timeout after ${duration}s)"
        else
            echo -e "${RED}[FAIL]${NC} $test_name (exit code: $exit_code after ${duration}s)"
        fi
        ((TESTS_FAILED++))
        return 1
    fi
}

# Main test execution
main() {
    local test_dir="$(dirname "$0")"

    echo "Test Directory: $test_dir"
    echo ""

    # Run our proven unit tests
    run_simple_test "Start Mechanics" "$test_dir/test-start-mechanics.sh"
    run_simple_test "Environment Parsing" "$test_dir/test-env-parsing.sh"
    run_simple_test "Framework Example" "$test_dir/example-framework-test.sh"

    # Results summary
    echo ""
    echo -e "${CYAN}=== Results ===${NC}"
    echo "Tests Run: $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}💥 $TESTS_FAILED test(s) failed!${NC}"
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi