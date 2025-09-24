#!/usr/bin/env bash

# Test systemd integration and TSM service management system
# This test addresses the permission/ownership model where we run as user:dev

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

echo -e "${BLUE}=== Systemd Integration Test Suite ===${NC}"
echo "User: $(whoami)"
echo "UID/GID: $(id)"
echo "TETRA_SRC: ${TETRA_SRC:-${PWD}}"

# Setup test environment
TEST_DIR="/tmp/systemd_test_$$"
mkdir -p "$TEST_DIR"

# Set TETRA_SRC if not set
export TETRA_SRC="${TETRA_SRC:-${PWD%/tests}}"
export TETRA_DIR="$TEST_DIR/tetra"

# Cleanup function
cleanup() {
    rm -rf "$TEST_DIR"
    # Stop any test services we might have started
    sudo systemctl stop tetra-test.service 2>/dev/null || true
    sudo rm -f /etc/systemd/system/tetra-test.service 2>/dev/null || true
    sudo systemctl daemon-reload 2>/dev/null || true
}
trap cleanup EXIT

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_TESTS++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_TESTS++))
}

test_skip() {
    echo -e "${YELLOW}~${NC} $1"
    ((SKIPPED_TESTS++))
}

run_test() {
    ((TOTAL_TESTS++))
    if "$@"; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}=== Testing Permission Model ===${NC}"

# Test 1: Current user permissions
test_current_user_permissions() {
    if [[ "$(whoami)" == "dev" ]]; then
        test_pass "Running as dev user (correct)"
        return 0
    else
        test_fail "Not running as dev user: $(whoami)"
        return 1
    fi
}
run_test test_current_user_permissions

# Test 2: Sudo access check
test_sudo_access() {
    if sudo -n true 2>/dev/null; then
        test_pass "Dev user has passwordless sudo access"
        return 0
    elif sudo -v; then
        test_pass "Dev user has sudo access (with password)"
        return 0
    else
        test_fail "Dev user lacks sudo access"
        return 1
    fi
}
run_test test_sudo_access

echo -e "${BLUE}=== Testing Tetra Daemon Executable ===${NC}"

# Test 3: Daemon executable exists
test_daemon_executable_exists() {
    if [[ -f "$TETRA_SRC/bin/tetra-daemon" ]]; then
        test_pass "tetra-daemon executable exists"
        return 0
    else
        test_fail "tetra-daemon executable missing"
        return 1
    fi
}
run_test test_daemon_executable_exists

# Test 4: Daemon executable is executable
test_daemon_executable_permissions() {
    if [[ -x "$TETRA_SRC/bin/tetra-daemon" ]]; then
        test_pass "tetra-daemon is executable"
        return 0
    else
        test_fail "tetra-daemon is not executable"
        return 1
    fi
}
run_test test_daemon_executable_permissions

echo -e "${BLUE}=== Testing Systemd Service File ===${NC}"

# Test 5: Systemd service file exists
test_service_file_exists() {
    if [[ -f "$TETRA_SRC/systemd/tetra.service" ]]; then
        test_pass "systemd service file exists"
        return 0
    else
        test_fail "systemd service file missing"
        return 1
    fi
}
run_test test_service_file_exists

echo -e "${BLUE}=== Testing Permission Model Analysis ===${NC}"

# Test 6: Check for potential permission issues
test_permission_model_analysis() {
    local issues=()

    # Check if TETRA_SRC is owned by dev user
    if [[ "$(stat -c %U "$TETRA_SRC")" != "dev" ]]; then
        issues+=("TETRA_SRC not owned by dev user")
    fi

    # Check if dev user is in required groups
    if ! groups dev | grep -q sudo; then
        issues+=("dev user not in sudo group")
    fi

    if [[ ${#issues[@]} -eq 0 ]]; then
        test_pass "Permission model analysis: no issues found"
        return 0
    else
        test_fail "Permission model issues: ${issues[*]}"
        return 1
    fi
}
run_test test_permission_model_analysis

echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED_TESTS${NC}"

SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
echo -e "Success rate: ${YELLOW}${SUCCESS_RATE}%${NC}"

echo -e "${BLUE}=== Permission Model Recommendations ===${NC}"
echo "Current Status:"
echo "  • Running as: $(whoami)"
echo "  • Has sudo: $(sudo -n true 2>/dev/null && echo "Yes" || echo "No (password required)")"
echo "  • TETRA_SRC: $TETRA_SRC"
echo "  • Owner: $(stat -c %U "$TETRA_SRC")"

echo ""
echo "Recommendations:"
echo "1. Keep current dev user model for development"
echo "2. For production, consider dedicated tetra user"
echo "3. Use sudo for systemd service installation"
echo "4. Consider user systemd services for development"

if [[ $FAILED_TESTS -gt 0 ]]; then
    echo -e "${RED}Some tests failed. Review permission model and system setup.${NC}"
    exit 1
else
    echo -e "${GREEN}All systemd integration tests passed!${NC}"
fi