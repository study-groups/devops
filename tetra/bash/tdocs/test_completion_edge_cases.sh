#!/usr/bin/env bash
# Test edge cases for tdocs REPL completion

export TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TDOCS_SRC="$TETRA_SRC/bash/tdocs"
export TDOCS_DIR="$TETRA_DIR/tdocs"

# Source the completion module
source "$TDOCS_SRC/tdocs_repl_complete.sh"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "TDOCS Completion Edge Case Tests"
echo "======================================"
echo ""

tests_passed=0
tests_failed=0

test_completion() {
    local desc="$1"
    local input="$2"

    echo -e "${BLUE}Testing: $desc${NC}"
    echo "  Input: '$input'"

    # Set READLINE_LINE to simulate input
    export READLINE_LINE="$input"
    export READLINE_POINT=${#input}

    # Try to run completion - should not error
    if _tdocs_repl_complete 2>&1 | grep -qi "bad array subscript"; then
        echo -e "${RED}✗ FAILED - Array subscript error${NC}"
        ((tests_failed++))
    elif _tdocs_repl_complete 2>&1 | grep -qi "unbound variable"; then
        echo -e "${RED}✗ FAILED - Unbound variable error${NC}"
        ((tests_failed++))
    else
        echo -e "${GREEN}✓ PASSED - No errors${NC}"
        ((tests_passed++))
    fi
    echo ""
}

# Test edge cases
test_completion "Empty input" ""
test_completion "Single space" " "
test_completion "Multiple spaces" "   "
test_completion "Single word" "ls"
test_completion "Word with trailing space" "ls "
test_completion "Command with flag" "ls --module"
test_completion "Command with flag and space" "ls --module "
test_completion "Filter command" "filter"
test_completion "Filter with type" "filter module"
test_completion "Filter with type and space" "filter module "

# Summary
echo "======================================"
echo "Summary"
echo "======================================"
echo -e "Tests passed: ${GREEN}$tests_passed${NC}"
echo -e "Tests failed: ${RED}$tests_failed${NC}"
echo ""

if [[ $tests_failed -eq 0 ]]; then
    echo -e "${GREEN}✓ All edge case tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
