#!/usr/bin/env bash

# Simple Systemd Integration Test
# Quick test to verify basic systemd components

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Simple Systemd Integration Test ===${NC}"
echo "Platform: $(uname -s)"
echo "User: $(whoami)"
echo "TETRA_SRC: ${TETRA_SRC:-${PWD%/tests}}"

# Check if we're on Linux
if [[ "$(uname -s)" != "Linux" ]]; then
    echo -e "${YELLOW}Warning: Running on $(uname -s), using mock mode${NC}"
    MOCK_MODE=true
else
    MOCK_MODE=false
fi

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_TESTS++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_TESTS++))
}

run_test() {
    ((TOTAL_TESTS++))
    echo "Running test: $1"
    if "$@"; then
        return 0
    else
        return 1
    fi
}

# Test 1: Check if tetra-daemon exists
test_daemon_exists() {
    local daemon_path="${TETRA_SRC:-..}/bin/tetra-daemon"
    if [[ -f "$daemon_path" ]]; then
        test_pass "tetra-daemon executable exists"
        return 0
    else
        test_fail "tetra-daemon executable missing at $daemon_path"
        return 1
    fi
}

# Test 2: Check if systemd service file exists
test_service_file_exists() {
    local service_path="${TETRA_SRC:-..}/systemd/tetra.service"
    if [[ -f "$service_path" ]]; then
        test_pass "systemd service file exists"
        return 0
    else
        test_fail "systemd service file missing at $service_path"
        return 1
    fi
}

# Test 3: Basic TSM functionality
test_tsm_availability() {
    local tsm_path="${TETRA_SRC:-..}/bash/tsm/tsm.sh"
    if [[ -f "$tsm_path" ]]; then
        test_pass "TSM module available"
        return 0
    else
        test_fail "TSM module missing at $tsm_path"
        return 1
    fi
}

# Test 4: Service templates exist
test_service_templates() {
    local template_dir="${TETRA_SRC:-..}/templates"
    if [[ -d "$template_dir" ]]; then
        local template_count=$(find "$template_dir" -name "*.service" -o -name "*.conf" | wc -l)
        if [[ $template_count -gt 0 ]]; then
            test_pass "Service templates available ($template_count found)"
            return 0
        fi
    fi
    test_fail "No service templates found"
    return 1
}

echo -e "${BLUE}=== Running Tests ===${NC}"

run_test test_daemon_exists
run_test test_service_file_exists
run_test test_tsm_availability
run_test test_service_templates

echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $TOTAL_TESTS -gt 0 ]]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "Success rate: ${YELLOW}${SUCCESS_RATE}%${NC}"
fi

if [[ $FAILED_TESTS -gt 0 ]]; then
    echo -e "${RED}Some tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed${NC}"
fi