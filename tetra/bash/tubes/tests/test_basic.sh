#!/usr/bin/env bash

# test_basic.sh - Basic tests for tubes module

set -euo pipefail

# Setup test environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

# Load tetra
source "$TETRA_SRC/bash/bootloader.sh" 2>/dev/null || {
    echo "Error: Failed to load tetra bootloader"
    exit 1
}

# Load tubes module
tmod load tubes || {
    echo "Error: Failed to load tubes module"
    exit 1
}

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper
assert_equal() {
    local expected="$1"
    local actual="$2"
    local description="$3"

    ((TESTS_RUN++))

    if [[ "$expected" == "$actual" ]]; then
        echo "✓ $description"
        ((TESTS_PASSED++))
        return 0
    else
        echo "✗ $description"
        echo "  Expected: $expected"
        echo "  Actual:   $actual"
        ((TESTS_FAILED++))
        return 1
    fi
}

assert_success() {
    local description="$1"

    ((TESTS_RUN++))

    if [[ $? -eq 0 ]]; then
        echo "✓ $description"
        ((TESTS_PASSED++))
        return 0
    else
        echo "✗ $description"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Cleanup before tests
echo "Cleaning up before tests..."
tubes cleanup 2>/dev/null

echo ""
echo "Running tubes basic tests"
echo "=========================="
echo ""

# Test 1: Module initialization
echo "Test 1: Module initialization"
if declare -f tubes >/dev/null 2>&1; then
    assert_success "tubes function is defined"
else
    echo "✗ tubes function not defined"
    ((TESTS_RUN++))
    ((TESTS_FAILED++))
fi

# Test 2: Directory structure
echo ""
echo "Test 2: Directory structure"
[[ -d "$TETRA_DIR/tubes/fifos" ]]
assert_success "FIFOs directory exists"

[[ -d "$TETRA_DIR/tubes/config" ]]
assert_success "Config directory exists"

[[ -d "$TETRA_DIR/tubes/logs" ]]
assert_success "Logs directory exists"

# Test 3: Create tube
echo ""
echo "Test 3: Create tube"
tubes create test-tube "Test tube" >/dev/null
assert_success "Create tube"

TUBE_PATH="$TETRA_DIR/tubes/fifos/test-tube.fifo"
[[ -p "$TUBE_PATH" ]]
assert_success "FIFO file exists"

# Test 4: List tubes
echo ""
echo "Test 4: List tubes"
OUTPUT=$(tubes list 2>/dev/null | grep -c "test-tube" || echo 0)
assert_equal "1" "$OUTPUT" "List shows created tube"

# Test 5: Send and receive
echo ""
echo "Test 5: Send and receive"

# Start receiver in background
(
    sleep 0.5
    MESSAGE=$(tubes receive test-tube 5)
    echo "$MESSAGE" > /tmp/tube-test-message.txt
) &
RECEIVER_PID=$!

# Send message
sleep 0.2
tubes send test-tube "Hello, Tubes!" >/dev/null 2>&1 || true

# Wait for receiver
wait $RECEIVER_PID 2>/dev/null || true

if [[ -f /tmp/tube-test-message.txt ]]; then
    RECEIVED=$(cat /tmp/tube-test-message.txt)
    assert_equal "Hello, Tubes!" "$RECEIVED" "Message received correctly"
    rm -f /tmp/tube-test-message.txt
else
    echo "✗ Message not received"
    ((TESTS_RUN++))
    ((TESTS_FAILED++))
fi

# Test 6: Destroy tube
echo ""
echo "Test 6: Destroy tube"
tubes destroy test-tube >/dev/null
assert_success "Destroy tube"

[[ ! -p "$TUBE_PATH" ]]
assert_success "FIFO file removed"

# Test 7: Router
echo ""
echo "Test 7: Router functionality"

# Start router
tubes router start >/dev/null 2>&1
sleep 0.5

tubes router status >/dev/null 2>&1
assert_success "Router is running"

# Stop router
tubes router stop >/dev/null 2>&1
assert_success "Router stopped"

# Final cleanup
echo ""
echo "Cleaning up after tests..."
tubes cleanup 2>/dev/null

# Results
echo ""
echo "=========================="
echo "Test Results"
echo "=========================="
echo "Tests run:    $TESTS_RUN"
echo "Passed:       $TESTS_PASSED"
echo "Failed:       $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi
