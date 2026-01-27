#!/usr/bin/env bash
# TSM List - available/enabled service definition listing

# Get all services-available directories (current user or all users if -U)
_tsm_get_services_dirs() {
    local type="$1"  # "available" or "enabled"
    local dirs=()

    if [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled; then
        # All users' orgs
        while IFS= read -r user_home; do
            for org_dir in "$user_home"/tetra/orgs/*/; do
                [[ -d "$org_dir" ]] || continue
                local services_dir="${org_dir}tsm/services-${type}"
                [[ -d "$services_dir" ]] && echo "$services_dir"
            done
        done < <(tsm_discover_user_homes)
    else
        # Current user's orgs only
        for org_dir in "$TETRA_DIR"/orgs/*/; do
            [[ -d "$org_dir" ]] || continue
            local services_dir="${org_dir}tsm/services-${type}"
            [[ -d "$services_dir" ]] && echo "$services_dir"
        done
    fi
}

# Extract org name from services path
# /home/dev/tetra/orgs/tetra/tsm/services-available -> tetra
_tsm_extract_org() {
    local path="$1"
    if [[ "$path" =~ /orgs/([^/]+)/tsm/ ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo "unknown"
    fi
}

# Check if a service is enabled (has symlink in services-enabled)
_tsm_is_enabled() {
    local name="$1"
    local org="$2"
    local user_home="$3"

    local enabled_dir
    if [[ -n "$user_home" ]]; then
        enabled_dir="$user_home/tetra/orgs/$org/tsm/services-enabled"
    else
        enabled_dir="$TETRA_DIR/orgs/$org/tsm/services-enabled"
    fi

    [[ -L "$enabled_dir/${name}.tsm" ]]
}

# Check if a service has a live running process
# Returns 0 if status=="online" and PID alive, 1 otherwise
_tsm_service_running() {
    local name="$1"

    # Process dirs use runtime names: exact match or name-PORT suffix
    for dir in "$TSM_PROCESSES_DIR/$name" "$TSM_PROCESSES_DIR/${name}"-*/; do
        [[ -d "$dir" ]] || continue
        local meta="${dir}/meta.json"
        [[ -f "$meta" ]] || continue

        local status pid
        status=$(jq -r '.status // empty' "$meta" 2>/dev/null)
        pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)

        [[ "$status" == "online" ]] && tsm_is_pid_alive "$pid" && return 0
    done
    return 1
}

# Consolidated list for available/enabled services
# Usage: _tsm_list_services <mode> <json_output>
#   mode: "available" or "enabled"
_tsm_list_services() {
    local mode="$1"
    local json_output="$2"
    local show_user=false
    local count=0
    local show_en=false

    [[ "$mode" == "available" ]] && show_en=true

    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true
    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

    if [[ "$json_output" == "true" ]]; then
        _tsm_list_services_json "$mode"
        return
    fi

    # Column widths
    local w_user=10 w_org=12 w_name=20 w_port=6 w_en=3 w_run=3 w_cmd=40

    # Build header/separator strings dynamically
    local hdr_parts=() sep_parts=()
    if [[ "$show_user" == true ]]; then
        hdr_parts+=("%-${w_user}s"); sep_parts+=("----------")
    fi
    hdr_parts+=("%-${w_org}s" "%-${w_name}s" "%-${w_port}s")
    sep_parts+=("------------" "--------------------" "------")
    if [[ "$show_en" == true ]]; then
        hdr_parts+=("%-${w_en}s"); sep_parts+=("---")
    fi
    hdr_parts+=("%-${w_run}s" "%s")
    sep_parts+=("---" "----------------------------------------")

    local hdr_fmt=$(IFS='  '; echo "${hdr_parts[*]}")

    # Header labels
    local hdr_labels=()
    if [[ "$show_user" == true ]]; then hdr_labels+=("USER"); fi
    hdr_labels+=("ORG" "NAME" "PORT")
    if [[ "$show_en" == true ]]; then hdr_labels+=("EN"); fi
    hdr_labels+=("RUN" "COMMAND")

    if [[ "$use_color" == true ]]; then
        tds_text_color "structural.primary"
        printf "$hdr_fmt" "${hdr_labels[@]}"
        reset_color; echo
        tds_text_color "text.dim"
        printf "$hdr_fmt" "${sep_parts[@]}"
        reset_color; echo
    else
        printf "${hdr_fmt}\n" "${hdr_labels[@]}"
        printf "${hdr_fmt}\n" "${sep_parts[@]}"
    fi

    # Iterate services
    while IFS= read -r services_dir; do
        [[ -d "$services_dir" ]] || continue

        local org=$(_tsm_extract_org "$services_dir")

        # Apply org filter
        [[ -n "$_TSM_LIST_FILTER_ORG" && "$org" != "$_TSM_LIST_FILTER_ORG" ]] && continue

        local owner=""
        [[ "$show_user" == true ]] && owner=$(tsm_extract_username "$services_dir")

        # Get user home for enabled check
        local user_home=""
        if [[ "$services_dir" =~ ^(/home/[^/]+|/Users/[^/]+|/root) ]]; then
            user_home="${BASH_REMATCH[1]}"
        fi

        for f in "$services_dir"/*.tsm; do
            # In enabled mode, only show symlinks
            if [[ "$mode" == "enabled" ]]; then
                [[ -L "$f" ]] || continue
            fi
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .tsm)

            # Read service definition
            local TSM_NAME="" TSM_COMMAND="" TSM_PORT=""
            source "$f" 2>/dev/null

            local port="${TSM_PORT:-auto}"
            local cmd="${TSM_COMMAND:-}"
            [[ ${#cmd} -gt $w_cmd ]] && cmd="${cmd:0:$((w_cmd-3))}..."

            # Check if enabled (available mode only)
            local enabled=" "
            if [[ "$show_en" == true ]] && _tsm_is_enabled "$name" "$org" "$user_home"; then
                enabled="*"
            fi

            # Check if running
            local running=" "
            if _tsm_service_running "$name"; then
                running="*"
            fi

            if [[ "$use_color" == true ]]; then
                if [[ "$show_user" == true ]]; then
                    tds_text_color "accent.info"; printf "%-${w_user}s" "$owner"; reset_color; printf "  "
                fi
                tds_text_color "text.muted"; printf "%-${w_org}s" "$org"; reset_color; printf "  "
                tds_text_color "text.primary"; printf "%-${w_name}s" "$name"; reset_color; printf "  "
                tds_text_color "text.tertiary"; printf "%-${w_port}s" "$port"; reset_color; printf "  "
                if [[ "$show_en" == true ]]; then
                    if [[ "$enabled" == "*" ]]; then
                        tds_text_color "feedback.success"; printf "%-${w_en}s" "$enabled"; reset_color
                    else
                        printf "%-${w_en}s" "$enabled"
                    fi
                    printf "  "
                fi
                if [[ "$running" == "*" ]]; then
                    tds_text_color "feedback.success"; printf "%-${w_run}s" "$running"; reset_color
                else
                    printf "%-${w_run}s" "$running"
                fi
                printf "  "
                tds_text_color "text.muted"; printf "%s" "$cmd"; reset_color
                echo
            else
                local row_parts=()
                if [[ "$show_user" == true ]]; then row_parts+=("$owner"); fi
                row_parts+=("$org" "$name" "$port")
                if [[ "$show_en" == true ]]; then row_parts+=("$enabled"); fi
                row_parts+=("$running" "$cmd")
                printf "${hdr_fmt}\n" "${row_parts[@]}"
            fi

            ((count++))
        done
    done < <(_tsm_get_services_dirs "$mode")

    [[ $count -eq 0 ]] && echo "(no services ${mode})"
}

export -f _tsm_get_services_dirs _tsm_extract_org _tsm_is_enabled _tsm_service_running _tsm_list_services
