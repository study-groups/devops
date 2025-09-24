#!/usr/bin/env bash

# TSM Lifecycle - Process operations and PID management
# This module handles process lifecycle operations (start, stop, status checks)

# === PID MANAGEMENT ===

_tsm_is_process_running() {
    local pid="$1"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

_tsm_get_process_by_name() {
    local name="$1"
    local process_file="$(_tsm_get_process_file "$name")"

    if [[ -f "$process_file" ]]; then
        local PID
        source "$process_file"
        if _tsm_is_process_running "$PID"; then
            echo "$PID"
            return 0
        else
            # Clean up stale process file
            rm -f "$process_file"
            return 1
        fi
    else
        return 1
    fi
}

# === BASIC PROCESS OPERATIONS ===

_tsm_kill_process() {
    local pid="$1"
    local process_name="$2"
    local timeout="${3:-10}"

    if ! _tsm_is_process_running "$pid"; then
        return 0  # Already dead
    fi

    # Try SIGTERM first
    kill "$pid" 2>/dev/null

    # Wait for graceful shutdown
    local count=0
    while [[ $count -lt $timeout ]] && _tsm_is_process_running "$pid"; do
        sleep 1
        count=$((count + 1))
    done

    # Force kill if still running
    if _tsm_is_process_running "$pid"; then
        kill -9 "$pid" 2>/dev/null
        sleep 1
    fi

    # Clean up files
    local process_file="$(_tsm_get_process_file "$process_name")"
    local pid_file="$(_tsm_get_pid_file "$process_name")"

    rm -f "$process_file" "$pid_file"

    return 0
}

# Export lifecycle functions
export -f _tsm_is_process_running
export -f _tsm_get_process_by_name
export -f _tsm_kill_process