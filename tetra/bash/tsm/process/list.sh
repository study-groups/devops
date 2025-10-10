#!/usr/bin/env bash

# TSM List - Service listing with running|available|all options
# Default: running services only

# Load TSM configuration
# Cross-module dependencies handled by include.sh loading order
# services/registry.sh functions are available after include.sh completes

# Setup service directories
TSM_SERVICES_AVAILABLE="$TETRA_DIR/tsm/services-available"
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

# Print table header
print_table_header() {
    printf "%-3s %-20s %-10s %-5s %-5s %-8s %-3s %-8s\n" \
        "ID" "Name" "Env" "PID" "Port" "Status" "↻" "Uptime"
    printf "%-3s %-20s %-10s %-5s %-5s %-8s %-3s %-8s\n" \
        "--" "--------------------" "----------" "-----" "-----" "--------" "---" "--------"
}

# Get service info
get_service_info() {
    local service_file="$1"
    local service_name=$(basename "$service_file" .tsm)

    local env_file=""
    local port=""
    local pid=""
    local status="stopped"
    local restarts="-"
    local uptime="-"

    # Parse service file
    while IFS= read -r line; do
        if [[ "$line" =~ TSM_ENV_FILE= ]]; then
            env_file=$(echo "$line" | cut -d'=' -f2 | tr -d '"' | xargs basename 2>/dev/null || echo "-")
        elif [[ "$line" =~ TSM_PORT= ]]; then
            port=$(echo "$line" | cut -d'=' -f2 | tr -d '"')
        fi
    done < "$service_file"

    # Check if service is running
    # Look for process files with various naming patterns
    local process_file
    local process_dir="$TSM_PROCESSES_DIR"

    # Try multiple naming patterns and file extensions
    if [[ -n "$port" ]]; then
        # Pattern 1: service-port.meta (e.g., devpages-4000.meta)
        if [[ -f "$process_dir/${service_name}-${port}.meta" ]]; then
            process_file="$process_dir/${service_name}-${port}.meta"
        # Pattern 2: service-port-port.env (e.g., tetra-4444-4444.env)
        elif [[ -f "$process_dir/${service_name}-${port}-${port}.env" ]]; then
            process_file="$process_dir/${service_name}-${port}-${port}.env"
        # Pattern 3: service-port.env (e.g., service-4000.env)
        elif [[ -f "$process_dir/${service_name}-${port}.env" ]]; then
            process_file="$process_dir/${service_name}-${port}.env"
        fi
    fi

    # Fallback: find any matching file
    if [[ ! -f "$process_file" ]]; then
        process_file=$(find "$process_dir/" -name "${service_name}*" \( -name "*.meta" -o -name "*.env" \) 2>/dev/null | head -1)
    fi

    if [[ -f "$process_file" ]]; then
        # Extract PID from different file formats
        if [[ "$process_file" == *.meta ]]; then
            pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)
        elif [[ "$process_file" == *.env ]]; then
            # For .env files, check if there's a corresponding .pid file
            local pid_file="${process_file%.env}.pid"
            if [[ -f "$pid_file" ]]; then
                pid=$(cat "$pid_file" 2>/dev/null)
            fi
        fi

        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            status="online"

            # Calculate uptime
            if [[ -n "$pid" ]]; then
                local start_time
                if command -v ps >/dev/null 2>&1; then
                    start_time=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs)
                    if [[ -n "$start_time" ]]; then
                        local start_epoch=$(date -j -f "%a %b %d %H:%M:%S %Y" "$start_time" "+%s" 2>/dev/null || echo "")
                        if [[ -n "$start_epoch" ]]; then
                            local current_epoch=$(date "+%s")
                            local uptime_seconds=$((current_epoch - start_epoch))

                            # Format uptime
                            if [[ $uptime_seconds -lt 60 ]]; then
                                uptime="${uptime_seconds}s"
                            elif [[ $uptime_seconds -lt 3600 ]]; then
                                uptime="$((uptime_seconds / 60))m"
                            elif [[ $uptime_seconds -lt 86400 ]]; then
                                uptime="$((uptime_seconds / 3600))h"
                            else
                                uptime="$((uptime_seconds / 86400))d"
                            fi
                        fi
                    fi
                fi
            fi

            # Get restart count if available
            local restart_count=$(grep -o "restarts=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2 || echo "0")
            restarts="$restart_count"
        else
            pid="-"
        fi
    else
        pid="-"
    fi

    # Default values
    [[ -z "$env_file" ]] && env_file="-"
    [[ -z "$port" ]] && port="-"

    # Return values via echo (bash array simulation)
    echo "$service_name|$env_file|$pid|$port|$status|$restarts|$uptime"
}

# List running services only
tsm_list_running() {
    print_table_header

    local id=0
    local found_running=false

    # Scan actual process metadata files
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for meta_file in "$TSM_PROCESSES_DIR"/*.meta; do
            [[ -f "$meta_file" ]] || continue

            # Read metadata
            local tsm_id name pid port command env_file start_time
            while IFS='=' read -r key value; do
                case "$key" in
                    tsm_id) tsm_id="${value//\'/}" ;;
                    name) name="${value//\'/}" ;;
                    pid) pid="${value//\'/}" ;;
                    port) port="${value//\'/}" ;;
                    command) command="${value//\'/}" ;;
                    env_file) env_file="${value//\'/}" ;;
                    start_time) start_time="${value//\'/}" ;;
                esac
            done < "$meta_file"

            # Check if process is still alive
            if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                # Calculate uptime
                local uptime="-"
                if [[ -n "$start_time" ]]; then
                    local current_time=$(date +%s)
                    local uptime_seconds=$((current_time - start_time))

                    if [[ $uptime_seconds -lt 60 ]]; then
                        uptime="${uptime_seconds}s"
                    elif [[ $uptime_seconds -lt 3600 ]]; then
                        uptime="$((uptime_seconds / 60))m"
                    elif [[ $uptime_seconds -lt 86400 ]]; then
                        uptime="$((uptime_seconds / 3600))h"
                    else
                        uptime="$((uptime_seconds / 86400))d"
                    fi
                fi

                # Format env file (basename only)
                local env_display="-"
                [[ -n "$env_file" ]] && env_display=$(basename "$env_file" 2>/dev/null || echo "-")

                # Format port
                [[ -z "$port" || "$port" == "none" ]] && port="-"

                printf "%-3s %-20s %-10s %-5s %-5s %-8s %-3s %-8s\n" \
                    "$tsm_id" "$name" "$env_display" "$pid" "$port" "online" "0" "$uptime"

                found_running=true
            fi
        done
    fi

    if [[ "$found_running" == "false" ]]; then
        echo ""
        echo "No running services found."
        echo "Start services with: tsm start <service-name>"
    fi
}

# List available services (all services)
tsm_list_available() {
    print_table_header

    local id=0
    if [[ -d "$TSM_SERVICES_AVAILABLE" ]]; then
        for service_file in "$TSM_SERVICES_AVAILABLE"/*.tsm; do
            [[ -f "$service_file" ]] || continue

            local service_info=$(get_service_info "$service_file")
            IFS='|' read -r name env_file pid port status restarts uptime <<< "$service_info"

            printf "%-3s %-20s %-10s %-5s %-5s %-8s %-3s %-8s\n" \
                "$id" "$name" "$env_file" "$pid" "$port" "$status" "$restarts" "$uptime"
            id=$((id + 1))
        done
    fi

    if [[ $id -eq 0 ]]; then
        echo ""
        echo "No services available. Create services in $TSM_SERVICES_AVAILABLE"
    fi
}

# List all services (same as available, but clearer naming)
tsm_list_all() {
    tsm_list_available
}