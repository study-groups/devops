#!/usr/bin/env bash
# Test Runner for TMC MIDI Controller
# Runs all tests and reports results

set -euo pipefail

# Test framework setup
TESTS_PASSED=0
TESTS_FAILED=0
CURRENT_TEST=""

# Colors for output
if [[ -t 1 ]]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    GREEN=''
    RED=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# Test assertions
assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-}"

    if [[ "$expected" == "$actual" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  Expected: ${YELLOW}$expected${NC}"
        echo -e "  Actual:   ${YELLOW}$actual${NC}"
        return 1
    fi
}

assert_not_empty() {
    local value="$1"
    local message="${2:-}"

    if [[ -n "$value" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  Value was empty"
        return 1
    fi
}

assert_empty() {
    local value="$1"
    local message="${2:-}"

    if [[ -z "$value" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  Expected empty, got: ${YELLOW}$value${NC}"
        return 1
    fi
}

assert_file_exists() {
    local file="$1"
    local message="${2:-File exists: $file}"

    if [[ -f "$file" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  File not found: ${YELLOW}$file${NC}"
        return 1
    fi
}

assert_success() {
    local command="$1"
    local message="${2:-Command succeeded}"

    if eval "$command" >/dev/null 2>&1; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  Command failed: ${YELLOW}$command${NC}"
        return 1
    fi
}

assert_failure() {
    local command="$1"
    local message="${2:-Command failed as expected}"

    if ! eval "$command" >/dev/null 2>&1; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  Command should have failed: ${YELLOW}$command${NC}"
        return 1
    fi
}

# Test suite runner
run_test_suite() {
    local suite_name="$1"
    local test_file="$2"

    echo -e "\n${BLUE}=== Running: $suite_name ===${NC}"

    if [[ ! -f "$test_file" ]]; then
        echo -e "${RED}✗ Test file not found: $test_file${NC}"
        return 1
    fi

    # Source the test file
    source "$test_file"
}

# Main test runner
main() {
    local test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local midi_src="$(cd "$test_dir/.." && pwd)"

    echo -e "${BLUE}TMC MIDI Controller Test Suite${NC}"
    echo -e "Test Directory: $test_dir"
    echo -e "MIDI Source: $midi_src\n"

    # Export paths for tests
    export MIDI_SRC="$midi_src"
    export TEST_DIR="$test_dir"
    export FIXTURES_DIR="$test_dir/fixtures"

    # Create temporary test environment
    export TEST_TEMP_DIR="$(mktemp -d)"
    export TETRA_DIR="$TEST_TEMP_DIR/tetra"
    export TMC_CONFIG_DIR="$TETRA_DIR/midi"
    mkdir -p "$TMC_CONFIG_DIR"

    trap "rm -rf '$TEST_TEMP_DIR'" EXIT

    # Run test suites
    local test_files=(
        "$test_dir/test_mapper.sh"
        "$test_dir/test_learning.sh"
        "$test_dir/test_commands.sh"
        "$test_dir/test_state.sh"
    )

    for test_file in "${test_files[@]}"; do
        if [[ -f "$test_file" ]]; then
            run_test_suite "$(basename "$test_file" .sh)" "$test_file" || true
        fi
    done

    # Print summary
    echo -e "\n${BLUE}=== Test Summary ===${NC}"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo -e "Total:  $((TESTS_PASSED + TESTS_FAILED))"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "\n${GREEN}All tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}Some tests failed.${NC}"
        return 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
