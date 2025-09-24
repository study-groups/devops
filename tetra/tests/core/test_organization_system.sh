#!/usr/bin/env bash

# Test Organization Management System after TETRA_DIR reorganization
# Tests the complete org system with new paths and structure

set -euo pipefail

# Test configuration
TEST_NAME="Organization System Tests"
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
    log_info "Setting up test environment..."

    # Source tetra
    if [[ -f "$HOME/tetra/tetra.sh" ]]; then
        source "$HOME/tetra/tetra.sh"
    else
        log_fail "Cannot find tetra.sh"
        exit 1
    fi

    # Load required modules
    tmod load org > /dev/null 2>&1 || {
        log_fail "Failed to load org module"
        exit 1
    }

    log_info "Test environment ready"
}

# Test 1: TETRA_DIR structure validation
test_tetra_dir_structure() {
    log_test "TETRA_DIR structure validation"

    local expected_dirs=("config" "orgs" "modules" "services" "env")
    local missing_dirs=()

    # Check if tetra.sh is the only root file
    local root_files=($(find "$TETRA_DIR" -maxdepth 1 -type f))
    if [[ ${#root_files[@]} -ne 1 ]] || [[ "$(basename "${root_files[0]}")" != "tetra.sh" ]]; then
        log_fail "tetra.sh should be the only root file, found: ${root_files[*]}"
        return
    fi

    # Check expected directories exist
    for dir in "${expected_dirs[@]}"; do
        if [[ ! -d "$TETRA_DIR/$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done

    if [[ ${#missing_dirs[@]} -eq 0 ]]; then
        log_pass "TETRA_DIR structure is correct"
    else
        log_fail "Missing directories: ${missing_dirs[*]}"
    fi
}

# Test 2: Active TOML location
test_active_toml_location() {
    log_test "Active TOML location validation"

    local config_toml="$TETRA_DIR/config/tetra.toml"

    if [[ -L "$config_toml" ]]; then
        local target=$(readlink "$config_toml")
        if [[ -f "$target" ]]; then
            log_pass "Active TOML symlink correctly points to: $target"
        else
            log_fail "Active TOML symlink points to non-existent file: $target"
        fi
    else
        log_fail "Active TOML not found at: $config_toml"
    fi
}

# Test 3: Organization listing
test_org_list() {
    log_test "Organization listing functionality"

    local output=$(tetra_org list 2>&1)

    if echo "$output" | grep -q "Tetra Organizations:" &&
       echo "$output" | grep -q "pixeljam_arcade"; then
        log_pass "Organization listing works correctly"
    else
        log_fail "Organization listing failed or missing expected content"
    fi
}

# Test 4: Active organization detection
test_org_active() {
    log_test "Active organization detection"

    local active_org=$(tetra_org active 2>&1)

    if [[ -n "$active_org" && "$active_org" != "none" ]]; then
        log_pass "Active organization detected: $active_org"
    else
        log_fail "Failed to detect active organization"
    fi
}

# Test 5: Organization switching
test_org_switching() {
    log_test "Organization switching functionality"

    # Get current active org
    local original_org=$(tetra_org active)

    # Test switching to test_client (should exist from previous setup)
    if tetra_org switch test_client > /dev/null 2>&1; then
        local new_active=$(tetra_org active)
        if [[ "$new_active" == "test_client" ]]; then
            log_pass "Successfully switched to test_client"

            # Switch back to original
            if tetra_org switch "$original_org" > /dev/null 2>&1; then
                log_pass "Successfully switched back to $original_org"
            else
                log_fail "Failed to switch back to original org: $original_org"
            fi
        else
            log_fail "Org switch didn't take effect, still: $new_active"
        fi
    else
        log_fail "Failed to switch to test_client organization"
    fi
}

# Test 6: Organization creation
test_org_creation() {
    log_test "Organization creation functionality"

    local test_org_name="test_org_$$"

    if tetra_org create "$test_org_name" > /dev/null 2>&1; then
        # Check if org directory was created
        if [[ -d "$TETRA_DIR/orgs/$test_org_name" ]]; then
            # Check if TOML file was created
            if [[ -f "$TETRA_DIR/orgs/$test_org_name/${test_org_name}.toml" ]]; then
                log_pass "Organization creation successful"

                # Clean up test org
                rm -rf "$TETRA_DIR/orgs/$test_org_name"
            else
                log_fail "Organization TOML file not created"
            fi
        else
            log_fail "Organization directory not created"
        fi
    else
        log_fail "Organization creation command failed"
    fi
}

# Test 7: Symlink integrity
test_symlink_integrity() {
    log_test "Organization symlink integrity"

    local config_toml="$TETRA_DIR/config/tetra.toml"
    local original_org=$(tetra_org active)

    # Test switching and verify symlink updates
    if tetra_org switch test_client > /dev/null 2>&1; then
        local new_target=$(readlink "$config_toml")
        if echo "$new_target" | grep -q "test_client"; then
            log_pass "Symlink updates correctly on org switch"

            # Switch back
            tetra_org switch "$original_org" > /dev/null 2>&1
        else
            log_fail "Symlink not updated after org switch"
            tetra_org switch "$original_org" > /dev/null 2>&1
        fi
    else
        log_fail "Cannot test symlink integrity - org switch failed"
    fi
}

# Test 8: Module data location
test_module_data_location() {
    log_test "Module data location validation"

    local expected_modules=("tsm" "rag" "utils" "nvm")
    local missing_modules=()

    for module in "${expected_modules[@]}"; do
        if [[ ! -d "$TETRA_DIR/modules/$module" ]]; then
            missing_modules+=("$module")
        fi
    done

    if [[ ${#missing_modules[@]} -eq 0 ]]; then
        log_pass "All expected modules found in modules directory"
    else
        log_fail "Missing modules in modules directory: ${missing_modules[*]}"
    fi
}

# Test 9: Config directory structure
test_config_directory() {
    log_test "Config directory structure validation"

    local config_dir="$TETRA_DIR/config"
    local expected_items=("modules.conf" "tetra.toml" "tetra")
    local missing_items=()

    for item in "${expected_items[@]}"; do
        if [[ ! -e "$config_dir/$item" ]]; then
            missing_items+=("$item")
        fi
    done

    # Check tetra subdirectory has expected structure
    if [[ -d "$config_dir/tetra" ]]; then
        local tetra_subdirs=("config" "history" "logs")
        for subdir in "${tetra_subdirs[@]}"; do
            if [[ ! -d "$config_dir/tetra/$subdir" ]]; then
                missing_items+=("tetra/$subdir")
            fi
        done
    fi

    if [[ ${#missing_items[@]} -eq 0 ]]; then
        log_pass "Config directory structure is correct"
    else
        log_fail "Missing items in config directory: ${missing_items[*]}"
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
    test_tetra_dir_structure
    test_active_toml_location
    test_org_list
    test_org_active
    test_org_switching
    test_org_creation
    test_symlink_integrity
    test_module_data_location
    test_config_directory

    echo
    echo "=========================================="
    echo "  Test Results"
    echo "=========================================="
    echo "Tests Run:    $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    fi
}

# Run tests
main "$@"