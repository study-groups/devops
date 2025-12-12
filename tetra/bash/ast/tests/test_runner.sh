#!/usr/bin/env bash
# Test Runner for Bash CST Tokenizer and Parser
# Runs all tests and reports results

# Note: We use set -e but NOT set -u because tests use literal $1, $!, etc.
# that would otherwise trigger "unbound variable" errors
set -eo pipefail

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
    NC='\033[0m'
else
    GREEN='' RED='' YELLOW='' BLUE='' NC=''
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

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-}"

    if [[ "$haystack" == *"$needle"* ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  Expected to contain: ${YELLOW}$needle${NC}"
        echo -e "  In: ${YELLOW}$haystack${NC}"
        return 1
    fi
}

assert_line_count() {
    local output="$1"
    local expected="$2"
    local message="${3:-}"
    local actual
    actual=$(echo "$output" | wc -l | tr -d ' ')

    if [[ "$actual" == "$expected" ]]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✓${NC} $CURRENT_TEST: $message"
        return 0
    else
        ((TESTS_FAILED++))
        echo -e "${RED}✗${NC} $CURRENT_TEST: $message"
        echo -e "  Expected $expected lines, got $actual"
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

    source "$test_file"
}

# Main test runner
main() {
    local test_dir
    test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local ast_src
    ast_src="$(cd "$test_dir/.." && pwd)"

    echo -e "${BLUE}Bash CST Tokenizer and Parser Test Suite${NC}"
    echo -e "Test Directory: $test_dir"
    echo -e "AST Source: $ast_src\n"

    # Export paths for tests
    export AST_SRC="$ast_src"
    export TEST_DIR="$test_dir"

    # Source the tokenizer
    source "$ast_src/bash_cst.sh"

    # Run test suites
    local test_files=(
        "$test_dir/test_tokenizer_basic.sh"
        "$test_dir/test_tokenizer_strings.sh"
        "$test_dir/test_tokenizer_variables.sh"
        "$test_dir/test_tokenizer_operators.sh"
        "$test_dir/test_parser_basic.sh"
        "$test_dir/test_parser_pipelines.sh"
        "$test_dir/test_parser_functions.sh"
        "$test_dir/test_parser_control.sh"
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
