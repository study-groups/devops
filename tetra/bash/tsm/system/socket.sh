#!/usr/bin/env bash

# TSM Unix Domain Socket Support
# Simple line-based protocol for non-port services

# Socket directory
TSM_SOCKETS_DIR="${TSM_PROCESSES_DIR}/sockets"

# Initialize sockets directory
tsm_socket_init() {
    mkdir -p "$TSM_SOCKETS_DIR"
}

# Create socket for a service
tsm_socket_create() {
    local name="$1"

    tsm_socket_init

    local socket_path="$TSM_SOCKETS_DIR/${name}.sock"

    # Socket will be created by service when it binds
    # We just return the path
    echo "$socket_path"
}

# Remove socket
tsm_socket_remove() {
    local name="$1"

    local socket_path="$TSM_SOCKETS_DIR/${name}.sock"
    [[ -S "$socket_path" ]] && rm -f "$socket_path"
}

# Send command to socket
# Protocol: line-based text
# Send: "VERB\n" or "VERB arg1 arg2\n"
# Receive: "response\n"
tsm_socket_send() {
    local name="$1"
    local verb="$2"
    shift 2
    local args="$@"

    local socket_path="$TSM_SOCKETS_DIR/${name}.sock"

    if [[ ! -S "$socket_path" ]]; then
        echo "ERROR: Socket not found: $socket_path" >&2
        return 1
    fi

    # Send command with timeout
    if command -v nc >/dev/null 2>&1; then
        # Use netcat if available
        echo "$verb $args" | timeout 5 nc -U "$socket_path" 2>/dev/null
    elif command -v socat >/dev/null 2>&1; then
        # Fallback to socat
        echo "$verb $args" | timeout 5 socat - UNIX-CONNECT:"$socket_path" 2>/dev/null
    else
        echo "ERROR: No socket client available (need nc or socat)" >&2
        return 1
    fi
}

# Common socket commands

tsm_socket_status() {
    local name="$1"
    tsm_socket_send "$name" "STATUS"
}

tsm_socket_health() {
    local name="$1"
    local response=$(tsm_socket_send "$name" "HEALTH" 2>/dev/null)
    [[ "$response" =~ (OK|PONG|HEALTHY) ]]
}

tsm_socket_reload() {
    local name="$1"
    tsm_socket_send "$name" "RELOAD"
}

tsm_socket_stop() {
    local name="$1"
    tsm_socket_send "$name" "STOP"
}

# List all active sockets
tsm_socket_list() {
    tsm_socket_init

    echo "Active Sockets:"
    echo "==============="

    local count=0
    for sock in "$TSM_SOCKETS_DIR"/*.sock; do
        [[ -S "$sock" ]] || continue

        local name=$(basename "$sock" .sock)
        local status="unknown"

        # Try health check
        if tsm_socket_health "$name" 2>/dev/null; then
            status="healthy"
        else
            status="no response"
        fi

        printf "%-30s %s\n" "$name" "$status"
        count=$((count + 1))
    done

    if [[ $count -eq 0 ]]; then
        echo "No active sockets"
    fi
}

# Cleanup stale sockets
tsm_socket_cleanup() {
    tsm_socket_init

    local cleaned=0

    for sock in "$TSM_SOCKETS_DIR"/*.sock; do
        [[ -S "$sock" ]] || continue

        local name=$(basename "$sock" .sock")

        # Check if process still exists
        if ! tsm_process_exists "$name" 2>/dev/null; then
            rm -f "$sock"
            echo "Removed stale socket: $name"
            ((cleaned++))
        fi
    done

    if [[ $cleaned -eq 0 ]]; then
        echo "No stale sockets found"
    else
        echo "Cleaned up $cleaned socket(s)"
    fi
}

export -f tsm_socket_init
export -f tsm_socket_create
export -f tsm_socket_remove
export -f tsm_socket_send
export -f tsm_socket_status
export -f tsm_socket_health
export -f tsm_socket_reload
export -f tsm_socket_stop
export -f tsm_socket_list
export -f tsm_socket_cleanup
