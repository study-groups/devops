#!/bin/bash

# TSM Patrol System - Automatic cleanup and port management
# Handles stale process cleanup and port range validation

# Port Range Definitions
# dev:     5000-5999  (development services)
# staging: 6000-6999  (staging services)
# proxy:   7000-7999  (hotrod proxies)
# prod:    8000-8999  (production services)

declare -A TSM_PORT_RANGES=(
    ["dev"]="5000-5999"
    ["staging"]="6000-6999"
    ["proxy"]="7000-7999"
    ["prod"]="8000-8999"
)

declare -A TSM_SERVICE_PORTS=(
    ["arcade-dev"]="5800"
    ["arcade-staging"]="6800"
    ["arcade-prod"]="8800"
    ["devpages-dev"]="5000"
    ["devpages-staging"]="6000"
    ["devpages-prod"]="8000"
    ["pbase-dev"]="5600"
    ["pbase-staging"]="6600"
    ["pbase-prod"]="8600"
    ["tetra-dev"]="5444"
    ["tetra-staging"]="6444"
    ["tetra-prod"]="8444"
)

# Silent patrol - cleanup without output
tsm_patrol_silent() {
    local cleaned=0

    if [[ ! -d "$TETRA_DIR/tsm/runtime/processes" ]]; then
        return 0
    fi

    for process_file in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
        [[ -f "$process_file" ]] || continue

        local process_name=$(basename "$process_file" .meta)
        local pid
        pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)

        if [[ -z "$pid" ]]; then
            rm -f "$process_file"
            rm -f "$TETRA_DIR/tsm/pids/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
            continue
        fi

        # Check if process is still running
        if ! kill -0 "$pid" 2>/dev/null; then
            rm -f "$process_file"
            rm -f "$TETRA_DIR/tsm/pids/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
        fi
    done

    return $cleaned
}

# Verbose patrol with output
tsm_patrol() {
    local show_output="${1:-true}"
    local cleaned=0

    if [[ "$show_output" == "true" ]]; then
        echo "🚨 TSM Patrol: Checking for stale processes..."
    fi

    if [[ ! -d "$TETRA_DIR/tsm/runtime/processes" ]]; then
        [[ "$show_output" == "true" ]] && echo "✅ No process tracking directory"
        return 0
    fi

    for process_file in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
        [[ -f "$process_file" ]] || continue

        local process_name=$(basename "$process_file" .meta)
        local pid
        pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)

        if [[ -z "$pid" ]]; then
            [[ "$show_output" == "true" ]] && echo "🧹 Cleaning invalid process file: $process_name"
            rm -f "$process_file"
            rm -f "$TETRA_DIR/tsm/pids/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
            continue
        fi

        # Check if process is still running
        if ! kill -0 "$pid" 2>/dev/null; then
            [[ "$show_output" == "true" ]] && echo "🧹 Cleaning stale process: $process_name (PID $pid)"
            rm -f "$process_file"
            rm -f "$TETRA_DIR/tsm/pids/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
        fi
    done

    if [[ "$show_output" == "true" ]]; then
        if [[ $cleaned -eq 0 ]]; then
            echo "✅ No stale processes found"
        else
            echo "✅ Cleaned up $cleaned stale processes"
        fi
    fi

    return $cleaned
}

# Get port range for environment
tsm_get_port_range() {
    local env="$1"
    echo "${TSM_PORT_RANGES[$env]:-}"
}

# Validate port against environment ranges
tsm_validate_port() {
    local port="$1"
    local env="${2:-dev}"

    local range="${TSM_PORT_RANGES[$env]}"
    if [[ -z "$range" ]]; then
        echo "Unknown environment: $env"
        return 1
    fi

    local min_port="${range%-*}"
    local max_port="${range#*-}"

    if [[ $port -ge $min_port && $port -le $max_port ]]; then
        return 0
    else
        echo "Port $port not in $env range ($range)"
        return 1
    fi
}

# Get recommended port for service
tsm_get_service_port() {
    local service="$1"
    local env="${2:-dev}"
    local service_key="$service-$env"

    echo "${TSM_SERVICE_PORTS[$service_key]:-}"
}

# Show port ranges
tsm_show_port_ranges() {
    echo "TSM Port Ranges:"
    echo "  dev (development):  5000-5999"
    echo "  staging:           6000-6999"
    echo "  proxy (hotrod):    7000-7999"
    echo "  prod (production): 8000-8999"
    echo ""
    echo "Standard Service Ports:"
    for service in arcade devpages pbase tetra; do
        echo "  $service:"
        echo "    dev:     ${TSM_SERVICE_PORTS[$service-dev]:-'not defined'}"
        echo "    staging: ${TSM_SERVICE_PORTS[$service-staging]:-'not defined'}"
        echo "    prod:    ${TSM_SERVICE_PORTS[$service-prod]:-'not defined'}"
    done
}