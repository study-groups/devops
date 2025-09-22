#!/usr/bin/env bash

# Comprehensive TSM lifecycle test
# Tests: start, stop, restart, kill, and start again

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

# Test configuration
TEST_SCRIPT="$(dirname "$0")/test_nc_server.sh"
TEST_PORT=8888
TEST_NAME="test-server"
WAIT_TIME=2

log() {
    echo -e "${BLUE}[TEST]${NC} $1"
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

# Helper function to wait and check process status
wait_and_check() {
    local expected_status="$1"
    local description="$2"
    
    sleep "$WAIT_TIME"
    
    if tsm list | grep -q "$TEST_NAME"; then
        # Parse the TSM table format - status is between the second and third │ characters
        local actual_status=$(tsm list | grep "$TEST_NAME" | sed 's/│/|/g' | cut -d'|' -f4 | tr -d ' ')
        if [[ "$actual_status" == "$expected_status" ]]; then
            success "$description - Status: $actual_status"
            return 0
        else
            error "$description - Expected: $expected_status, Got: $actual_status"
            return 1
        fi
    else
        if [[ "$expected_status" == "stopped" ]] || [[ "$expected_status" == "deleted" ]]; then
            success "$description - Process not found (as expected)"
            return 0
        else
            error "$description - Process not found in TSM list"
            return 1
        fi
    fi
}

# Helper function to check if port is actually open
check_port() {
    local port="$1"
    local should_be_open="$2"
    
    if command -v lsof >/dev/null 2>&1; then
        if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            if [[ "$should_be_open" == "true" ]]; then
                success "Port $port is open (as expected)"
                return 0
            else
                error "Port $port is open (should be closed)"
                return 1
            fi
        else
            if [[ "$should_be_open" == "false" ]]; then
                success "Port $port is closed (as expected)"
                return 0
            else
                error "Port $port is closed (should be open)"
                return 1
            fi
        fi
    else
        warn "lsof not available, skipping port check"
        return 0
    fi
}

# Helper function to get process PID from TSM
get_tsm_pid() {
    tsm list | grep "$TEST_NAME" | sed 's/│/|/g' | cut -d'|' -f5 | tr -d ' ' | head -1
}

# Helper function to check if PID exists in system
check_pid_exists() {
    local pid="$1"
    if [[ -n "$pid" && "$pid" != "-" ]]; then
        if ps -p "$pid" >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

cleanup() {
    log "Cleaning up any existing test processes..."
    tsm delete "$TEST_NAME" 2>/dev/null || true
    tsm delete "*test*" 2>/dev/null || true
    
    # Kill any lingering nc processes on our test port
    if command -v lsof >/dev/null 2>&1; then
        local pids=$(lsof -iTCP:"$TEST_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            warn "Killing lingering processes on port $TEST_PORT: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    fi
    
    sleep 1
}

main() {
    log "Starting TSM Lifecycle Test"
    log "Test script: $TEST_SCRIPT"
    log "Test port: $TEST_PORT"
    log "Test name: $TEST_NAME"
    
    # Verify test script exists and is executable
    if [[ ! -f "$TEST_SCRIPT" ]]; then
        error "Test script not found: $TEST_SCRIPT"
        exit 1
    fi
    
    if [[ ! -x "$TEST_SCRIPT" ]]; then
        error "Test script not executable: $TEST_SCRIPT"
        exit 1
    fi
    
    # Setup TSM if needed
    log "Setting up TSM..."
    tsm setup
    
    # Initial cleanup
    cleanup
    
    # Test 1: Start process
    log "TEST 1: Starting process..."
    if tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        wait_and_check "online" "Process started successfully"
        check_port "$TEST_PORT" "true"
        
        local pid=$(get_tsm_pid)
        log "Process PID: $pid"
        
        if check_pid_exists "$pid"; then
            success "Process PID $pid exists in system"
        else
            error "Process PID $pid does not exist in system"
        fi
    else
        error "Failed to start process"
        exit 1
    fi
    
    # Test 2: Stop process (graceful)
    log "TEST 2: Stopping process (graceful)..."
    local pid_before_stop=$(get_tsm_pid)
    
    if tsm stop "$TEST_NAME"; then
        wait_and_check "stopped" "Process stopped successfully"
        check_port "$TEST_PORT" "false"
        
        # Check if the original PID still exists
        if check_pid_exists "$pid_before_stop"; then
            error "Process PID $pid_before_stop still exists after stop (ZOMBIE/LEAKED PROCESS)"
            
            # Show process details
            log "Process details:"
            ps -p "$pid_before_stop" -o pid,ppid,pgid,sid,comm,args || true
            
            # Check what's listening on the port
            if command -v lsof >/dev/null 2>&1; then
                log "Port $TEST_PORT listeners:"
                lsof -iTCP:"$TEST_PORT" -sTCP:LISTEN || true
            fi
        else
            success "Process PID $pid_before_stop properly cleaned up"
        fi
    else
        error "Failed to stop process"
    fi
    
    # Test 3: Start again
    log "TEST 3: Starting process again..."
    if tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        wait_and_check "online" "Process restarted successfully"
        check_port "$TEST_PORT" "true"
    else
        error "Failed to restart process"
    fi
    
    # Test 4: Restart process
    log "TEST 4: Restarting process..."
    local pid_before_restart=$(get_tsm_pid)
    
    if tsm restart "$TEST_NAME"; then
        wait_and_check "online" "Process restarted successfully"
        check_port "$TEST_PORT" "true"
        
        local pid_after_restart=$(get_tsm_pid)
        if [[ "$pid_before_restart" != "$pid_after_restart" ]]; then
            success "Process PID changed from $pid_before_restart to $pid_after_restart (proper restart)"
            
            # Check if old PID is cleaned up
            if check_pid_exists "$pid_before_restart"; then
                error "Old process PID $pid_before_restart still exists after restart (LEAKED PROCESS)"
            else
                success "Old process PID $pid_before_restart properly cleaned up"
            fi
        else
            warn "Process PID remained the same after restart: $pid_before_restart"
        fi
    else
        error "Failed to restart process"
    fi
    
    # Test 5: Kill process (force)
    log "TEST 5: Killing process (force)..."
    local pid_before_kill=$(get_tsm_pid)
    
    if tsm kill "$TEST_NAME"; then
        wait_and_check "deleted" "Process killed and deleted successfully"
        check_port "$TEST_PORT" "false"
        
        # Check if the PID still exists
        if check_pid_exists "$pid_before_kill"; then
            error "Process PID $pid_before_kill still exists after kill (ZOMBIE/LEAKED PROCESS)"
            
            # Show process details
            log "Leaked process details:"
            ps -p "$pid_before_kill" -o pid,ppid,pgid,sid,comm,args || true
            
            # Try to force kill it
            warn "Attempting manual cleanup of PID $pid_before_kill"
            kill -9 "$pid_before_kill" 2>/dev/null || true
        else
            success "Process PID $pid_before_kill properly cleaned up"
        fi
    else
        error "Failed to kill process"
    fi
    
    # Test 6: Start final time
    log "TEST 6: Starting process final time..."
    if tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        wait_and_check "online" "Process started final time successfully"
        check_port "$TEST_PORT" "true"
        success "Final start test completed"
    else
        error "Failed to start process final time"
    fi
    
    # Show final status
    log "Final TSM status:"
    tsm list
    
    log "Final port scan:"
    tsm scan-ports
    
    # Final cleanup
    log "Final cleanup..."
    cleanup
    
    success "TSM Lifecycle Test completed!"
}

# Run the test
main "$@"
