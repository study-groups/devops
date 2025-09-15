#!/usr/bin/env bash

# Test Helpers for Bash Testing

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Global test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Assert that a command succeeds (exit code 0)
assert_success() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    local exit_code="$1"
    local message="${2:-Command should succeed}"
    
    if [[ "$exit_code" -eq 0 ]]; then
        echo -e "${GREEN}✓ PASS:${NC} $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL:${NC} $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Assert that a command fails (non-zero exit code)
assert_failure() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    local exit_code="$1"
    local message="${2:-Command should fail}"
    
    if [[ "$exit_code" -ne 0 ]]; then
        echo -e "${GREEN}✓ PASS:${NC} $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL:${NC} $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Assert that output contains a specific string
assert_contains() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    local output="$1"
    local expected="$2"
    local message="${3:-Output should contain expected string}"
    
    if [[ "$output" == *"$expected"* ]]; then
        echo -e "${GREEN}✓ PASS:${NC} $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL:${NC} $message"
        echo "Expected: '$expected'"
        echo "Actual output: '$output'"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Assert a bash test condition
assert_true() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    local condition="$1"
    local message="${2:-Condition should be true}"
    
    if eval "$condition"; then
        echo -e "${GREEN}✓ PASS:${NC} $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL:${NC} $message"
        echo "Failed condition: $condition"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Print test summary
print_test_summary() {
    echo
    echo "Test Summary:"
    echo "============"
    echo "Total Tests:  $TOTAL_TESTS"
    echo "Passed Tests: $PASSED_TESTS"
    echo "Failed Tests: $FAILED_TESTS"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed.${NC}"
        exit 1
    fi
}

# Trap to ensure summary is printed
trap print_test_summary EXIT
