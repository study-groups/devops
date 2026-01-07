#!/usr/bin/env bash
# TSM Patrol - Service supervision and auto-restart
#
# Used by tetra-4444 patrol loop to check enabled services and restart crashed ones.
# Outputs JSON for parsing by the Node.js patrol module.

# Run a single patrol check
# Args: [--once] [--json]
# --once: Single pass, don't loop
# --json: Output JSON format for tetra-4444
tsm_patrol() {
    local json=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --once) shift ;;  # Ignored - always single-pass from CLI
            --json) json=true; shift ;;
            *) shift ;;
        esac
    done

    local -a restarted=()

    # Check each enabled service
    for link in "$TSM_SERVICES_ENABLED"/*.tsm; do
        [[ -L "$link" ]] || continue

        local name=$(basename "$link" .tsm)
        local svc_file=$(readlink "$link")

        # Skip if symlink is broken
        [[ -f "$svc_file" ]] || continue

        # Source service definition to get TSM_NAME
        local TSM_NAME="" TSM_COMMAND="" TSM_PORT="" TSM_ENV="" TSM_CWD=""
        source "$svc_file" 2>/dev/null || continue

        local proc_name="${TSM_NAME:-$name}"

        # Check if service is running
        if ! tsm_is_running "$proc_name"; then
            # Try to restart
            if tsm_start "$proc_name" >/dev/null 2>&1; then
                restarted+=("$proc_name")
            fi
        fi
    done

    # Output results
    if [[ "$json" == "true" ]]; then
        if [[ ${#restarted[@]} -eq 0 ]]; then
            printf '{"restarted":[]}\n'
        else
            local json_arr=""
            for svc in "${restarted[@]}"; do
                [[ -n "$json_arr" ]] && json_arr+=","
                json_arr+="\"$svc\""
            done
            printf '{"restarted":[%s]}\n' "$json_arr"
        fi
    elif [[ ${#restarted[@]} -gt 0 ]]; then
        echo "Restarted: ${restarted[*]}"
    fi
}

# Check if a service is running by name
# Looks for process in TSM_PROCESSES_DIR
tsm_is_running() {
    local name="$1"
    [[ -z "$name" ]] && return 1

    # Check for process directory with meta.json
    local meta="$TSM_PROCESSES_DIR/$name/meta.json"
    [[ -f "$meta" ]] || return 1

    # Get PID from metadata
    local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
    [[ -z "$pid" ]] && return 1

    # Check if process is alive
    kill -0 "$pid" 2>/dev/null
}

export -f tsm_patrol tsm_is_running
