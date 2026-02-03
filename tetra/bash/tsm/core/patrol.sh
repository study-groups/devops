#!/usr/bin/env bash
# TSM Patrol - Service supervision and auto-restart
#
# Used by tetra-4444 patrol loop to check enabled services and restart crashed ones.
# Outputs JSON for parsing by the Node.js patrol module.
# Multi-user aware: root checks all users' enabled services.

# Check and restart services for a single user
# Args: $1=services_enabled_dir, $2=processes_dir, $3=username
# Returns: array of restarted service names via _PATROL_RESTARTED
_tsm_patrol_user() {
    local services_enabled="$1"
    local processes_dir="$2"
    local username="$3"

    [[ -d "$services_enabled" ]] || return 0

    for link in "$services_enabled"/*.tsm; do
        [[ -L "$link" ]] || continue

        local name=$(basename "$link" .tsm)
        local svc_file=$(readlink "$link")

        # Skip if symlink is broken
        [[ -f "$svc_file" ]] || continue

        # Source service definition to get TSM_NAME
        local TSM_NAME="" TSM_COMMAND="" TSM_PORT="" TSM_ENV="" TSM_CWD=""
        source "$svc_file" 2>/dev/null || continue

        local proc_name="${TSM_NAME:-$name}"

        # Check if service is running (check user's processes dir)
        local meta="$processes_dir/$proc_name/meta.json"
        local running=false

        if [[ -f "$meta" ]]; then
            local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
            [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && running=true
        fi

        if [[ "$running" == false ]]; then
            # Try to restart as the target user
            local restart_ok=false

            if [[ "$username" == "$USER" || "$username" == "$(whoami)" ]]; then
                (
                    cd "${TSM_CWD:-$PWD}" 2>/dev/null || true
                    tsm_start "$TSM_COMMAND" --name "$proc_name" --port "$TSM_PORT" >/dev/null 2>&1
                ) && restart_ok=true
            elif [[ $EUID -eq 0 ]]; then
                sudo -u "$username" bash -c "
                    source ~/tetra/tetra.sh
                    cd '${TSM_CWD:-$PWD}' 2>/dev/null || true
                    tsm_start '$TSM_COMMAND' --name '$proc_name' --port '$TSM_PORT' >/dev/null 2>&1
                " && restart_ok=true
            fi

            [[ "$restart_ok" == true ]] && _PATROL_RESTARTED+=("$username:$proc_name")
        fi
    done
}

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

    local -a _PATROL_RESTARTED=()

    # Multi-user mode: root checks all users
    if [[ $EUID -eq 0 ]] && type tsm_discover_user_homes &>/dev/null; then
        while IFS= read -r user_home; do
            local username=$(tsm_extract_username "$user_home")
            local services_enabled="$user_home/tetra/tsm/services-enabled"
            local processes_dir="$user_home/tetra/tsm/runtime/processes"

            _tsm_patrol_user "$services_enabled" "$processes_dir" "$username"
        done < <(tsm_discover_user_homes)
    else
        # Single user mode
        _tsm_patrol_user "$TSM_SERVICES_ENABLED" "$TSM_PROCESSES_DIR" "$USER"
    fi

    # Output results
    if [[ "$json" == "true" ]]; then
        if [[ ${#_PATROL_RESTARTED[@]} -eq 0 ]]; then
            printf '{"restarted":[]}\n'
        else
            local json_arr=""
            for svc in "${_PATROL_RESTARTED[@]}"; do
                [[ -n "$json_arr" ]] && json_arr+=","
                json_arr+="\"$svc\""
            done
            printf '{"restarted":[%s]}\n' "$json_arr"
        fi
    elif [[ ${#_PATROL_RESTARTED[@]} -gt 0 ]]; then
        echo "Restarted: ${_PATROL_RESTARTED[*]}"
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

