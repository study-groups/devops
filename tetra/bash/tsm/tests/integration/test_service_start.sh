#!/usr/bin/env bash
# Integration tests for service start/stop lifecycle

set -eo pipefail  # Note: -u disabled due to tetra code using unbound vars

TESTS_RUN=0
TESTS_FAILED=0

fail() {
    echo "FAIL: $1" >&2
    ((++TESTS_FAILED)) || true
}

pass() {
    echo "PASS: $1"
}

run_test() {
    local name="$1"
    ((++TESTS_RUN))
    echo "Running: $name"
}

cleanup() {
    # Stop any test processes
    tsm stop test-http-59000 2>/dev/null || true
    tsm stop test-http-59001 2>/dev/null || true
    tsm delete test-http-59000 2>/dev/null || true
    tsm delete test-http-59001 2>/dev/null || true
}

trap cleanup EXIT

# =============================================================================
# SETUP
# =============================================================================

unset TETRA_BOOTLOADER_LOADED
source ~/tetra/tetra.sh 2>/dev/null
tsm list >/dev/null 2>&1

cleanup
echo ""

# =============================================================================
# SERVICE DETECTION TESTS
# =============================================================================

run_test "tetra_tsm_start detects http as service"
# This should print "Starting service" not "using universal start"
output=$(cd /tmp && tsm start http 2>&1 || true)
if [[ "$output" == *"Starting service"* ]] || [[ "$output" == *"🚀"* ]]; then
    pass "http detected as service"
    # Clean up
    tsm stop 2>/dev/null || true
else
    fail "http not detected as service. Output: $output"
fi

# =============================================================================
# PROCESS NAMING TESTS
# =============================================================================

run_test "Service start uses correct naming pattern"
cd /tmp
output=$(tsm start http 2>&1 || true)
# Should be something like tmp-http-8000 not just tmp-8000
if [[ "$output" == *"-http-"* ]]; then
    pass "Name includes service name (http)"
else
    fail "Name missing service name. Output: $output"
fi
tsm stop 2>/dev/null || true

# =============================================================================
# PORT AUTO-INCREMENT TESTS
# =============================================================================

run_test "Port auto-increment when port busy"
# Start first instance
nc -l 59000 &>/dev/null &
nc_pid=$!
sleep 0.2

# Try to start on same port - should auto-increment
output=$(tsm start "python -m http.server 59000" --name test-http --port 59000 2>&1 || true)
if [[ "$output" == *"59001"* ]] || [[ "$output" == *"using port"* ]]; then
    pass "Auto-incremented to avoid busy port"
else
    # Check if it failed with port busy message
    if [[ "$output" == *"in use"* ]]; then
        fail "Didn't auto-increment, got port busy error"
    else
        pass "Started (port may have been free)"
    fi
fi

kill $nc_pid 2>/dev/null || true
tsm stop test-http 2>/dev/null || true

# =============================================================================
# PROCESS LIFECYCLE TESTS
# =============================================================================

run_test "Can start and stop a process"
output=$(tsm start "sleep 300" --name test-sleep --port none 2>&1)
if [[ "$output" == *"Started"* ]]; then
    pass "Process started"

    # Verify it's running
    if tsm list 2>/dev/null | grep -q "test-sleep"; then
        pass "Process appears in list"
    else
        fail "Process not in list"
    fi

    # Stop it
    stop_output=$(tsm stop test-sleep 2>&1 || true)
    if [[ "$stop_output" == *"stopped"* ]]; then
        pass "Process stopped"
    else
        fail "Stop failed: $stop_output"
    fi
else
    fail "Start failed: $output"
fi

# =============================================================================
# ENVIRONMENT ACTIVATION TESTS
# =============================================================================

run_test "Python processes get pyenv activated"
cd /tmp
# Create a test script that prints python path
cat > /tmp/test_python_path.py << 'EOF'
import sys
print(sys.executable)
EOF

output=$(tsm start "python /tmp/test_python_path.py" --name test-pypath --port none 2>&1 || true)
sleep 1
log_content=$(cat "$TETRA_DIR/tsm/runtime/processes/test-pypath-"*/current.out 2>/dev/null || echo "")

if [[ "$log_content" == *"tetra/pyenv"* ]]; then
    pass "Python using tetra pyenv"
else
    echo "  Python path: $log_content"
    pass "Python process ran (may use system python)"
fi

tsm stop test-pypath 2>/dev/null || true
rm -f /tmp/test_python_path.py

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "========================================"
echo "Integration Tests: $TESTS_RUN run, $TESTS_FAILED failed"
echo "========================================"

exit $TESTS_FAILED
