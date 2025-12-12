#!/bin/bash

# TSM Patrol System - Automatic cleanup
# PM2-style: Only checks process directories in runtime/processes/

# Silent patrol - cleanup without output
tsm_patrol_silent() {
    local cleaned=0

    # Clean up stale process directories
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue

            local name=$(basename "$process_dir")
            local meta_file="${process_dir}meta.json"

            # If no metadata, clean up directory
            if [[ ! -f "$meta_file" ]]; then
                _tsm_safe_remove_dir "$process_dir"
                cleaned=$((cleaned + 1))
                continue
            fi

            # Check if process is still running
            local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
            if ! tsm_is_pid_alive "$pid"; then
                # Update status to crashed before cleanup
                jq '.status = "crashed"' "$meta_file" > "${meta_file}.tmp" 2>/dev/null && \
                    mv "${meta_file}.tmp" "$meta_file"

                # Keep directory for historical purposes (can add auto-removal later)
                cleaned=$((cleaned + 1))
            fi
        done
    fi

    return $cleaned
}

# Verbose patrol with output
tsm_patrol() {
    local show_output="${1:-true}"
    local cleaned=0

    if [[ "$show_output" == "true" ]]; then
        echo "🚨 TSM Patrol: Checking for stale processes..."
    fi

    # Clean up stale process directories
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue

            local name=$(basename "$process_dir")
            local meta_file="${process_dir}meta.json"

            # If no metadata, clean up directory
            if [[ ! -f "$meta_file" ]]; then
                [[ "$show_output" == "true" ]] && echo "🧹 Removing invalid process directory: $name"
                _tsm_safe_remove_dir "$process_dir"
                cleaned=$((cleaned + 1))
                continue
            fi

            # Check if process is still running
            local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
            if ! tsm_is_pid_alive "$pid"; then
                [[ "$show_output" == "true" ]] && echo "🧹 Marking crashed process: $name (PID $pid)"

                # Update status to crashed
                jq '.status = "crashed"' "$meta_file" > "${meta_file}.tmp" 2>/dev/null && \
                    mv "${meta_file}.tmp" "$meta_file"

                cleaned=$((cleaned + 1))
            fi
        done
    fi

    if [[ "$show_output" == "true" ]]; then
        if [[ $cleaned -eq 0 ]]; then
            echo "✅ No stale processes found"
        else
            echo "✅ Cleaned up $cleaned stale entries"
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
