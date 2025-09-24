#!/bin/bash

# TSM Environment File Parsing Test Suite
# Focused testing of --env flag handling, PORT/NAME extraction, and env file resolution
#
# Usage: ./test-env-parsing.sh [--verbose] [--no-cleanup] [--integration]

# set -e # Exit on any error (disabled for testing)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="/tmp/tsm-env-test-$$"
TEST_ENV_DIR="$TEST_DIR/env"
VERBOSE=false
CLEANUP=true
INTEGRATION=false

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --integration)
            INTEGRATION=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--verbose] [--no-cleanup] [--integration]"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Test step wrapper
run_test() {
    local test_name="$1"
    local test_function="$2"

    ((TESTS_RUN++))
    log_info "Test $TESTS_RUN: $test_name"

    if $test_function; then
        log_success "$test_name"
        return 0
    else
        log_failure "$test_name"
        return 1
    fi
}

# Setup comprehensive test environment
setup_test_env() {
    log_info "Setting up comprehensive env test environment in $TEST_DIR"

    # Create test directories
    mkdir -p "$TEST_ENV_DIR"
    mkdir -p "$TEST_DIR/project/env"
    mkdir -p "$TEST_DIR/nested/deep/env"

    # === Standard env files ===
    cat > "$TEST_ENV_DIR/local.env" << 'EOF'
export PORT=4000
export NAME=myapp
export NODE_ENV=development
export DATABASE_URL=sqlite:local.db
EOF

    cat > "$TEST_ENV_DIR/dev.env" << 'EOF'
export PORT=3000
export NAME=devapp
export NODE_ENV=development
export API_KEY=dev-key-123
EOF

    cat > "$TEST_ENV_DIR/staging.env" << 'EOF'
export PORT=8080
export NAME=stagingapp
export NODE_ENV=staging
export DATABASE_URL=postgres://staging-db
EOF

    cat > "$TEST_ENV_DIR/prod.env" << 'EOF'
export PORT=80
export NAME=production
export NODE_ENV=production
export DATABASE_URL=postgres://prod-db
EOF

    # === Edge case env files ===
    cat > "$TEST_ENV_DIR/port-only.env" << 'EOF'
export PORT=3001
export NODE_ENV=test
# No NAME defined
EOF

    cat > "$TEST_ENV_DIR/name-only.env" << 'EOF'
export NAME=nameonly
export NODE_ENV=test
# No PORT defined
EOF

    cat > "$TEST_ENV_DIR/empty.env" << 'EOF'
export NODE_ENV=test
# No PORT or NAME defined
EOF

    cat > "$TEST_ENV_DIR/tetra-vars.env" << 'EOF'
export TETRA_PORT=5000
export TETRA_NAME=tetraapp
export NODE_ENV=development
EOF

    cat > "$TEST_ENV_DIR/mixed-vars.env" << 'EOF'
export PORT=6000
export TETRA_PORT=7000
export NAME=mixedapp
export TETRA_NAME=tetramixed
export NODE_ENV=development
EOF

    cat > "$TEST_ENV_DIR/quoted-values.env" << 'EOF'
export PORT="4001"
export NAME='quotedapp'
export NODE_ENV="development"
EOF

    cat > "$TEST_ENV_DIR/comments.env" << 'EOF'
# This is a test env file
export PORT=4002  # Main port
export NAME=commentapp  # App name
export NODE_ENV=development
# End of file
EOF

    cat > "$TEST_ENV_DIR/spaces.env" << 'EOF'
export PORT = 4003
export NAME = spaceapp
export NODE_ENV = development
EOF

    cat > "$TEST_ENV_DIR/invalid-port.env" << 'EOF'
export PORT=not-a-number
export NAME=invalidport
export NODE_ENV=development
EOF

    cat > "$TEST_ENV_DIR/high-port.env" << 'EOF'
export PORT=65535
export NAME=highport
export NODE_ENV=development
EOF

    cat > "$TEST_ENV_DIR/low-port.env" << 'EOF'
export PORT=1023
export NAME=lowport
export NODE_ENV=development
EOF

    # === Alternative file extensions ===
    cat > "$TEST_ENV_DIR/alt.env" << 'EOF'
export PORT=4004
export NAME=altapp
EOF

    cp "$TEST_ENV_DIR/local.env" "$TEST_ENV_DIR/local"  # No .env extension

    # === Nested directory structure ===
    cp "$TEST_ENV_DIR/local.env" "$TEST_DIR/project/env/local.env"
    cp "$TEST_ENV_DIR/dev.env" "$TEST_DIR/nested/deep/env/dev.env"

    # === Absolute path test file ===
    cat > "/tmp/absolute-test-$$.env" << 'EOF'
export PORT=9999
export NAME=absolute
export NODE_ENV=test
EOF

    log_debug "Created comprehensive test environment:"
    log_debug "  Standard files: local.env, dev.env, staging.env, prod.env"
    log_debug "  Edge cases: port-only, name-only, empty, tetra-vars, mixed-vars"
    log_debug "  Format tests: quoted-values, comments, spaces"
    log_debug "  Validation tests: invalid-port, high-port, low-port"
    log_debug "  Alternative files: alt.env, local (no extension)"
    log_debug "  Nested: project/env/local.env, nested/deep/env/dev.env"
    log_debug "  Absolute: /tmp/absolute-test-$$.env"
}

# Cleanup function
cleanup_test_env() {
    if [[ "$CLEANUP" == "true" ]]; then
        log_info "Cleaning up test environment"

        # Kill any test processes that might be running
        pkill -f "tsm-env-test" 2>/dev/null || true

        # Clean up any TSM processes created during testing
        if [[ "$INTEGRATION" == "true" ]]; then
            tsm delete "*" 2>/dev/null || true
        fi

        # Remove test directory
        rm -rf "$TEST_DIR"

        # Remove absolute path test file
        rm -f "/tmp/absolute-test-$$.env"

        log_debug "Cleaned up test environment"
    else
        log_info "Skipping cleanup - test files remain in $TEST_DIR"
    fi
}

# === UNIT TESTS FOR ENV FILE RESOLUTION ===

# Test basic env file resolution patterns
test_env_file_resolution_patterns() {
    log_debug "Testing env file resolution patterns"

    cd "$TEST_DIR"

    # Test all resolution patterns
    local test_cases=(
        "local:$TEST_ENV_DIR/local.env"
        "dev:$TEST_ENV_DIR/dev.env"
        "staging:$TEST_ENV_DIR/staging.env"
        "alt:$TEST_ENV_DIR/alt.env"
    )

    for case in "${test_cases[@]}"; do
        local env_arg="${case%%:*}"
        local expected="${case##*:}"

        log_debug "  Testing resolution: $env_arg → $expected"

        # Simulate TSM env resolution logic
        local resolved=""
        if [[ "$env_arg" != /* ]]; then
            local candidates=(
                "$PWD/env/${env_arg}.env"
                "$PWD/env/$env_arg"
                "$PWD/${env_arg}.env"
                "$PWD/$env_arg"
            )
            for candidate in "${candidates[@]}"; do
                if [[ -f "$candidate" ]]; then
                    resolved="$candidate"
                    break
                fi
            done
        fi

        if [[ "$resolved" == "$expected" ]]; then
            log_debug "    ✅ Resolved correctly: $resolved"
        else
            log_debug "    ❌ Resolution failed. Expected: $expected, Got: $resolved"
            return 1
        fi
    done

    return 0
}

# Test absolute path resolution
test_absolute_path_resolution() {
    log_debug "Testing absolute path resolution"

    local abs_file="/tmp/absolute-test-$$.env"

    # Test absolute path (should use as-is)
    local resolved="$abs_file"
    if [[ -f "$resolved" ]]; then
        log_debug "  ✅ Absolute path resolved: $resolved"
        return 0
    else
        log_debug "  ❌ Absolute path not found: $resolved"
        return 1
    fi
}

# Test nonexistent file handling
test_nonexistent_file_handling() {
    log_debug "Testing nonexistent file handling"

    cd "$TEST_DIR"

    local env_arg="nonexistent"
    local resolved=""

    # Simulate resolution logic
    if [[ "$env_arg" != /* ]]; then
        local candidates=(
            "$PWD/env/${env_arg}.env"
            "$PWD/env/$env_arg"
            "$PWD/${env_arg}.env"
            "$PWD/$env_arg"
        )
        for candidate in "${candidates[@]}"; do
            if [[ -f "$candidate" ]]; then
                resolved="$candidate"
                break
            fi
        done
    fi

    if [[ -z "$resolved" ]]; then
        log_debug "  ✅ Correctly detected nonexistent file"
        return 0
    else
        log_debug "  ❌ Should not have resolved: $resolved"
        return 1
    fi
}

# === UNIT TESTS FOR VARIABLE EXTRACTION ===

# Test standard PORT/NAME extraction
test_standard_variable_extraction() {
    log_debug "Testing standard PORT/NAME extraction"

    local test_cases=(
        "local.env:4000:myapp"
        "dev.env:3000:devapp"
        "staging.env:8080:stagingapp"
        "prod.env:80:production"
    )

    for case in "${test_cases[@]}"; do
        IFS=':' read -r file expected_port expected_name <<< "$case"

        log_debug "  Testing $file → PORT=$expected_port, NAME=$expected_name"

        local port name
        port=$(source "$TEST_ENV_DIR/$file" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
        name=$(source "$TEST_ENV_DIR/$file" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

        if [[ "$port" == "$expected_port" && "$name" == "$expected_name" ]]; then
            log_debug "    ✅ Extraction correct: PORT=$port, NAME=$name"
        else
            log_debug "    ❌ Extraction failed. Expected PORT=$expected_port NAME=$expected_name, Got PORT=$port NAME=$name"
            return 1
        fi
    done

    return 0
}

# Test edge case variable extraction
test_edge_case_variable_extraction() {
    log_debug "Testing edge case variable extraction"

    # Test port-only file
    local port name
    port=$(source "$TEST_ENV_DIR/port-only.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/port-only.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    if [[ "$port" == "3001" && -z "$name" ]]; then
        log_debug "  ✅ Port-only file: PORT=$port, NAME=(empty)"
    else
        log_debug "  ❌ Port-only failed: PORT=$port, NAME=$name"
        return 1
    fi

    # Test name-only file
    port=$(source "$TEST_ENV_DIR/name-only.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/name-only.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    if [[ -z "$port" && "$name" == "nameonly" ]]; then
        log_debug "  ✅ Name-only file: PORT=(empty), NAME=$name"
    else
        log_debug "  ❌ Name-only failed: PORT=$port, NAME=$name"
        return 1
    fi

    # Test empty file
    port=$(source "$TEST_ENV_DIR/empty.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/empty.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    if [[ -z "$port" && -z "$name" ]]; then
        log_debug "  ✅ Empty file: PORT=(empty), NAME=(empty)"
    else
        log_debug "  ❌ Empty file failed: PORT=$port, NAME=$name"
        return 1
    fi

    return 0
}

# Test TETRA_* variable fallbacks
test_tetra_variable_fallbacks() {
    log_debug "Testing TETRA_* variable fallbacks"

    # Test TETRA_PORT and TETRA_NAME
    local port name
    port=$(source "$TEST_ENV_DIR/tetra-vars.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/tetra-vars.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    if [[ "$port" == "5000" && "$name" == "tetraapp" ]]; then
        log_debug "  ✅ TETRA_* variables: PORT=$port, NAME=$name"
    else
        log_debug "  ❌ TETRA_* variables failed: PORT=$port, NAME=$name"
        return 1
    fi

    # Test precedence (PORT should take precedence over TETRA_PORT)
    port=$(source "$TEST_ENV_DIR/mixed-vars.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/mixed-vars.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    if [[ "$port" == "6000" && "$name" == "mixedapp" ]]; then
        log_debug "  ✅ Variable precedence: PORT=$port takes precedence over TETRA_PORT"
    else
        log_debug "  ❌ Variable precedence failed: PORT=$port, NAME=$name"
        return 1
    fi

    return 0
}

# Test quoted values and formatting
test_quoted_values_and_formatting() {
    log_debug "Testing quoted values and formatting"

    # Test quoted values
    local port name
    port=$(source "$TEST_ENV_DIR/quoted-values.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/quoted-values.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    if [[ "$port" == "4001" && "$name" == "quotedapp" ]]; then
        log_debug "  ✅ Quoted values: PORT=$port, NAME=$name"
    else
        log_debug "  ❌ Quoted values failed: PORT=$port, NAME=$name"
        return 1
    fi

    # Test comments (should ignore comments)
    port=$(source "$TEST_ENV_DIR/comments.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/comments.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    if [[ "$port" == "4002" && "$name" == "commentapp" ]]; then
        log_debug "  ✅ Comments ignored: PORT=$port, NAME=$name"
    else
        log_debug "  ❌ Comments handling failed: PORT=$port, NAME=$name"
        return 1
    fi

    return 0
}

# Test port validation scenarios
test_port_validation() {
    log_debug "Testing port validation scenarios"

    # Test invalid port (not a number)
    local port
    port=$(source "$TEST_ENV_DIR/invalid-port.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")

    if [[ "$port" == "not-a-number" ]]; then
        log_debug "  ✅ Invalid port extracted (validation should happen later): $port"
    else
        log_debug "  ❌ Invalid port extraction failed: $port"
        return 1
    fi

    # Test high port (65535 - valid)
    port=$(source "$TEST_ENV_DIR/high-port.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")

    if [[ "$port" == "65535" ]]; then
        log_debug "  ✅ High port (65535): $port"
    else
        log_debug "  ❌ High port failed: $port"
        return 1
    fi

    # Test low port (1023 - might need privileges)
    port=$(source "$TEST_ENV_DIR/low-port.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")

    if [[ "$port" == "1023" ]]; then
        log_debug "  ✅ Low port (1023): $port"
    else
        log_debug "  ❌ Low port failed: $port"
        return 1
    fi

    return 0
}

# === INTEGRATION TESTS (if --integration flag is used) ===

# Test actual TSM start with env files
test_integration_tsm_start_with_env() {
    if [[ "$INTEGRATION" != "true" ]]; then
        log_debug "Skipping integration test (use --integration to enable)"
        return 0
    fi

    log_debug "Testing actual TSM start with env files"

    # Load Tetra environment (which loads TSM)
    source ~/tetra/tetra.sh 2>/dev/null || {
        log_debug "    ❌ Could not load Tetra environment from ~/tetra/tetra.sh"
        return 1
    }

    cd "$TEST_DIR"

    # Test 1: Start with local.env (should extract PORT=4000, NAME=myapp)
    log_debug "  Testing: tsm start --env local echo 'test local'"

    local output
    output=$(tsm start --env local echo 'test local' 2>&1)
    local exit_code=$?

    log_debug "    Exit code: $exit_code"
    log_debug "    Output: $output"

    if [[ $exit_code -eq 0 ]]; then
        log_debug "    ✅ Command succeeded"

        # Check if process was created with correct name (should be myapp-4000)
        if echo "$output" | grep -q "myapp-4000"; then
            log_debug "    ✅ Process name contains 'myapp-4000' (NAME from env)"
        else
            log_debug "    ❌ Process name should contain 'myapp-4000'"
            return 1
        fi
    else
        log_debug "    ❌ Command failed with exit code $exit_code"
        return 1
    fi

    # Clean up the process
    tsm delete "*" 2>/dev/null || true

    return 0
}

# Test TSM start with debug flag
test_integration_debug_output() {
    if [[ "$INTEGRATION" != "true" ]]; then
        log_debug "Skipping integration test (use --integration to enable)"
        return 0
    fi

    log_debug "Testing TSM start with debug flag"

    cd "$TEST_DIR"

    # Test debug output
    log_debug "  Testing: tsm start --env local --debug echo 'debug test'"

    local output
    output=$(tsm start --env local --debug echo 'debug test' 2>&1)
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        # Check if debug output is present
        if echo "$output" | grep -q "TSM Debug Information"; then
            log_debug "    ✅ Debug output found"
        else
            log_debug "    ❌ Debug output missing"
            log_debug "    Output: $output"
            return 1
        fi

        # Check if extracted variables are shown
        if echo "$output" | grep -q "Extracted PORT: 4000" && echo "$output" | grep -q "Extracted NAME: myapp"; then
            log_debug "    ✅ Debug shows extracted variables"
        else
            log_debug "    ❌ Debug missing extracted variables"
            log_debug "    Output: $output"
            return 1
        fi
    else
        log_debug "    ❌ Command failed with exit code $exit_code"
        log_debug "    Output: $output"
        return 1
    fi

    # Clean up
    tsm delete "*" 2>/dev/null || true

    return 0
}

# Main test execution
main() {
    echo -e "${CYAN}=== TSM Environment Parsing Test Suite ===${NC}"
    echo "Test Directory: $TEST_DIR"
    echo "Verbose Mode: $VERBOSE"
    echo "Cleanup: $CLEANUP"
    echo "Integration Tests: $INTEGRATION"
    echo ""

    # Setup
    setup_test_env

    # Trap to ensure cleanup only if cleanup is enabled
    if [[ "$CLEANUP" == "true" ]]; then
        trap cleanup_test_env EXIT
    fi

    # === UNIT TESTS ===
    echo -e "${YELLOW}=== Unit Tests ===${NC}"

    run_test "Environment File Resolution Patterns" test_env_file_resolution_patterns
    run_test "Absolute Path Resolution" test_absolute_path_resolution
    run_test "Nonexistent File Handling" test_nonexistent_file_handling
    run_test "Standard Variable Extraction" test_standard_variable_extraction
    run_test "Edge Case Variable Extraction" test_edge_case_variable_extraction
    run_test "TETRA_* Variable Fallbacks" test_tetra_variable_fallbacks
    run_test "Quoted Values and Formatting" test_quoted_values_and_formatting
    run_test "Port Validation Scenarios" test_port_validation

    # === INTEGRATION TESTS ===
    if [[ "$INTEGRATION" == "true" ]]; then
        echo ""
        echo -e "${YELLOW}=== Integration Tests ===${NC}"

        run_test "TSM Start with Env Files" test_integration_tsm_start_with_env
        run_test "Debug Output Validation" test_integration_debug_output
    fi

    # Manual cleanup if no trap
    if [[ "$CLEANUP" != "true" ]]; then
        cleanup_test_env
    fi

    # Summary
    echo ""
    echo -e "${CYAN}=== Test Results ===${NC}"
    echo "Tests Run: $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}💥 $TESTS_FAILED test(s) failed!${NC}"
        return 1
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi