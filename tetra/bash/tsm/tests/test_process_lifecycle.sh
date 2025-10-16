#!/usr/bin/env bash
# Test: Process Lifecycle (Start, Check, Stop)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$SCRIPT_DIR")"

export TETRA_SRC="$(dirname "$(dirname "$TSM_DIR")")"
export TETRA_DIR="/tmp/tsm-test-$$"
export TSM_PROCESSES_DIR="$TETRA_DIR/tsm/runtime/processes"
export TSM_LOGS_DIR="$TETRA_DIR/tsm/runtime/logs"

source "$TSM_DIR/core/utils.sh"
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
    # Kill any test processes
    for pid_file in "$TSM_PROCESSES_DIR"/*/test-*.pid 2>/dev/null; do
        [[ -f "$pid_file" ]] && kill $(cat "$pid_file") 2>/dev/null || true
    done
    rm -rf "$TETRA_DIR"
}

trap cleanup EXIT
mkdir -p "$TSM_PROCESSES_DIR" "$TSM_LOGS_DIR"

echo "Testing: Process Lifecycle"
echo "=========================="

# Test 1: Create process that runs
test "Start a real process"
echo '#!/bin/bash
while true; do
    echo "tick"
    sleep 1
done' > /tmp/test-proc-$$.sh
chmod +x /tmp/test-proc-$$.sh

bash /tmp/test-proc-$$.sh &
pid=$!
tsm_create_metadata "test-sleeper" "$pid" "bash /tmp/test-proc-$$.sh" "none" "/tmp" "bash" "bash" "" >/dev/null

if tetra_tsm_is_running "test-sleeper"; then
    pass
else
    fail "Process should be running"
fi

# Test 2: Check non-existent process
test "Non-existent process returns false"
if tetra_tsm_is_running "does-not-exist"; then
    fail "Non-existent process reported as running"
else
    pass
fi

# Test 3: Check dead process
test "Detect dead process"
tsm_create_metadata "dead-proc" "999999" "cmd" "none" "/" "" "command" "" >/dev/null
if tetra_tsm_is_running "dead-proc"; then
    fail "Dead process reported as running"
else
    pass
fi

# Test 4: ID to name resolution
test "Resolve ID to process name"
id=$(tsm_read_metadata "test-sleeper" "tsm_id")
name=$(tetra_tsm_id_to_name "$id")
if [[ "$name" == "test-sleeper" ]]; then
    pass
else
    fail "Expected 'test-sleeper', got '$name'"
fi

# Test 5: Name to ID resolution
test "Resolve name to ID"
resolved_id=$(tetra_tsm_name_to_id "test-sleeper")
if [[ "$resolved_id" == "$id" ]]; then
    pass
else
    fail "ID mismatch"
fi

# Test 6: Fuzzy name matching
test "Fuzzy name matching"
resolved_id=$(tetra_tsm_resolve_to_id "sleeper")
if [[ "$resolved_id" == "$id" ]]; then
    pass
else
    fail "Fuzzy match failed"
fi

# Test 7: Numeric ID input
test "Numeric ID input"
resolved_id=$(tetra_tsm_resolve_to_id "$id")
if [[ "$resolved_id" == "$id" ]]; then
    pass
else
    fail "Numeric ID resolution failed"
fi

# Test 8: Ambiguous fuzzy match
test "Ambiguous fuzzy match fails"
tsm_create_metadata "test-other" "88888" "cmd" "none" "/" "" "command" "" >/dev/null
if tetra_tsm_resolve_to_id "test" 2>&1 | grep -q "ambiguous"; then
    pass
else
    fail "Should detect ambiguous match"
fi

# Test 9: Kill process
test "Kill running process"
kill "$pid" 2>/dev/null
sleep 1
if tetra_tsm_is_running "test-sleeper"; then
    fail "Process still running after kill"
else
    pass
fi

# Test 10: Process cleanup
test "Remove process metadata"
tsm_remove_process "test-sleeper"
if [[ -d "$TSM_PROCESSES_DIR/test-sleeper" ]]; then
    fail "Process directory not removed"
else
    pass
fi

rm -f /tmp/test-proc-$$.sh

echo ""
echo "Results: $TESTS_PASSED/$TESTS_RUN passed, $TESTS_FAILED failed"
[[ $TESTS_FAILED -eq 0 ]]
