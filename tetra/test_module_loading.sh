#!/usr/bin/env bash

# Test script for Tetra module loading system
# Tests all registered modules for proper loading and basic functionality

# Initialize test results
declare -A test_results
declare -A load_results
test_count=0
pass_count=0
fail_count=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test logging functions
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"

    ((test_count++))
    test_results["$test_name"]="$status"

    if [[ "$status" == "PASS" ]]; then
        echo -e "${GREEN}✓${NC} $test_name: $message"
        ((pass_count++))
    elif [[ "$status" == "FAIL" ]]; then
        echo -e "${RED}✗${NC} $test_name: $message"
        ((fail_count++))
    else
        echo -e "${YELLOW}~${NC} $test_name: $message"
    fi
}

# Test if module can be loaded
test_module_loading() {
    local module_name="$1"
    local loader_path="${TETRA_MODULE_LOADERS[$module_name]}"

    if [[ -z "$loader_path" ]]; then
        log_test "load_$module_name" "FAIL" "Module not registered"
        return 1
    fi

    if [[ ! -d "$loader_path" ]]; then
        log_test "load_$module_name" "FAIL" "Module directory does not exist: $loader_path"
        return 1
    fi

    # Test manual loading
    if [[ -f "$loader_path/includes.sh" ]]; then
        if source "$loader_path/includes.sh" 2>/dev/null; then
            log_test "load_$module_name" "PASS" "Module loaded successfully via includes.sh"
            load_results["$module_name"]="includes.sh"
            return 0
        else
            log_test "load_$module_name" "FAIL" "Failed to source includes.sh"
            return 1
        fi
    elif [[ -f "$loader_path/$(basename "$loader_path").sh" ]]; then
        if source "$loader_path/$(basename "$loader_path").sh" 2>/dev/null; then
            log_test "load_$module_name" "PASS" "Module loaded successfully via main file"
            load_results["$module_name"]="main_file"
            return 0
        else
            log_test "load_$module_name" "FAIL" "Failed to source main file"
            return 1
        fi
    else
        log_test "load_$module_name" "FAIL" "No includes.sh or main file found"
        return 1
    fi
}

# Test lazy loading functionality for specific functions
test_lazy_loading() {
    local func_name="$1"
    local module_name="$2"

    # Check if function exists and is a stub
    if ! declare -f "$func_name" >/dev/null 2>&1; then
        log_test "lazy_$func_name" "FAIL" "Function not defined"
        return 1
    fi

    # Check if it's a lazy loading stub
    if declare -f "$func_name" | grep -q "tetra_load_module"; then
        log_test "lazy_$func_name" "PASS" "Function is lazy loading stub"
        return 0
    else
        log_test "lazy_$func_name" "SKIP" "Function is not lazy loaded (already loaded)"
        return 0
    fi
}

# Test function execution
test_function_execution() {
    local func_name="$1"
    local test_args="$2"

    if ! declare -f "$func_name" >/dev/null 2>&1; then
        log_test "exec_$func_name" "SKIP" "Function not available"
        return 1
    fi

    # Try to execute with help or status argument (safe)
    if $func_name help >/dev/null 2>&1 || $func_name --help >/dev/null 2>&1 || $func_name status >/dev/null 2>&1; then
        log_test "exec_$func_name" "PASS" "Function executes successfully"
        return 0
    else
        log_test "exec_$func_name" "FAIL" "Function execution failed"
        return 1
    fi
}

echo "=== Tetra Module Loading Test Suite ==="
echo

# Source the boot system
echo "Loading boot system..."
source /Users/mricos/src/devops/tetra/bash/boot/boot_core.sh
source /Users/mricos/src/devops/tetra/bash/boot/boot_modules.sh

echo "Found ${#TETRA_MODULE_LOADERS[@]} registered modules"
echo

# Test 1: Module Loading
echo "=== Testing Module Loading ==="
for module_name in $(echo "${!TETRA_MODULE_LOADERS[@]}" | tr ' ' '\n' | sort); do
    test_module_loading "$module_name"
done

echo

# Test 2: Lazy Loading Functions
echo "=== Testing Lazy Loading Functions ==="
lazy_functions=(
    "tsm:tsm"
    "tkm:tkm"
    "pm:pm"
    "hotrod:hotrod"
    "pb:pb"
    "pbvm:pbvm"
    "pico:pico"
    "tro:tro"
    "anthropic:anthropic"
    "echo64:melvin"
)

for func_entry in "${lazy_functions[@]}"; do
    IFS=':' read -r func_name module_name <<< "$func_entry"
    test_lazy_loading "$func_name" "$module_name"
done

echo

# Test 3: Function Execution (safe commands only)
echo "=== Testing Function Execution ==="
test_function_execution "qa" "help"
test_function_execution "tsm" "help"
test_function_execution "tkm" "help"

echo

# Summary
echo "=== Test Summary ==="
echo "Total tests: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"
echo -e "Success rate: $(( pass_count * 100 / test_count ))%"

if [[ $fail_count -gt 0 ]]; then
    echo
    echo "Failed tests:"
    for test_name in "${!test_results[@]}"; do
        if [[ "${test_results[$test_name]}" == "FAIL" ]]; then
            echo "  - $test_name"
        fi
    done
    exit 1
else
    echo "All tests passed!"
    exit 0
fi