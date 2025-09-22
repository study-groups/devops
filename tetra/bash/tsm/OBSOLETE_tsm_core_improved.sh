#!/usr/bin/env bash

# Improved TSM core functions with better process killing
# This file contains fixes for the process killing issues

# Improved stop function that handles process groups and child processes
tetra_tsm_stop_single_improved() {
    local name="$1"
    local force="${2:-false}"
    local pidfile="$TETRA_DIR/tsm/pids/$name.pid"
    
    if ! tetra_tsm_is_running "$name"; then
        echo "tsm: process '$name' not running"
        return 1
    fi
    
    local pid=$(cat "$pidfile")
    
    echo "tsm: stopping process '$name' (PID: $pid)"
    
    # Get process group ID
    local pgid=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
    else
        pgid=$(ps -p "$pid" -o pgid --no-headers 2>/dev/null | tr -d ' ')
    fi
    
    echo "tsm: process group ID: $pgid"
    
    if [[ "$force" == "true" ]]; then
        echo "tsm: force killing process and group..."
        
        # Kill the entire process group with SIGKILL
        if [[ -n "$pgid" && "$pgid" != "$pid" ]]; then
            kill -KILL -"$pgid" 2>/dev/null || true
            echo "tsm: sent SIGKILL to process group $pgid"
        fi
        
        # Also kill the main process directly
        kill -KILL "$pid" 2>/dev/null || true
        echo "tsm: sent SIGKILL to main process $pid"
        
    else
        echo "tsm: graceful shutdown..."
        
        # First try SIGTERM to the entire process group
        if [[ -n "$pgid" && "$pgid" != "$pid" ]]; then
            kill -TERM -"$pgid" 2>/dev/null || true
            echo "tsm: sent SIGTERM to process group $pgid"
        fi
        
        # Also send SIGTERM to main process
        kill -TERM "$pid" 2>/dev/null || true
        echo "tsm: sent SIGTERM to main process $pid"
        
        # Wait for graceful shutdown
        local wait_count=0
        local max_wait=10  # Increased from 3 to 10 seconds
        
        while [[ $wait_count -lt $max_wait ]] && tetra_tsm_is_running "$name"; do
            sleep 1
            wait_count=$((wait_count + 1))
            echo "tsm: waiting for graceful shutdown... ($wait_count/$max_wait)"
        done
        
        # Force kill if still running
        if tetra_tsm_is_running "$name"; then
            echo "tsm: graceful shutdown failed, force killing..."
            
            # Kill the entire process group with SIGKILL
            if [[ -n "$pgid" && "$pgid" != "$pid" ]]; then
                kill -KILL -"$pgid" 2>/dev/null || true
                echo "tsm: sent SIGKILL to process group $pgid"
            fi
            
            # Also kill the main process directly
            kill -KILL "$pid" 2>/dev/null || true
            echo "tsm: sent SIGKILL to main process $pid"
            
            # Wait a bit more
            sleep 2
        fi
    fi
    
    # Final verification and cleanup of any remaining processes
    local remaining_pids=""
    if [[ -n "$pgid" ]]; then
        # Find any remaining processes in the group
        if [[ "$OSTYPE" == "darwin"* ]]; then
            remaining_pids=$(ps -g "$pgid" -o pid= 2>/dev/null | tr -d ' ' | tr '\n' ' ')
        else
            remaining_pids=$(ps --ppid "$pid" -o pid --no-headers 2>/dev/null | tr '\n' ' ')
        fi
    fi
    
    if [[ -n "$remaining_pids" ]]; then
        echo "tsm: cleaning up remaining processes: $remaining_pids"
        for rpid in $remaining_pids; do
            [[ -n "$rpid" ]] && kill -KILL "$rpid" 2>/dev/null || true
        done
        sleep 1
    fi
    
    # Check if any processes are still using the port
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    if [[ -f "$metafile" ]]; then
        local port=""
        eval "$(cat "$metafile")"
        
        if [[ -n "$port" && "$port" != "-" ]] && command -v lsof >/dev/null 2>&1; then
            local port_pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
            if [[ -n "$port_pids" ]]; then
                echo "tsm: cleaning up processes still using port $port: $port_pids"
                echo "$port_pids" | xargs kill -KILL 2>/dev/null || true
                sleep 1
            fi
        fi
    fi
    
    # Cleanup
    rm -f "$pidfile"
    echo "tsm: stopped '$name'"
}

# Test function to compare old vs new behavior
tetra_tsm_test_kill_comparison() {
    local name="$1"
    
    echo "=== Testing Kill Behavior Comparison ==="
    
    if ! tetra_tsm_is_running "$name"; then
        echo "Process '$name' is not running"
        return 1
    fi
    
    local pid=$(cat "$TETRA_DIR/tsm/pids/$name.pid")
    
    echo "Process PID: $pid"
    
    # Show process tree before killing
    echo "--- Process tree before kill ---"
    if command -v pstree >/dev/null 2>&1; then
        pstree -p "$pid" 2>/dev/null || echo "pstree failed"
    fi
    
    ps -p "$pid" -o pid,ppid,pgid,sid,tty,stat,time,comm,args 2>/dev/null || echo "Process not found"
    
    # Show child processes
    echo "--- Child processes ---"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        ps -o pid,ppid,pgid,sid,tty,stat,time,comm,args | grep -E "(PPID|$pid)" || echo "No child processes"
    else
        ps --ppid "$pid" -o pid,ppid,pgid,sid,tty,stat,time,comm,args || echo "No child processes"
    fi
    
    # Use improved kill function
    tetra_tsm_stop_single_improved "$name" "false"
    
    # Verify cleanup
    echo "--- Verification after kill ---"
    sleep 2
    
    if ps -p "$pid" >/dev/null 2>&1; then
        echo "ERROR: Main process $pid still exists!"
        ps -p "$pid" -o pid,ppid,pgid,sid,tty,stat,time,comm,args
    else
        echo "SUCCESS: Main process $pid cleaned up"
    fi
    
    # Check for any remaining child processes
    local remaining=$(ps -o pid,ppid,pgid,sid,tty,stat,time,comm,args | grep "$pid" | grep -v grep || true)
    if [[ -n "$remaining" ]]; then
        echo "ERROR: Remaining child processes found:"
        echo "$remaining"
    else
        echo "SUCCESS: No remaining child processes"
    fi
}

# Export the improved function
export -f tetra_tsm_stop_single_improved
export -f tetra_tsm_test_kill_comparison
