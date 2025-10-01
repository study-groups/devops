#!/bin/bash

# TSM Patrol System - Automatic cleanup and port management
# Handles stale process cleanup and port range validation

# Load services configuration
# Cross-module dependencies handled by include.sh loading order
# services/registry.sh functions are available after include.sh completes

# Silent patrol - cleanup without output
tsm_patrol_silent() {
    local cleaned=0

    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        return 0
    fi

    for process_file in "$TSM_PROCESSES_DIR"/*.meta; do
        [[ -f "$process_file" ]] || continue

        local process_name=$(basename "$process_file" .meta)
        local pid
        pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)

        if [[ -z "$pid" ]]; then
            rm -f "$process_file"
            rm -f "$TSM_PIDS_DIR/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
            continue
        fi

        # Check if process is still running
        if ! kill -0 "$pid" 2>/dev/null; then
            rm -f "$process_file"
            rm -f "$TSM_PIDS_DIR/$process_name.pid" 2>/dev/null
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

    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        [[ "$show_output" == "true" ]] && echo "✅ No process tracking directory"
        return 0
    fi

    for process_file in "$TSM_PROCESSES_DIR"/*.meta; do
        [[ -f "$process_file" ]] || continue

        local process_name=$(basename "$process_file" .meta)
        local pid
        pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)

        if [[ -z "$pid" ]]; then
            [[ "$show_output" == "true" ]] && echo "🧹 Cleaning invalid process file: $process_name"
            rm -f "$process_file"
            rm -f "$TSM_PIDS_DIR/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
            continue
        fi

        # Check if process is still running
        if ! kill -0 "$pid" 2>/dev/null; then
            [[ "$show_output" == "true" ]] && echo "🧹 Cleaning stale process: $process_name (PID $pid)"
            rm -f "$process_file"
            rm -f "$TSM_PIDS_DIR/$process_name.pid" 2>/dev/null
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
    for env in dev staging proxy prod; do
        local range="${TSM_PORT_RANGES[$env]:-'not defined'}"
        local label=""
        case "$env" in
            dev) label="dev (development)" ;;
            staging) label="staging" ;;
            proxy) label="proxy (hotrod)" ;;
            prod) label="prod (production)" ;;
        esac
        printf "  %-20s %s\n" "$label:" "$range"
    done
    echo ""
    echo "Standard Service Ports:"
    for service in arcade devpages pbase tetra tserve; do
        echo "  $service:"
        echo "    dev:     $(tsm_get_service_port "$service" "dev" || echo 'not defined')"
        echo "    staging: $(tsm_get_service_port "$service" "staging" || echo 'not defined')"
        echo "    prod:    $(tsm_get_service_port "$service" "prod" || echo 'not defined')"
    done

    echo ""
    echo "Ignored Ports (not managed by TSM):"
    printf "  %s\n" "${TSM_IGNORE_PORTS[@]}"
}