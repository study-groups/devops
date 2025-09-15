#!/usr/bin/env bash

# Comprehensive test suite for Tetra Module System
# Tests loading, unloading, lazy loading, and error conditions

# Test configuration
TETRA_DEBUG_LOADING=false
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
total_tests=0
passed_tests=0
failed_tests=0

# Test logging
test_assert() {
    local condition="$1"
    local test_name="$2"
    local error_msg="${3:-Test failed}"

    ((total_tests++))

    if [[ "$condition" == "true" ]]; then
        echo -e "${GREEN}✓${NC} $test_name"
        ((passed_tests++))
    else
        echo -e "${RED}✗${NC} $test_name: $error_msg"
        ((failed_tests++))
    fi
}

# Test setup
setup_tests() {
    echo "=== Tetra Module System Test Suite ==="
    echo "Setting up test environment..."

    # Source boot system
    source /Users/mricos/src/devops/tetra/bash/boot/boot_core.sh 2>/dev/null
    source /Users/mricos/src/devops/tetra/bash/boot/boot_modules.sh 2>/dev/null

    echo "Loaded ${#TETRA_MODULE_LOADERS[@]} modules"
    echo
}

# Test 1: Core Functions Exist
test_core_functions() {
    echo "=== Testing Core Module Functions ==="

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
    echo "=== Testing Module Registration ==="

    # Test registering a new module
    local test_module_path="/tmp/test_module"
    tetra_register_module "test_module" "$test_module_path"

    test_assert "$(echo "${TETRA_MODULE_LOADERS[test_module]}" | grep -q "$test_module_path" && echo true || echo false)" \
        "Module registration works"

    test_assert "$(echo "${TETRA_MODULE_LOADED[test_module]}" | grep -q "false" && echo true || echo false)" \
        "Newly registered module marked as unloaded"

    echo
}

# Test 3: Essential Modules
test_essential_modules() {
    echo "=== Testing Essential Modules ==="

    local essential_modules=("utils" "prompt" "tmod" "qa")

    for module in "${essential_modules[@]}"; do
        test_assert "$(echo "${TETRA_MODULE_LOADED[$module]}" | grep -q "true" && echo true || echo false)" \
            "Essential module $module is loaded"
    done

    echo
}

# Test 4: Lazy Loading Functions
test_lazy_loading() {
    echo "=== Testing Lazy Loading ==="

    # Test that lazy functions exist and are stubs
    local lazy_functions=("tsm" "tkm" "pm")

    for func in "${lazy_functions[@]}"; do
        if declare -f "$func" >/dev/null 2>&1; then
            if declare -f "$func" | grep -q "tetra_load_module"; then
                test_assert "true" "Function $func is lazy loading stub"
            else
                test_assert "false" "Function $func exists but is not lazy" "Function already loaded"
            fi
        else
            test_assert "false" "Function $func does not exist"
        fi
    done

    echo
}

# Test 5: Module Loading and Unloading
test_load_unload() {
    echo "=== Testing Module Load/Unload ==="

    # Test loading a module that exists
    local test_module="tsm"

    # Ensure it starts unloaded
    tetra_unload_module "$test_module" >/dev/null 2>&1

    test_assert "$(echo "${TETRA_MODULE_LOADED[$test_module]}" | grep -q "false" && echo true || echo false)" \
        "Module $test_module can be unloaded"

    # Test loading
    if tetra_load_module "$test_module" >/dev/null 2>&1; then
        test_assert "true" "Module $test_module can be loaded"

        test_assert "$(echo "${TETRA_MODULE_LOADED[$test_module]}" | grep -q "true" && echo true || echo false)" \
            "Module $test_module marked as loaded after loading"
    else
        test_assert "false" "Module $test_module failed to load"
    fi

    echo
}

# Test 6: Function Execution After Lazy Loading
test_function_execution() {
    echo "=== Testing Function Execution ==="

    # Test qa function (should be loaded)
    if qa help >/dev/null 2>&1; then
        test_assert "true" "qa function executes successfully"
    else
        test_assert "false" "qa function execution failed"
    fi

    # Test tsm function (lazy loaded)
    if tsm help >/dev/null 2>&1; then
        test_assert "true" "tsm function executes successfully (lazy loaded)"
    else
        test_assert "false" "tsm function execution failed"
    fi

    echo
}

# Test 7: Error Conditions
test_error_conditions() {
    echo "=== Testing Error Conditions ==="

    # Test loading non-existent module
    if tetra_load_module "nonexistent_module" >/dev/null 2>&1; then
        test_assert "false" "Loading non-existent module should fail"
    else
        test_assert "true" "Loading non-existent module fails correctly"
    fi

    # Test unloading non-loaded module
    if tetra_unload_module "anthropic" >/dev/null 2>&1; then
        test_assert "false" "Unloading non-loaded module should fail"
    else
        test_assert "true" "Unloading non-loaded module fails correctly"
    fi

    echo
}

# Test Summary
print_summary() {
    echo "=== Test Summary ==="
    echo "Total tests: $total_tests"
    echo -e "Passed: ${GREEN}$passed_tests${NC}"
    echo -e "Failed: ${RED}$failed_tests${NC}"

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
    test_load_unload
    test_function_execution
    test_error_conditions
    print_summary
}

main "$@"