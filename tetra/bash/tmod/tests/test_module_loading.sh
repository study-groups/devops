#!/usr/bin/env bash

# tmod Module Loading Tests

# Source test helpers and tmod core
TMOD_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$TMOD_TEST_DIR/test_helpers.sh"

# Declare associative array for module loading tracking
declare -A TETRA_MODULE_LOADED

# Mock functions for missing module loading utilities
tetra_register_dev_modules() {
    echo "Registering development modules"
}

tetra_smart_load_module() {
    local module="$1"
    local dev_flag="$2"
    
    if [[ -z "$module" ]]; then
        echo "Error: No module specified" >&2
        return 1
    fi
    
    # Simulate dev flag registration
    if [[ "$dev_flag" == "-dev" ]]; then
        tetra_register_dev_modules
    fi
    
    # Predefined list of valid modules for testing
    local valid_modules=("git" "rag" "python" "nvm" "tsm")
    local module_found=false
    
    for valid_module in "${valid_modules[@]}"; do
        if [[ "$module" == "$valid_module" ]]; then
            module_found=true
            break
        fi
    done
    
    if [[ "$module_found" == "false" ]]; then
        echo "Module not found: $module" >&2
        return 1
    fi
    
    echo "Auto-registering module: $module"
    # Call the mock tetra_load_module to properly set the state
    tetra_load_module "$module"
    return 0
}

tetra_load_module() {
    local module="$1"
    
    if [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
        return 0  # Already loaded
    fi
    
    # For testing, just mark as loaded without actually sourcing files
    TETRA_MODULE_LOADED["$module"]="true"
    return 0
}

# Override the sourced function with our mock
override_module_loading_functions() {
    # Temporarily replace the sourced functions with our mocks
    eval "$(declare -f tetra_smart_load_module)"
    eval "$(declare -f tetra_register_dev_modules)"
    eval "$(declare -f tetra_load_module)"
}

# Source tetra environment and tmod core
source "$TETRA_SRC/bash/tetra_env.sh"
source "$TETRA_SRC/bash/tmod/tmod_core.sh"

# Override functions after sourcing - must be done after all sourcing
# to ensure our mocks take precedence over the real functions
override_module_loading_functions

# Export the array so it's available to subshells
export TETRA_MODULE_LOADED

# Test loading an existing module
test_load_existing_module() {
    local module="git"
    
    # Ensure module is not already loaded
    if [[ "${TETRA_MODULE_LOADED[$module]}" == "true" ]]; then
        echo "Module $module already loaded, skipping test"
        return 0
    fi
    
    # Capture output of module loading to a temp file to avoid subshell issues
    local temp_output=$(mktemp)
    tmod_load_module "$module" > "$temp_output" 2>&1
    local exit_code=$?
    local output=$(cat "$temp_output")
    rm "$temp_output"
    
    # Check if loading was successful
    assert_success $exit_code "Module $module should load successfully"
    assert_contains "$output" "Auto-registering module: $module" "Should auto-register module"
    
    # Verify module is now considered loaded
    assert_true "[[ '${TETRA_MODULE_LOADED[$module]}' == 'true' ]]" \
        "Module $module should be marked as loaded"
}

# Test loading a non-existent module
test_load_nonexistent_module() {
    local module="nonexistent_module_xyz"
    
    # Capture output of module loading to a temp file
    local temp_output=$(mktemp)
    tmod_load_module "$module" > "$temp_output" 2>&1
    local exit_code=$?
    local output=$(cat "$temp_output")
    rm "$temp_output"
    
    # Check if loading failed
    assert_failure $exit_code "Non-existent module should fail to load"
    assert_contains "$output" "Module not found: $module" "Should show module not found error"
}

# Test loading a module with dev flag
test_load_module_with_dev_flag() {
    local module="rag"
    
    # Capture output of module loading with dev flag to a temp file
    local temp_output=$(mktemp)
    tmod_load_module "$module" "-dev" > "$temp_output" 2>&1
    local exit_code=$?
    local output=$(cat "$temp_output")
    rm "$temp_output"
    
    # Check if loading was successful
    assert_success $exit_code "Module $module with dev flag should load successfully"
    # Our mock tetra_register_dev_modules outputs this text
    assert_contains "$output" "Registering development modules" "Should register dev modules"
    # Our mock tetra_smart_load_module outputs this text
    assert_contains "$output" "Auto-registering module: $module" "Should auto-register module"
}

# Run all tests
run_tests() {
    # Reset module loading state before tests
    TETRA_MODULE_LOADED=()
    
    test_load_existing_module
    test_load_nonexistent_module
    test_load_module_with_dev_flag
}

# Execute tests
run_tests
