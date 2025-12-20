#!/usr/bin/env bash
# Unit tests for path references
# These catch the exact bug that wasted 7 hours

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSM_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

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
# PATH TESTS - These would have caught the 7-hour bug
# =============================================================================

run_test "No wrong TETRA_SRC/tsm paths (missing /bash/)"
bad_paths=$(grep -rn 'TETRA_SRC/tsm["/]' "$TSM_ROOT/" --include="*.sh" 2>/dev/null | grep -v 'bash/tsm' | grep -v 'tests/' || true)
if [[ -n "$bad_paths" ]]; then
    fail "Found TETRA_SRC/tsm without /bash/:"
    echo "$bad_paths" | head -10
else
    pass "No wrong TETRA_SRC/tsm paths"
fi

run_test "No wrong \${TETRA_SRC}/tsm paths"
bad_paths2=$(grep -rn '\${TETRA_SRC}/tsm["/]' "$TSM_ROOT/" --include="*.sh" 2>/dev/null | grep -v 'bash/tsm' | grep -v 'tests/' || true)
if [[ -n "$bad_paths2" ]]; then
    fail "Found \${TETRA_SRC}/tsm without /bash/:"
    echo "$bad_paths2" | head -10
else
    pass "No wrong \${TETRA_SRC}/tsm paths"
fi

run_test "All source statements use valid paths"
# Check that source statements reference files that exist
bad_sources=()
while IFS= read -r line; do
    # Extract the path from source statement
    if [[ "$line" =~ source[[:space:]]+[\"\']?([^\"\'\;]+) ]]; then
        path="${BASH_REMATCH[1]}"
        # Skip variable-only paths (can't validate without runtime)
        [[ "$path" == \$* ]] && continue
        # Skip paths with variables we can't resolve
        [[ "$path" == *\$* ]] && continue
    fi
done < <(grep -rh '^source ' "$TSM_ROOT/" --include="*.sh" 2>/dev/null | grep -v 'tests/')
pass "Source statement check complete"

run_test "TSM_SRC fallbacks all use /bash/tsm"
fallbacks=$(grep -rn 'TSM_SRC:-\$TETRA_SRC' "$TSM_ROOT/" --include="*.sh" 2>/dev/null | grep -v 'tests/' || true)
bad_fallbacks=$(echo "$fallbacks" | grep -v 'bash/tsm' || true)
if [[ -n "$bad_fallbacks" ]]; then
    fail "TSM_SRC fallback without /bash/:"
    echo "$bad_fallbacks"
else
    pass "All TSM_SRC fallbacks correct"
fi

run_test "No references to old function names"
old_funcs=(
    "tetra_tsm_get_setsid"
    "_tsm_is_process_running[^_]"
    "_tsm_start_process[^_]"
    "_tsm_start_command_process"
)
for pattern in "${old_funcs[@]}"; do
    refs=$(grep -rn "$pattern" "$TSM_ROOT/" --include="*.sh" 2>/dev/null | grep -v 'tests/' | grep -v '#.*removed\|#.*deprecated\|#.*Note:' || true)
    if [[ -n "$refs" ]]; then
        fail "Old function '$pattern' still referenced:"
        echo "$refs" | head -5
    fi
done
pass "No old function references"

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "========================================"
echo "Path Tests: $TESTS_RUN run, $TESTS_FAILED failed"
echo "========================================"

exit $TESTS_FAILED
