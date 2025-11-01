#!/usr/bin/env bash
# Test tdocs REPL completion functions

# Set up test environment
export TETRA_SRC="${TETRA_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TDOCS_SRC="$TETRA_SRC/bash/tdocs"
export TDOCS_DIR="$TETRA_DIR/tdocs"

# Source the completion module
source "$TDOCS_SRC/tdocs_repl_complete.sh"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
tests_passed=0
tests_failed=0

# Test helper
run_test() {
    local test_name="$1"
    local test_cmd="$2"
    local expected="$3"

    echo -e "${BLUE}Testing: $test_name${NC}"

    local result
    result=$(eval "$test_cmd" 2>&1)

    if [[ "$result" == *"$expected"* ]] || [[ -z "$expected" && -n "$result" ]]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((tests_passed++))
        if [[ -n "$result" ]]; then
            echo "  Output: $result"
        fi
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((tests_failed++))
    fi
    echo ""
}

# Create test database directory if it doesn't exist
mkdir -p "$TDOCS_DIR/db"

echo "======================================"
echo "TDOCS REPL Completion Tests"
echo "======================================"
echo ""

# Test 1: Get modules function
run_test "Get modules" \
    "_tdocs_get_modules | head -1" \
    ""

# Test 2: Get types function
run_test "Get document types" \
    "_tdocs_get_types" \
    "spec"

# Test 3: Get categories function
run_test "Get categories" \
    "_tdocs_get_categories" \
    "core"

# Test 4: Get tags function (may be empty if no metadata exists)
run_test "Get tags" \
    "_tdocs_get_tags || echo 'no tags found'" \
    ""

# Test 5: Get document paths (may be empty if no docs exist)
run_test "Get document paths" \
    "_tdocs_get_doc_paths || echo 'no docs found'" \
    ""

# Test 6: Enable completion function exists
run_test "Enable completion function exists" \
    "declare -F tdocs_repl_enable_completion >/dev/null && echo 'exists' || echo 'missing'" \
    "exists"

# Test 7: Disable completion function exists
run_test "Disable completion function exists" \
    "declare -F tdocs_repl_disable_completion >/dev/null && echo 'exists' || echo 'missing'" \
    "exists"

# Test 8: Main completion function exists
run_test "Main completion function exists" \
    "declare -F _tdocs_repl_complete >/dev/null && echo 'exists' || echo 'missing'" \
    "exists"

# Test 9: Context complete function exists
run_test "Context complete function exists" \
    "declare -F _tdocs_context_complete >/dev/null && echo 'exists' || echo 'missing'" \
    "exists"

# Test 10: All exported functions are available
echo -e "${BLUE}Checking exported functions:${NC}"
exported_functions=(
    "_tdocs_get_modules"
    "_tdocs_get_types"
    "_tdocs_get_doc_paths"
    "_tdocs_get_categories"
    "_tdocs_get_tags"
    "_tdocs_repl_complete"
    "_tdocs_context_complete"
    "tdocs_repl_enable_completion"
    "tdocs_repl_disable_completion"
)

all_exported=true
for func in "${exported_functions[@]}"; do
    if declare -F "$func" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $func"
        ((tests_passed++))
    else
        echo -e "  ${RED}✗${NC} $func (not found)"
        ((tests_failed++))
        all_exported=false
    fi
done
echo ""

# Summary
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "Tests passed: ${GREEN}$tests_passed${NC}"
echo -e "Tests failed: ${RED}$tests_failed${NC}"
echo ""

if [[ $tests_failed -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
