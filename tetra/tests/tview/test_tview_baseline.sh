#!/usr/bin/env bash

# TView Baseline Test Framework
# Top-down tests to assess TView module structure, configuration, and metrics

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TVIEW_DIR="$TETRA_SRC_DIR/bash/tview"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test utilities
log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

run_test() {
    ((TESTS_RUN++))
    log_test "$1"
}

# Baseline metrics tests
test_tview_file_count() {
    run_test "TView file count should be stable"

    local expected_files=28
    local actual_files=$(find "$TVIEW_DIR" -name "*.sh" | wc -l)
    local tolerance=3  # Allow some variance for refactoring

    if (( actual_files >= expected_files - tolerance && actual_files <= expected_files + tolerance )); then
        log_pass "TView has $actual_files files (expected ~$expected_files ±$tolerance)"
    else
        log_fail "TView has $actual_files files, expected ~$expected_files ±$tolerance"
    fi
}

test_tview_line_count() {
    run_test "TView total lines should be stable"

    local expected_lines=11165
    local actual_lines=$(find "$TVIEW_DIR" -name "*.sh" -exec wc -l {} + | tail -1 | awk '{print $1}')
    local tolerance=500  # Allow 500 line variance for refactoring

    if (( actual_lines >= expected_lines - tolerance && actual_lines <= expected_lines + tolerance )); then
        log_pass "TView has $actual_lines lines (expected ~$expected_lines ±$tolerance)"
    else
        log_fail "TView has $actual_lines lines, expected ~$expected_lines ±$tolerance"
    fi
}

test_core_modules_exist() {
    run_test "Core TView modules should exist"

    local core_modules=(
        "tview_core.sh"
        "tview_data.sh"
        "tview_render.sh"
        "tview_actions.sh"
        "tview_modes.sh"
        "tview_repl.sh"
        "tview_hooks.sh"
        "tview_layout.sh"
    )

    local missing=()
    for module in "${core_modules[@]}"; do
        if [[ ! -f "$TVIEW_DIR/$module" ]]; then
            missing+=("$module")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "All ${#core_modules[@]} core modules exist"
    else
        log_fail "Missing core modules: ${missing[*]}"
    fi
}

test_configuration_parameters() {
    run_test "Configuration parameter system should be accessible"

    # Test TETRA_DIR environment
    if [[ -n "$TETRA_DIR" ]]; then
        log_pass "TETRA_DIR is set: $TETRA_DIR"
    else
        log_fail "TETRA_DIR environment variable not set"
    fi

    # Test org configuration structure
    local active_org_file="$TETRA_DIR/config/active_org"
    local tetra_config="$TETRA_DIR/config/tetra.toml"

    if [[ -f "$active_org_file" ]]; then
        local active_org=$(cat "$active_org_file" 2>/dev/null)
        if [[ -n "$active_org" ]]; then
            log_pass "Active org configured: $active_org"

            # Test org TOML file exists
            local org_toml="$TETRA_DIR/orgs/$active_org/tetra.toml"
            if [[ -f "$org_toml" ]]; then
                log_pass "Organization TOML exists: $org_toml"
            else
                log_fail "Organization TOML missing: $org_toml"
            fi
        else
            log_fail "Active org file empty: $active_org_file"
        fi
    elif [[ -L "$tetra_config" ]]; then
        log_pass "Legacy symlink configuration detected: $tetra_config"
    else
        log_fail "No active org configuration found (missing $active_org_file and $tetra_config)"
    fi
}

test_toml_structure() {
    run_test "TOML configuration structure should be valid"

    # Find active TOML file
    local toml_file=""

    # Check new active org system
    if [[ -n "$TETRA_DIR" ]]; then
        local active_org_file="$TETRA_DIR/config/active_org"
        if [[ -f "$active_org_file" ]]; then
            local active_org=$(cat "$active_org_file" 2>/dev/null)
            if [[ -n "$active_org" ]]; then
                toml_file="$TETRA_DIR/orgs/$active_org/tetra.toml"
            fi
        fi

        # Fallback to symlink
        if [[ -z "$toml_file" && -L "$TETRA_DIR/config/tetra.toml" ]]; then
            toml_file="$TETRA_DIR/config/tetra.toml"
        fi
    fi

    if [[ -f "$toml_file" ]]; then
        log_pass "TOML file found: $toml_file"

        # Test required sections
        local required_sections=("metadata" "org" "infrastructure" "environments" "services")
        local missing_sections=()

        for section in "${required_sections[@]}"; do
            if ! grep -q "^\[$section\]" "$toml_file"; then
                missing_sections+=("$section")
            fi
        done

        if [[ ${#missing_sections[@]} -eq 0 ]]; then
            log_pass "All required TOML sections present"
        else
            log_warn "Missing TOML sections: ${missing_sections[*]}"
        fi
    else
        log_fail "No active TOML file found"
    fi
}

test_module_dependencies() {
    run_test "Module dependencies should be resolvable"

    # Check for common function definitions
    local common_functions=(
        "detect_active_toml"
        "render_main_interface"
        "handle_keypress"
        "load_environment_data"
    )

    local found_functions=()
    local missing_functions=()

    for func in "${common_functions[@]}"; do
        if grep -r "^$func()" "$TVIEW_DIR" >/dev/null 2>&1; then
            found_functions+=("$func")
        else
            missing_functions+=("$func")
        fi
    done

    if [[ ${#found_functions[@]} -gt 0 ]]; then
        log_pass "Found ${#found_functions[@]} core functions: ${found_functions[*]}"
    fi

    if [[ ${#missing_functions[@]} -gt 0 ]]; then
        log_warn "Missing functions: ${missing_functions[*]}"
    fi
}

test_environment_modes() {
    run_test "Environment×Mode combinations should be defined"

    # Check for mode definitions
    local mode_files=(
        "$TVIEW_DIR/tview_modes.sh"
        "$TVIEW_DIR/content/registry/mode_definitions.sh"
    )

    local modes_found=false
    for file in "${mode_files[@]}"; do
        if [[ -f "$file" ]] && grep -q "MODE_DEFINITIONS" "$file"; then
            modes_found=true
            log_pass "Mode definitions found in $(basename "$file")"
            break
        fi
    done

    if ! $modes_found; then
        log_fail "No mode definitions found"
    fi

    # Check for environment detection
    if grep -r "ENVIRONMENTS\|detect.*environment" "$TVIEW_DIR" >/dev/null 2>&1; then
        log_pass "Environment detection logic present"
    else
        log_warn "Environment detection logic not found"
    fi
}

# Run all tests
main() {
    echo -e "${BLUE}=== TView Baseline Test Suite ===${NC}"
    echo "Testing TView codebase structure and configuration"
    echo

    test_tview_file_count
    test_tview_line_count
    test_core_modules_exist
    test_configuration_parameters
    test_toml_structure
    test_module_dependencies
    test_environment_modes

    echo
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Tests run: $TESTS_RUN"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed.${NC}"
        exit 1
    fi
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi