#!/usr/bin/env bash
# Test: Thread-Safe ID Allocation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_DIR="$(dirname "$SCRIPT_DIR")"

export TETRA_SRC="$(dirname "$(dirname "$TSM_DIR")")"
export TETRA_DIR="/tmp/tsm-test-$$"
export TSM_PROCESSES_DIR="$TETRA_DIR/tsm/runtime/processes"

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
    rm -rf "$TETRA_DIR"
}

trap cleanup EXIT
mkdir -p "$TSM_PROCESSES_DIR"

echo "Testing: Thread-Safe ID Allocation"
echo "==================================="

# Test 1: First ID is 0
test "First allocated ID is 0"
id=$(tetra_tsm_get_next_id)
if [[ "$id" == "0" ]]; then
    pass
else
    fail "Expected 0, got $id"
fi

# Test 2: Sequential allocation
test "Sequential ID allocation"
tsm_create_metadata "proc-0" "100" "cmd" "none" "/" "" "command" "" >/dev/null
id=$(tetra_tsm_get_next_id)
if [[ "$id" == "1" ]]; then
    pass
else
    fail "Expected 1, got $id"
fi

# Test 3: Gap filling
test "Gap-filling algorithm"
tsm_create_metadata "proc-2" "102" "cmd" "none" "/" "" "command" "" >/dev/null
tsm_remove_process "proc-0"
id=$(tetra_tsm_get_next_id)
if [[ "$id" == "0" ]]; then
    pass
else
    fail "Expected 0 (fill gap), got $id"
fi

# Test 4: Reservation placeholders
test "ID reservation creates placeholder"
id=$(tetra_tsm_get_next_id)
if [[ -d "$TSM_PROCESSES_DIR/.reserved-$id" ]]; then
    pass
else
    fail "Reservation placeholder not created"
fi

# Test 5: Reserved IDs are skipped
test "Reserved IDs are skipped"
mkdir -p "$TSM_PROCESSES_DIR/.reserved-5"
id=$(tetra_tsm_get_next_id)
if [[ "$id" != "5" ]]; then
    pass
else
    fail "Reserved ID 5 was allocated"
fi

# Test 6: Concurrent allocation (race condition test)
test "Concurrent allocation (10 parallel processes)"
pids=()
for i in {1..10}; do
    (
        id=$(tetra_tsm_get_next_id)
        echo "$id" > "/tmp/tsm-id-$$-$i"
    ) &
    pids+=($!)
done

for pid in "${pids[@]}"; do
    wait "$pid"
done

ids=($(cat /tmp/tsm-id-$$-* | sort -n))
unique_ids=($(printf '%s\n' "${ids[@]}" | sort -u))

if [[ ${#ids[@]} -eq ${#unique_ids[@]} ]]; then
    pass
else
    fail "Duplicate IDs allocated: ${ids[*]}"
fi

rm -f /tmp/tsm-id-$$-*

# Test 7: Lock timeout
test "Lock acquisition timeout"
(
    exec 200>"$TSM_PROCESSES_DIR/.id_allocation_lock"
    flock -x 200
    sleep 10
) &
lock_pid=$!

sleep 0.5
timeout 3 bash -c "source $TSM_DIR/core/utils.sh && tetra_tsm_get_next_id" 2>&1 | grep -q "timeout" && pass || fail "Lock timeout not working"

kill $lock_pid 2>/dev/null || true
wait $lock_pid 2>/dev/null || true

# Test 8: Cleanup removes reservation
test "Metadata creation removes reservation"
id=$(tetra_tsm_get_next_id)
tsm_create_metadata "cleanup-test" "999" "cmd" "none" "/" "" "command" "" >/dev/null
if [[ ! -d "$TSM_PROCESSES_DIR/.reserved-$id" ]]; then
    pass
else
    fail "Reservation not cleaned up"
fi

# Test 9: Large ID gaps
test "Handle large ID gaps efficiently"
tsm_create_metadata "proc-100" "100" "cmd" "none" "/" "" "command" "" >/dev/null
id=$(tetra_tsm_get_next_id)
if [[ "$id" -lt "10" ]]; then
    pass
else
    fail "Did not fill lower gaps, got $id"
fi

# Test 10: Thread safety verification
test "Thread safety (stress test with 50 concurrent allocations)"
pids=()
for i in {1..50}; do
    (
        id=$(tetra_tsm_get_next_id)
        tsm_create_metadata "stress-$id" "$((1000+i))" "cmd" "none" "/" "" "command" "" >/dev/null 2>&1
    ) &
    pids+=($!)
done

failed=0
for pid in "${pids[@]}"; do
    wait "$pid" || failed=$((failed + 1))
done

if [[ $failed -eq 0 ]]; then
    pass
else
    fail "$failed allocations failed"
fi

echo ""
echo "Results: $TESTS_PASSED/$TESTS_RUN passed, $TESTS_FAILED failed"
[[ $TESTS_FAILED -eq 0 ]]
