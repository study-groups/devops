#!/usr/bin/env bash
# test-framework.sh - Shared test setup for startup tests
#
# Reuses TSM framework pattern (run_test, PASS/FAIL counters, colors).
# Adds startup-specific helpers for isolated org testing.
#
# Usage: source this file in your test scripts

# === GLOBAL CONFIGURATION ===

STARTUP_TEST_DIR="/tmp/tetra-test-$$"
STARTUP_TEST_CLEANUP="${STARTUP_TEST_CLEANUP:-true}"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# JSON output mode
declare -a _TEST_RESULTS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# === LOGGING ===

log_info()    { [[ "${TETRA_TEST_JSON:-}" == "1" ]] && return; echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass()    { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
log_fail()    { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
log_warn()    { [[ "${TETRA_TEST_JSON:-}" == "1" ]] && return; echo -e "${YELLOW}[WARN]${NC} $1"; }
log_section() { [[ "${TETRA_TEST_JSON:-}" == "1" ]] && return; echo ""; echo -e "${PURPLE}=== $1 ===${NC}"; }

# === TEST EXECUTION ===

run_test() {
    local test_name="$1"
    local test_function="$2"

    # Single-test filter: skip non-matching tests
    if [[ -n "${TETRA_TEST_SINGLE:-}" && "$test_function" != "$TETRA_TEST_SINGLE" ]]; then
        return 0
    fi

    ((TESTS_RUN++))

    local t_start=$EPOCHREALTIME
    if $test_function; then
        local t_end=$EPOCHREALTIME
        local dur_ms
        dur_ms=$(printf '%.0f' "$(echo "($t_end - $t_start) * 1000" | bc)")
        if [[ "${TETRA_TEST_JSON:-}" == "1" ]]; then
            ((TESTS_PASSED++))
        else
            log_pass "$test_name"
        fi
        _TEST_RESULTS+=("{\"name\":\"${test_name//\"/\\\"}\",\"function\":\"${test_function}\",\"file\":\"${_SUITE_FILE:-unknown}\",\"status\":\"pass\",\"duration_ms\":${dur_ms}}")
        return 0
    else
        local t_end=$EPOCHREALTIME
        local dur_ms
        dur_ms=$(printf '%.0f' "$(echo "($t_end - $t_start) * 1000" | bc)")
        if [[ "${TETRA_TEST_JSON:-}" == "1" ]]; then
            ((TESTS_FAILED++))
        else
            log_fail "$test_name"
        fi
        _TEST_RESULTS+=("{\"name\":\"${test_name//\"/\\\"}\",\"function\":\"${test_function}\",\"file\":\"${_SUITE_FILE:-unknown}\",\"status\":\"fail\",\"duration_ms\":${dur_ms}}")
        return 1
    fi
}

# === STARTUP TEST SETUP ===

startup_test_setup() {
    local suite_name="${1:-Startup Test Suite}"
    _SUITE_NAME="$suite_name"
    _SUITE_FILE="${BASH_SOURCE[1]}"
    _SUITE_START=$EPOCHREALTIME

    if [[ "${TETRA_TEST_JSON:-}" != "1" ]]; then
        log_section "$suite_name"
    fi

    # Resolve TETRA_SRC from this script's location
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
    TETRA_SRC="$(cd "$script_dir/../.." && pwd)"
    export TETRA_SRC

    # Create isolated TETRA_DIR
    TETRA_DIR="$STARTUP_TEST_DIR"
    export TETRA_DIR
    mkdir -p "$TETRA_DIR/orgs"
    mkdir -p "$TETRA_DIR/config"

    if [[ "${TETRA_TEST_JSON:-}" != "1" ]]; then
        log_info "TETRA_SRC: $TETRA_SRC"
        log_info "TETRA_DIR: $TETRA_DIR (isolated)"
    fi

    # Source core org module (provides shared helpers)
    source "$TETRA_SRC/bash/org/org.sh" 2>/dev/null || true

    # Cleanup trap
    if [[ "$STARTUP_TEST_CLEANUP" == "true" ]]; then
        trap startup_test_teardown EXIT
    fi
}

startup_test_teardown() {
    if [[ "$STARTUP_TEST_CLEANUP" == "true" && -d "$STARTUP_TEST_DIR" ]]; then
        rm -rf "$STARTUP_TEST_DIR"
    fi
}

# Create a test org with sections from templates
_create_test_org() {
    local org_name="${1:-testorg}"
    local org_dir="$TETRA_DIR/orgs/$org_name"

    mkdir -p "$org_dir/sections"
    mkdir -p "$org_dir/backups"

    # Minimal 00-org.toml
    cat > "$org_dir/sections/00-org.toml" << EOF
[org]
name = "$org_name"
EOF

    # Stub 10-infrastructure.toml
    cat > "$org_dir/sections/10-infrastructure.toml" << EOF
# Infrastructure - environments
[env.local]
description = "Local development"
EOF

    # Stub 20-storage.toml
    cat > "$org_dir/sections/20-storage.toml" << 'EOF'
# Storage configuration
# [storage.s3]
# endpoint = "sfo3.digitaloceanspaces.com"
EOF

    # Stub 50-custom.toml
    cat > "$org_dir/sections/50-custom.toml" << 'EOF'
# User customizations
# [notes]
EOF

    echo "$org_dir"
}

# === RESULTS ===

startup_test_results() {
    local suite_name="${1:-Test Results}"

    if [[ "${TETRA_TEST_JSON:-}" == "1" ]]; then
        local suite_end=$EPOCHREALTIME
        local total_ms
        total_ms=$(printf '%.0f' "$(echo "($suite_end - ${_SUITE_START:-$suite_end}) * 1000" | bc)")
        local tests_json=""
        local i
        for i in "${!_TEST_RESULTS[@]}"; do
            [[ $i -gt 0 ]] && tests_json+=","
            tests_json+="${_TEST_RESULTS[$i]}"
        done
        printf '{"suite":"%s","passed":%d,"failed":%d,"total":%d,"duration_ms":%d,"tests":[%s]}\n' \
            "${_SUITE_NAME//\"/\\\"}" "$TESTS_PASSED" "$TESTS_FAILED" "$TESTS_RUN" "$total_ms" "$tests_json"
        return $TESTS_FAILED
    fi

    echo ""
    log_section "$suite_name"
    echo "Tests Run:    $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed${NC}"
        return 0
    else
        echo -e "${RED}$TESTS_FAILED test(s) failed${NC}"
        return 1
    fi
}
