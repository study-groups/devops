#!/usr/bin/env bash

# TSM Port Resolution - 5-step ladder
# Simple, transparent port allocation

# Port allocation range
TSM_PORT_RANGE_START=8000
TSM_PORT_RANGE_END=8999

# Runtime port tracking
TSM_PORT_ALLOCATIONS="${TSM_PROCESSES_DIR}/port_allocations.txt"

# Read patterns file
_tsm_read_patterns() {
    local patterns_file="$TETRA_SRC/bash/tsm/patterns.txt"
    local user_patterns="$TETRA_DIR/tsm/patterns.txt"

    # Read system patterns first
    if [[ -f "$patterns_file" ]]; then
        grep -v '^#' "$patterns_file" | grep -v '^$'
    fi

    # Then user patterns (can override)
    if [[ -f "$user_patterns" ]]; then
        grep -v '^#' "$user_patterns" | grep -v '^$'
    fi
}

# Find matching pattern for command
tsm_find_pattern() {
    local command="$1"

    while IFS='|' read -r name match port template; do
        if [[ "$command" =~ $match ]]; then
            echo "$name|$match|$port|$template"
            return 0
        fi
    done < <(_tsm_read_patterns)

    return 1
}

# Check if port is available
tsm_port_available() {
    local port="$1"

    if command -v lsof >/dev/null 2>&1; then
        ! lsof -i ":$port" -t >/dev/null 2>&1
    else
        return 0  # Assume available if can't check
    fi
}

# Allocate next available port in range
tsm_allocate_port() {
    for port in $(seq $TSM_PORT_RANGE_START $TSM_PORT_RANGE_END); do
        if tsm_port_available "$port"; then
            echo "$port"
            return 0
        fi
    done

    return 1
}

# Track port allocation
tsm_track_port() {
    local port="$1"
    local name="$2"
    local pid="$3"

    mkdir -p "$(dirname "$TSM_PORT_ALLOCATIONS")"
    echo "$port|$name|$pid|$(date +%s)" >> "$TSM_PORT_ALLOCATIONS"
}

# 5-Step Port Ladder
# Returns: port|template|service_type
tsm_resolve_port() {
    local command="$1"
    local explicit_port="$2"

    local port=""
    local template="{cmd}"
    local service_type="pid"

    # Step 1: Explicit --port flag
    if [[ -n "$explicit_port" ]]; then
        port="$explicit_port"
        service_type="port"
        echo "$port|$template|$service_type"
        return 0
    fi

    # Step 2: Pattern in registry
    local pattern_match
    if pattern_match=$(tsm_find_pattern "$command"); then
        IFS='|' read -r pname pmatch pport ptemplate <<< "$pattern_match"

        if [[ "$pport" == "0" ]]; then
            # Port 0 means socket-based
            service_type="socket"
            echo "0|$ptemplate|$service_type"
            return 0
        else
            # Try default port
            if tsm_port_available "$pport"; then
                port="$pport"
            else
                # Default busy, allocate
                port=$(tsm_allocate_port)
            fi
            template="$ptemplate"
            service_type="port"
            echo "$port|$template|$service_type"
            return 0
        fi
    fi

    # Step 3: PORT in command text
    if [[ "$command" =~ (:|--port|-p|PORT=)[[:space:]]*([0-9]{4,5}) ]]; then
        port="${BASH_REMATCH[2]}"
        service_type="port"
        echo "$port|$template|$service_type"
        return 0
    fi

    # Step 4: Allocate from range
    if port=$(tsm_allocate_port); then
        service_type="port"
        echo "$port|$template|$service_type"
        return 0
    fi

    # Step 5: No port available
    echo "none|$template|pid"
    return 1
}

# Apply template to command
tsm_apply_template() {
    local command="$1"
    local port="$2"
    local template="$3"

    # Replace {cmd} with command
    local result="${template//\{cmd\}/$command}"

    # Replace {port} with port
    result="${result//\{port\}/$port}"

    echo "$result"
}

# Clean up stale port allocations
tsm_cleanup_ports() {
    [[ ! -f "$TSM_PORT_ALLOCATIONS" ]] && return 0

    local temp_file="${TSM_PORT_ALLOCATIONS}.tmp"
    > "$temp_file"

    while IFS='|' read -r port name pid timestamp; do
        # Keep if process still alive
        if kill -0 "$pid" 2>/dev/null; then
            echo "$port|$name|$pid|$timestamp" >> "$temp_file"
        fi
    done < "$TSM_PORT_ALLOCATIONS"

    mv "$temp_file" "$TSM_PORT_ALLOCATIONS"
}

export -f tsm_find_pattern
export -f tsm_port_available
export -f tsm_allocate_port
export -f tsm_track_port
export -f tsm_resolve_port
export -f tsm_apply_template
export -f tsm_cleanup_ports
