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

# Print a colored or plain column
# Usage: _tsm_svc_col <token> <width> <value> <use_color>
_tsm_svc_col() {
    local token="$1" width="$2" value="$3" use_color="$4"
    if [[ "$use_color" == true ]]; then
        tds_text_color "$token"; printf "%-${width}s" "$value"; reset_color; printf "  "
    else
        printf "%-${width}s  " "$value"
    fi
}

# Print a separator dash string of given width
_tsm_svc_sep() { local w="$1"; printf '%*s' "$w" '' | tr ' ' '-'; }

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

    # Terminal width
    local term_w="${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}"

    # Fixed column widths
    local w_user=10 w_org=12 w_name=20 w_port=5 w_en=2 w_run=3
    local gap=2  # spaces between columns

    # Calculate COMMAND column width from remaining space
    local fixed=0
    (( fixed += w_org + gap + w_name + gap + w_port + gap + w_run + gap ))
    [[ "$show_user" == true ]] && (( fixed += w_user + gap ))
    [[ "$show_en" == true ]] && (( fixed += w_en + gap ))
    local w_cmd=$(( term_w - fixed ))
    (( w_cmd < 10 )) && w_cmd=10

    # --- Header ---
    _tsm_svc_header() {
        local label="$1" sep="$2"
        [[ "$use_color" == true ]] && tds_text_color "structural.primary"
        [[ "$show_user" == true ]] && printf "%-${w_user}s  " "$( [[ $label == hdr ]] && echo USER || _tsm_svc_sep $w_user)"
        printf "%-${w_org}s  " "$( [[ $label == hdr ]] && echo ORG || _tsm_svc_sep $w_org)"
        printf "%-${w_name}s  " "$( [[ $label == hdr ]] && echo NAME || _tsm_svc_sep $w_name)"
        printf "%-${w_port}s  " "$( [[ $label == hdr ]] && echo PORT || _tsm_svc_sep $w_port)"
        [[ "$show_en" == true ]] && printf "%-${w_en}s  " "$( [[ $label == hdr ]] && echo EN || _tsm_svc_sep $w_en)"
        printf "%-${w_run}s  " "$( [[ $label == hdr ]] && echo RUN || _tsm_svc_sep $w_run)"
        printf "%s" "$( [[ $label == hdr ]] && echo COMMAND || _tsm_svc_sep $w_cmd)"
        [[ "$use_color" == true ]] && reset_color
        echo
    }

    if [[ "$use_color" == true ]]; then
        tds_text_color "structural.primary"; _tsm_svc_header hdr; reset_color
        tds_text_color "text.dim"; _tsm_svc_header sep; reset_color
    else
        _tsm_svc_header hdr
        _tsm_svc_header sep
    fi

    # --- Rows ---
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

            local port="${TSM_PORT:-auto}"
            local cmd="${TSM_COMMAND:-}"
            [[ ${#cmd} -gt $w_cmd ]] && cmd="${cmd:0:$((w_cmd-3))}..."

            local enabled=" "
            [[ "$show_en" == true ]] && _tsm_is_enabled "$name" "$org" "$user_home" && enabled="*"

            local running=" "
            _tsm_service_running "$name" && running="*"

            # Print row
            [[ "$show_user" == true ]] && _tsm_svc_col "accent.info" "$w_user" "$owner" "$use_color"
            _tsm_svc_col "text.muted" "$w_org" "$org" "$use_color"
            _tsm_svc_col "text.primary" "$w_name" "$name" "$use_color"
            _tsm_svc_col "text.tertiary" "$w_port" "$port" "$use_color"

            if [[ "$show_en" == true ]]; then
                if [[ "$enabled" == "*" && "$use_color" == true ]]; then
                    _tsm_svc_col "feedback.success" "$w_en" "$enabled" true
                else
                    _tsm_svc_col "text.muted" "$w_en" "$enabled" "$use_color"
                fi
            fi

            if [[ "$running" == "*" && "$use_color" == true ]]; then
                _tsm_svc_col "status.success" "$w_run" "$running" true
            else
                _tsm_svc_col "text.muted" "$w_run" "$running" "$use_color"
            fi

            # Command column (last, no trailing pad)
            if [[ "$use_color" == true ]]; then
                tds_text_color "text.muted"; printf "%s" "$cmd"; reset_color
            else
                printf "%s" "$cmd"
            fi
            echo

            ((count++))
        done
    done < <(_tsm_get_services_dirs "$mode")

    [[ $count -eq 0 ]] && echo "(no services ${mode})"
}

