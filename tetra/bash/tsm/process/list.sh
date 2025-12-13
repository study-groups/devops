#!/usr/bin/env bash

# TSM List - Service listing with running|available|all options
# Default: running services only

# Load color module
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    source "$TETRA_SRC/bash/color/color_palettes.sh"
fi

# Services-enabled location (consolidated in Phase 3)
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

# Print table header (multi-user aware)
print_table_header() {
    text_color "00AAAA"
    if [[ $TSM_MULTI_USER_ENABLED -eq 1 ]]; then
        # Multi-user mode: show USER column
        printf "%-10s %-3s %-20s %-10s %-5s %-5s %-8s %-8s %-8s\n" \
            "USER" "ID" "Name" "Env" "PID" "Port" "Status" "Type" "Uptime"
        printf "%-10s %-3s %-20s %-10s %-5s %-5s %-8s %-8s %-8s\n" \
            "----------" "--" "--------------------" "----------" "-----" "-----" "--------" "--------" "--------"
    else
        # Single-user mode: no USER column
        printf "%-3s %-25s %-10s %-5s %-5s %-8s %-8s %-8s\n" \
            "ID" "Name" "Env" "PID" "Port" "Status" "Type" "Uptime"
        printf "%-3s %-25s %-10s %-5s %-5s %-8s %-8s %-8s\n" \
            "--" "-------------------------" "----------" "-----" "-----" "--------" "--------" "--------"
    fi
    reset_color
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
    echo "$service_name|$env_file|$pid|$port|$status|$uptime"
}

# Helper: Print a single process row
_tsm_print_process_row() {
    local tsm_id="$1"
    local display_name="$2"
    local env_display="$3"
    local pid="$4"
    local port="$5"
    local type_display="$6"
    local uptime="$7"
    local owner_user="$8"

    # Print with colors (format depends on multi-user mode)
    if [[ $TSM_MULTI_USER_ENABLED -eq 1 && -n "$owner_user" ]]; then
        # Multi-user mode: include USER column
        printf "%-10s %-3s %-20s %-10s %-5s %-5s " "$owner_user" "$tsm_id" "$display_name" "$env_display" "$pid" "$port"
    else
        # Single-user mode: no USER column
        printf "%-3s %-25s %-10s %-5s %-5s " "$tsm_id" "$display_name" "$env_display" "$pid" "$port"
    fi

    text_color "00AA00"; printf "%-8s" "online"; reset_color
    printf " %-8s %-8s\n" "$type_display" "$uptime"
}

# Helper: List processes from a single directory (hierarchical display)
_tsm_list_processes_from_dir() {
    local processes_dir="$1"
    local owner_user="$2"  # Optional: username for multi-user display
    local found_running=false

    # Arrays to hold process data (bash 5.2+)
    declare -A proc_data      # name -> "tsm_id|pid|port|start_time|env_file|service_type|comm_type"
    declare -A proc_parent    # name -> parent_name
    declare -a root_procs=()  # Names of root processes (no parent)
    declare -A children_of    # parent_name -> space-separated child names

    # First pass: collect all running processes
    for process_dir in "$processes_dir"/*/; do
        [[ -d "$process_dir" ]] || continue

        local name=$(basename "$process_dir")
        local meta_file="$process_dir/meta.json"
        [[ -f "$meta_file" ]] || continue

        # Read all metadata in one jq call
        local metadata
        metadata=$(jq -r '[.tsm_id, .pid, .port, .start_time, .env_file, .service_type, .parent, .comm_type] | @tsv' "$meta_file" 2>/dev/null)
        [[ -z "$metadata" ]] && continue

        local tsm_id pid port start_time env_file service_type parent_name comm_type
        read tsm_id pid port start_time env_file service_type parent_name comm_type <<< "$metadata"

        # Only include running processes
        if ! tsm_is_pid_alive "$pid"; then
            continue
        fi

        # Store process data
        proc_data["$name"]="$tsm_id|$pid|$port|$start_time|$env_file|$service_type|$comm_type"

        # Track parent-child relationships
        if [[ -z "$parent_name" || "$parent_name" == "null" ]]; then
            root_procs+=("$name")
            proc_parent["$name"]=""
        else
            proc_parent["$name"]="$parent_name"
            # Add to parent's children list
            if [[ -n "${children_of[$parent_name]}" ]]; then
                children_of["$parent_name"]+=" $name"
            else
                children_of["$parent_name"]="$name"
            fi
        fi
    done

    # Second pass: print hierarchically (roots first, then their children)
    for root_name in "${root_procs[@]}"; do
        [[ -z "${proc_data[$root_name]}" ]] && continue

        # Parse root process data
        IFS='|' read tsm_id pid port start_time env_file service_type comm_type <<< "${proc_data[$root_name]}"

        # Calculate uptime
        local uptime=$(tsm_calculate_uptime "$start_time")

        # Format env file (basename only)
        local env_display="-"
        if [[ -n "$env_file" && "$env_file" != "null" && "$env_file" != "" ]]; then
            env_display=$(basename "$env_file" 2>/dev/null || echo "-")
        fi

        # Format port
        [[ -z "$port" || "$port" == "none" || "$port" == "null" || "$port" == "0" ]] && port="-"

        # Format service type
        local type_display="${service_type:-pid}"

        # Print root process
        _tsm_print_process_row "$tsm_id" "$root_name" "$env_display" "$pid" "$port" "$type_display" "$uptime" "$owner_user"
        found_running=true

        # Print children (indented with tree character)
        local child_list="${children_of[$root_name]}"
        if [[ -n "$child_list" ]]; then
            local children=($child_list)
            local num_children=${#children[@]}
            local i=0

            for child_name in "${children[@]}"; do
                [[ -z "${proc_data[$child_name]}" ]] && continue

                # Parse child process data
                IFS='|' read c_tsm_id c_pid c_port c_start_time c_env_file c_service_type c_comm_type <<< "${proc_data[$child_name]}"

                # Calculate uptime
                local c_uptime=$(tsm_calculate_uptime "$c_start_time")

                # Format env file
                local c_env_display="-"
                if [[ -n "$c_env_file" && "$c_env_file" != "null" && "$c_env_file" != "" ]]; then
                    c_env_display=$(basename "$c_env_file" 2>/dev/null || echo "-")
                fi

                # Format port (children often don't have ports)
                [[ -z "$c_port" || "$c_port" == "none" || "$c_port" == "null" || "$c_port" == "0" ]] && c_port="-"

                # For children, show comm_type instead of service_type
                local c_type_display="${c_comm_type:-${c_service_type:-pid}}"
                [[ "$c_type_display" == "null" ]] && c_type_display="pid"

                # Tree prefix: └─ for last child, ├─ for others
                local prefix="├─"
                ((i++))
                [[ $i -eq $num_children ]] && prefix="└─"

                # Print child with tree prefix
                local display_name="$prefix $child_name"
                _tsm_print_process_row "$c_tsm_id" "$display_name" "$c_env_display" "$c_pid" "$c_port" "$c_type_display" "$c_uptime" "$owner_user"
                found_running=true
            done
        fi
    done

    # Handle orphan children (parent not running but child is)
    for name in "${!proc_data[@]}"; do
        local parent="${proc_parent[$name]}"
        # Skip roots (already printed) and children of running parents
        [[ -z "$parent" ]] && continue
        [[ -n "${proc_data[$parent]}" ]] && continue

        # This is an orphan - parent specified but not running
        IFS='|' read tsm_id pid port start_time env_file service_type comm_type <<< "${proc_data[$name]}"

        local uptime=$(tsm_calculate_uptime "$start_time")
        local env_display="-"
        if [[ -n "$env_file" && "$env_file" != "null" && "$env_file" != "" ]]; then
            env_display=$(basename "$env_file" 2>/dev/null || echo "-")
        fi
        [[ -z "$port" || "$port" == "none" || "$port" == "null" || "$port" == "0" ]] && port="-"
        local type_display="${service_type:-pid}"

        # Show with orphan indicator
        local display_name="(orphan) $name"
        _tsm_print_process_row "$tsm_id" "$display_name" "$env_display" "$pid" "$port" "$type_display" "$uptime" "$owner_user"
        found_running=true
    done

    return $([ "$found_running" = "true" ] && echo 0 || echo 1)
}

# List running services only (PM2-style: read from process directories)
tsm_list_running() {
    local filter_user="${1:-}"  # Optional: filter by username

    print_table_header

    local found_running=false

    # Multi-user support: scan all users if enabled, or just current user
    if [[ $TSM_MULTI_USER_ENABLED -eq 1 ]]; then
        # Multi-user mode: scan all user homes
        while IFS= read -r processes_dir; do
            local owner=$(tsm_get_instance_owner "$processes_dir")

            # Apply user filter if specified
            if [[ -n "$filter_user" && "$filter_user" != "$owner" ]]; then
                continue
            fi

            if _tsm_list_processes_from_dir "$processes_dir" "$owner"; then
                found_running=true
            fi
        done < <(tsm_get_all_process_dirs)
    else
        # Single-user mode: only current user's processes
        if [[ -d "$TSM_PROCESSES_DIR" ]]; then
            if _tsm_list_processes_from_dir "$TSM_PROCESSES_DIR" ""; then
                found_running=true
            fi
        fi
    fi

    if [[ "$found_running" == "false" ]]; then
        echo ""
        if [[ -n "$filter_user" ]]; then
            echo "No running services found for user '$filter_user'."
        else
            echo "No running services found."
            echo "Start services with: tsm start <service-name>"
        fi
    fi
}

# List available services - delegates to tetra_tsm_list_services()
tsm_list_available() {
    tetra_tsm_list_services "$@"
}

# List all services - delegates to tetra_tsm_list_services()
tsm_list_all() {
    tetra_tsm_list_services "$@"
}

# Truncate path in the middle to fit within width
_tsm_truncate_path() {
    local path="$1"
    local max_width="$2"

    local path_len=${#path}

    if [[ $path_len -le $max_width ]]; then
        echo "$path"
        return
    fi

    # Calculate how much to keep on each side
    local keep=$((max_width - 3))  # Reserve 3 chars for "..."
    local left=$((keep / 2))
    local right=$((keep - left))

    echo "${path:0:$left}...${path: -$right}"
}

# List running services in long/detailed format
tsm_list_long() {
    local found_running=false

    # Read from process directories
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue

            local name=$(basename "$process_dir")
            local meta_file="$process_dir/meta.json"
            [[ -f "$meta_file" ]] || continue

            # Read all metadata (read each field individually to avoid tab-splitting issues)
            local tsm_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
            local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
            local start_time=$(jq -r '.start_time // empty' "$meta_file" 2>/dev/null)
            local interpreter=$(jq -r '.interpreter // empty' "$meta_file" 2>/dev/null)
            local command=$(jq -r '.command // empty' "$meta_file" 2>/dev/null)
            local cwd=$(jq -r '.cwd // empty' "$meta_file" 2>/dev/null)
            local port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
            local env_file=$(jq -r '.env_file // empty' "$meta_file" 2>/dev/null)
            local parent_name=$(jq -r '.parent // empty' "$meta_file" 2>/dev/null)

            [[ -z "$pid" ]] && continue

            # Format name with arrow if this is a child process
            local display_name="$name"
            if [[ -n "$parent_name" && "$parent_name" != "null" ]]; then
                display_name="← $name"
            fi

            # Verify process is still running
            if tsm_is_pid_alive "$pid"; then
                [[ "$found_running" == "true" ]] && echo ""  # Spacing between entries
                found_running=true

                # Calculate uptime
                local uptime=$(tsm_calculate_uptime "$start_time")

                # Get CPU and memory stats
                local cpu_usage="0.0%"
                local mem_usage="0 MB"
                if command -v ps >/dev/null 2>&1; then
                    cpu_usage=$(ps -p "$pid" -o %cpu= 2>/dev/null | xargs || echo "0.0")%
                    local mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | xargs || echo "0")
                    local mem_mb=$(awk "BEGIN {printf \"%.1f\", $mem_kb/1024}")
                    mem_usage="${mem_mb} MB"
                fi

                # Check if port is listening
                local port_status=""
                if [[ -n "$port" && "$port" != "null" && "$port" != "none" ]]; then
                    if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
                        port_status="listening"
                    else
                        port_status="not listening"
                    fi
                fi

                # Extract interpreter basename
                local interp_type=$(basename "$interpreter" 2>/dev/null || echo "bash")
                case "$interp_type" in
                    python*) interp_type="python" ;;
                    node) interp_type="node" ;;
                esac

                # Format paths with ~ for home
                local cwd_display="$cwd"
                [[ "$cwd" == "$HOME"* ]] && cwd_display="~${cwd#$HOME}"

                local cmd_display="$command"
                [[ "$command" == "$HOME"* ]] && cmd_display="~${command#$HOME}"

                local env_display="${env_file:-none}"
                [[ "$env_display" != "null" && "$env_display" != "none" && "$env_display" == "$HOME"* ]] && env_display="~${env_display#$HOME}"

                # Print formatted output - header split into two lines
                text_color "FFAA00"; echo -n "[$tsm_id] $display_name"; reset_color
                echo -n "  "
                text_color "00AA00"; echo -n "● online"; reset_color
                echo " (uptime: $uptime)"

                text_color "00AAAA"; echo -n "  $interp_type"; reset_color
                echo " PID: $pid  CPU: $cpu_usage Memory: $mem_usage"

                # Runtime section (toned down gray/monochrome)
                text_color "888888"; echo -n "  Interpreter:   "; reset_color
                text_color "AAAAAA"; echo "$interpreter"; reset_color

                text_color "888888"
                echo "  Command:       $cmd_display"
                echo "  CWD:           $cwd_display"
                if [[ -n "$port" && "$port" != "null" && "$port" != "none" ]]; then
                    echo "  Port:          $port ($port_status)"
                fi
                reset_color

                # Environment section (purple/magenta color)
                if [[ -n "$env_file" && "$env_file" != "null" && "$env_file" != "" ]]; then
                    text_color "AA88FF"
                    echo "  File:          $env_display"
                    reset_color
                fi
            else
                # Process died - mark as crashed
                tsm_set_status "$name" "crashed"
            fi
        done
    fi

    if [[ "$found_running" == "false" ]]; then
        echo ""
        echo "No running services found."
        echo "Start services with: tsm start <service-name>"
    fi
}

# List running services with PWD (compact mode: id, name, type, uptime, path)
tsm_list_pwd() {
    # Get terminal width, default to 80
    local term_width=${COLUMNS:-80}

    # Fixed column widths: ID(3) + Name(25) + Type(6) + Up(5) + spaces(4) = 43
    # Path gets remaining space
    local fixed_width=43
    local path_width=$((term_width - fixed_width))
    [[ $path_width -lt 20 ]] && path_width=20  # Minimum path width

    # Compact header
    text_color "00AAAA"
    printf "%-3s %-25s %-6s %-5s %s\n" "ID" "Name" "Type" "Up" "Path"
    printf "%-3s %-25s %-6s %-5s %s\n" "--" "-------------------------" "------" "-----" "----"
    reset_color

    local found_running=false

    # Read from process directories
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue

            local name=$(basename "$process_dir")
            local meta_file="$process_dir/meta.json"
            [[ -f "$meta_file" ]] || continue

            # Read all metadata in one jq call
            local metadata
            metadata=$(jq -r '[.tsm_id, .pid, .start_time, .interpreter, .cwd] | @tsv' "$meta_file" 2>/dev/null)
            [[ -z "$metadata" ]] && continue

            read tsm_id pid start_time interpreter cwd <<< "$metadata"

            # Verify process is still running
            if tsm_is_pid_alive "$pid"; then
                # Calculate uptime
                local uptime=$(tsm_calculate_uptime "$start_time")

                # Format interpreter/runtime - extract basename if it's a path
                local type_display="${interpreter:-bash}"
                if [[ "$type_display" == */* ]]; then
                    type_display=$(basename "$type_display")
                fi

                # Normalize common interpreters
                case "$type_display" in
                    python|python3|python3.*) type_display="python" ;;
                    node|nodejs) type_display="node" ;;
                    bash|sh) type_display="bash" ;;
                    go) type_display="go" ;;
                    ruby) type_display="ruby" ;;
                    *) type_display="${type_display:0:6}" ;;
                esac

                # Format path - use ~ for home directory
                local path_display="$cwd"
                if [[ "$cwd" == "$HOME"* ]]; then
                    path_display="~${cwd#$HOME}"
                fi

                # Truncate path if needed
                path_display=$(_tsm_truncate_path "$path_display" "$path_width")

                # Print compact format
                printf "%-3s %-25s %-6s %-5s %s\n" "$tsm_id" "$name" "$type_display" "$uptime" "$path_display"

                found_running=true
            else
                # Process died - mark as crashed
                tsm_set_status "$name" "crashed"
            fi
        done
    fi

    if [[ "$found_running" == "false" ]]; then
        echo ""
        echo "No running services found."
        echo "Start services with: tsm start <service-name>"
    fi
}

# List running services in tree format (ASCII art hierarchy)
# Format: name [id] :port (comm_type) ● status
tsm_list_tree() {
    local found_running=false

    # Arrays to hold process data (bash 5.2+)
    declare -A proc_data      # name -> "tsm_id|pid|port|status|comm_type"
    declare -A proc_parent    # name -> parent_name
    declare -a root_procs=()  # Names of root processes (no parent)
    declare -A children_of    # parent_name -> space-separated child names

    # Collect all running processes
    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        echo ""
        echo "No running services found."
        return
    fi

    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue

        local name=$(basename "$process_dir")
        local meta_file="$process_dir/meta.json"
        [[ -f "$meta_file" ]] || continue

        # Read metadata
        local metadata
        metadata=$(jq -r '[.tsm_id, .pid, .port, .parent, .comm_type, .start_time] | @tsv' "$meta_file" 2>/dev/null)
        [[ -z "$metadata" ]] && continue

        local tsm_id pid port parent_name comm_type start_time
        read tsm_id pid port parent_name comm_type start_time <<< "$metadata"

        # Only include running processes
        if ! tsm_is_pid_alive "$pid"; then
            continue
        fi

        # Store process data
        proc_data["$name"]="$tsm_id|$pid|$port|$comm_type|$start_time"

        # Track parent-child relationships
        if [[ -z "$parent_name" || "$parent_name" == "null" ]]; then
            root_procs+=("$name")
            proc_parent["$name"]=""
        else
            proc_parent["$name"]="$parent_name"
            if [[ -n "${children_of[$parent_name]}" ]]; then
                children_of["$parent_name"]+=" $name"
            else
                children_of["$parent_name"]="$name"
            fi
        fi
    done

    # Print tree
    for root_name in "${root_procs[@]}"; do
        [[ -z "${proc_data[$root_name]}" ]] && continue
        found_running=true

        IFS='|' read tsm_id pid port comm_type start_time <<< "${proc_data[$root_name]}"

        # Calculate uptime
        local uptime=$(tsm_calculate_uptime "$start_time")

        # Build root line: name [id] :port ● status (uptime)
        echo -n "$root_name "
        text_color "888888"; echo -n "[$tsm_id]"; reset_color

        if [[ -n "$port" && "$port" != "null" && "$port" != "none" && "$port" != "0" ]]; then
            text_color "00AAAA"; echo -n " :$port"; reset_color
        fi

        text_color "00AA00"; echo -n " ●"; reset_color
        echo " online ($uptime)"

        # Print children
        local child_list="${children_of[$root_name]}"
        if [[ -n "$child_list" ]]; then
            local children=($child_list)
            local num_children=${#children[@]}
            local i=0

            for child_name in "${children[@]}"; do
                [[ -z "${proc_data[$child_name]}" ]] && continue

                IFS='|' read c_tsm_id c_pid c_port c_comm_type c_start_time <<< "${proc_data[$child_name]}"
                local c_uptime=$(tsm_calculate_uptime "$c_start_time")

                # Tree connector
                ((i++))
                local connector="├──"
                [[ $i -eq $num_children ]] && connector="└──"

                # Build child line
                echo -n "$connector $child_name "
                text_color "888888"; echo -n "[$c_tsm_id]"; reset_color

                # Show comm_type in parentheses
                if [[ -n "$c_comm_type" && "$c_comm_type" != "null" ]]; then
                    text_color "FFAA00"; echo -n " ($c_comm_type)"; reset_color
                fi

                text_color "00AA00"; echo -n " ●"; reset_color
                echo " online ($c_uptime)"
            done
        fi

        echo ""  # Blank line between root processes
    done

    # Handle orphans
    for name in "${!proc_data[@]}"; do
        local parent="${proc_parent[$name]}"
        [[ -z "$parent" ]] && continue
        [[ -n "${proc_data[$parent]}" ]] && continue

        found_running=true
        IFS='|' read tsm_id pid port comm_type start_time <<< "${proc_data[$name]}"
        local uptime=$(tsm_calculate_uptime "$start_time")

        text_color "FFAA00"; echo -n "(orphan) "; reset_color
        echo -n "$name "
        text_color "888888"; echo -n "[$tsm_id]"; reset_color
        text_color "00AA00"; echo -n " ●"; reset_color
        echo " online ($uptime)"
        echo ""
    done

    if [[ "$found_running" == "false" ]]; then
        echo ""
        echo "No running services found."
        echo "Start services with: tsm start <service-name>"
    fi
}