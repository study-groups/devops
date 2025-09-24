#!/usr/bin/env bash

# Test TDash Integration after TETRA_DIR reorganization
# Tests TDash functionality with new organization system and paths

set -euo pipefail

# Test configuration
TEST_NAME="TDash Integration Tests"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test utilities
log_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
    ((TESTS_RUN++))
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "[INFO] $1"
}

# Test setup
setup_test_environment() {
    log_info "Setting up TDash test environment..."

    # Source tetra
    if [[ -f "$HOME/tetra/tetra.sh" ]]; then
        source "$HOME/tetra/tetra.sh"
    else
        log_fail "Cannot find tetra.sh"
        exit 1
    fi

    # Load required modules
    tmod load tdash > /dev/null 2>&1 || {
        log_fail "Failed to load tdash module"
        exit 1
    }

    tmod load org > /dev/null 2>&1 || {
        log_fail "Failed to load org module"
        exit 1
    }

    log_info "TDash test environment ready"
}

# Test 1: TDash module loading
test_tdash_module_loading() {
    log_test "TDash module loading"

    if command -v tdash > /dev/null 2>&1; then
        log_pass "TDash command available after module load"
    else
        log_fail "TDash command not available"
    fi
}

# Test 2: TDash help functionality
test_tdash_help() {
    log_test "TDash help functionality"

    local help_output=$(tdash help 2>&1)

    if echo "$help_output" | grep -q "Tetra Dashboard" &&
       echo "$help_output" | grep -q "4-mode, 4-environment navigation"; then
        log_pass "TDash help displays correctly"
    else
        log_fail "TDash help output missing expected content"
    fi
}

# Test 3: TOML detection with new path
test_toml_detection() {
    log_test "TOML detection with new config path"

    # Source TDash functions to test detect_active_toml
    source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

    # Call detect_active_toml function
    detect_active_toml

    if [[ -n "$ACTIVE_TOML" ]]; then
        if [[ "$ACTIVE_TOML" == "$TETRA_DIR/config/tetra.toml" ]]; then
            log_pass "TDash correctly detects TOML at new location: $ACTIVE_TOML"
        else
            log_fail "TDash detected wrong TOML location: $ACTIVE_TOML"
        fi
    else
        log_fail "TDash failed to detect active TOML"
    fi
}

# Test 4: Organization context detection
test_organization_context() {
    log_test "Organization context detection in TDash"

    # Source TDash functions
    source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

    # Call detect_active_toml function
    detect_active_toml

    if [[ -n "$ACTIVE_ORG" ]]; then
        local current_org=$(tetra_org active)
        if [[ "$ACTIVE_ORG" == "$current_org" ]]; then
            log_pass "TDash correctly detects organization context: $ACTIVE_ORG"
        else
            log_fail "TDash org context mismatch: TDash=$ACTIVE_ORG, Org=$current_org"
        fi
    else
        log_fail "TDash failed to detect organization context"
    fi
}

# Test 5: TOML data loading
test_toml_data_loading() {
    log_test "TOML data loading functionality"

    # Source TDash functions
    source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

    # Initialize TOML detection
    detect_active_toml

    if [[ -n "$ACTIVE_TOML" ]]; then
        # Try to load TOML data
        load_toml_data

        # Check if some expected variables are set (from pixeljam_arcade.toml)
        if [[ -n "$DEV_SERVER" || -n "$DEV_IP" ]]; then
            log_pass "TOML data loading successful"
        else
            log_fail "TOML data not loaded or missing expected content"
        fi
    else
        log_fail "Cannot test TOML loading - no active TOML detected"
    fi
}

# Test 6: TDash render functions exist
test_render_functions() {
    log_test "TDash render functions availability"

    # Source TDash functions
    source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

    local missing_functions=()
    local expected_functions=(
        "render_toml_system"
        "render_toml_local"
        "render_toml_dev"
        "render_tkm_system"
        "render_tsm_system"
        "render_deploy_system"
    )

    for func in "${expected_functions[@]}"; do
        if ! declare -f "$func" > /dev/null 2>&1; then
            missing_functions+=("$func")
        fi
    done

    if [[ ${#missing_functions[@]} -eq 0 ]]; then
        log_pass "All expected render functions are available"
    else
        log_fail "Missing render functions: ${missing_functions[*]}"
    fi
}

# Test 7: Navigation state variables
test_navigation_state() {
    log_test "Navigation state variables initialization"

    # Source TDash functions
    source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

    local missing_vars=()
    local expected_vars=(
        "MODES"
        "ENVIRONMENTS"
        "CURRENT_MODE"
        "CURRENT_ENV"
        "CURRENT_ITEM"
    )

    for var in "${expected_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -eq 0 ]]; then
        log_pass "All navigation state variables are initialized"
    else
        log_fail "Missing navigation variables: ${missing_vars[*]}"
    fi
}

# Test 8: Mode and environment arrays
test_mode_environment_arrays() {
    log_test "Mode and environment arrays content"

    # Source TDash functions
    source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

    # Check MODES array
    local expected_modes=("TOML" "TKM" "TSM" "DEPLOY")
    local modes_match=true

    for i in "${!expected_modes[@]}"; do
        if [[ "${MODES[i]}" != "${expected_modes[i]}" ]]; then
            modes_match=false
            break
        fi
    done

    # Check ENVIRONMENTS array
    local expected_envs=("SYSTEM" "LOCAL" "DEV" "STAGING" "PROD")
    local envs_match=true

    for i in "${!expected_envs[@]}"; do
        if [[ "${ENVIRONMENTS[i]}" != "${expected_envs[i]}" ]]; then
            envs_match=false
            break
        fi
    done

    if $modes_match && $envs_match; then
        log_pass "Mode and environment arrays have correct content"
    else
        log_fail "Mode or environment arrays have incorrect content"
    fi
}

# Test 9: TDash with organization switching
test_tdash_org_switching() {
    log_test "TDash behavior with organization switching"

    # Get current org
    local original_org=$(tetra_org active)

    # Switch to test_client org
    if tetra_org switch test_client > /dev/null 2>&1; then
        # Source TDash and test detection
        source "$TETRA_SRC/bash/tdash/tdash_repl.sh"
        detect_active_toml

        if [[ "$ACTIVE_ORG" == "test_client" ]]; then
            log_pass "TDash correctly updates org context after switch"
        else
            log_fail "TDash org context not updated after switch: $ACTIVE_ORG"
        fi

        # Switch back
        tetra_org switch "$original_org" > /dev/null 2>&1
    else
        log_fail "Cannot test org switching - switch to test_client failed"
    fi
}

# Test 10: Color and formatting functions
test_color_formatting() {
    log_test "Color and formatting functions"

    # Source TDash functions
    source "$TETRA_SRC/bash/tdash/tdash_repl.sh"

    # Test color setup
    setup_colors

    local missing_colors=()
    local expected_colors=("RED" "GREEN" "YELLOW" "BLUE" "MAGENTA" "CYAN")

    for color in "${expected_colors[@]}"; do
        if [[ -z "${!color:-}" ]]; then
            missing_colors+=("$color")
        fi
    done

    if [[ ${#missing_colors[@]} -eq 0 ]]; then
        log_pass "Color formatting variables are set"
    else
        log_fail "Missing color variables: ${missing_colors[*]}"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "  $TEST_NAME"
    echo "=========================================="
    echo

    setup_test_environment
    echo

    # Run all tests
    test_tdash_module_loading
    test_tdash_help
    test_toml_detection
    test_organization_context
    test_toml_data_loading
    test_render_functions
    test_navigation_state
    test_mode_environment_arrays
    test_tdash_org_switching
    test_color_formatting

    echo
    echo "=========================================="
    echo "  Test Results"
    echo "=========================================="
    echo "Tests Run:    $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All TDash tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some TDash tests failed!${NC}"
        exit 1
    fi
}

# Run tests
main "$@"