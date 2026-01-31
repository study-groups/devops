#!/usr/bin/env bash
# run-all.sh - Run all startup test suites, aggregate results
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

TOTAL_PASS=0
TOTAL_FAIL=0
SUITES_RUN=0

# Suite definitions
SUITES=(
    "NH Bridge:test-nh-bridge.sh"
    "Org Build:test-org-build.sh"
    "Org Parity:test-org-parity.sh"
    "Init Lifecycle:test-init-lifecycle.sh"
    "Tetra QA:test-tetra-qa.sh"
)

if [[ "${TETRA_TEST_JSON:-}" == "1" ]]; then
    # JSON aggregation mode
    declare -a suite_jsons=()
    total_passed=0
    total_failed=0
    total_tests=0

    for suite in "${SUITES[@]}"; do
        name="${suite%%:*}"
        script="${suite#*:}"

        json_output=$(TETRA_TEST_JSON=1 bash "$SCRIPT_DIR/$script" 2>/dev/null) || true
        if [[ -n "$json_output" ]]; then
            suite_jsons+=("$json_output")
            # Extract counts from JSON using parameter expansion
            p="${json_output#*\"passed\":}"
            p="${p%%,*}"
            f="${json_output#*\"failed\":}"
            f="${f%%,*}"
            t="${json_output#*\"total\":}"
            t="${t%%,*}"
            total_passed=$((total_passed + p))
            total_failed=$((total_failed + f))
            total_tests=$((total_tests + t))
        fi
    done

    # Build suites array
    suites_json=""
    for i in "${!suite_jsons[@]}"; do
        [[ $i -gt 0 ]] && suites_json+=","
        suites_json+="${suite_jsons[$i]}"
    done

    printf '{"suites":[%s],"total_passed":%d,"total_failed":%d,"total_tests":%d}\n' \
        "$suites_json" "$total_passed" "$total_failed" "$total_tests"
    exit $total_failed
fi

# Normal (ANSI) mode
run_suite() {
    local name="$1"
    local script="$2"

    echo ""
    echo -e "${PURPLE}━━━ $name ━━━${NC}"

    if bash "$SCRIPT_DIR/$script"; then
        ((SUITES_RUN++))
    else
        ((SUITES_RUN++))
    fi
}

echo -e "${CYAN}Tetra Startup Test Suite${NC}"
echo "========================"

for suite in "${SUITES[@]}"; do
    name="${suite%%:*}"
    script="${suite#*:}"

    echo ""
    echo -e "${PURPLE}━━━ $name ━━━${NC}"

    local_fail=0
    bash "$SCRIPT_DIR/$script" || local_fail=$?
    TOTAL_FAIL=$((TOTAL_FAIL + local_fail))
    ((SUITES_RUN++))
done

echo ""
echo "==============================="
echo -e "${CYAN}Final Summary${NC}"
echo "Suites run: $SUITES_RUN"

if [[ $TOTAL_FAIL -eq 0 ]]; then
    echo -e "${GREEN}All suites passed${NC}"
else
    echo -e "${RED}Total failures: $TOTAL_FAIL${NC}"
fi

exit $TOTAL_FAIL
