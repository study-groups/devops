#!/usr/bin/env bash
# Unit tests for service lookup
# Tests _tsm_find_service and related functions

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
# SETUP
# =============================================================================

unset TETRA_BOOTLOADER_LOADED
unset TETRA_MODULE_LOADED
source ~/tetra/tetra.sh 2>/dev/null
tsm list >/dev/null 2>&1

echo ""

# =============================================================================
# ORG ITERATION TESTS - This catches the newline bug
# =============================================================================

run_test "_tsm_get_orgs outputs one org per line"
org_output=$(_tsm_get_orgs 2>/dev/null)
org_count=$(echo "$org_output" | grep -c . || echo 0)
if [[ $org_count -ge 1 ]]; then
    pass "_tsm_get_orgs returned $org_count org(s)"
    echo "  Orgs: $(echo "$org_output" | tr '\n' ' ')"
else
    fail "_tsm_get_orgs returned no orgs"
fi

run_test "Iterating orgs works correctly with while read"
iter_count=0
while IFS= read -r org; do
    [[ -z "$org" ]] && continue
    ((++iter_count)) || true
    # Verify org name has no newlines/spaces
    if [[ "$org" =~ [[:space:]] ]]; then
        fail "Org name contains whitespace: '$org'"
    fi
done < <(_tsm_get_orgs 2>/dev/null)

if [[ $iter_count -ge 1 ]]; then
    pass "While loop iterated over $iter_count org(s) correctly"
else
    fail "While loop didn't iterate over any orgs"
fi

run_test "Each org has valid tsm directory"
while IFS= read -r org; do
    [[ -z "$org" ]] && continue
    org_tsm_dir="$TETRA_DIR/orgs/$org/tsm"
    if [[ -d "$org_tsm_dir" ]]; then
        pass "Org '$org' has tsm dir"
    else
        fail "Org '$org' missing tsm dir: $org_tsm_dir"
    fi
done < <(_tsm_get_orgs 2>/dev/null)

# =============================================================================
# SERVICE LOOKUP TESTS
# =============================================================================

run_test "_tsm_parse_service_ref parses simple name"
parsed_org="" parsed_svc=""
_tsm_parse_service_ref "http" parsed_org parsed_svc 2>/dev/null
if [[ -z "$parsed_org" && "$parsed_svc" == "http" ]]; then
    pass "Parsed 'http' correctly: org='' service='http'"
else
    fail "Parsed 'http' wrong: org='$parsed_org' service='$parsed_svc'"
fi

run_test "_tsm_parse_service_ref parses org/service"
_tsm_parse_service_ref "tetra/http" parsed_org parsed_svc 2>/dev/null
if [[ "$parsed_org" == "tetra" && "$parsed_svc" == "http" ]]; then
    pass "Parsed 'tetra/http' correctly"
else
    fail "Parsed 'tetra/http' wrong: org='$parsed_org' service='$parsed_svc'"
fi

run_test "_tsm_find_service finds http service"
found_org="" found_file=""
if _tsm_find_service "http" found_org found_file 2>/dev/null; then
    if [[ -f "$found_file" ]]; then
        pass "Found http service: $found_file"
    else
        fail "Found http but file doesn't exist: $found_file"
    fi
else
    fail "_tsm_find_service could not find 'http' service"
    echo "  Available services:"
    for org in $(_tsm_get_orgs); do
        ls "$TETRA_DIR/orgs/$org/tsm/services-available/"*.tsm 2>/dev/null | head -3 || true
    done
fi

run_test "_tsm_find_service returns correct org"
if _tsm_find_service "http" found_org found_file 2>/dev/null; then
    if [[ -n "$found_org" ]]; then
        pass "Service org: $found_org"
    else
        fail "Found service but org is empty"
    fi
fi

run_test "_tsm_find_service fails for nonexistent service"
if _tsm_find_service "nonexistent_service_12345" found_org found_file 2>/dev/null; then
    fail "Found nonexistent service (should have failed)"
else
    pass "Correctly returned not found for nonexistent service"
fi

run_test "_tsm_find_service with explicit org"
if _tsm_find_service "tetra/http" found_org found_file 2>/dev/null; then
    if [[ "$found_org" == "tetra" ]]; then
        pass "Explicit org lookup works"
    else
        fail "Explicit org returned wrong org: $found_org"
    fi
else
    # This might fail if http isn't in tetra org
    echo "  SKIP: tetra/http not found (may not exist)"
fi

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "========================================"
echo "Service Lookup Tests: $TESTS_RUN run, $TESTS_FAILED failed"
echo "========================================"

exit $TESTS_FAILED
