#!/bin/bash

# TSM Test Framework
# Reusable setup, teardown, and utility functions for TSM testing
#
# Usage: source this file in your test scripts
# Example:
#   #!/bin/bash
#   source "$(dirname "$0")/tsm-test-framework.sh"
#
#   test_my_feature() {
#       # your test code here
#   }
#
#   main() {
#       tsm_test_setup
#       run_test "My Feature Test" test_my_feature
#       tsm_test_teardown
#   }

# === GLOBAL CONFIGURATION ===

# Default test configuration (can be overridden)
TSM_TEST_BASE_DIR="${TSM_TEST_BASE_DIR:-/tmp}"
TSM_TEST_CLEANUP="${TSM_TEST_CLEANUP:-true}"
TSM_TEST_VERBOSE="${TSM_TEST_VERBOSE:-false}"
TSM_TEST_INTEGRATION="${TSM_TEST_INTEGRATION:-false}"

# Auto-generate unique test directory
TSM_TEST_DIR="$TSM_TEST_BASE_DIR/tsm-test-$$-$(date +%s)"
TSM_TEST_ENV_DIR="$TSM_TEST_DIR/env"
TSM_TEST_SCRIPTS_DIR="$TSM_TEST_DIR/scripts"

# Test counters
TSM_TESTS_RUN=0
TSM_TESTS_PASSED=0
TSM_TESTS_FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# === LOGGING FUNCTIONS ===

tsm_log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

tsm_log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TSM_TESTS_PASSED++))
}

tsm_log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TSM_TESTS_FAILED++))
}

tsm_log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

tsm_log_debug() {
    if [[ "$TSM_TEST_VERBOSE" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

tsm_log_section() {
    echo ""
    echo -e "${PURPLE}=== $1 ===${NC}"
}

# === TEST EXECUTION FRAMEWORK ===

# Run a single test with proper error handling and reporting
run_test() {
    local test_name="$1"
    local test_function="$2"

    ((TSM_TESTS_RUN++))
    tsm_log_info "Test $TSM_TESTS_RUN: $test_name"

    # Create a clean sub-environment for each test
    local test_start_time=$(date +%s)

    if $test_function; then
        local test_end_time=$(date +%s)
        local test_duration=$((test_end_time - test_start_time))
        tsm_log_success "$test_name (${test_duration}s)"
        return 0
    else
        local test_end_time=$(date +%s)
        local test_duration=$((test_end_time - test_start_time))
        tsm_log_failure "$test_name (${test_duration}s)"
        return 1
    fi
}

# === TSM ENVIRONMENT SETUP ===

# Load TSM functions for integration testing
tsm_load_environment() {
    if [[ "$TSM_TEST_INTEGRATION" == "true" ]]; then
        tsm_log_debug "Loading Tetra environment for integration tests"

        # Try multiple ways to load Tetra
        if [[ -f ~/tetra/tetra.sh ]]; then
            source ~/tetra/tetra.sh 2>/dev/null || {
                tsm_log_warning "Failed to load ~/tetra/tetra.sh"
                return 1
            }
        elif [[ -n "$TETRA_DIR" && -f "$TETRA_DIR/tetra.sh" ]]; then
            source "$TETRA_DIR/tetra.sh" 2>/dev/null || {
                tsm_log_warning "Failed to load $TETRA_DIR/tetra.sh"
                return 1
            }
        else
            tsm_log_warning "Could not find Tetra installation"
            return 1
        fi

        tsm_log_debug "Tetra environment loaded successfully"

        # Verify TSM is available
        if ! command -v tsm >/dev/null 2>&1; then
            tsm_log_warning "TSM command not available after loading environment"
            return 1
        fi
    fi

    return 0
}

# === TEST DATA CREATION ===

# Create standard test environment files
create_test_env_files() {
    tsm_log_debug "Creating standard test environment files"

    mkdir -p "$TSM_TEST_ENV_DIR"

    # Standard environment files
    cat > "$TSM_TEST_ENV_DIR/local.env" << 'EOF'
export PORT=4000
export NAME=testapp
export NODE_ENV=development
export DATABASE_URL=sqlite:local.db
EOF

    cat > "$TSM_TEST_ENV_DIR/dev.env" << 'EOF'
export PORT=3000
export NAME=devapp
export NODE_ENV=development
export API_KEY=dev-key-123
EOF

    cat > "$TSM_TEST_ENV_DIR/staging.env" << 'EOF'
export PORT=8080
export NAME=stagingapp
export NODE_ENV=staging
export DATABASE_URL=postgres://staging-db
EOF

    cat > "$TSM_TEST_ENV_DIR/prod.env" << 'EOF'
export PORT=80
export NAME=production
export NODE_ENV=production
export DATABASE_URL=postgres://prod-db
EOF

    # Edge case files
    cat > "$TSM_TEST_ENV_DIR/port-only.env" << 'EOF'
export PORT=3001
export NODE_ENV=test
EOF

    cat > "$TSM_TEST_ENV_DIR/name-only.env" << 'EOF'
export NAME=nameonly
export NODE_ENV=test
EOF

    cat > "$TSM_TEST_ENV_DIR/empty.env" << 'EOF'
export NODE_ENV=test
EOF

    cat > "$TSM_TEST_ENV_DIR/tetra-vars.env" << 'EOF'
export TETRA_PORT=5000
export TETRA_NAME=tetraapp
export NODE_ENV=development
EOF

    # Format test files
    cat > "$TSM_TEST_ENV_DIR/quoted-values.env" << 'EOF'
export PORT="4001"
export NAME='quotedapp'
export NODE_ENV="development"
EOF

    cat > "$TSM_TEST_ENV_DIR/comments.env" << 'EOF'
# Test env file with comments
export PORT=4002  # Main port
export NAME=commentapp  # App name
export NODE_ENV=development
EOF

    tsm_log_debug "Created test env files: local, dev, staging, prod, port-only, name-only, empty, tetra-vars, quoted-values, comments"
}

# Create test script files
create_test_scripts() {
    tsm_log_debug "Creating test script files"

    mkdir -p "$TSM_TEST_SCRIPTS_DIR"

    # Simple test server
    cat > "$TSM_TEST_SCRIPTS_DIR/test-server.js" << 'EOF'
#!/usr/bin/env node
console.log('Test server starting...');
setTimeout(() => {
    console.log('Test server running on port', process.env.PORT || '3000');
    process.exit(0); // Exit after brief run for testing
}, 1000);
EOF
    chmod +x "$TSM_TEST_SCRIPTS_DIR/test-server.js"

    # Simple bash script
    cat > "$TSM_TEST_SCRIPTS_DIR/simple-script.sh" << 'EOF'
#!/bin/bash
echo "Simple script executed with args: $*"
sleep 1
echo "Simple script done"
EOF
    chmod +x "$TSM_TEST_SCRIPTS_DIR/simple-script.sh"

    # Long-running script for lifecycle tests
    cat > "$TSM_TEST_SCRIPTS_DIR/long-running.sh" << 'EOF'
#!/bin/bash
echo "Long-running script starting..."
for i in {1..10}; do
    echo "Iteration $i"
    sleep 1
done
echo "Long-running script done"
EOF
    chmod +x "$TSM_TEST_SCRIPTS_DIR/long-running.sh"

    tsm_log_debug "Created test scripts: test-server.js, simple-script.sh, long-running.sh"
}

# === MAIN SETUP AND TEARDOWN ===

# Main setup function - call this at the beginning of your test suite
tsm_test_setup() {
    local suite_name="${1:-TSM Test Suite}"

    tsm_log_section "$suite_name"
    tsm_log_info "Test Directory: $TSM_TEST_DIR"
    tsm_log_info "Verbose Mode: $TSM_TEST_VERBOSE"
    tsm_log_info "Integration Tests: $TSM_TEST_INTEGRATION"
    tsm_log_info "Cleanup: $TSM_TEST_CLEANUP"
    echo ""

    # Create test directory
    mkdir -p "$TSM_TEST_DIR"

    # Load TSM environment if needed
    if ! tsm_load_environment; then
        if [[ "$TSM_TEST_INTEGRATION" == "true" ]]; then
            tsm_log_warning "Integration tests requested but TSM environment unavailable"
            return 1
        fi
    fi

    # Create standard test data
    create_test_env_files
    create_test_scripts

    # Setup cleanup trap if cleanup is enabled
    if [[ "$TSM_TEST_CLEANUP" == "true" ]]; then
        trap tsm_test_teardown EXIT
    fi

    tsm_log_debug "Test environment setup complete"
    return 0
}

# Main teardown function - call this at the end of your test suite (or use trap)
tsm_test_teardown() {
    if [[ "$TSM_TEST_CLEANUP" == "true" ]]; then
        tsm_log_info "Cleaning up test environment"

        # Kill any test processes
        pkill -f "tsm-test" 2>/dev/null || true

        # Clean up any TSM processes if integration tests were run
        if [[ "$TSM_TEST_INTEGRATION" == "true" ]] && command -v tsm >/dev/null 2>&1; then
            tsm delete "*" 2>/dev/null || true
        fi

        # Remove test directory
        if [[ -d "$TSM_TEST_DIR" ]]; then
            rm -rf "$TSM_TEST_DIR"
            tsm_log_debug "Removed test directory: $TSM_TEST_DIR"
        fi
    else
        tsm_log_info "Skipping cleanup - test files remain in $TSM_TEST_DIR"
    fi
}

# === TEST RESULT REPORTING ===

# Print final test results
tsm_test_results() {
    local suite_name="${1:-Test Results}"

    echo ""
    tsm_log_section "$suite_name"
    echo "Tests Run: $TSM_TESTS_RUN"
    echo "Tests Passed: $TSM_TESTS_PASSED"
    echo "Tests Failed: $TSM_TESTS_FAILED"

    if [[ $TSM_TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}💥 $TSM_TESTS_FAILED test(s) failed!${NC}"
        return 1
    fi
}

# === UTILITY FUNCTIONS ===

# Parse common test arguments
tsm_parse_test_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose|-v)
                TSM_TEST_VERBOSE=true
                shift
                ;;
            --no-cleanup)
                TSM_TEST_CLEANUP=false
                shift
                ;;
            --integration|-i)
                TSM_TEST_INTEGRATION=true
                shift
                ;;
            --help|-h)
                cat << EOF
TSM Test Framework Options:
  --verbose, -v      Enable verbose output
  --no-cleanup       Don't clean up test files after run
  --integration, -i  Enable integration tests (loads TSM environment)
  --help, -h         Show this help message

Environment Variables:
  TSM_TEST_BASE_DIR   Base directory for test files (default: /tmp)
  TSM_TEST_CLEANUP    Enable cleanup (default: true)
  TSM_TEST_VERBOSE    Enable verbose output (default: false)
  TSM_TEST_INTEGRATION Enable integration tests (default: false)
EOF
                exit 0
                ;;
            *)
                tsm_log_warning "Unknown argument: $1"
                shift
                ;;
        esac
    done
}

# Check if we're in a test environment
tsm_is_test_env() {
    [[ -n "$TSM_TEST_DIR" && -d "$TSM_TEST_DIR" ]]
}

# Get current test working directory
tsm_get_test_dir() {
    echo "$TSM_TEST_DIR"
}

# Get test env directory
tsm_get_test_env_dir() {
    echo "$TSM_TEST_ENV_DIR"
}

# Get test scripts directory
tsm_get_test_scripts_dir() {
    echo "$TSM_TEST_SCRIPTS_DIR"
}

tsm_log_info "TSM Test Framework loaded"
tsm_log_debug "Framework version: 1.0"
tsm_log_debug "Available functions: tsm_test_setup, tsm_test_teardown, run_test, tsm_test_results"