#!/usr/bin/env bash
# TSM List - JSON output for running processes and service definitions

# JSON output for running processes
_tsm_list_json() {
    local show_all="$1"
    local first=true
    local show_user=false

    # Check if we should include user field
    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true

    # Get process directories to iterate
    local processes_dirs=()
    if [[ "$show_user" == true ]]; then
        mapfile -t processes_dirs < <(tsm_get_all_process_dirs)
    else
        [[ -d "$TSM_PROCESSES_DIR" ]] && processes_dirs+=("$TSM_PROCESSES_DIR")
    fi

    echo "["
    for processes_dir in "${processes_dirs[@]}"; do
        [[ -d "$processes_dir" ]] || continue

        # Extract username from path
        local owner=""
        [[ "$show_user" == true ]] && owner=$(tsm_extract_username "$processes_dir")

        for dir in "$processes_dir"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == .* ]] && continue

            local meta="${dir}meta.json"
            [[ -f "$meta" ]] || continue

            local id=$(jq -r '.id // .tsm_id // "-"' "$meta" 2>/dev/null)
            local pid=$(jq -r '.pid // "-"' "$meta" 2>/dev/null)
            local port=$(jq -r '.port // "-"' "$meta" 2>/dev/null)
            local status=$(jq -r '.status // "unknown"' "$meta" 2>/dev/null)
            local started=$(jq -r '.started // .start_time // empty' "$meta" 2>/dev/null)

            if tsm_is_pid_alive "$pid"; then
                status="online"
            else
                [[ "$status" == "online" ]] && status="stopped"
            fi

            [[ "$show_all" != "true" && "$status" != "online" ]] && continue

            local uptime="-"
            if [[ "$status" == "online" && -n "$started" ]]; then
                uptime=$(tsm_format_uptime $(($(date +%s) - started)))
            fi

            $first || echo ","
            first=false
            # Escape values for safe JSON output
            local esc_name=$(_tsm_json_escape "$name")
            local esc_status=$(_tsm_json_escape "$status")
            local esc_uptime=$(_tsm_json_escape "$uptime")
            if [[ "$show_user" == true ]]; then
                local esc_owner=$(_tsm_json_escape "$owner")
                printf '  {"user":"%s","id":"%s","name":"%s","pid":"%s","port":"%s","status":"%s","uptime":"%s"}' \
                    "$esc_owner" "$id" "$esc_name" "$pid" "$port" "$esc_status" "$esc_uptime"
            else
                printf '  {"id":"%s","name":"%s","pid":"%s","port":"%s","status":"%s","uptime":"%s"}' \
                    "$id" "$esc_name" "$pid" "$port" "$esc_status" "$esc_uptime"
            fi
        done
    done
    echo ""
    echo "]"
}

# Consolidated JSON output for available/enabled services
# Usage: _tsm_list_services_json <mode>
_tsm_list_services_json() {
    local mode="$1"
    local first=true
    local show_user=false
    local show_en=false

    [[ "$mode" == "available" ]] && show_en=true
    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true

    echo "["
    while IFS= read -r services_dir; do
        [[ -d "$services_dir" ]] || continue

        local org=$(_tsm_extract_org "$services_dir")
        [[ -n "$_TSM_LIST_FILTER_ORG" && "$org" != "$_TSM_LIST_FILTER_ORG" ]] && continue

        local owner=""
        [[ "$show_user" == true ]] && owner=$(tsm_extract_username "$services_dir")

        local user_home=""
        if [[ "$services_dir" =~ ^(/home/[^/]+|/Users/[^/]+|/root) ]]; then
            user_home="${BASH_REMATCH[1]}"
        fi

        for f in "$services_dir"/*.tsm; do
            if [[ "$mode" == "enabled" ]]; then
                [[ -L "$f" ]] || continue
            fi
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .tsm)

            local TSM_NAME="" TSM_COMMAND="" TSM_PORT=""
            source "$f" 2>/dev/null

            local running="false"
            _tsm_service_running "$name" && running="true"

            $first || echo ","
            first=false

            # Build JSON object
            local json_obj=""
            [[ "$show_user" == true ]] && json_obj+="\"user\":\"$owner\","
            json_obj+="\"org\":\"$org\",\"name\":\"$name\",\"port\":\"${TSM_PORT:-auto}\""
            if [[ "$show_en" == true ]]; then
                local enabled="false"
                _tsm_is_enabled "$name" "$org" "$user_home" && enabled="true"
                json_obj+=",\"enabled\":${enabled}"
            fi
            json_obj+=",\"running\":${running},\"command\":\"${TSM_COMMAND:-}\""

            printf '  {%s}' "$json_obj"
        done
    done < <(_tsm_get_services_dirs "$mode")
    echo ""
    echo "]"
}

