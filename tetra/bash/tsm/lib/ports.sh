#!/usr/bin/env bash
# TSM Ports - simplified 3-step port resolution

# Port range for auto-allocation
TSM_PORT_MIN=8000
TSM_PORT_MAX=8999

# Check if port is available (not in use)
tsm_port_available() {
    local port="$1"
    [[ -z "$port" ]] && return 1

    if command -v lsof >/dev/null 2>&1; then
        ! lsof -i ":$port" -t >/dev/null 2>&1
    else
        # Fallback: try netcat
        if command -v nc >/dev/null 2>&1; then
            ! nc -z localhost "$port" 2>/dev/null
        else
            return 0  # Assume available
        fi
    fi
}

# Allocate next available port in range
tsm_allocate_port() {
    local start="${1:-$TSM_PORT_MIN}"
    local port

    [[ $start -lt $TSM_PORT_MIN ]] && start=$TSM_PORT_MIN
    [[ $start -gt $TSM_PORT_MAX ]] && return 1

    for ((port = start; port <= TSM_PORT_MAX; port++)); do
        tsm_port_available "$port" && { echo "$port"; return 0; }
    done

    return 1
}

# 3-Step Port Resolution
# Args: explicit_port env_port
# Returns: port number or empty
# Supports "8000+" syntax for explicit auto-increment from base
tsm_resolve_port() {
    local explicit="$1"
    local env_port="$2"

    # Step 1: Explicit --port wins
    if [[ -n "$explicit" ]]; then
        # Handle "8000+" syntax (base port with auto-increment)
        if [[ "$explicit" == *+ ]]; then
            local base="${explicit%+}"
            tsm_allocate_port "$base"
            return 0
        fi

        # Explicit port MUST be available - fail loudly if not
        if tsm_port_available "$explicit"; then
            echo "$explicit"
        else
            # Port taken - report what's using it and FAIL
            local blocker_pid=$(tsm_port_pid "$explicit")
            if [[ -n "$blocker_pid" ]]; then
                tsm_error "port $explicit in use by PID $blocker_pid (use '$explicit+' for auto-increment)"
            else
                tsm_error "port $explicit unavailable (use '$explicit+' for auto-increment)"
            fi
            return 1
        fi
        return 0
    fi

    # Step 2: Environment PORT (also strict - fail if unavailable)
    if [[ -n "$env_port" ]]; then
        if tsm_port_available "$env_port"; then
            echo "$env_port"
        else
            local blocker_pid=$(tsm_port_pid "$env_port")
            if [[ -n "$blocker_pid" ]]; then
                tsm_error "env PORT=$env_port in use by PID $blocker_pid"
            else
                tsm_error "env PORT=$env_port unavailable"
            fi
            return 1
        fi
        return 0
    fi

    # Step 3: Auto-allocate
    tsm_allocate_port
}

# Detect port used by PID (via lsof)
tsm_detect_port() {
    local pid="$1"
    [[ -z "$pid" ]] && return 1

    command -v lsof >/dev/null 2>&1 || return 1

    # Check TCP LISTEN first
    local port=$(lsof -Pan -p "$pid" -iTCP 2>/dev/null | awk '$8 ~ /LISTEN/ {print $9}' | head -1 | cut -d':' -f2)
    [[ -n "$port" ]] && { echo "$port"; return 0; }

    # Then UDP
    port=$(lsof -Pan -p "$pid" -iUDP 2>/dev/null | awk 'NR>1 {print $9}' | head -1 | cut -d':' -f2)
    [[ -n "$port" ]] && { echo "$port"; return 0; }

    return 1
}

# Get PID using port
tsm_port_pid() {
    local port="$1"
    [[ -z "$port" ]] && return 1
    command -v lsof >/dev/null 2>&1 || return 1
    lsof -ti ":$port" 2>/dev/null | head -1
}

# Get port type (tcp/udp) for a port
tsm_port_type() {
    local port="$1"
    [[ -z "$port" ]] && { echo "tcp"; return; }
    command -v lsof >/dev/null 2>&1 || { echo "tcp"; return; }

    if lsof -i "TCP:$port" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "tcp"
    elif lsof -i "UDP:$port" >/dev/null 2>&1; then
        echo "udp"
    else
        echo "tcp"  # Default
    fi
}

# Parse PORT from env file content
# Handles both "PORT=xxx" and "export PORT=xxx"
tsm_parse_env_port() {
    local env_file="$1"
    [[ -f "$env_file" ]] || return 1
    grep -E '^(export )?PORT=' "$env_file" 2>/dev/null | head -1 | sed 's/^export //' | cut -d'=' -f2 | tr -d ' "'
}

# Count established connections on a port
# Args: port
# Returns: count of established connections
tsm_port_connections() {
    local port="$1"
    [[ -z "$port" ]] && { echo "0"; return; }
    command -v lsof >/dev/null 2>&1 || { echo "0"; return; }

    # Count ESTABLISHED TCP connections to this port
    local count=$(lsof -i ":$port" -sTCP:ESTABLISHED 2>/dev/null | grep -v "^COMMAND" | wc -l | tr -d ' ')
    echo "${count:-0}"
}

# Get connection details for a port
# Args: port
# Returns: JSON-like connection info
tsm_port_connection_details() {
    local port="$1"
    [[ -z "$port" ]] && return 1
    command -v lsof >/dev/null 2>&1 || return 1

    local listen=0 established=0

    # Count LISTEN sockets
    listen=$(lsof -i ":$port" -sTCP:LISTEN 2>/dev/null | grep -v "^COMMAND" | wc -l | tr -d ' ')

    # Count ESTABLISHED connections
    established=$(lsof -i ":$port" -sTCP:ESTABLISHED 2>/dev/null | grep -v "^COMMAND" | wc -l | tr -d ' ')

    echo "listen=${listen:-0} established=${established:-0}"
}

export TSM_PORT_MIN TSM_PORT_MAX
