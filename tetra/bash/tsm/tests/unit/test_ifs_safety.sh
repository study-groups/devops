#!/usr/bin/env bash
# Unit tests for IFS safety
# Ensures no code corrupts IFS in ways that break array operations

set -eo pipefail

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

# =============================================================================
# SETUP
# =============================================================================

# Store original IFS
ORIGINAL_IFS="$IFS"

# Load tetra
unset TETRA_BOOTLOADER_LOADED
unset TETRA_MODULE_LOADED
source ~/tetra/tetra.sh 2>/dev/null

# Trigger TSM lazy load
tsm list >/dev/null 2>&1

echo ""

# =============================================================================
# IFS PRESERVATION TESTS
# =============================================================================

run_test "IFS preserved after tetra load"
if [[ "$IFS" == "$ORIGINAL_IFS" ]]; then
    pass "IFS unchanged after loading tetra"
else
    fail "IFS corrupted after loading tetra: expected '$ORIGINAL_IFS', got '$IFS'"
fi

run_test "IFS preserved after tsm list"
tsm list >/dev/null 2>&1
if [[ "$IFS" == "$ORIGINAL_IFS" ]]; then
    pass "IFS unchanged after tsm list"
else
    fail "IFS corrupted after tsm list"
fi

run_test "IFS default value is space-tab-newline"
expected_ifs=$' \t\n'
if [[ "$IFS" == "$expected_ifs" ]]; then
    pass "IFS is default value"
else
    fail "IFS is not default: $(printf '%q' "$IFS")"
fi

# =============================================================================
# ARRAY OPERATION TESTS (detect IFS issues)
# =============================================================================

run_test "seq word splitting works correctly"
count=0
for i in $(seq 1 5); do
    ((++count))
done
if [[ $count -eq 5 ]]; then
    pass "seq splits into 5 iterations"
else
    fail "seq produced $count iterations instead of 5 (IFS issue)"
fi

run_test "Command substitution word splitting works"
output=$(echo "a b c")
count=0
for word in $output; do
    ((++count))
done
if [[ $count -eq 3 ]]; then
    pass "Word splitting produced 3 words"
else
    fail "Word splitting produced $count words instead of 3 (IFS issue)"
fi

run_test "Newline splitting works in for loop"
multiline=$'line1\nline2\nline3'
count=0
for line in $multiline; do
    ((++count))
done
if [[ $count -eq 3 ]]; then
    pass "Newline splitting produced 3 lines"
else
    fail "Newline splitting produced $count lines instead of 3 (IFS issue)"
fi

# =============================================================================
# ANTI-PATTERN DETECTION
# =============================================================================

run_test "No 'unset IFS' in TSM core files"
bad_files=$(grep -l 'unset IFS' \
    "$TETRA_SRC/bash/tsm/core/"*.sh \
    "$TETRA_SRC/bash/tsm/process/"*.sh \
    "$TETRA_SRC/bash/tsm/services/"*.sh \
    "$TETRA_SRC/bash/tsm/system/"*.sh \
    2>/dev/null || true)
if [[ -z "$bad_files" ]]; then
    pass "No 'unset IFS' found in TSM"
else
    fail "Found 'unset IFS' in: $bad_files"
fi

run_test "No IFS_OLD pattern in TSM core files"
bad_files=$(grep -l 'IFS_OLD' \
    "$TETRA_SRC/bash/tsm/core/"*.sh \
    "$TETRA_SRC/bash/tsm/process/"*.sh \
    "$TETRA_SRC/bash/tsm/services/"*.sh \
    "$TETRA_SRC/bash/tsm/system/"*.sh \
    2>/dev/null || true)
if [[ -z "$bad_files" ]]; then
    pass "No IFS_OLD pattern found in TSM"
else
    fail "Found IFS_OLD in: $bad_files"
fi

run_test "No array=(\$(cmd)) pattern in TSM core files"
# This pattern is IFS-dependent and should use readarray instead
bad_count=0
while IFS= read -r line; do
    [[ -n "$line" ]] && ((++bad_count)) || true
done < <(grep -E '\w+=\(\$\(' \
    "$TETRA_SRC/bash/tsm/core/"*.sh \
    "$TETRA_SRC/bash/tsm/process/"*.sh \
    "$TETRA_SRC/bash/tsm/services/"*.sh \
    2>/dev/null || true)
if [[ $bad_count -eq 0 ]]; then
    pass "No array=\$() pattern found"
else
    fail "Found $bad_count instances of array=\$() pattern (use readarray instead)"
fi

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "========================================"
echo "IFS Safety Tests: $TESTS_RUN run, $TESTS_FAILED failed"
echo "========================================"

exit $TESTS_FAILED
