#!/usr/bin/env bash
# Test: Unified Port Management System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$SCRIPT_DIR")"

export TETRA_SRC="$(dirname "$(dirname "$TSM_DIR")")"
export TETRA_DIR="/tmp/tsm-test-$$"
export TSM_PORTS_DIR="$TETRA_DIR/tsm/runtime/ports"
export TSM_PROCESSES_DIR="$TETRA_DIR/tsm/runtime/processes"

source "$TSM_DIR/system/ports.sh"
source "$TSM_DIR/core/metadata.sh"

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "  [$TESTS_RUN] $1 ... "
}

pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "✓"
}

fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "✗ - $1"
}

cleanup() {
    rm -rf "$TETRA_DIR"
}

trap cleanup EXIT
mkdir -p "$TSM_PORTS_DIR" "$TSM_PROCESSES_DIR"

echo "Testing: Unified Port System"
echo "============================="

# Test 1: Initialize port registry
test "Initialize port registry"
tsm_init_port_registry
if [[ -f "$TSM_PORTS_DIR/registry.tsv" ]]; then
    pass
else
    fail "Registry file not created"
fi

# Test 2: Register port
test "Register declared port"
tsm_register_port "0" "test-app" "3000" "12345"
if grep -q "test-app" "$TSM_PORTS_DIR/registry.tsv"; then
    pass
else
    fail "Port not registered"
fi

# Test 3: Update actual port
test "Update actual scanned port"
tsm_update_actual_port "0" "3000"
if grep "^0" "$TSM_PORTS_DIR/registry.tsv" | grep -q "3000.*3000"; then
    pass
else
    fail "Actual port not updated"
fi

# Test 4: Deregister port
test "Deregister port"
tsm_deregister_port "0"
if ! grep -q "test-app" "$TSM_PORTS_DIR/registry.tsv"; then
    pass
else
    fail "Port not deregistered"
fi

# Test 5: Named port registry
test "Set named port"
tsm_set_named_port "devpages" "4000"
port=$(tsm_get_named_port "devpages")
if [[ "$port" == "4000" ]]; then
    pass
else
    fail "Named port not set correctly"
fi

# Test 6: Get port owner
test "Get port owner"
owner=$(tsm_get_port_owner "4000")
if [[ "$owner" == "devpages" ]]; then
    pass
else
    fail "Port owner incorrect"
fi

# Test 7: Port validation
test "Validate port registry"
if tsm_validate_port_registry; then
    pass
else
    fail "Port validation failed"
fi

# Test 8: Detect port conflicts
test "Detect duplicate port assignment"
if tsm_set_named_port "duplicate" "4000" 2>&1 | grep -q "already assigned"; then
    pass
else
    fail "Did not detect port conflict"
fi

# Test 9: Remove named port
test "Remove named port"
tsm_remove_named_port "devpages"
if ! tsm_get_named_port "devpages" >/dev/null 2>&1; then
    pass
else
    fail "Named port not removed"
fi

# Test 10: Port reconciliation
test "Port reconciliation (declared vs actual)"
tsm_register_port "1" "app1" "5000" "99999"
tsm_register_port "2" "app2" "none" "88888"

# Start a real listener on port 9999 for testing
nc -l 9999 2>/dev/null &
listener_pid=$!
sleep 0.5

tsm_register_port "3" "listener" "9999" "$listener_pid"
tsm_update_actual_port "3" "9999"

if tsm_reconcile_ports 2>&1 | grep -q "Correct"; then
    pass
else
    fail "Port reconciliation failed"
fi

kill $listener_pid 2>/dev/null || true
wait $listener_pid 2>/dev/null || true

echo ""
echo "Results: $TESTS_PASSED/$TESTS_RUN passed, $TESTS_FAILED failed"
[[ $TESTS_FAILED -eq 0 ]]
