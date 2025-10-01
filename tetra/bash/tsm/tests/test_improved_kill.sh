#!/usr/bin/env bash

# Test for improved TSM kill functionality

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
TEST_SCRIPT="$SCRIPT_DIR/test_persistent_server.sh"
TEST_PORT=8889
TEST_NAME="improved-test"

log() {
    echo -e "${BLUE}[IMPROVED]${NC} $1"
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Source TSM functions
source "$SCRIPT_DIR/../include.sh"

cleanup() {
    log "Cleaning up..."
    tsm delete "$TEST_NAME" 2>/dev/null || true
    
    # Kill any lingering processes on test port
    if command -v lsof >/dev/null 2>&1; then
        local pids=$(lsof -iTCP:"$TEST_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            warn "Killing lingering processes on port $TEST_PORT: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    fi
    
    sleep 1
}

test_original_kill() {
    log "Testing ORIGINAL TSM kill behavior..."
    
    # Start test process
    if ! tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        error "Failed to start test process"
        return 1
    fi
    
    sleep 2
    
    local pid=$(tsm list | grep "$TEST_NAME" | awk '{print $4}')
    log "Started process with PID: $pid"
    
    # Show process tree
    log "Process tree before original kill:"
    if command -v pstree >/dev/null 2>&1; then
        pstree -p "$pid" 2>/dev/null || echo "pstree failed"
    fi
    
    # Use original TSM stop
    log "Using original TSM stop..."
    tsm stop "$TEST_NAME"
    
    sleep 2
    
    # Check if process still exists
    if ps -p "$pid" >/dev/null 2>&1; then
        error "ORIGINAL: Process $pid still exists after stop!"
        
        # Show what's still running
        ps -p "$pid" -o pid,ppid,pgid,sid,tty,stat,time,comm,args || true
        
        # Check port
        if command -v lsof >/dev/null 2>&1; then
            lsof -iTCP:"$TEST_PORT" -sTCP:LISTEN || true
        fi
        
        # Manual cleanup
        kill -9 "$pid" 2>/dev/null || true
        return 1
    else
        success "ORIGINAL: Process $pid properly cleaned up"
        return 0
    fi
}

test_improved_kill() {
    log "Testing IMPROVED TSM kill behavior..."
    
    # Start test process
    if ! tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        error "Failed to start test process"
        return 1
    fi
    
    sleep 2
    
    local pid=$(tsm list | grep "$TEST_NAME" | awk '{print $4}')
    log "Started process with PID: $pid"
    
    # Use improved kill function
    log "Using improved kill function..."
    tetra_tsm_stop_single_improved "$TEST_NAME" "false"
    
    sleep 2
    
    # Check if process still exists
    if ps -p "$pid" >/dev/null 2>&1; then
        error "IMPROVED: Process $pid still exists after stop!"
        
        # Show what's still running
        ps -p "$pid" -o pid,ppid,pgid,sid,tty,stat,time,comm,args || true
        
        # Check port
        if command -v lsof >/dev/null 2>&1; then
            lsof -iTCP:"$TEST_PORT" -sTCP:LISTEN || true
        fi
        
        return 1
    else
        success "IMPROVED: Process $pid properly cleaned up"
        return 0
    fi
}

test_comparison() {
    log "Running kill behavior comparison test..."
    
    # Start test process
    if ! tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        error "Failed to start test process"
        return 1
    fi
    
    sleep 2
    
    # Use the comparison function
    tetra_tsm_test_kill_comparison "$TEST_NAME"
}

main() {
    log "Starting Improved Kill Test"
    
    # Setup
    tsm setup
    cleanup
    
    local failed_tests=0
    local total_tests=0
    
    # Test 1: Original behavior
    total_tests=$((total_tests + 1))
    log "=== Test 1: Original Kill Behavior ==="
    if ! test_original_kill; then
        failed_tests=$((failed_tests + 1))
    fi
    cleanup
    
    echo ""
    
    # Test 2: Improved behavior
    total_tests=$((total_tests + 1))
    log "=== Test 2: Improved Kill Behavior ==="
    if ! test_improved_kill; then
        failed_tests=$((failed_tests + 1))
    fi
    cleanup
    
    echo ""
    
    # Test 3: Detailed comparison
    total_tests=$((total_tests + 1))
    log "=== Test 3: Detailed Comparison ==="
    if ! test_comparison; then
        failed_tests=$((failed_tests + 1))
    fi
    cleanup
    
    # Summary
    log "Improved Kill Test Summary:"
    log "Total tests: $total_tests"
    log "Failed tests: $failed_tests"
    log "Passed tests: $((total_tests - failed_tests))"
    
    if [[ $failed_tests -eq 0 ]]; then
        success "All improved kill tests passed!"
        return 0
    else
        error "$failed_tests out of $total_tests tests failed"
        return 1
    fi
}

# Run the test
main "$@"
