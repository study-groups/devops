#!/usr/bin/env bash

# Debug test for TSM kill functionality
# This test specifically investigates the issue where TSM kills the process but it's still there

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

TEST_SCRIPT="$(dirname "$0")/test_persistent_server.sh"
TEST_PORT=8889
TEST_NAME="debug-server"

log() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
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

# Get detailed process information
show_process_tree() {
    local pid="$1"
    local description="$2"
    
    log "$description - Process tree for PID $pid:"
    
    if command -v pstree >/dev/null 2>&1; then
        pstree -p "$pid" 2>/dev/null || echo "  pstree failed"
    fi
    
    log "$description - Process details:"
    ps -p "$pid" -o pid,ppid,pgid,sid,tty,stat,time,comm,args 2>/dev/null || echo "  Process $pid not found"
    
    log "$description - Child processes:"
    ps -o pid,ppid,pgid,sid,tty,stat,time,comm,args | grep -E "(PPID|$pid)" || echo "  No child processes found"
    
    log "$description - Process group and session info:"
    ps -eo pid,ppid,pgid,sid,tty,stat,comm | grep -E "(PID|$pid)" || echo "  No process group info found"
}

# Check what's using the port
show_port_usage() {
    local port="$1"
    local description="$2"
    
    log "$description - Port $port usage:"
    
    if command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"$port" -sTCP:LISTEN -P -n || echo "  No processes listening on port $port"
    else
        warn "lsof not available"
    fi
    
    if command -v netstat >/dev/null 2>&1; then
        log "$description - netstat output:"
        netstat -an | grep ":$port " || echo "  No netstat entries for port $port"
    fi
}

# Manual kill test with detailed logging
manual_kill_test() {
    local pid="$1"
    local description="$2"
    
    log "$description - Manual kill test for PID $pid"
    
    # Show initial state
    show_process_tree "$pid" "Before kill"
    show_port_usage "$TEST_PORT" "Before kill"
    
    # Try SIGTERM first
    log "$description - Sending SIGTERM to PID $pid"
    if kill -TERM "$pid" 2>/dev/null; then
        success "SIGTERM sent successfully"
    else
        error "Failed to send SIGTERM"
        return 1
    fi
    
    # Wait and check
    sleep 3
    if ps -p "$pid" >/dev/null 2>&1; then
        warn "Process $pid still alive after SIGTERM, trying SIGKILL"
        show_process_tree "$pid" "After SIGTERM (still alive)"
        
        # Try SIGKILL
        log "$description - Sending SIGKILL to PID $pid"
        if kill -KILL "$pid" 2>/dev/null; then
            success "SIGKILL sent successfully"
        else
            error "Failed to send SIGKILL"
        fi
        
        # Wait and check again
        sleep 1
        if ps -p "$pid" >/dev/null 2>&1; then
            error "Process $pid STILL ALIVE after SIGKILL!"
            show_process_tree "$pid" "After SIGKILL (ZOMBIE?)"
            show_port_usage "$TEST_PORT" "After SIGKILL"
            return 1
        else
            success "Process $pid killed successfully with SIGKILL"
        fi
    else
        success "Process $pid terminated successfully with SIGTERM"
    fi
    
    # Final state check
    show_port_usage "$TEST_PORT" "After kill"
    
    return 0
}

cleanup() {
    log "Cleaning up any existing test processes..."
    tsm delete "$TEST_NAME" 2>/dev/null || true
    
    # Kill any lingering processes on our test port
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
    log "Starting TSM Kill Debug Test"
    log "Test script: $TEST_SCRIPT"
    log "Test port: $TEST_PORT"
    log "Test name: $TEST_NAME"
    
    # Verify test script exists
    if [[ ! -f "$TEST_SCRIPT" ]]; then
        error "Test script not found: $TEST_SCRIPT"
        exit 1
    fi
    
    # Setup and cleanup
    tsm setup
    cleanup
    
    # Start the test process
    log "Starting test process..."
    if ! tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        error "Failed to start test process"
        exit 1
    fi
    
    sleep 2
    
    # Get the PID
    local pid=$(tsm list | grep "$TEST_NAME" | sed 's/│/|/g' | cut -d'|' -f5 | tr -d ' ')
    if [[ -z "$pid" || "$pid" == "-" ]]; then
        error "Could not get PID for test process"
        exit 1
    fi
    
    log "Test process started with PID: $pid"
    
    # Show initial state
    show_process_tree "$pid" "Initial state"
    show_port_usage "$TEST_PORT" "Initial state"
    
    # Test TSM stop
    log "Testing TSM stop..."
    local pid_before_stop="$pid"
    
    if tsm stop "$TEST_NAME"; then
        success "TSM stop command completed"
        
        sleep 2
        
        # Check if process still exists
        if ps -p "$pid_before_stop" >/dev/null 2>&1; then
            error "Process $pid_before_stop still exists after TSM stop!"
            show_process_tree "$pid_before_stop" "After TSM stop (LEAKED)"
            show_port_usage "$TEST_PORT" "After TSM stop (LEAKED)"
            
            # Try manual kill
            manual_kill_test "$pid_before_stop" "Manual cleanup"
        else
            success "Process $pid_before_stop properly cleaned up by TSM stop"
        fi
    else
        error "TSM stop failed"
    fi
    
    # Test TSM kill (delete)
    log "Testing TSM kill (delete)..."
    
    # Start again
    if tsm start "$TEST_SCRIPT" "$TEST_NAME"; then
        sleep 2
        local pid_for_kill=$(tsm list | grep "$TEST_NAME" | sed 's/│/|/g' | cut -d'|' -f5 | tr -d ' ')
        log "Started new process for kill test with PID: $pid_for_kill"
        
        show_process_tree "$pid_for_kill" "Before TSM kill"
        
        if tsm kill "$TEST_NAME"; then
            success "TSM kill command completed"
            
            sleep 2
            
            # Check if process still exists
            if ps -p "$pid_for_kill" >/dev/null 2>&1; then
                error "Process $pid_for_kill still exists after TSM kill!"
                show_process_tree "$pid_for_kill" "After TSM kill (LEAKED)"
                show_port_usage "$TEST_PORT" "After TSM kill (LEAKED)"
                
                # Try manual kill
                manual_kill_test "$pid_for_kill" "Manual cleanup after TSM kill"
            else
                success "Process $pid_for_kill properly cleaned up by TSM kill"
            fi
        else
            error "TSM kill failed"
        fi
    else
        error "Failed to start process for kill test"
    fi
    
    # Final cleanup
    cleanup
    
    log "Kill debug test completed"
}

# Run the test
main "$@"
