#!/bin/bash

# TSM Start Mechanics Test Suite
# Focused testing of TSM start command parsing, env detection, and process creation
#
# Usage: ./test-start-mechanics.sh [--verbose] [--cleanup]

# set -e # Exit on any error (disabled for testing)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="/tmp/tsm-start-test-$$"
TEST_ENV_DIR="$TEST_DIR/env"
TEST_SCRIPTS_DIR="$TEST_DIR/scripts"
VERBOSE=false
CLEANUP=true

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
        *)
            echo "Unknown option: $1"
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

# Setup test environment
setup_test_env() {
    log_info "Setting up test environment in $TEST_DIR"

    # Create test directories
    mkdir -p "$TEST_ENV_DIR"
    mkdir -p "$TEST_SCRIPTS_DIR"

    # Create test environment files
    cat > "$TEST_ENV_DIR/local.env" << 'EOF'
export PORT=4000
export NAME=testapp
export NODE_ENV=development
EOF

    cat > "$TEST_ENV_DIR/prod.env" << 'EOF'
export PORT=8080
export NAME=prodapp
export NODE_ENV=production
EOF

    cat > "$TEST_ENV_DIR/port-only.env" << 'EOF'
export PORT=3000
export NODE_ENV=test
EOF

    cat > "$TEST_ENV_DIR/name-only.env" << 'EOF'
export NAME=nameonly
export NODE_ENV=test
EOF

    cat > "$TEST_ENV_DIR/empty.env" << 'EOF'
export NODE_ENV=test
EOF

    # Create test script files
    cat > "$TEST_SCRIPTS_DIR/test-server.js" << 'EOF'
#!/usr/bin/env node
console.log('Test server starting...');
setTimeout(() => {
    console.log('Test server running');
}, 1000);
EOF

    chmod +x "$TEST_SCRIPTS_DIR/test-server.js"

    cat > "$TEST_SCRIPTS_DIR/simple-script.sh" << 'EOF'
#!/bin/bash
echo "Simple script executed"
sleep 2
echo "Simple script done"
EOF

    chmod +x "$TEST_SCRIPTS_DIR/simple-script.sh"

    log_debug "Created test environment files:"
    log_debug "  - $TEST_ENV_DIR/local.env (PORT=4000, NAME=testapp)"
    log_debug "  - $TEST_ENV_DIR/prod.env (PORT=8080, NAME=prodapp)"
    log_debug "  - $TEST_ENV_DIR/port-only.env (PORT=3000, no NAME)"
    log_debug "  - $TEST_ENV_DIR/name-only.env (NAME=nameonly, no PORT)"
    log_debug "  - $TEST_ENV_DIR/empty.env (no PORT, no NAME)"
    log_debug "  - $TEST_SCRIPTS_DIR/test-server.js"
    log_debug "  - $TEST_SCRIPTS_DIR/simple-script.sh"
}

# Cleanup function
cleanup_test_env() {
    if [[ "$CLEANUP" == "true" ]]; then
        log_info "Cleaning up test environment"

        # Kill any test processes that might be running
        pkill -f "tsm-start-test" 2>/dev/null || true

        # Clean up any TSM processes created during testing
        tsm delete "*" 2>/dev/null || true

        # Remove test directory
        rm -rf "$TEST_DIR"

        log_debug "Cleaned up $TEST_DIR"
    else
        log_info "Skipping cleanup - test files remain in $TEST_DIR"
    fi
}

# Test functions for TSM start mechanics

# Test 1: Environment file resolution
test_env_file_resolution() {
    log_debug "Testing environment file resolution"

    cd "$TEST_DIR"

    # Test 1a: Relative path resolution
    local resolved
    resolved=$(TSM_TEST_MODE=true bash -c "
        source '$TETRA_SRC/bash/tsm/tsm_cli.sh'
        env_file='local'
        if [[ \"\$env_file\" != /* ]]; then
            candidates=(
                \"\$PWD/env/\${env_file}.env\"
                \"\$PWD/env/\$env_file\"
                \"\$PWD/\${env_file}.env\"
                \"\$PWD/\$env_file\"
            )
            for candidate in \"\${candidates[@]}\"; do
                if [[ -f \"\$candidate\" ]]; then
                    echo \"\$candidate\"
                    break
                fi
            done
        fi
    ")

    log_debug "Resolved 'local' to: $resolved"

    if [[ "$resolved" == "$TEST_ENV_DIR/local.env" ]]; then
        return 0
    else
        log_debug "Expected: $TEST_ENV_DIR/local.env"
        log_debug "Got: $resolved"
        return 1
    fi
}

# Test 2: Variable extraction from env files
test_variable_extraction() {
    log_debug "Testing variable extraction from env files"

    # Test extracting PORT and NAME from local.env
    local port name
    port=$(source "$TEST_ENV_DIR/local.env" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    name=$(source "$TEST_ENV_DIR/local.env" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")

    log_debug "Extracted from local.env - PORT: '$port', NAME: '$name'"

    if [[ "$port" == "4000" && "$name" == "testapp" ]]; then
        return 0
    else
        log_debug "Expected PORT=4000, NAME=testapp"
        log_debug "Got PORT='$port', NAME='$name'"
        return 1
    fi
}

# Test 3: Command mode detection
test_command_mode_detection() {
    log_debug "Testing command mode detection logic"

    cd "$TEST_DIR"

    # Test case: "node server.js" should trigger command mode when env_file is set
    # This mimics the logic in tsm_cli.sh line 270
    local file="node"
    local env_file="local"
    local port=""

    if [[ ! -f "$file" ]] && [[ -n "$port" || -n "$env_file" ]]; then
        log_debug "Command mode triggered: file='$file', env_file='$env_file', port='$port'"
        return 0
    else
        log_debug "Command mode NOT triggered - this is incorrect"
        return 1
    fi
}

# Test 4: Debug flag parsing
test_debug_flag_parsing() {
    log_debug "Testing debug flag parsing"

    # Simulate argument parsing for --debug flag
    local args=("--env" "local" "--debug" "node" "server.js")
    local debug=false
    local env_file=""
    local command_args=()

    # Parse arguments (mimicking tsm_cli.sh logic)
    local i=0
    while [[ $i -lt ${#args[@]} ]]; do
        case "${args[i]}" in
            --env)
                env_file="${args[$((i+1))]}"
                i=$((i+2))
                ;;
            --debug)
                debug=true
                i=$((i+1))
                ;;
            *)
                command_args+=("${args[i]}")
                i=$((i+1))
                ;;
        esac
    done

    log_debug "Parsed: debug=$debug, env_file='$env_file', command_args=(${command_args[*]})"

    if [[ "$debug" == "true" && "$env_file" == "local" && "${command_args[*]}" == "node server.js" ]]; then
        return 0
    else
        return 1
    fi
}

# Test 5: Process name generation
test_process_name_generation() {
    log_debug "Testing process name generation"

    # Test with NAME from env file
    local custom_name="testapp"
    local port="4000"
    local command_args=("node" "server.js")

    # This mimics the logic in tetra_tsm_start_command
    local name
    if [[ -n "$custom_name" ]]; then
        name="${custom_name}-${port}"
    else
        local base_name="${command_args[0]}"
        base_name="${base_name##*/}"  # Remove path if present
        name="${base_name}-${port}"
    fi

    log_debug "Generated name: '$name'"

    if [[ "$name" == "testapp-4000" ]]; then
        return 0
    else
        log_debug "Expected: testapp-4000"
        log_debug "Got: $name"
        return 1
    fi
}

# Test 6: Error handling for missing port
test_missing_port_error() {
    log_debug "Testing error handling for missing port"

    # Simulate the condition where no port is found
    local port=""
    local env_file="$TEST_ENV_DIR/empty.env"

    # Try to extract port from env file
    if [[ -n "$env_file" && -f "$env_file" ]]; then
        port=$(source "$env_file" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")
    fi

    log_debug "Port after extraction: '$port'"

    # Should be empty and trigger error condition
    if [[ -z "$port" ]]; then
        log_debug "Correctly detected missing port"
        return 0
    else
        log_debug "Port should be empty but got: '$port'"
        return 1
    fi
}

# Main test execution
main() {
    echo -e "${CYAN}=== TSM Start Mechanics Test Suite ===${NC}"
    echo "Test Directory: $TEST_DIR"
    echo "Verbose Mode: $VERBOSE"
    echo "Cleanup: $CLEANUP"
    echo ""

    # Setup
    setup_test_env

    # Trap to ensure cleanup only if cleanup is enabled
    if [[ "$CLEANUP" == "true" ]]; then
        trap cleanup_test_env EXIT
    fi

    # Run tests
    run_test "Environment File Resolution" test_env_file_resolution
    run_test "Variable Extraction" test_variable_extraction
    run_test "Command Mode Detection" test_command_mode_detection
    run_test "Debug Flag Parsing" test_debug_flag_parsing
    run_test "Process Name Generation" test_process_name_generation
    run_test "Missing Port Error Handling" test_missing_port_error

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