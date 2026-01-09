#!/usr/bin/env bash
# TSM List - process listing with verbosity levels
#
# Verbosity levels:
#   (none)  : Compact table (ID, NAME, PID, PORT, STATUS, UPTIME)
#   -v      : Add TYPE, CWD columns
#   -vv     : Add parent/sibling relations
#   -vvv    : Multiline detailed format per service
#   -vvvv   : Full metadata dump

# List running processes or service definitions
# Usage: tsm_list [available|enabled] [-v...] [-a] [-U] [-p] [-g] [--org ORG] [--json]
#
# Modes:
#   (default)  - Running processes
#   available  - Service definitions in services-available/
#   enabled    - Service definitions in services-enabled/
#
# Flags:
#   -a         - Include stopped processes (running mode only)
#   -U         - All users (requires root)
#   --org ORG  - Filter by org name
#   -g         - Group by stack
#   -p         - Port-focused view
#   --json     - JSON output
tsm_list() {
    local mode="running"
    local verbosity=0
    local show_all=false
    local show_ports=false
    local json_output=false
    local all_users=false
    local group_by_stack=false
    local filter_org=""

    # Check for mode as first positional arg
    case "${1:-}" in
        available|avail) mode="available"; shift ;;
        enabled)         mode="enabled"; shift ;;
    esac

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -vvvv)           verbosity=4 ;;
            -vvv)            verbosity=3 ;;
            -vv)             verbosity=2 ;;
            -v)              verbosity=1 ;;
            -a|--all)        show_all=true ;;
            -U|--all-users)  all_users=true ;;
            --org)           filter_org="$2"; shift ;;
            -p|--ports)      show_ports=true ;;
            --json)          json_output=true ;;
            -g|--group)      group_by_stack=true ;;
            *)               break ;;
        esac
        shift
    done

    # Set global for helper functions
    _TSM_LIST_ALL_USERS="$all_users"
    _TSM_LIST_FILTER_ORG="$filter_org"

    case "$mode" in
        available)
            _tsm_list_available "$json_output"
            ;;
        enabled)
            _tsm_list_enabled "$json_output"
            ;;
        running)
            # Sweep stale processes first
            _tsm_sweep_stale

            if [[ "$json_output" == "true" ]]; then
                _tsm_list_json "$show_all"
            elif [[ "$show_ports" == "true" ]]; then
                _tsm_list_ports
            elif [[ "$group_by_stack" == "true" ]]; then
                _tsm_list_grouped "$show_all"
            elif [[ $verbosity -ge 3 ]]; then
                _tsm_list_long "$show_all" "$verbosity"
            elif [[ $verbosity -ge 1 ]]; then
                _tsm_list_verbose "$show_all" "$verbosity"
            else
                _tsm_list_table "$show_all"
            fi
            ;;
    esac
}

# Sweep stale (dead) processes
_tsm_sweep_stale() {
    local processes_dirs=()

    if [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled; then
        # Sweep all users' processes
        mapfile -t processes_dirs < <(tsm_get_all_process_dirs)
    else
        # Just current user
        [[ -d "$TSM_PROCESSES_DIR" ]] && processes_dirs+=("$TSM_PROCESSES_DIR")
    fi

    for processes_dir in "${processes_dirs[@]}"; do
        [[ -d "$processes_dir" ]] || continue
        for dir in "$processes_dir"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == .* ]] && continue

            local meta="${dir}meta.json"
            [[ -f "$meta" ]] || continue

            local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
            local status=$(jq -r '.status // empty' "$meta" 2>/dev/null)

            if [[ "$status" == "online" ]] && ! tsm_is_pid_alive "$pid"; then
                # Update status in place
                jq '.status = "stopped"' "$meta" > "${meta}.tmp" && mv "${meta}.tmp" "$meta"
            fi
        done
    done
}

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

# JSON output
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

# === AVAILABLE/ENABLED SERVICE LISTING ===

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

# List available services
_tsm_list_available() {
    local json_output="$1"
    local show_user=false
    local count=0

    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true
    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

    if [[ "$json_output" == "true" ]]; then
        _tsm_list_available_json
        return
    fi

    # Column widths
    local w_user=10 w_org=12 w_name=20 w_port=6 w_en=3 w_cmd=40

    # Header
    if [[ "$use_color" == true ]]; then
        tds_text_color "structural.primary"
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s" \
                "USER" "ORG" "NAME" "PORT" "EN" "COMMAND"
        else
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s" \
                "ORG" "NAME" "PORT" "EN" "COMMAND"
        fi
        reset_color; echo
        tds_text_color "text.dim"
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s" \
                "----------" "------------" "--------------------" "------" "---" "----------------------------------------"
        else
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s" \
                "------------" "--------------------" "------" "---" "----------------------------------------"
        fi
        reset_color; echo
    else
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s\n" \
                "USER" "ORG" "NAME" "PORT" "EN" "COMMAND"
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s\n" \
                "----------" "------------" "--------------------" "------" "---" "----------------------------------------"
        else
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s\n" \
                "ORG" "NAME" "PORT" "EN" "COMMAND"
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s\n" \
                "------------" "--------------------" "------" "---" "----------------------------------------"
        fi
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
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .tsm)

            # Read service definition
            local TSM_NAME="" TSM_COMMAND="" TSM_PORT=""
            source "$f" 2>/dev/null

            local port="${TSM_PORT:-auto}"
            local cmd="${TSM_COMMAND:-}"
            [[ ${#cmd} -gt $w_cmd ]] && cmd="${cmd:0:$((w_cmd-3))}..."

            # Check if enabled
            local enabled=" "
            if _tsm_is_enabled "$name" "$org" "$user_home"; then
                enabled="*"
            fi

            if [[ "$use_color" == true ]]; then
                if [[ "$show_user" == true ]]; then
                    tds_text_color "accent.info"; printf "%-${w_user}s" "$owner"; reset_color; printf "  "
                fi
                tds_text_color "text.muted"; printf "%-${w_org}s" "$org"; reset_color; printf "  "
                tds_text_color "text.primary"; printf "%-${w_name}s" "$name"; reset_color; printf "  "
                tds_text_color "text.tertiary"; printf "%-${w_port}s" "$port"; reset_color; printf "  "
                if [[ "$enabled" == "*" ]]; then
                    tds_text_color "feedback.success"; printf "%-${w_en}s" "$enabled"; reset_color
                else
                    printf "%-${w_en}s" "$enabled"
                fi
                printf "  "
                tds_text_color "text.muted"; printf "%s" "$cmd"; reset_color
                echo
            else
                if [[ "$show_user" == true ]]; then
                    printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s\n" \
                        "$owner" "$org" "$name" "$port" "$enabled" "$cmd"
                else
                    printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %-${w_en}s  %s\n" \
                        "$org" "$name" "$port" "$enabled" "$cmd"
                fi
            fi

            ((count++))
        done
    done < <(_tsm_get_services_dirs "available")

    [[ $count -eq 0 ]] && echo "(no services available)"
}

# List enabled services
_tsm_list_enabled() {
    local json_output="$1"
    local show_user=false
    local count=0

    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true
    [[ -z "${_TSM_COLORS_LOADED:-}" ]] && source "${TETRA_SRC}/bash/tsm/lib/colors.sh"

    local use_color=false
    [[ "$_TSM_HAS_TDS" == true ]] && [[ -t 1 ]] && use_color=true

    if [[ "$json_output" == "true" ]]; then
        _tsm_list_enabled_json
        return
    fi

    # Column widths
    local w_user=10 w_org=12 w_name=20 w_port=6 w_cmd=40

    # Header
    if [[ "$use_color" == true ]]; then
        tds_text_color "structural.primary"
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %s" \
                "USER" "ORG" "NAME" "PORT" "COMMAND"
        else
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %s" \
                "ORG" "NAME" "PORT" "COMMAND"
        fi
        reset_color; echo
        tds_text_color "text.dim"
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %s" \
                "----------" "------------" "--------------------" "------" "----------------------------------------"
        else
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %s" \
                "------------" "--------------------" "------" "----------------------------------------"
        fi
        reset_color; echo
    else
        if [[ "$show_user" == true ]]; then
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %s\n" \
                "USER" "ORG" "NAME" "PORT" "COMMAND"
            printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %s\n" \
                "----------" "------------" "--------------------" "------" "----------------------------------------"
        else
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %s\n" \
                "ORG" "NAME" "PORT" "COMMAND"
            printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %s\n" \
                "------------" "--------------------" "------" "----------------------------------------"
        fi
    fi

    # Iterate enabled services
    while IFS= read -r services_dir; do
        [[ -d "$services_dir" ]] || continue

        local org=$(_tsm_extract_org "$services_dir")

        # Apply org filter
        [[ -n "$_TSM_LIST_FILTER_ORG" && "$org" != "$_TSM_LIST_FILTER_ORG" ]] && continue

        local owner=""
        [[ "$show_user" == true ]] && owner=$(tsm_extract_username "$services_dir")

        for f in "$services_dir"/*.tsm; do
            [[ -L "$f" ]] || continue  # Only symlinks in enabled
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .tsm)

            # Read service definition
            local TSM_NAME="" TSM_COMMAND="" TSM_PORT=""
            source "$f" 2>/dev/null

            local port="${TSM_PORT:-auto}"
            local cmd="${TSM_COMMAND:-}"
            [[ ${#cmd} -gt $w_cmd ]] && cmd="${cmd:0:$((w_cmd-3))}..."

            if [[ "$use_color" == true ]]; then
                if [[ "$show_user" == true ]]; then
                    tds_text_color "accent.info"; printf "%-${w_user}s" "$owner"; reset_color; printf "  "
                fi
                tds_text_color "text.muted"; printf "%-${w_org}s" "$org"; reset_color; printf "  "
                tds_text_color "feedback.success"; printf "%-${w_name}s" "$name"; reset_color; printf "  "
                tds_text_color "text.tertiary"; printf "%-${w_port}s" "$port"; reset_color; printf "  "
                tds_text_color "text.muted"; printf "%s" "$cmd"; reset_color
                echo
            else
                if [[ "$show_user" == true ]]; then
                    printf "%-${w_user}s  %-${w_org}s  %-${w_name}s  %-${w_port}s  %s\n" \
                        "$owner" "$org" "$name" "$port" "$cmd"
                else
                    printf "%-${w_org}s  %-${w_name}s  %-${w_port}s  %s\n" \
                        "$org" "$name" "$port" "$cmd"
                fi
            fi

            ((count++))
        done
    done < <(_tsm_get_services_dirs "enabled")

    [[ $count -eq 0 ]] && echo "(no services enabled)"
}

# JSON output for available services
_tsm_list_available_json() {
    local first=true
    local show_user=false

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
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .tsm)

            local TSM_NAME="" TSM_COMMAND="" TSM_PORT=""
            source "$f" 2>/dev/null

            local enabled="false"
            _tsm_is_enabled "$name" "$org" "$user_home" && enabled="true"

            $first || echo ","
            first=false

            if [[ "$show_user" == true ]]; then
                printf '  {"user":"%s","org":"%s","name":"%s","port":"%s","enabled":%s,"command":"%s"}' \
                    "$owner" "$org" "$name" "${TSM_PORT:-auto}" "$enabled" "${TSM_COMMAND:-}"
            else
                printf '  {"org":"%s","name":"%s","port":"%s","enabled":%s,"command":"%s"}' \
                    "$org" "$name" "${TSM_PORT:-auto}" "$enabled" "${TSM_COMMAND:-}"
            fi
        done
    done < <(_tsm_get_services_dirs "available")
    echo ""
    echo "]"
}

# JSON output for enabled services
_tsm_list_enabled_json() {
    local first=true
    local show_user=false

    [[ "$_TSM_LIST_ALL_USERS" == "true" ]] && tsm_multi_user_enabled && show_user=true

    echo "["
    while IFS= read -r services_dir; do
        [[ -d "$services_dir" ]] || continue

        local org=$(_tsm_extract_org "$services_dir")
        [[ -n "$_TSM_LIST_FILTER_ORG" && "$org" != "$_TSM_LIST_FILTER_ORG" ]] && continue

        local owner=""
        [[ "$show_user" == true ]] && owner=$(tsm_extract_username "$services_dir")

        for f in "$services_dir"/*.tsm; do
            [[ -L "$f" ]] || continue
            [[ -f "$f" ]] || continue
            local name=$(basename "$f" .tsm)

            local TSM_NAME="" TSM_COMMAND="" TSM_PORT=""
            source "$f" 2>/dev/null

            $first || echo ","
            first=false

            if [[ "$show_user" == true ]]; then
                printf '  {"user":"%s","org":"%s","name":"%s","port":"%s","command":"%s"}' \
                    "$owner" "$org" "$name" "${TSM_PORT:-auto}" "${TSM_COMMAND:-}"
            else
                printf '  {"org":"%s","name":"%s","port":"%s","command":"%s"}' \
                    "$org" "$name" "${TSM_PORT:-auto}" "${TSM_COMMAND:-}"
            fi
        done
    done < <(_tsm_get_services_dirs "enabled")
    echo ""
    echo "]"
}

export -f tsm_list _tsm_sweep_stale _tsm_list_table _tsm_list_grouped _tsm_grouped_header _tsm_grouped_row _tsm_list_verbose _tsm_list_long _tsm_list_ports _tsm_list_json
export -f _tsm_get_services_dirs _tsm_extract_org _tsm_is_enabled _tsm_list_available _tsm_list_enabled _tsm_list_available_json _tsm_list_enabled_json
