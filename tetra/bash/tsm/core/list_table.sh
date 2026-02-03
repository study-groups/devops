#!/usr/bin/env bash
# TSM List - compact table, grouped, and port-focused views

# Compact table format (default)
_tsm_list_table() {
    local show_all="$1"
    local count=0
    local show_user=false

    # Check if we should show USER column
    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true

    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

    local w_user=10 w_id=3 w_name=22 w_pid=6 w_port=5 w_status=7 w_uptime=10

    # Header
    if [[ "$use_color" == true ]]; then
        tds_text_color "structural.primary"
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s" \
                "USER" "ID" "NAME" "PID" "PORT" "STATUS" "UPTIME"
        else
            printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s" \
                "ID" "NAME" "PID" "PORT" "STATUS" "UPTIME"
        fi
        reset_color
        echo
        tds_text_color "text.dim"
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s" \
                "----------" "---" "----------------------" "------" "-----" "-------" "------"
        else
            printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s" \
                "---" "----------------------" "------" "-----" "-------" "------"
        fi
        reset_color
        echo
    else
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
                "USER" "ID" "NAME" "PID" "PORT" "STATUS" "UPTIME"
            printf "%-${w_user}s  %-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
                "----------" "---" "----------------------" "------" "-----" "-------" "------"
        else
            printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
                "ID" "NAME" "PID" "PORT" "STATUS" "UPTIME"
            printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
                "---" "----------------------" "------" "-----" "-------" "------"
        fi
    fi

    # Get process directories to iterate
    local processes_dirs=()
    if [[ "$show_user" == true ]]; then
        mapfile -t processes_dirs < <(tsm_get_all_process_dirs)
    else
        [[ -d "$TSM_PROCESSES_DIR" ]] && processes_dirs+=("$TSM_PROCESSES_DIR")
    fi

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

            [[ ${#name} -gt $w_name ]] && name="${name:0:$((w_name-3))}..."
            [[ "$port" == "null" || "$port" == "0" ]] && port="-"

            if [[ "$use_color" == true ]]; then
                if [[ "$show_user" == true ]]; then
                    tds_text_color "accent.info"; printf "%-${w_user}s" "$owner"; reset_color; printf "  "
                fi
                tds_text_color "text.muted"; printf "%-${w_id}s" "$id"; reset_color; printf "  "
                tsm_format_name "$name" "$w_name"; printf "  "
                tds_text_color "text.tertiary"; printf "%-${w_pid}s" "$pid"; reset_color; printf "  "
                tds_text_color "text.tertiary"; printf "%-${w_port}s" "$port"; reset_color; printf "  "
                local status_token=$(_tsm_status_token "$status")
                tds_text_color "$status_token"; printf "%-${w_status}s" "$status"; reset_color; printf "  "
                tds_text_color "text.muted"; printf "%s" "$uptime"; reset_color
                echo
            else
                if [[ "$show_user" == true ]]; then
                    printf "%-${w_user}s  %-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
                        "$owner" "$id" "$name" "$pid" "$port" "$status" "$uptime"
                else
                    printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
                        "$id" "$name" "$pid" "$port" "$status" "$uptime"
                fi
            fi

            ((count++))
        done
    done

    [[ $count -eq 0 ]] && echo "(no processes)"
}

# Stack-grouped table format (-g, --group)
_tsm_list_grouped() {
    local show_all="$1"
    local show_user=false

    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true
    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

    # Collect processes by stack
    declare -A stack_procs  # stack_name -> newline-separated process dirs
    local standalone_procs=""

    # Get process directories
    local processes_dirs=()
    if [[ "$show_user" == true ]]; then
        mapfile -t processes_dirs < <(tsm_get_all_process_dirs)
    else
        [[ -d "$TSM_PROCESSES_DIR" ]] && processes_dirs+=("$TSM_PROCESSES_DIR")
    fi

    # First pass: collect and categorize by stack
    for processes_dir in "${processes_dirs[@]}"; do
        [[ -d "$processes_dir" ]] || continue

        for dir in "$processes_dir"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == .* ]] && continue

            local meta="${dir}meta.json"
            [[ -f "$meta" ]] || continue

            local status=$(jq -r '.status // "unknown"' "$meta" 2>/dev/null)
            local pid=$(jq -r '.pid // "-"' "$meta" 2>/dev/null)

            if tsm_is_pid_alive "$pid"; then
                status="online"
            else
                [[ "$status" == "online" ]] && status="stopped"
            fi

            [[ "$show_all" != "true" && "$status" != "online" ]] && continue

            local stack=$(jq -r '.stack // empty' "$meta" 2>/dev/null)

            if [[ -n "$stack" && "$stack" != "null" ]]; then
                stack_procs[$stack]+="${dir}"$'\n'
            else
                standalone_procs+="${dir}"$'\n'
            fi
        done
    done

    # Get sorted stack names
    local sorted_stacks=()
    for stack in "${!stack_procs[@]}"; do
        sorted_stacks+=("$stack")
    done
    IFS=$'\n' sorted_stacks=($(sort <<<"${sorted_stacks[*]}")); unset IFS

    local w_id=3 w_name=22 w_pid=6 w_port=5 w_status=7 w_uptime=10
    local total_count=0

    # Print each stack group
    for stack in "${sorted_stacks[@]}"; do
        # Stack header
        if [[ "$use_color" == true ]]; then
            tds_text_color "accent.warning"
            printf "=== %s ===" "$stack"
            reset_color
            echo
        else
            printf "=== %s ===\n" "$stack"
        fi

        # Column headers
        _tsm_grouped_header "$use_color" "$w_id" "$w_name" "$w_pid" "$w_port" "$w_status" "$w_uptime"

        # Print processes in this stack
        while IFS= read -r dir; do
            [[ -z "$dir" ]] && continue
            _tsm_grouped_row "$dir" "$use_color" "$w_id" "$w_name" "$w_pid" "$w_port" "$w_status" "$w_uptime"
            ((total_count++))
        done <<< "${stack_procs[$stack]}"

        echo  # Blank line between stacks
    done

    # Print standalone services
    if [[ -n "$standalone_procs" ]]; then
        if [[ "$use_color" == true ]]; then
            tds_text_color "text.muted"
            printf "=== [standalone] ==="
            reset_color
            echo
        else
            printf "=== [standalone] ===\n"
        fi

        _tsm_grouped_header "$use_color" "$w_id" "$w_name" "$w_pid" "$w_port" "$w_status" "$w_uptime"

        while IFS= read -r dir; do
            [[ -z "$dir" ]] && continue
            _tsm_grouped_row "$dir" "$use_color" "$w_id" "$w_name" "$w_pid" "$w_port" "$w_status" "$w_uptime"
            ((total_count++))
        done <<< "$standalone_procs"
    fi

    [[ $total_count -eq 0 ]] && echo "(no processes)"
}

# Helper: print table header for grouped output
_tsm_grouped_header() {
    local use_color="$1" w_id="$2" w_name="$3" w_pid="$4" w_port="$5" w_status="$6" w_uptime="$7"

    if [[ "$use_color" == true ]]; then
        tds_text_color "structural.primary"
        printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s" \
            "ID" "NAME" "PID" "PORT" "STATUS" "UPTIME"
        reset_color
        echo
        tds_text_color "text.dim"
        printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s" \
            "---" "----------------------" "------" "-----" "-------" "------"
        reset_color
        echo
    else
        printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
            "ID" "NAME" "PID" "PORT" "STATUS" "UPTIME"
        printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
            "---" "----------------------" "------" "-----" "-------" "------"
    fi
}

# Helper: print single process row for grouped output
_tsm_grouped_row() {
    local dir="$1" use_color="$2" w_id="$3" w_name="$4" w_pid="$5" w_port="$6" w_status="$7" w_uptime="$8"

    local meta="${dir}meta.json"
    [[ -f "$meta" ]] || return

    local name=$(basename "$dir")
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

    local uptime="-"
    if [[ "$status" == "online" && -n "$started" ]]; then
        uptime=$(tsm_format_uptime $(($(date +%s) - started)))
    fi

    [[ ${#name} -gt $w_name ]] && name="${name:0:$((w_name-3))}..."
    [[ "$port" == "null" || "$port" == "0" ]] && port="-"

    if [[ "$use_color" == true ]]; then
        tds_text_color "text.muted"; printf "%-${w_id}s" "$id"; reset_color; printf "  "
        tsm_format_name "$name" "$w_name"; printf "  "
        tds_text_color "text.tertiary"; printf "%-${w_pid}s" "$pid"; reset_color; printf "  "
        tds_text_color "text.tertiary"; printf "%-${w_port}s" "$port"; reset_color; printf "  "
        local status_token=$(_tsm_status_token "$status")
        tds_text_color "$status_token"; printf "%-${w_status}s" "$status"; reset_color; printf "  "
        tds_text_color "text.muted"; printf "%s" "$uptime"; reset_color
        echo
    else
        printf "%-${w_id}s  %-${w_name}s  %-${w_pid}s  %-${w_port}s  %-${w_status}s  %s\n" \
            "$id" "$name" "$pid" "$port" "$status" "$uptime"
    fi
}

# Port-focused output
_tsm_list_ports() {
    local show_user=false

    # Check if we should show USER column
    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true

    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

    if [[ "$use_color" == true ]]; then
        tds_text_color "structural.primary"
        if [[ "$show_user" == true ]]; then
            printf "%-10s  %-5s  %-22s  %-6s  %-5s  %s" "USER" "PORT" "NAME" "PID" "PROTO" "CONN"
        else
            printf "%-5s  %-22s  %-6s  %-5s  %s" "PORT" "NAME" "PID" "PROTO" "CONN"
        fi
        reset_color; echo
        tds_text_color "text.dim"
        if [[ "$show_user" == true ]]; then
            printf "%-10s  %-5s  %-22s  %-6s  %-5s  %s" "----------" "-----" "----------------------" "------" "-----" "----"
        else
            printf "%-5s  %-22s  %-6s  %-5s  %s" "-----" "----------------------" "------" "-----" "----"
        fi
        reset_color; echo
    else
        if [[ "$show_user" == true ]]; then
            printf "%-10s  %-5s  %-22s  %-6s  %-5s  %s\n" "USER" "PORT" "NAME" "PID" "PROTO" "CONN"
            printf "%-10s  %-5s  %-22s  %-6s  %-5s  %s\n" "----------" "-----" "----------------------" "------" "-----" "----"
        else
            printf "%-5s  %-22s  %-6s  %-5s  %s\n" "PORT" "NAME" "PID" "PROTO" "CONN"
            printf "%-5s  %-22s  %-6s  %-5s  %s\n" "-----" "----------------------" "------" "-----" "----"
        fi
    fi

    # Get process directories to iterate
    local processes_dirs=()
    if [[ "$show_user" == true ]]; then
        mapfile -t processes_dirs < <(tsm_get_all_process_dirs)
    else
        [[ -d "$TSM_PROCESSES_DIR" ]] && processes_dirs+=("$TSM_PROCESSES_DIR")
    fi

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

            local pid=$(jq -r '.pid // "-"' "$meta" 2>/dev/null)
            tsm_is_pid_alive "$pid" || continue

            local port=$(jq -r '.port // "-"' "$meta" 2>/dev/null)
            [[ "$port" == "null" || "$port" == "0" || "$port" == "-" ]] && continue

            # Get connection count via lsof
            local conn_count=$(tsm_port_connections "$port")

            if [[ "$use_color" == true ]]; then
                if [[ "$show_user" == true ]]; then
                    tds_text_color "accent.info"; printf "%-10s" "$owner"; reset_color; printf "  "
                fi
                tds_text_color "text.tertiary"; printf "%-5s" "$port"; reset_color; printf "  "
                tds_text_color "text.primary"; printf "%-22s" "$name"; reset_color; printf "  "
                tds_text_color "text.muted"; printf "%-6s  %-5s  " "$pid" "tcp"; reset_color
                if [[ "$conn_count" -gt 0 ]]; then
                    tds_text_color "feedback.success"; printf "%s" "$conn_count"; reset_color
                else
                    printf "%s" "$conn_count"
                fi
                echo
            else
                if [[ "$show_user" == true ]]; then
                    printf "%-10s  %-5s  %-22s  %-6s  %-5s  %s\n" "$owner" "$port" "$name" "$pid" "tcp" "$conn_count"
                else
                    printf "%-5s  %-22s  %-6s  %-5s  %s\n" "$port" "$name" "$pid" "tcp" "$conn_count"
                fi
            fi
        done
    done
}

