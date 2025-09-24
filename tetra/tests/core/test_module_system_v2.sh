#!/usr/bin/env bash

# Comprehensive test suite for Tetra Module System
# Tests loading, unloading, lazy loading, and error conditions

# Detect TETRA_SRC dynamically
if [[ -z "$TETRA_SRC" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    export TETRA_SRC="$(dirname "$SCRIPT_DIR")"
fi

# Test configuration
TETRA_DEBUG_LOADING=false
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
total_tests=0
passed_tests=0
failed_tests=0
skipped_tests=0

# Test logging
test_assert() {
    local condition="$1"
    local test_name="$2"
    local error_msg="${3:-Test failed}"

    ((total_tests++))

    case "$condition" in
        "true")
            echo -e "${GREEN}✓${NC} $test_name"
            ((passed_tests++))
            ;;
        "skip")
            echo -e "${YELLOW}~${NC} $test_name: $error_msg"
            ((skipped_tests++))
            ;;
        *)
            echo -e "${RED}✗${NC} $test_name: $error_msg"
            ((failed_tests++))
            ;;
    esac
}

# Test setup
setup_tests() {
    echo -e "${BLUE}=== Tetra Module System Test Suite ===${NC}"
    echo "TETRA_SRC: $TETRA_SRC"
    echo "Setting up test environment..."

    # Verify TETRA_SRC exists
    if [[ ! -d "$TETRA_SRC/bash/boot" ]]; then
        echo -e "${RED}Error: Cannot find Tetra boot system at $TETRA_SRC/bash/boot${NC}"
        exit 1
    fi

    # Source boot system with error handling
    if ! source "$TETRA_SRC/bash/boot/boot_core.sh" 2>/dev/null; then
        echo -e "${RED}Error: Failed to load boot_core.sh${NC}"
        exit 1
    fi

    if ! source "$TETRA_SRC/bash/boot/boot_modules.sh" 2>/dev/null; then
        echo -e "${RED}Error: Failed to load boot_modules.sh${NC}"
        exit 1
    fi

    echo "Loaded ${#TETRA_MODULE_LOADERS[@]} modules"
    echo
}

# Test 1: Core Functions Exist
test_core_functions() {
    echo -e "${BLUE}=== Testing Core Module Functions ===${NC}"

    test_assert "$(declare -f tetra_register_module >/dev/null 2>&1 && echo true || echo false)" \
        "tetra_register_module function exists"

    test_assert "$(declare -f tetra_load_module >/dev/null 2>&1 && echo true || echo false)" \
        "tetra_load_module function exists"

    test_assert "$(declare -f tetra_unload_module >/dev/null 2>&1 && echo true || echo false)" \
        "tetra_unload_module function exists"

    test_assert "$(declare -f tetra_create_lazy_function >/dev/null 2>&1 && echo true || echo false)" \
        "tetra_create_lazy_function function exists"

    test_assert "$(declare -f tetra_list_modules >/dev/null 2>&1 && echo true || echo false)" \
        "tetra_list_modules function exists"

    echo
}

# Test 2: Module Registration
test_module_registration() {
    echo -e "${BLUE}=== Testing Module Registration ===${NC}"

    # Test registering a new module
    local test_module_path="/tmp/test_module_$$"
    mkdir -p "$test_module_path"
    echo "# Test module" > "$test_module_path/includes.sh"

    tetra_register_module "test_module_$$" "$test_module_path"

    test_assert "$(echo "${TETRA_MODULE_LOADERS[test_module_$$]}" | grep -q "$test_module_path" && echo true || echo false)" \
        "Module registration works"

    # Cleanup
    rm -rf "$test_module_path"
    echo
}

# Test 3: Essential Modules
test_essential_modules() {
    echo -e "${BLUE}=== Testing Essential Modules ===${NC}"

    local essential_modules=("utils" "prompt" "tmod" "qa")

    for module in "${essential_modules[@]}"; do
        # Check if module is registered
        if [[ -n "${TETRA_MODULE_LOADERS[$module]}" ]]; then
            test_assert "true" "Essential module $module is registered"

            # Check if module directory exists
            local module_path="${TETRA_MODULE_LOADERS[$module]}"
            if [[ -d "$module_path" ]]; then
                test_assert "true" "Essential module $module directory exists: $module_path"
            else
                test_assert "false" "Essential module $module directory missing" "$module_path"
            fi
        else
            test_assert "false" "Essential module $module not registered"
        fi
    done

    echo
}

# Test 4: Lazy Loading Functions
test_lazy_loading() {
    echo -e "${BLUE}=== Testing Lazy Loading ===${NC}"

    # Test that lazy functions exist and are stubs
    local lazy_functions=("tsm" "tkm" "pm")

    for func in "${lazy_functions[@]}"; do
        if declare -f "$func" >/dev/null 2>&1; then
            if declare -f "$func" | grep -q "tetra_load_module"; then
                test_assert "true" "Function $func is lazy loading stub"
            else
                test_assert "skip" "Function $func exists but is not lazy" "Function already loaded"
            fi
        else
            test_assert "false" "Function $func does not exist"
        fi
    done

    echo
}

# Test 5: Module Loading
test_module_loading() {
    echo -e "${BLUE}=== Testing Module Loading ===${NC}"

    # Test loading a few known modules
    local test_modules=("tsm" "tkm")

    for test_module in "${test_modules[@]}"; do
        # Check if module is registered
        if [[ -z "${TETRA_MODULE_LOADERS[$test_module]}" ]]; then
            test_assert "skip" "Module $test_module not registered" "Skipping load test"
            continue
        fi

        # Test loading with output suppression
        local temp_output=$(mktemp)
        if tetra_load_module "$test_module" >"$temp_output" 2>&1; then
            test_assert "true" "Module $test_module loads without errors"
        else
            test_assert "false" "Module $test_module failed to load" "$(cat "$temp_output")"
        fi
        rm -f "$temp_output"
    done

    echo
}

# Test 6: Function Execution
test_function_execution() {
    echo -e "${BLUE}=== Testing Function Execution ===${NC}"

    # Test functions with safe commands
    local test_functions=("qa" "tmod")

    for func in "${test_functions[@]}"; do
        if declare -f "$func" >/dev/null 2>&1; then
            local temp_output=$(mktemp)
            if $func help >"$temp_output" 2>&1 || $func --help >"$temp_output" 2>&1; then
                test_assert "true" "Function $func executes successfully"
            else
                test_assert "false" "Function $func execution failed" "$(head -1 "$temp_output")"
            fi
            rm -f "$temp_output"
        else
            test_assert "skip" "Function $func not available" "Cannot test execution"
        fi
    done

    echo
}

# Test 7: Error Conditions
test_error_conditions() {
    echo -e "${BLUE}=== Testing Error Conditions ===${NC}"

    # Test loading non-existent module
    local temp_output=$(mktemp)
    if tetra_load_module "nonexistent_module_$$" >"$temp_output" 2>&1; then
        test_assert "false" "Loading non-existent module should fail"
    else
        test_assert "true" "Loading non-existent module fails correctly"
    fi
    rm -f "$temp_output"

    echo
}

# Test Summary
print_summary() {
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total tests: $total_tests"
    echo -e "Passed: ${GREEN}$passed_tests${NC}"
    echo -e "Failed: ${RED}$failed_tests${NC}"
    echo -e "Skipped: ${YELLOW}$skipped_tests${NC}"

    if [[ $failed_tests -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        return 0
    else
        local success_rate=$((passed_tests * 100 / total_tests))
        echo -e "Success rate: ${YELLOW}${success_rate}%${NC}"
        return 1
    fi
}

# Run all tests
main() {
    setup_tests
    test_core_functions
    test_module_registration
    test_essential_modules
    test_lazy_loading
    test_module_loading
    test_function_execution
    test_error_conditions
    print_summary
}

main "$@"