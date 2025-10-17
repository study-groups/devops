#!/usr/bin/env bash

# QA Module Test Suite
set -euo pipefail

# Ensure we're sourcing the main QA module
QA_TEST_DIR="/tmp/qa_test_$$"
export QA_DIR="$QA_TEST_DIR"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"

source "$TETRA_SRC/bash/qa/qa.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test Setup
setup() {
    rm -rf "$QA_DIR"
    mkdir -p "$QA_DIR/db" "$QA_CONFIG_DIR" "$QA_LOGS_DIR"

    # Set test configuration
    echo "test-api-key" > "$OPENAI_API_FILE"
    echo "gpt-4" > "$QA_ENGINE_FILE"
    echo "Test Context" > "$QA_CONTEXT_FILE"
}

# Cleanup after tests
teardown() {
    rm -rf "$QA_DIR"
}

# Test runner helpers
run_test() {
    local test_name="$1"
    ((TESTS_RUN++))

    echo -n "Running $test_name... "
    if $test_name; then
        echo "PASS"
        ((TESTS_PASSED++))
    else
        echo "FAIL"
        ((TESTS_FAILED++))
    fi
}

# Test configuration getters
test_config_getters() {
    local api=$(_get_openai_api)
    local engine=$(_get_qa_engine)
    local context=$(_get_qa_context)

    [[ "$api" == "test-api-key" ]] || return 1
    [[ "$engine" == "gpt-4" ]] || return 1
    [[ "$context" == "Test Context" ]] || return 1

    return 0
}

# Test input sanitization
test_sanitize_input() {
    local input="  Hello, world!  "
    local sanitized=$(_qa_sanitize_input "$input")

    # Should trim whitespace and remove non-printable chars
    [[ -n "$sanitized" ]] || return 1
    [[ "$sanitized" == *"Hello"* ]] || return 1

    return 0
}

# Test index sanitization
test_sanitize_index() {
    local idx1=$(_qa_sanitize_index "")
    local idx2=$(_qa_sanitize_index "5")

    [[ "$idx1" == "0" ]] || return 1
    [[ "$idx2" == "5" ]] || return 1

    return 0
}

# Test answer retrieval
test_answer_retrieval() {
    echo "Test prompt" > "$QA_DIR/db/1000.prompt"
    echo "Test answer content" > "$QA_DIR/db/1000.answer"

    local output=$(a 2>/dev/null)

    [[ "$output" == *"Test answer content"* ]] || return 1

    return 0
}

# Test qa_delete function
test_qa_delete() {
    echo "Test prompt" > "$QA_DIR/db/9999.prompt"
    echo "Test answer" > "$QA_DIR/db/9999.answer"
    echo "Test data" > "$QA_DIR/db/9999.data"

    qa_delete 9999 2>/dev/null

    [[ ! -f "$QA_DIR/db/9999.prompt" ]] || return 1
    [[ ! -f "$QA_DIR/db/9999.answer" ]] || return 1
    [[ ! -f "$QA_DIR/db/9999.data" ]] || return 1

    return 0
}

# Main test runner
main() {
    echo "QA Module Test Suite"
    echo "===================="
    echo

    setup

    run_test test_config_getters
    run_test test_sanitize_input
    run_test test_sanitize_index
    run_test test_answer_retrieval
    run_test test_qa_delete

    teardown

    echo
    echo "===================="
    echo "Tests run: $TESTS_RUN"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"

    [[ $TESTS_FAILED -eq 0 ]] && exit 0 || exit 1
}

main "$@"
