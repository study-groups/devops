#!/usr/bin/env bash

# Master test runner for TSM tests

set -e

# Setup environment for TSM
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TETRA_SRC="$(cd "$SCRIPT_DIR/../../.." && pwd)"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"

# Source TSM functions
source "$TETRA_SRC/bash/tsm/tsm.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(dirname "$0")"

log() {
    echo -e "${BLUE}[RUNNER]${NC} $1"
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

run_test() {
    local test_script="$1"
    local test_name="$2"
    
    log "Running test: $test_name"
    echo "----------------------------------------"
    
    if [[ -f "$test_script" && -x "$test_script" ]]; then
        if "$test_script"; then
            success "$test_name completed successfully"
            return 0
        else
            error "$test_name failed"
            return 1
        fi
    else
        error "Test script not found or not executable: $test_script"
        return 1
    fi
}

main() {
    log "Starting TSM Test Suite"
    
    local failed_tests=0
    local total_tests=0
    
    # Test 1: Service Definition Conventions
    total_tests=$((total_tests + 1))
    if ! run_test "$SCRIPT_DIR/test_service_conventions.sh" "Service Definition Conventions"; then
        failed_tests=$((failed_tests + 1))
    fi

    echo ""
    echo "========================================"
    echo ""

    # Test 2: Service Start/Restart Tests
    total_tests=$((total_tests + 1))
    if ! run_test "$SCRIPT_DIR/test_start_restart_services.sh" "Service Start/Restart Tests"; then
        failed_tests=$((failed_tests + 1))
    fi

    echo ""
    echo "========================================"
    echo ""

    # Test 3: Service Definitions (TSM_ENV_FILE integration)
    total_tests=$((total_tests + 1))
    if ! run_test "$SCRIPT_DIR/test_service_definitions.sh" "Service Definitions Integration"; then
        failed_tests=$((failed_tests + 1))
    fi

    echo ""
    echo "========================================"
    echo ""

    # Test 4: Kill Debug Test
    total_tests=$((total_tests + 1))
    if ! run_test "$SCRIPT_DIR/test_kill_debug.sh" "Kill Debug Test"; then
        failed_tests=$((failed_tests + 1))
    fi

    echo ""
    echo "========================================"
    echo ""

    # Test 5: Full Lifecycle Test
    total_tests=$((total_tests + 1))
    if ! run_test "$SCRIPT_DIR/test_lifecycle.sh" "Full Lifecycle Test"; then
        failed_tests=$((failed_tests + 1))
    fi
    
    echo ""
    echo "========================================"
    echo ""
    
    # Summary
    log "Test Suite Summary:"
    log "Total tests: $total_tests"
    log "Failed tests: $failed_tests"
    log "Passed tests: $((total_tests - failed_tests))"
    
    if [[ $failed_tests -eq 0 ]]; then
        success "All tests passed!"
        return 0
    else
        error "$failed_tests out of $total_tests tests failed"
        return 1
    fi
}

# Run the tests
main "$@"
