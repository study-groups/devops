#!/usr/bin/env bash
# TSM List - verbose and long multiline views (-v/-vv/-vvv/-vvvv)

# Verbose table format (-v, -vv)
_tsm_list_verbose() {
    local show_all="$1"
    local verbosity="$2"
    local count=0
    local show_user=false

    # Check if we should show USER column
    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true

    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

    # -v adds TYPE, CWD
    # -vv adds PARENT/SIBLING info
    local w_user=10 w_id=3 w_name=20 w_pid=6 w_port=5 w_status=7 w_up=6 w_type=6 w_cwd=30

    # Header
    local hdr_fmt hdr_sep
    if [[ $verbosity -ge 2 ]]; then
        if [[ "$show_user" == true ]]; then
            hdr_fmt="%-${w_user}s %-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %-10s %s"
            hdr_sep="---------- --- -------------------- ------ ----- ------- ------ ------ ---------- -----"
        else
            hdr_fmt="%-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %-10s %s"
            hdr_sep="--- -------------------- ------ ----- ------- ------ ------ ---------- -----"
        fi
        if [[ "$use_color" == true ]]; then
            tds_text_color "structural.primary"
            if [[ "$show_user" == true ]]; then
                printf "$hdr_fmt\n" "USER" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "PARENT" "CWD"
            else
                printf "$hdr_fmt\n" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "PARENT" "CWD"
            fi
            reset_color
            tds_text_color "text.dim"; echo "$hdr_sep"; reset_color
        else
            if [[ "$show_user" == true ]]; then
                printf "$hdr_fmt\n" "USER" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "PARENT" "CWD"
            else
                printf "$hdr_fmt\n" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "PARENT" "CWD"
            fi
            echo "$hdr_sep"
        fi
    else
        if [[ "$show_user" == true ]]; then
            hdr_fmt="%-${w_user}s %-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %s"
            hdr_sep="---------- --- -------------------- ------ ----- ------- ------ ------ -----"
        else
            hdr_fmt="%-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %s"
            hdr_sep="--- -------------------- ------ ----- ------- ------ ------ -----"
        fi
        if [[ "$use_color" == true ]]; then
            tds_text_color "structural.primary"
            if [[ "$show_user" == true ]]; then
                printf "$hdr_fmt\n" "USER" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "CWD"
            else
                printf "$hdr_fmt\n" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "CWD"
            fi
            reset_color
            tds_text_color "text.dim"; echo "$hdr_sep"; reset_color
        else
            if [[ "$show_user" == true ]]; then
                printf "$hdr_fmt\n" "USER" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "CWD"
            else
                printf "$hdr_fmt\n" "ID" "NAME" "PID" "PORT" "STATUS" "UP" "TYPE" "CWD"
            fi
            echo "$hdr_sep"
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
            local interpreter=$(jq -r '.interpreter // "bash"' "$meta" 2>/dev/null)
            local cwd=$(jq -r '.cwd // "-"' "$meta" 2>/dev/null)
            local parent=$(jq -r '.parent // "-"' "$meta" 2>/dev/null)

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

            # Format fields
            [[ ${#name} -gt $w_name ]] && name="${name:0:$((w_name-3))}..."
            [[ "$port" == "null" || "$port" == "0" ]] && port="-"

            # Extract type from interpreter
            local svc_type=$(basename "$interpreter" 2>/dev/null)
            case "$svc_type" in
                python*) svc_type="python" ;;
                node*)   svc_type="node" ;;
                bash|sh) svc_type="bash" ;;
            esac
            svc_type="${svc_type:0:$w_type}"

            # Shorten CWD
            [[ "$cwd" == "$HOME"* ]] && cwd="~${cwd#$HOME}"
            [[ ${#cwd} -gt $w_cwd ]] && cwd="...${cwd: -$((w_cwd-3))}"

            if [[ $verbosity -ge 2 ]]; then
                if [[ "$show_user" == true ]]; then
                    printf "%-${w_user}s %-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %-10s %s\n" \
                        "$owner" "$id" "$name" "$pid" "$port" "$status" "$uptime" "$svc_type" "$parent" "$cwd"
                else
                    printf "%-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %-10s %s\n" \
                        "$id" "$name" "$pid" "$port" "$status" "$uptime" "$svc_type" "$parent" "$cwd"
                fi
            else
                if [[ "$show_user" == true ]]; then
                    printf "%-${w_user}s %-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %s\n" \
                        "$owner" "$id" "$name" "$pid" "$port" "$status" "$uptime" "$svc_type" "$cwd"
                else
                    printf "%-${w_id}s %-${w_name}s %-${w_pid}s %-${w_port}s %-${w_status}s %-${w_up}s %-${w_type}s %s\n" \
                        "$id" "$name" "$pid" "$port" "$status" "$uptime" "$svc_type" "$cwd"
                fi
            fi

            ((count++))
        done
    done

    [[ $count -eq 0 ]] && echo "(no processes)"
}

# Long multiline format (-vvv, -vvvv)
_tsm_list_long() {
    local show_all="$1"
    local verbosity="$2"
    local count=0
    local show_user=false

    # Check if we should show USER info
    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true

    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

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

            # Read all metadata
            local id=$(jq -r '.id // .tsm_id // "-"' "$meta" 2>/dev/null)
            local pid=$(jq -r '.pid // "-"' "$meta" 2>/dev/null)
            local port=$(jq -r '.port // "-"' "$meta" 2>/dev/null)
            local status=$(jq -r '.status // "unknown"' "$meta" 2>/dev/null)
            local started=$(jq -r '.started // .start_time // empty' "$meta" 2>/dev/null)
            local interpreter=$(jq -r '.interpreter // "bash"' "$meta" 2>/dev/null)
            local command=$(jq -r '.command // "-"' "$meta" 2>/dev/null)
            local cwd=$(jq -r '.cwd // "-"' "$meta" 2>/dev/null)
            local parent=$(jq -r '.parent // "-"' "$meta" 2>/dev/null)
            local env_file=$(jq -r '.env_file // "-"' "$meta" 2>/dev/null)

            if tsm_is_pid_alive "$pid"; then
                status="online"
            else
                [[ "$status" == "online" ]] && status="stopped"
            fi

            [[ "$show_all" != "true" && "$status" != "online" ]] && continue

            # Separator between entries
            [[ $count -gt 0 ]] && echo ""
            ((count++))

            local uptime="-"
            if [[ "$status" == "online" && -n "$started" ]]; then
                uptime=$(tsm_format_uptime $(($(date +%s) - started)))
            fi

            # Get CPU/memory if running
            local cpu_usage="0.0%" mem_usage="0 MB"
            if [[ "$status" == "online" ]] && command -v ps >/dev/null 2>&1; then
                cpu_usage=$(ps -p "$pid" -o %cpu= 2>/dev/null | xargs)%
                local mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | xargs)
                mem_usage=$(awk "BEGIN {printf \"%.1f MB\", ${mem_kb:-0}/1024}")
            fi

            # Check port listening
            local port_status=""
            if [[ "$port" != "-" && "$port" != "null" && "$port" != "0" ]]; then
                if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
                    port_status="listening"
                else
                    port_status="not listening"
                fi
            fi

            # Format paths
            [[ "$cwd" == "$HOME"* ]] && cwd="~${cwd#$HOME}"
            [[ "$command" == "$HOME"* ]] && command="~${command#$HOME}"
            [[ "$env_file" == "$HOME"* ]] && env_file="~${env_file#$HOME}"

            # Print header line with user prefix if in multi-user mode
            if [[ "$use_color" == true ]]; then
                if [[ "$show_user" == true ]]; then
                    tds_text_color "accent.info"; printf "[$owner] "; reset_color
                fi
                tds_text_color "accent.warning"; printf "[$id] $name"; reset_color
                printf "  "
                if [[ "$status" == "online" ]]; then
                    tds_text_color "feedback.success"; printf "● online"; reset_color
                else
                    tds_text_color "text.muted"; printf "○ $status"; reset_color
                fi
                printf " (uptime: $uptime)\n"

                tds_text_color "structural.primary"
                printf "  %-12s" "$(basename "$interpreter")"
                reset_color
                printf " PID: %-6s  CPU: %-6s  Memory: %s\n" "$pid" "$cpu_usage" "$mem_usage"
            else
                if [[ "$show_user" == true ]]; then
                    printf "[$owner] [$id] $name  ● $status (uptime: $uptime)\n"
                else
                    printf "[$id] $name  ● $status (uptime: $uptime)\n"
                fi
                printf "  %-12s PID: %-6s  CPU: %-6s  Memory: %s\n" "$(basename "$interpreter")" "$pid" "$cpu_usage" "$mem_usage"
            fi

            # Details
            if [[ "$use_color" == true ]]; then
                tds_text_color "text.muted"
            fi

            printf "  Interpreter:   %s\n" "$interpreter"
            printf "  Command:       %s\n" "$command"
            printf "  CWD:           %s\n" "$cwd"

            if [[ "$port" != "-" && "$port" != "null" ]]; then
                printf "  Port:          %s" "$port"
                [[ -n "$port_status" ]] && printf " (%s)" "$port_status"
                echo
            fi

            if [[ "$parent" != "-" && "$parent" != "null" ]]; then
                printf "  Parent:        %s\n" "$parent"
            fi

            if [[ "$use_color" == true ]]; then
                reset_color
            fi

            # Env file (purple)
            if [[ "$env_file" != "-" && "$env_file" != "null" && "$env_file" != "" ]]; then
                if [[ "$use_color" == true ]]; then
                    tds_text_color "accent.info"
                fi
                printf "  Env:           %s\n" "$env_file"
                if [[ "$use_color" == true ]]; then
                    reset_color
                fi
            fi

            # Runtime info (service-reported metrics)
            local runtime_file="${dir}runtime.json"
            if [[ -f "$runtime_file" ]]; then
                if [[ "$use_color" == true ]]; then
                    tds_text_color "accent.warning"
                fi
                printf "  Runtime:       "
                if [[ "$use_color" == true ]]; then
                    reset_color
                fi
                # Format runtime.json as key=value pairs on one line
                jq -r 'to_entries | map(
                    if .value | type == "object" then
                        .key + ":{" + (.value | to_entries | map(.key + "=" + (.value | tostring)) | join(",")) + "}"
                    else
                        .key + "=" + (.value | tostring)
                    end
                ) | join("  ")' "$runtime_file" 2>/dev/null
            fi

            # -vvvv: Full metadata dump
            if [[ $verbosity -ge 4 ]]; then
                echo "  ---"
                if [[ "$use_color" == true ]]; then
                    tds_text_color "text.dim"
                fi
                jq -r 'to_entries | .[] | "  \(.key): \(.value)"' "$meta" 2>/dev/null
                if [[ "$use_color" == true ]]; then
                    reset_color
                fi
            fi
        done
    done

    [[ $count -eq 0 ]] && echo "(no processes)"
}

