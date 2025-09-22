#!/usr/bin/env bash

# Simple test to demonstrate the kill issue and fix

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

log() {
    echo -e "${BLUE}[SIMPLE]${NC} $1"
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

cleanup() {
    log "Cleaning up..."
    tsm delete "*" 2>/dev/null || true
    
    # Kill any lingering processes on test ports
    for port in 8888 8889; do
        if command -v lsof >/dev/null 2>&1; then
            local pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
            if [[ -n "$pids" ]]; then
                warn "Killing lingering processes on port $port: $pids"
                echo "$pids" | xargs kill -9 2>/dev/null || true
            fi
        fi
    done
    
    sleep 1
}

main() {
    log "Simple Kill Test - Demonstrating Process Leak Issue"
    
    # Setup
    tsm setup
    cleanup
    
    # Start a test process
    log "Starting test process..."
    if ! tsm start ./test_nc_server.sh simple-test; then
        error "Failed to start test process"
        exit 1
    fi
    
    sleep 2
    
    # Show initial state
    log "Initial state:"
    tsm list
    
    log "Port 8888 usage:"
    lsof -iTCP:8888 -sTCP:LISTEN || echo "No processes on port 8888"
    
    # Get the main PID
    local main_pid=$(tsm list | grep "simple-test" | sed 's/│/|/g' | cut -d'|' -f5 | tr -d ' ')
    log "Main process PID: $main_pid"
    
    # Show process tree
    log "Process tree:"
    ps -o pid,ppid,pgid,tty,stat,time,comm,args | grep -E "(PID|$main_pid|nc)" || echo "No related processes found"
    
    # Stop the process
    log "Stopping process with TSM..."
    tsm stop simple-test
    
    sleep 2
    
    # Check what's left
    log "After TSM stop:"
    tsm list
    
    log "Port 8888 usage after stop:"
    lsof -iTCP:8888 -sTCP:LISTEN || echo "No processes on port 8888"
    
    # Check if main PID still exists
    if ps -p "$main_pid" >/dev/null 2>&1; then
        error "Main process $main_pid still exists!"
        ps -p "$main_pid" -o pid,ppid,pgid,tty,stat,time,comm,args
    else
        success "Main process $main_pid properly cleaned up"
    fi
    
    # Check for any nc processes
    local nc_pids=$(ps -o pid,ppid,pgid,tty,stat,time,comm,args | grep "nc" | grep -v grep | awk '{print $1}' || true)
    if [[ -n "$nc_pids" ]]; then
        error "Found leaked nc processes: $nc_pids"
        ps -o pid,ppid,pgid,tty,stat,time,comm,args | grep "nc" | grep -v grep
        
        log "These are the leaked processes that TSM failed to clean up!"
        log "This demonstrates the issue you reported."
        
        # Manual cleanup
        warn "Manually cleaning up leaked processes..."
        echo "$nc_pids" | xargs kill -9 2>/dev/null || true
    else
        success "No leaked nc processes found"
    fi
    
    # Final cleanup
    cleanup
    
    log "Simple kill test completed"
}

# Run the test
main "$@"
