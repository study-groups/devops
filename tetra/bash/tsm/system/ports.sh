#!/usr/bin/env bash

# TSM Simple Port Detection
# Just runtime detection via lsof - no registry, no TOML, no allocation

# Detect what port a process (PID) is using
tsm_detect_port() {
    local pid="$1"

    if [[ -z "$pid" ]]; then
        return 1
    fi

    # Use lsof to find listening port for this PID
    if command -v lsof >/dev/null 2>&1; then
        local port=$(lsof -Pan -p "$pid" -i 2>/dev/null | awk '$8 ~ /LISTEN/ {print $9}' | head -1 | cut -d':' -f2)
        if [[ -n "$port" ]]; then
            echo "$port"
            return 0
        fi
    fi

    return 1
}

# Check if a port is in use
tsm_is_port_used() {
    local port="$1"

    if [[ -z "$port" ]]; then
        return 1
    fi

    if command -v lsof >/dev/null 2>&1; then
        lsof -ti ":$port" >/dev/null 2>&1
        return $?
    fi

    return 1
}

# Get PID using a specific port
tsm_get_port_pid() {
    local port="$1"

    if [[ -z "$port" ]]; then
        return 1
    fi

    if command -v lsof >/dev/null 2>&1; then
        local pid=$(lsof -ti ":$port" 2>/dev/null | head -1)
        if [[ -n "$pid" ]]; then
            echo "$pid"
            return 0
        fi
    fi

    return 1
}

# Export essential functions
export -f tsm_detect_port
export -f tsm_is_port_used
export -f tsm_get_port_pid
