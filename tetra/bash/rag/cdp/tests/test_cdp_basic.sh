#!/usr/bin/env bash
# test_cdp_basic.sh - Basic CDP functionality test
#
# Tests:
#   - Module loading
#   - Directory initialization
#   - Path generation
#   - Chrome binary detection
#   - Timestamp generation
#   - Database file path construction

# Test framework setup
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDP_DIR="$TEST_DIR/.."
TETRA_SRC="${TETRA_SRC:-$(cd "$TEST_DIR/../../../.." && pwd)}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test helpers
assert_equals() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ "$expected" == "$actual" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Expected: $expected"
        echo "  Actual:   $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_not_empty() {
    local value="$1"
    local test_name="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -n "$value" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Value was empty"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_file_exists() {
    local file="$1"
    local test_name="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  File not found: $file"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_dir_exists() {
    local dir="$1"
    local test_name="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if [[ -d "$dir" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Directory not found: $dir"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_function_exists() {
    local func_name="$1"
    local test_name="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if declare -f "$func_name" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $test_name"
        echo "  Function not found: $func_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test suite
echo "═══════════════════════════════════════════════════════════"
echo "CDP Module Test Suite"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Module files exist
echo "Test Group: Module Structure"
echo "───────────────────────────────────────────────────────────"
assert_file_exists "$CDP_DIR/cdp_paths.sh" "cdp_paths.sh exists"
assert_file_exists "$CDP_DIR/cdp.sh" "cdp.sh exists"
assert_file_exists "$CDP_DIR/actions.sh" "actions.sh exists"
assert_file_exists "$CDP_DIR/includes.sh" "includes.sh exists"
assert_file_exists "$CDP_DIR/README.md" "README.md exists"
echo ""

# Test 2: Module loading
echo "Test Group: Module Loading"
echo "───────────────────────────────────────────────────────────"

# Source the module
source "$CDP_DIR/includes.sh" 2>/dev/null
load_result=$?

assert_equals "0" "$load_result" "Module loads without errors"
echo ""

# Test 3: Path functions
echo "Test Group: Path Functions"
echo "───────────────────────────────────────────────────────────"
assert_function_exists "cdp_get_db_dir" "cdp_get_db_dir function exists"
assert_function_exists "cdp_get_config_dir" "cdp_get_config_dir function exists"
assert_function_exists "cdp_get_logs_dir" "cdp_get_logs_dir function exists"
assert_function_exists "cdp_get_cache_dir" "cdp_get_cache_dir function exists"
assert_function_exists "cdp_generate_timestamp" "cdp_generate_timestamp function exists"
assert_function_exists "cdp_get_db_path" "cdp_get_db_path function exists"
echo ""

# Test 4: Core functions
echo "Test Group: Core Functions"
echo "───────────────────────────────────────────────────────────"
assert_function_exists "cdp_init" "cdp_init function exists"
assert_function_exists "cdp_get_chrome_binary" "cdp_get_chrome_binary function exists"
assert_function_exists "cdp_launch_chrome" "cdp_launch_chrome function exists"
assert_function_exists "cdp_connect" "cdp_connect function exists"
assert_function_exists "cdp_navigate" "cdp_navigate function exists"
assert_function_exists "cdp_screenshot" "cdp_screenshot function exists"
assert_function_exists "cdp_execute" "cdp_execute function exists"
assert_function_exists "cdp_get_html" "cdp_get_html function exists"
assert_function_exists "cdp_extract" "cdp_extract function exists"
echo ""

# Test 5: Path generation
echo "Test Group: Path Generation"
echo "───────────────────────────────────────────────────────────"

# Generate timestamp
timestamp=$(cdp_generate_timestamp)
assert_not_empty "$timestamp" "Timestamp generated"

# Test that timestamp is numeric
if [[ "$timestamp" =~ ^[0-9]+$ ]]; then
    echo -e "${GREEN}✓${NC} Timestamp is numeric"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Timestamp is numeric"
    echo "  Got: $timestamp"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test path construction
screenshot_path=$(cdp_get_db_screenshot_path "$timestamp")
expected_pattern=".*/${timestamp}.cdp.screenshot.png"
if [[ "$screenshot_path" =~ $expected_pattern ]]; then
    echo -e "${GREEN}✓${NC} Screenshot path follows pattern"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Screenshot path follows pattern"
    echo "  Expected pattern: ${expected_pattern}"
    echo "  Got: $screenshot_path"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

trace_path=$(cdp_get_db_trace_path "$timestamp")
expected_pattern=".*/${timestamp}.cdp.trace.json"
if [[ "$trace_path" =~ $expected_pattern ]]; then
    echo -e "${GREEN}✓${NC} Trace path follows pattern"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} Trace path follows pattern"
    echo "  Expected pattern: ${expected_pattern}"
    echo "  Got: $trace_path"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

html_path=$(cdp_get_db_html_path "$timestamp")
expected_pattern=".*/${timestamp}.cdp.page.html"
if [[ "$html_path" =~ $expected_pattern ]]; then
    echo -e "${GREEN}✓${NC} HTML path follows pattern"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} HTML path follows pattern"
    echo "  Expected pattern: ${expected_pattern}"
    echo "  Got: $html_path"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))
echo ""

# Test 6: Directory initialization
echo "Test Group: Directory Initialization"
echo "───────────────────────────────────────────────────────────"

# Use a test-specific TETRA_DIR (save original CDP_DIR first)
ORIGINAL_CDP_DIR="$CDP_DIR"
export TEST_TETRA_DIR=$(mktemp -d)
export CDP_DIR="$TEST_TETRA_DIR/cdp"

cdp_init_dirs 2>/dev/null

assert_dir_exists "$CDP_DIR/db" "Database directory created"
assert_dir_exists "$CDP_DIR/config" "Config directory created"
assert_dir_exists "$CDP_DIR/logs" "Logs directory created"
assert_dir_exists "$CDP_DIR/cache" "Cache directory created"

# Cleanup test directory and restore CDP_DIR
rm -rf "$TEST_TETRA_DIR"
CDP_DIR="$ORIGINAL_CDP_DIR"
echo ""

# Test 7: Action file validation
echo "Test Group: Action File Validation"
echo "───────────────────────────────────────────────────────────"

# Use the source CDP_DIR, not the test one
ACTIONS_FILE="$TEST_DIR/../actions.sh"

# Verify actions.sh contains required function definitions
if grep -q "^cdp_register_actions()" "$ACTIONS_FILE" && \
   grep -q "^cdp_execute_action()" "$ACTIONS_FILE" && \
   grep -q "export -f cdp_register_actions" "$ACTIONS_FILE" && \
   grep -q "export -f cdp_execute_action" "$ACTIONS_FILE"; then
    echo -e "${GREEN}✓${NC} actions.sh contains required function definitions"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} actions.sh contains required function definitions"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Verify action declarations exist
action_count=$(grep -c "declare_action" "$ACTIONS_FILE" || true)
if [[ $action_count -ge 10 ]]; then
    echo -e "${GREEN}✓${NC} actions.sh contains action declarations ($action_count found)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC} actions.sh contains action declarations (only $action_count found)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))
echo ""

# Test 8: Chrome binary detection (info only)
echo "Test Group: Chrome Detection (Info)"
echo "───────────────────────────────────────────────────────────"

chrome_binary=$(cdp_get_chrome_binary 2>/dev/null)
if [[ -n "$chrome_binary" ]]; then
    echo -e "${GREEN}✓${NC} Chrome binary detected: $chrome_binary"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠${NC} Chrome binary not detected (optional for basic tests)"
    echo "  Install Chrome to enable full functionality"
fi
TESTS_RUN=$((TESTS_RUN + 1))
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════"
echo "Test Results"
echo "═══════════════════════════════════════════════════════════"
echo "Total:  $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
