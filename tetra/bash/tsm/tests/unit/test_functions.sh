#!/usr/bin/env bash
# Unit tests for function existence and signatures
# Verifies all critical functions are loaded correctly

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

# =============================================================================
# SETUP - Force fresh load
# =============================================================================

echo "Forcing fresh TSM load..."
unset TETRA_BOOTLOADER_LOADED
unset TETRA_MODULE_LOADED
while read -r func; do
    unset -f "$func" 2>/dev/null
done < <(declare -F | awk '{print $3}' | grep -E '^_?tsm|^tetra_tsm' || true)

source ~/tetra/tetra.sh 2>/dev/null
# Trigger lazy load
tsm list >/dev/null 2>&1

echo ""

# =============================================================================
# CRITICAL FUNCTION EXISTENCE
# =============================================================================

run_test "Core platform functions exist"
core_funcs=(
    "tsm_get_setsid"
    "tsm_get_flock"
    "tsm_has_setsid"
    "tsm_check_platform_deps"
)
for fn in "${core_funcs[@]}"; do
    if declare -F "$fn" >/dev/null 2>&1; then
        pass "$fn exists"
    else
        fail "$fn MISSING"
    fi
done

run_test "Process utility functions exist"
util_funcs=(
    "tsm_is_pid_alive"
    "tsm_port_available"
    "tsm_process_exists"
    "tsm_allocate_port_from"
)
for fn in "${util_funcs[@]}"; do
    if declare -F "$fn" >/dev/null 2>&1; then
        pass "$fn exists"
    else
        fail "$fn MISSING"
    fi
done

run_test "Start functions exist"
start_funcs=(
    "tsm_start_any_command"
    "tsm_detect_type"
    "tsm_resolve_interpreter"
    "tsm_build_env_activation"
    "tsm_discover_port"
    "tsm_generate_process_name"
)
for fn in "${start_funcs[@]}"; do
    if declare -F "$fn" >/dev/null 2>&1; then
        pass "$fn exists"
    else
        fail "$fn MISSING"
    fi
done

run_test "Service functions exist"
service_funcs=(
    "tetra_tsm_start"
    "tetra_tsm_start_service"
    "tetra_tsm_start_local"
    "tetra_tsm_stop_single"
    "tetra_tsm_restart_single"
    "_tsm_find_service"
    "_tsm_get_orgs"
    "_tsm_parse_service_ref"
)
for fn in "${service_funcs[@]}"; do
    if declare -F "$fn" >/dev/null 2>&1; then
        pass "$fn exists"
    else
        fail "$fn MISSING"
    fi
done

run_test "Hook functions exist"
hook_funcs=(
    "tsm_build_prehook"
    "tsm_resolve_hook"
)
for fn in "${hook_funcs[@]}"; do
    if declare -F "$fn" >/dev/null 2>&1; then
        pass "$fn exists"
    else
        fail "$fn MISSING"
    fi
done

# =============================================================================
# FUNCTION BEHAVIOR TESTS
# =============================================================================

run_test "tsm_get_setsid returns executable path"
setsid_path=$(tsm_get_setsid 2>/dev/null || true)
if [[ -n "$setsid_path" && -x "$setsid_path" ]]; then
    pass "tsm_get_setsid returns: $setsid_path"
else
    fail "tsm_get_setsid returned invalid: '$setsid_path'"
fi

run_test "tsm_is_pid_alive detects current shell"
if tsm_is_pid_alive $$ 2>/dev/null; then
    pass "tsm_is_pid_alive correctly detects PID $$"
else
    fail "tsm_is_pid_alive says current shell is dead!"
fi

run_test "tsm_port_available detects unused port"
if tsm_port_available 59999 2>/dev/null; then
    pass "tsm_port_available says 59999 is free"
else
    fail "tsm_port_available says 59999 is busy (unexpected)"
fi

run_test "_tsm_get_orgs returns at least one org"
org_count=0
while IFS= read -r org; do
    [[ -n "$org" ]] && ((++org_count)) || true
done < <(_tsm_get_orgs 2>/dev/null)
if [[ $org_count -ge 1 ]]; then
    pass "_tsm_get_orgs returned $org_count org(s)"
else
    fail "_tsm_get_orgs returned no orgs"
fi

run_test "tsm_detect_type identifies python"
type_result=$(tsm_detect_type "python -m http.server" 2>/dev/null)
if [[ "$type_result" == "python" ]]; then
    pass "tsm_detect_type correctly identifies python"
else
    fail "tsm_detect_type returned '$type_result' for python command"
fi

run_test "tsm_detect_type identifies node"
type_result=$(tsm_detect_type "node server.js" 2>/dev/null)
if [[ "$type_result" == "node" ]]; then
    pass "tsm_detect_type correctly identifies node"
else
    fail "tsm_detect_type returned '$type_result' for node command"
fi

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "========================================"
echo "Function Tests: $TESTS_RUN run, $TESTS_FAILED failed"
echo "========================================"

exit $TESTS_FAILED
