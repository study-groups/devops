#!/usr/bin/env bash
# TSM Test Runner - Runs all tests for consolidated codebase

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
SUITE_RESULTS=()

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  TSM Consolidated Test Suite          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

run_test_suite() {
    local test_file="$1"
    local suite_name=$(basename "$test_file" .sh)

    echo -e "${YELLOW}Running: $suite_name${NC}"
    echo "----------------------------------------"

    if bash "$test_file"; then
        echo -e "${GREEN}✓ $suite_name PASSED${NC}"
        SUITE_RESULTS+=("✓ $suite_name")
        return 0
    else
        echo -e "${RED}✗ $suite_name FAILED${NC}"
        SUITE_RESULTS+=("✗ $suite_name")
        return 1
    fi
}

# Test suites in dependency order
test_suites=(
    "test_metadata.sh"           # JSON metadata system
    "test_id_allocation.sh"      # Thread-safe ID allocation
    "test_process_lifecycle.sh"  # Process management
    "test_ports.sh"              # Unified port system
    "test_start_any.sh"          # Universal command starter
)

echo "Test suites to run: ${#test_suites[@]}"
echo ""

suite_passed=0
suite_failed=0

for suite in "${test_suites[@]}"; do
    test_file="$SCRIPT_DIR/$suite"

    if [[ ! -f "$test_file" ]]; then
        echo -e "${RED}WARNING: Test file not found: $suite${NC}"
        continue
    fi

    if run_test_suite "$test_file"; then
        ((suite_passed++))
    else
        ((suite_failed++))
    fi

    echo ""
done

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Test Summary                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

for result in "${SUITE_RESULTS[@]}"; do
    if [[ "$result" == ✓* ]]; then
        echo -e "${GREEN}$result${NC}"
    else
        echo -e "${RED}$result${NC}"
    fi
done

echo ""
echo "Total Suites: ${#test_suites[@]}"
echo -e "${GREEN}Passed: $suite_passed${NC}"
echo -e "${RED}Failed: $suite_failed${NC}"
echo ""

if [[ $suite_failed -eq 0 ]]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ALL TESTS PASSED ✓                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║     SOME TESTS FAILED ✗                ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    exit 1
fi
