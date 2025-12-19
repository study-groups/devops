#!/usr/bin/env bash

# TSM List - Service listing with running|available|all options
# Default: running services only
# Uses TDS theme colors via TSM_COLOR_TOKENS

# Load color module
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    source "$TETRA_SRC/bash/color/color_palettes.sh"
fi

# Services-enabled location (consolidated in Phase 3)
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

# =============================================================================
# COLOR HELPERS - Use TSM_COLOR_TOKENS for themed output
# =============================================================================

# Get hex color from TSM token (fallback to TDS semantic or hardcoded)
_tsm_list_color() {
    local token="$1"
    local fallback="$2"

    # Try TSM token first
    if declare -f tsm_color_get >/dev/null 2>&1; then
        local hex=$(tsm_color_get "$token")
        [[ "$hex" != "888888" ]] && { echo "$hex"; return; }
    fi

    # Try TDS semantic color
    if declare -f tds_semantic_color >/dev/null 2>&1; then
        local hex=$(tds_semantic_color "$token" 2>/dev/null)
        [[ -n "$hex" ]] && { echo "${hex#\#}"; return; }
    fi

    # Fallback
    echo "${fallback:-888888}"
}

# Print with TSM token color
_tsm_list_print() {
    local token="$1"
    local text="$2"
    local hex=$(_tsm_list_color "$token")

    if declare -f text_color >/dev/null 2>&1; then
        text_color "$hex"
        printf "%s" "$text"
        reset_color
    else
        printf "%s" "$text"
    fi
}

# Print table header (multi-user aware)
print_table_header() {
    local header_color=$(_tsm_list_color "list.header" "00AAAA")
    text_color "$header_color"
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

# Detect protocol (tcp/udp) for a port and PID
_tsm_detect_protocol() {
    local port="$1"
    local pid="$2"

    [[ -z "$port" || "$port" == "-" || "$port" == "none" || "$port" == "null" ]] && { echo "pid"; return; }

    # Check if PID is using TCP on this port
    if lsof -Pan -p "$pid" -iTCP:"$port" 2>/dev/null | grep -q LISTEN; then
        echo "tcp"
        return
    fi

    # Check if PID is using UDP on this port
    if lsof -Pan -p "$pid" -iUDP:"$port" 2>/dev/null | grep -q "$port"; then
        echo "udp"
        return
    fi

    # Fallback: check any process on this port
    if lsof -i TCP:"$port" 2>/dev/null | grep -q LISTEN; then
        echo "tcp"
    elif lsof -i UDP:"$port" 2>/dev/null | grep -q "$port"; then
        echo "udp"
    else
        echo "port"
    fi
}

# Helper: Format ports for display (primary + secondary)
_tsm_format_ports() {
    local meta_file="$1"
    local primary_port="$2"

    # Get secondary ports from ports array
    local secondary_ports
    secondary_ports=$(jq -r '(.ports // []) | map(select(.protocol != "primary")) | .[].port' "$meta_file" 2>/dev/null | tr '\n' ',' | sed 's/,$//')

    if [[ -n "$secondary_ports" ]]; then
        echo "${primary_port}+${secondary_ports}"
    else
        echo "$primary_port"
    fi
}

# Helper: Print a single process row with colorized name parsing
_tsm_print_process_row() {
    local tsm_id="$1"
    local display_name="$2"
    local env_display="$3"
    local pid="$4"
    local port="$5"
    local type_display="$6"
    local uptime="$7"
    local owner_user="$8"

    # Get themed colors
    local id_color=$(_tsm_list_color "list.index" "888888")
    local name_color=$(_tsm_list_color "process.name" "EEEEEE")
    local port_suffix_color=$(_tsm_list_color "process.port_suffix" "00AA00")
    local port_color=$(_tsm_list_color "process.port" "00AAAA")
    local pid_color=$(_tsm_list_color "process.pid" "AAAAAA")
    local status_color=$(_tsm_list_color "process.running" "44DD44")
    local type_color=$(_tsm_list_color "process.type" "00ACC1")
    local uptime_color=$(_tsm_list_color "process.uptime" "CCCCCC")
    local env_color=$(_tsm_list_color "process.env" "FB8C00")

    # Parse name: split "base-name-PORT" into base and port suffix
    local base_name="$display_name"
    local name_suffix=""

    # Handle tree prefixes (├─, └─) by preserving them
    local tree_prefix=""
    if [[ "$display_name" =~ ^([├└]─[[:space:]]) ]]; then
        tree_prefix="${BASH_REMATCH[1]}"
        display_name="${display_name#${tree_prefix}}"
    fi

    # Extract port suffix if name ends with -NNNN (3-5 digits)
    if [[ "$display_name" =~ ^(.+)-([0-9]{3,5})$ ]]; then
        base_name="${BASH_REMATCH[1]}"
        name_suffix="-${BASH_REMATCH[2]}"
    fi

    # Print with colors (format depends on multi-user mode)
    if [[ $TSM_MULTI_USER_ENABLED -eq 1 && -n "$owner_user" ]]; then
        # Multi-user mode: include USER column
        printf "%-10s " "$owner_user"
        text_color "$id_color"; printf "%-3s " "$tsm_id"; reset_color

        # Colorized name: tree_prefix + base_name + port_suffix
        printf "%s" "$tree_prefix"
        text_color "$name_color"; printf "%s" "$base_name"; reset_color
        text_color "$port_suffix_color"; printf "%-*s " "$((20 - ${#tree_prefix} - ${#base_name}))" "$name_suffix"; reset_color

        text_color "$env_color"; printf "%-10s " "$env_display"; reset_color
        text_color "$pid_color"; printf "%-5s " "$pid"; reset_color
        text_color "$port_color"; printf "%-5s " "$port"; reset_color
    else
        # Single-user mode: no USER column
        text_color "$id_color"; printf "%-3s " "$tsm_id"; reset_color

        # Colorized name: tree_prefix + base_name + port_suffix
        printf "%s" "$tree_prefix"
        text_color "$name_color"; printf "%s" "$base_name"; reset_color
        text_color "$port_suffix_color"; printf "%-*s " "$((25 - ${#tree_prefix} - ${#base_name}))" "$name_suffix"; reset_color

        text_color "$env_color"; printf "%-10s " "$env_display"; reset_color
        text_color "$pid_color"; printf "%-5s " "$pid"; reset_color
        text_color "$port_color"; printf "%-5s " "$port"; reset_color
    fi

    text_color "$status_color"; printf "%-8s" "online"; reset_color
    text_color "$type_color"; printf " %-8s" "$type_display"; reset_color
    text_color "$uptime_color"; printf " %-8s\n" "$uptime"; reset_color
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

        # Detect protocol (tcp/udp) for type display
        local type_display
        type_display=$(_tsm_detect_protocol "$port" "$pid")

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

                # Detect protocol for children too
                local c_type_display
                c_type_display=$(_tsm_detect_protocol "$c_port" "$c_pid")

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

# Sweep stale processes - silently clean up dead processes
# Only logs if something was cleaned
_tsm_sweep_stale() {
    local swept=0
    local swept_names=()

    [[ -d "$TSM_PROCESSES_DIR" ]] || return 0

    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local name=$(basename "$process_dir")
        # Skip hidden/reserved dirs
        [[ "$name" == .* ]] && continue

        local meta_file="${process_dir}meta.json"
        [[ -f "$meta_file" ]] || continue

        local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
        [[ -z "$pid" ]] && continue

        # Check if process is dead
        if ! kill -0 "$pid" 2>/dev/null; then
            swept_names+=("$name")
            # Remove the stale directory
            rm -rf "$process_dir" 2>/dev/null
            ((swept++))
        fi
    done

    # Log if we swept anything
    if [[ $swept -gt 0 ]]; then
        echo "🧹 Cleaned $swept stale process(es): ${swept_names[*]}"
        echo ""
    fi
}

# List running services only (PM2-style: read from process directories)
tsm_list_running() {
    local filter_user="${1:-}"  # Optional: filter by username

    # Sweep stale processes first (silent if none)
    _tsm_sweep_stale

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

                # Get themed colors for long display
                local name_color=$(_tsm_list_color "process.name" "FFAA00")
                local status_color=$(_tsm_list_color "process.running" "00AA00")
                local port_color=$(_tsm_list_color "process.port" "00AAAA")
                local secondary_color=$(_tsm_list_color "text.secondary" "888888")
                local tertiary_color=$(_tsm_list_color "text.tertiary" "AAAAAA")

                # Print formatted output - header split into two lines
                text_color "$name_color"; echo -n "[$tsm_id] $display_name"; reset_color
                echo -n "  "
                text_color "$status_color"; echo -n "● online"; reset_color
                echo " (uptime: $uptime)"

                text_color "$port_color"; echo -n "  $interp_type"; reset_color
                echo " PID: $pid  CPU: $cpu_usage Memory: $mem_usage"

                # Runtime section (toned down gray/monochrome)
                text_color "$secondary_color"; echo -n "  Interpreter:   "; reset_color
                text_color "$tertiary_color"; echo "$interpreter"; reset_color

                text_color "$secondary_color"
                echo "  Command:       $cmd_display"
                echo "  CWD:           $cwd_display"
                if [[ -n "$port" && "$port" != "null" && "$port" != "none" ]]; then
                    echo "  Port:          $port ($port_status)"
                fi
                reset_color

                # Environment section (purple/magenta color)
                if [[ -n "$env_file" && "$env_file" != "null" && "$env_file" != "" ]]; then
                    local env_color=$(_tsm_list_color "interactive.accent" "AA88FF")
                    text_color "$env_color"
                    echo "  File:          $env_display"
                    reset_color
                fi

                # Secondary ports section (cyan color)
                local secondary_ports
                secondary_ports=$(jq -r '(.ports // []) | map(select(.protocol != "primary")) | .[] | "    \(.port) (\(.type)/\(.protocol))"' "$meta_file" 2>/dev/null)
                if [[ -n "$secondary_ports" ]]; then
                    text_color "$port_color"
                    echo "  Other Ports:"
                    echo "$secondary_ports"
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
    local header_color=$(_tsm_list_color "list.header" "00AAAA")
    text_color "$header_color"
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

    # Get themed colors for tree display
    local name_color=$(_tsm_list_color "process.name" "FFFFFF")
    local id_color=$(_tsm_list_color "list.index" "888888")
    local port_color=$(_tsm_list_color "process.port" "00AAAA")
    local status_color=$(_tsm_list_color "process.running" "00AA00")
    local warn_color=$(_tsm_list_color "status.warning" "FFAA00")

    # Print tree
    for root_name in "${root_procs[@]}"; do
        [[ -z "${proc_data[$root_name]}" ]] && continue
        found_running=true

        IFS='|' read tsm_id pid port comm_type start_time <<< "${proc_data[$root_name]}"

        # Calculate uptime
        local uptime=$(tsm_calculate_uptime "$start_time")

        # Build root line: name [id] :port ● status (uptime)
        text_color "$name_color"; echo -n "$root_name "; reset_color
        text_color "$id_color"; echo -n "[$tsm_id]"; reset_color

        if [[ -n "$port" && "$port" != "null" && "$port" != "none" && "$port" != "0" ]]; then
            text_color "$port_color"; echo -n " :$port"; reset_color
        fi

        text_color "$status_color"; echo -n " ●"; reset_color
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
                echo -n "$connector "
                text_color "$name_color"; echo -n "$child_name "; reset_color
                text_color "$id_color"; echo -n "[$c_tsm_id]"; reset_color

                # Show comm_type in parentheses
                if [[ -n "$c_comm_type" && "$c_comm_type" != "null" ]]; then
                    text_color "$warn_color"; echo -n " ($c_comm_type)"; reset_color
                fi

                text_color "$status_color"; echo -n " ●"; reset_color
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

        text_color "$warn_color"; echo -n "(orphan) "; reset_color
        text_color "$name_color"; echo -n "$name "; reset_color
        text_color "$id_color"; echo -n "[$tsm_id]"; reset_color
        text_color "$status_color"; echo -n " ●"; reset_color
        echo " online ($uptime)"
        echo ""
    done

    if [[ "$found_running" == "false" ]]; then
        echo ""
        echo "No running services found."
        echo "Start services with: tsm start <service-name>"
    fi
}

# List running services with extended port relationship view
# Shows: ● bind  ⊙ multicast  → send-to
tsm_list_ports() {
    local found_running=false

    # Header with themed colors
    local header_color=$(_tsm_list_color "list.header" "00AAAA")
    text_color "$header_color"
    printf "%-3s %-20s %-8s %-40s\n" "ID" "Name" "Status" "Ports"
    printf "%-3s %-20s %-8s %-40s\n" "--" "--------------------" "--------" "----------------------------------------"
    reset_color

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
        local tsm_id pid
        tsm_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
        pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)

        # Only show running processes
        if ! tsm_is_pid_alive "$pid"; then
            continue
        fi

        found_running=true

        # Build port string with relation symbols
        local port_str=""
        local ports_json
        ports_json=$(jq -c '.ports // []' "$meta_file" 2>/dev/null)

        if [[ "$ports_json" != "[]" ]]; then
            while IFS= read -r port_entry; do
                local p_port p_type p_relation p_protocol p_group
                p_port=$(echo "$port_entry" | jq -r '.port')
                p_type=$(echo "$port_entry" | jq -r '.type // "tcp"')
                p_relation=$(echo "$port_entry" | jq -r '.relation // "bind"')
                p_protocol=$(echo "$port_entry" | jq -r '.protocol // ""')
                p_group=$(echo "$port_entry" | jq -r '.group // ""')

                # Choose symbol based on relation
                local symbol="●"
                case "$p_relation" in
                    bind-shared) symbol="⊙" ;;
                    multicast-join) symbol="⊙" ;;
                    send-to) symbol="→" ;;
                    primary|bind) symbol="●" ;;
                esac

                # Format: ●1985/tcp or ⊙1983/udp(239.1.1.1)
                local entry="${symbol}${p_port}/${p_type}"
                [[ -n "$p_group" ]] && entry="${entry}(${p_group})"

                [[ -n "$port_str" ]] && port_str="${port_str}  "
                port_str="${port_str}${entry}"
            done < <(echo "$ports_json" | jq -c '.[]')
        fi

        # Print row with themed colors
        local status_color=$(_tsm_list_color "process.running" "00AA00")
        printf "%-3s %-20s " "$tsm_id" "$name"
        text_color "$status_color"; printf "%-8s" "online"; reset_color
        printf " %s\n" "$port_str"
    done

    if [[ "$found_running" == "false" ]]; then
        echo ""
        echo "No running services found."
    fi

    # Legend with themed colors
    local secondary_color=$(_tsm_list_color "text.secondary" "888888")
    echo ""
    text_color "$secondary_color"
    echo "Legend: ● bind  ⊙ multicast/shared  → send-to"
    reset_color
}
export -f _tsm_sweep_stale
