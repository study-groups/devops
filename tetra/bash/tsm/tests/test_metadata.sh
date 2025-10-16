#!/usr/bin/env bash
# Test: JSON Metadata System (PM2-style)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$SCRIPT_DIR")"

# Setup test environment
export TETRA_SRC="$(dirname "$(dirname "$TSM_DIR")")"
export TETRA_DIR="/tmp/tsm-test-$$"
export TSM_PROCESSES_DIR="$TETRA_DIR/tsm/runtime/processes"

source "$TSM_DIR/core/metadata.sh"
source "$TSM_DIR/core/utils.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test() {
    local name="$1"
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "  [$TESTS_RUN] $name ... "
}

pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "✓"
}

fail() {
    local reason="$1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "✗"
    echo "    FAIL: $reason"
}

cleanup() {
    rm -rf "$TETRA_DIR"
}

trap cleanup EXIT

# Setup
mkdir -p "$TSM_PROCESSES_DIR"

echo "Testing: JSON Metadata System"
echo "=============================="

# Test 1: Create metadata
test "Create process metadata"
tsm_id=$(tsm_create_metadata "test-proc" "12345" "node server.js" "3000" "/tmp" "node" "node" "env/test.env")
if [[ -f "$TSM_PROCESSES_DIR/test-proc/meta.json" ]]; then
    pass
else
    fail "Metadata file not created"
fi

# Test 2: Read metadata fields
test "Read metadata fields"
pid=$(tsm_read_metadata "test-proc" "pid")
if [[ "$pid" == "12345" ]]; then
    pass
else
    fail "Expected pid=12345, got $pid"
fi

# Test 3: Update metadata
test "Update metadata field"
tsm_update_metadata "test-proc" "status" "running"
status=$(tsm_read_metadata "test-proc" "status")
if [[ "$status" == "running" ]]; then
    pass
else
    fail "Status not updated"
fi

# Test 4: Set status
test "Set process status"
tsm_set_status "test-proc" "stopped"
status=$(tsm_read_metadata "test-proc" "status")
if [[ "$status" == "stopped" ]]; then
    pass
else
    fail "Status setter failed"
fi

# Test 5: Process exists check
test "Check if process exists"
if tsm_process_exists "test-proc"; then
    pass
else
    fail "Process should exist"
fi

# Test 6: List processes
test "List all processes"
procs=$(tsm_list_processes)
if echo "$procs" | grep -q "test-proc"; then
    pass
else
    fail "Process not in list"
fi

# Test 7: Remove process
test "Remove process metadata"
tsm_remove_process "test-proc"
if [[ ! -d "$TSM_PROCESSES_DIR/test-proc" ]]; then
    pass
else
    fail "Process directory not removed"
fi

# Test 8: Process directory structure
test "Verify PM2-style directory structure"
tsm_create_metadata "app" "99999" "python app.py" "8000" "/app" "python" "python" ""
if [[ -f "$TSM_PROCESSES_DIR/app/meta.json" ]]; then
    pass
else
    fail "PM2-style structure not created"
fi

# Test 9: JSON structure validation
test "Validate JSON structure"
json=$(cat "$TSM_PROCESSES_DIR/app/meta.json")
if echo "$json" | jq -e '.tsm_id' >/dev/null 2>&1 && \
   echo "$json" | jq -e '.pid' >/dev/null 2>&1 && \
   echo "$json" | jq -e '.command' >/dev/null 2>&1; then
    pass
else
    fail "JSON structure invalid"
fi

# Test 10: Calculate uptime
test "Calculate uptime"
start_time=$(($(date +%s) - 65))
uptime=$(tsm_calculate_uptime "$start_time")
if [[ "$uptime" == "1m" ]]; then
    pass
else
    fail "Uptime calculation incorrect: $uptime"
fi

echo ""
echo "Results: $TESTS_PASSED/$TESTS_RUN passed, $TESTS_FAILED failed"
[[ $TESTS_FAILED -eq 0 ]]
