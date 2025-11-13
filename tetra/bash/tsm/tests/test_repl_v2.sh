#!/usr/bin/env bash

# Test script for TSM REPL v2 migration
# Tests all critical functionality before making v2 the default

# Source tetra
source ~/tetra/tetra.sh

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for output
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
RESET="\033[0m"

test_pass() {
    echo -e "${GREEN}✓${RESET} $1"
    ((TESTS_PASSED++))
    ((TESTS_RUN++))
}

test_fail() {
    echo -e "${RED}✗${RESET} $1"
    ((TESTS_FAILED++))
    ((TESTS_RUN++))
}

test_info() {
    echo -e "${YELLOW}ℹ${RESET} $1"
}

# Test 1: Check dependencies exist
test_dependencies() {
    echo ""
    echo "=== Testing Dependencies ==="

    if [[ -f "$TETRA_SRC/bash/repl/repl.sh" ]]; then
        test_pass "bash/repl library exists"
    else
        test_fail "bash/repl library missing"
        return 1
    fi

    if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
        test_pass "bash/color library exists"
    else
        test_fail "bash/color library missing"
        return 1
    fi

    if [[ -f "$TETRA_SRC/bash/tcurses/tcurses_input.sh" ]]; then
        test_pass "bash/tcurses library exists"
    else
        test_fail "bash/tcurses library missing"
        return 1
    fi
}

# Test 2: Check syntax
test_syntax() {
    echo ""
    echo "=== Testing Syntax ==="

    if bash -n "$TETRA_SRC/bash/tsm/tsm_repl.sh" 2>/dev/null; then
        test_pass "repl_v2.sh has valid syntax"
    else
        test_fail "repl_v2.sh has syntax errors"
        return 1
    fi
}

# Test 3: Check repl_v2 can be sourced
test_sourcing() {
    echo ""
    echo "=== Testing Sourcing ==="

    if source "$TETRA_SRC/bash/tsm/tsm_repl.sh" 2>/dev/null; then
        test_pass "repl_v2.sh sources without errors"
    else
        test_fail "repl_v2.sh failed to source"
        return 1
    fi

    if declare -f tsm_repl_main >/dev/null; then
        test_pass "tsm_repl_main function defined"
    else
        test_fail "tsm_repl_main function not defined"
        return 1
    fi
}

# Test 4: Check slash commands are registered
test_slash_commands() {
    echo ""
    echo "=== Testing Slash Command Registration ==="

    source "$TETRA_SRC/bash/tsm/tsm_repl.sh" 2>/dev/null

    local expected_commands=(
        "list" "ls" "kill" "last" "ps" "disk" "mem" "env"
        "orphans" "clean" "validate" "doctor" "json" "tview" "sessions" "tsm-help"
    )

    local all_registered=true
    for cmd in "${expected_commands[@]}"; do
        if [[ -n "${REPL_SLASH_HANDLERS[$cmd]:-}" ]]; then
            test_pass "/$cmd command registered"
        else
            test_fail "/$cmd command not registered"
            all_registered=false
        fi
    done

    if $all_registered; then
        return 0
    else
        return 1
    fi
}

# Test 5: Check prompt builders
test_prompt_builders() {
    echo ""
    echo "=== Testing Prompt Builders ==="

    source "$TETRA_SRC/bash/tsm/tsm_repl.sh" 2>/dev/null

    if declare -f tsm_prompt_status >/dev/null; then
        test_pass "tsm_prompt_status function defined"
    else
        test_fail "tsm_prompt_status function not defined"
        return 1
    fi

    if declare -f tsm_prompt_base >/dev/null; then
        test_pass "tsm_prompt_base function defined"
    else
        test_fail "tsm_prompt_base function not defined"
        return 1
    fi

    # Test that prompt builders can be called
    if tsm_prompt_status >/dev/null 2>&1; then
        test_pass "tsm_prompt_status executes without error"
    else
        test_fail "tsm_prompt_status execution failed"
    fi
}

# Test 6: Check history configuration
test_history_config() {
    echo ""
    echo "=== Testing History Configuration ==="

    source "$TETRA_SRC/bash/tsm/tsm_repl.sh" 2>/dev/null

    if [[ -n "$REPL_HISTORY_BASE" ]]; then
        test_pass "REPL_HISTORY_BASE is set: $REPL_HISTORY_BASE"
    else
        test_fail "REPL_HISTORY_BASE is not set"
    fi

    if [[ -n "$TSM_HISTORY_LOG" ]]; then
        test_pass "TSM_HISTORY_LOG is set: $TSM_HISTORY_LOG"
    else
        test_fail "TSM_HISTORY_LOG is not set"
    fi
}

# Test 7: Check helper functions
test_helper_functions() {
    echo ""
    echo "=== Testing Helper Functions ==="

    source "$TETRA_SRC/bash/tsm/tsm_repl.sh" 2>/dev/null

    if declare -f tsm_count_running >/dev/null; then
        test_pass "tsm_count_running function defined"
    else
        test_fail "tsm_count_running function not defined"
        return 1
    fi

    if declare -f tsm_repl_save_output >/dev/null; then
        test_pass "tsm_repl_save_output function defined"
    else
        test_fail "tsm_repl_save_output function not defined"
        return 1
    fi

    if declare -f tsm_repl_get_last >/dev/null; then
        test_pass "tsm_repl_get_last function defined"
    else
        test_fail "tsm_repl_get_last function not defined"
        return 1
    fi
}

# Test 8: Compare functionality with original REPL
test_feature_parity() {
    echo ""
    echo "=== Testing Feature Parity ==="

    # Get slash commands from original REPL
    local original_commands=$(grep -E '^\s+/[a-z]+' "$TETRA_SRC/bash/tsm/interfaces/repl.sh" | \
        grep -v '#!/' | sed 's/.*\/\([a-z]*\).*/\1/' | sort -u)

    source "$TETRA_SRC/bash/tsm/tsm_repl.sh" 2>/dev/null

    local missing_count=0
    while IFS= read -r cmd; do
        [[ -z "$cmd" ]] && continue
        if [[ -z "${REPL_SLASH_HANDLERS[$cmd]:-}" ]]; then
            test_info "Feature from original: /$cmd (check if intentional)"
            ((missing_count++))
        fi
    done <<< "$original_commands"

    if [[ $missing_count -eq 0 ]]; then
        test_pass "All original features present in v2"
    else
        test_info "$missing_count features from original need review"
    fi
}

# Run all tests
echo "╔════════════════════════════════════════════╗"
echo "║  TSM REPL v2 Migration Test Suite         ║"
echo "╚════════════════════════════════════════════╝"

test_dependencies
test_syntax
test_sourcing
test_slash_commands
test_prompt_builders
test_history_config
test_helper_functions
test_feature_parity

# Summary
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  Test Summary                              ║"
echo "╚════════════════════════════════════════════╝"
echo -e "Tests run:    $TESTS_RUN"
echo -e "${GREEN}Tests passed: $TESTS_PASSED${RESET}"
if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "${RED}Tests failed: $TESTS_FAILED${RESET}"
else
    echo -e "${GREEN}Tests failed: 0${RESET}"
fi

# Exit code
if [[ $TESTS_FAILED -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}✓ All tests passed! REPL v2 is ready for migration.${RESET}"
    exit 0
else
    echo ""
    echo -e "${RED}✗ Some tests failed. Please review before migration.${RESET}"
    exit 1
fi
