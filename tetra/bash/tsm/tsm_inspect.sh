#!/usr/bin/env bash

# tetra_tsm_ inspect - Inspection and debugging commands for tsm

tetra_tsm_list() {
    _tetra_tsm_get_all_processes
    
    if [[ ${#_tsm_procs_name[@]} -eq 0 ]]; then
        echo "No processes found"
        return
    fi
    
    echo "┌──────┬────────────────────┬─────────┬────────┬─────────┬──────────────────────┐"
    echo "│ id   │ name               │ status  │ pid    │ port    │ uptime               │"
    echo "├──────┼────────────────────┼─────────┼────────┼─────────┼──────────────────────┤"
    
    for i in "${!_tsm_procs_name[@]}"; do
        printf "│ %-4s │ %-18s │ %-7s │ %-6s │ %-7s │ %-20s │\n" \
            "${_tsm_procs_id[i]}" "${_tsm_procs_name[i]}" "${_tsm_procs_status[i]}" "${_tsm_procs_pid[i]}" "${_tsm_procs_port[i]}" "${_tsm_procs_uptime[i]}"
    done
    
    echo "└──────┴────────────────────┴─────────┴────────┴─────────┴──────────────────────┘"
}

tetra_tsm_env() {
    local pattern="${1:-}"
    [[ -n "$pattern" ]] || { echo "tsm: env <process|id>" >&2; return 64; }
    
    local resolved_id
    resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
    if [[ $? -ne 0 ]]; then
        echo "tsm: process '$pattern' not found" >&2
        return 1
    fi
    
    local name
    name=$(tetra_tsm_id_to_name "$resolved_id")
    
    local env_file="$TETRA_DIR/tsm/processes/$name.env"
    if [[ -f "$env_file" ]]; then
        cat "$env_file" | sort
    else
        echo "tsm: no environment file found for '$name'" >&2
        return 1
    fi
}

tetra_tsm_paths() {
    local pattern="${1:-}"
    [[ -n "$pattern" ]] || { echo "tsm: paths <process|id>" >&2; return 64; }

    local resolved_id
    resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
    if [[ $? -ne 0 ]]; then
        echo "tsm: process '$pattern' not found" >&2
        return 1
    fi

    local name
    name=$(tetra_tsm_id_to_name "$resolved_id")

    echo "Paths for process '$name' (ID: $resolved_id):"
    echo "  meta: $TETRA_DIR/tsm/processes/$name.meta"
    echo "  pid:  $TETRA_DIR/tsm/pids/$name.pid"
    echo "  env:  $TETRA_DIR/tsm/processes/$name.env"
    echo "  out:  $TETRA_DIR/tsm/logs/$name.out"
    echo "  err:  $TETRA_DIR/tsm/logs/$name.err"
}

tetra_tsm_logs() {
    local pattern=""
    local lines="50"
    local follow=false

    # Correct argument parsing
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lines)
                lines="$2"
                shift 2
                ;;
            -f|--follow)
                follow=true
                shift
                ;;
            --nostream) # Kept for compatibility, it's the default
                follow=false
                shift
                ;;
            -*)
                echo "tsm: unknown flag '$1' for logs command" >&2
                return 64
                ;;
            *)
                if [[ -z "$pattern" ]]; then
                    pattern="$1"
                else
                    echo "tsm: unexpected argument '$1'" >&2
                    return 64
                fi
                shift
                ;;
        esac
    done

    [[ -n "$pattern" ]] || { echo "tsm: logs <process|id|*> [--lines N] [-f|--follow]" >&2; return 64; }

    if [[ "$pattern" == "*" ]]; then
        # Show logs for all processes
        for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            local name=$(basename "$metafile" .meta)
            echo "==> $name (ID: $tsm_id) <=="
            tetra_tsm_logs_by_id "$tsm_id" "$lines" "$follow"
            echo
        done
    else
        # Resolve name or ID to TSM ID
        local resolved_id
        resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
        if [[ $? -eq 0 ]]; then
            tetra_tsm_logs_by_id "$resolved_id" "$lines" "$follow"
        else
            echo "tsm: process '$pattern' not found" >&2
            return 1
        fi
    fi
}

# Show logs by TSM ID
tetra_tsm_logs_by_id() {
    local id="$1"
    local lines="${2:-50}"
    local follow="${3:-false}"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_logs_single "$name" "$lines" "$follow"
}

tetra_tsm_logs_single() {
    local name="$1"
    local lines="${2:-50}"
    local follow="${3:-false}"
    
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    [[ -f "$metafile" ]] || { echo "tsm: process '$name' not found" >&2; return 1; }
    
    # All processes use standard TSM log structure
    local outlog="$TETRA_DIR/tsm/logs/$name.out"
    local errlog="$TETRA_DIR/tsm/logs/$name.err"
    
    if [[ "$follow" == "true" ]]; then
        # Follow logs in real-time
        echo "Following logs for '$name' (Ctrl-C to exit)..."
        tail -n "$lines" -f "$outlog" "$errlog" 2>/dev/null
    else
        # Default: show last N lines
        if [[ ! -f "$outlog" && ! -f "$errlog" ]]; then
            echo "tsm: no logs found for '$name'"
            return
        fi
        
        echo "--- Logs for $name (Last $lines lines) ---"
        if [[ -f "$outlog" ]]; then
            echo "=== STDOUT ==="
            tail -n "$lines" "$outlog" 2>/dev/null
        fi
        if [[ -f "$errlog" ]]; then
            echo "=== STDERR ==="
            tail -n "$lines" "$errlog" 2>/dev/null
        fi
    fi
}

tetra_tsm_scan_ports() {
    if ! command -v lsof >/dev/null 2>&1; then
        echo "tsm: 'lsof' command not found, which is required for scanning ports." >&2
        return 1
    fi

    _tetra_tsm_get_all_processes

    declare -A open_ports
    declare -A open_ports_pid
    declare -A open_ports_cmd
    
    while read -r cmd pid port; do
        [[ -n "$port" ]] || continue
        open_ports[$port]=1
        open_ports_pid[$port]=$pid
        open_ports_cmd[$port]=$cmd
    done < <(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2 | awk '{port=$9; sub(/.*:/, "", port); print $1, $2, port}')

    echo "┌─────────┬─────────┬──────────────────┬──────────────────────────┐"
    echo "│ Port    │ PID     │ Command          │ Status                   │"
    echo "├─────────┼─────────┼──────────────────┼──────────────────────────┤"

    declare -A reported_ports
    
    # Check ports managed by TSM
    for i in "${!_tsm_procs_name[@]}"; do
        local name="${_tsm_procs_name[i]}"
        local id="${_tsm_procs_id[i]}"
        local port="${_tsm_procs_port[i]}"
        local pid="${_tsm_procs_pid[i]}"
        local status="${_tsm_procs_status[i]}"
        
        [[ "$port" == "-" ]] && continue
        reported_ports[$port]=1

        if [[ -n "${open_ports[$port]}" ]]; then
            # Port is open
            local open_pid="${open_ports_pid[$port]}"
            local open_cmd="${open_ports_cmd[$port]}"
            
            if [[ "$status" == "online" ]]; then
                if [[ "$pid" == "$open_pid" ]]; then
                    printf "│ %-7s │ %-7s │ %-16s │ %-24s │\n" "$port" "$pid" "$open_cmd" "Online (TSM: $name)"
                else
                    printf "│ %-7s │ %-7s │ %-16s │ %-24s │\n" "$port" "$open_pid" "$open_cmd" "CONFLICT (TSM: $name)"
                fi
            else # status is stopped
                printf "│ %-7s │ %-7s │ %-16s │ %-24s │\n" "$port" "$open_pid" "$open_cmd" "LEAKED (TSM: $name)"
            fi
        else
            # Port is not open
            if [[ "$status" == "online" ]]; then
                printf "│ %-7s │ %-7s │ %-16s │ %-24s │\n" "$port" "$pid" "-" "ERROR (port not open)"
            fi
        fi
    done

    # Report unmanaged open ports
    for port in "${!open_ports[@]}"; do
        if [[ -z "${reported_ports[$port]}" ]]; then
            local pid="${open_ports_pid[$port]}"
            local cmd="${open_ports_cmd[$port]}"
            printf "│ %-7s │ %-7s │ %-16s │ %-24s │\n" "$port" "$pid" "$cmd" "Unmanaged"
        fi
    done

    echo "└─────────┴─────────┴──────────────────┴──────────────────────────┘"
}


tetra_tsm_ports() {
    for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        
        local name=$(basename "$metafile" .meta)
        local port script
        eval "$(cat "$metafile")"
        
        if [[ "$name" =~ ^(.+)-([0-9]+)$ ]]; then
            local process_name="${BASH_REMATCH[1]}"
            local port_num="${BASH_REMATCH[2]}"
            echo "Process: $process_name, Port: $port_num"
        fi
    done
}

tetra_tsm_info() {
    local pattern="${1:-}"
    [[ -n "$pattern" ]] || { echo "tsm: info <process|id>" >&2; return 64; }

    local resolved_id
    resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
    if [[ $? -ne 0 ]]; then
        echo "tsm: process '$pattern' not found" >&2
        return 1
    fi

    local name
    name=$(tetra_tsm_id_to_name "$resolved_id")

    # --- Gather all data ---
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    local pid port start_time script tsm_id
    eval "$(cat "$metafile")"

    local status uptime
    if tetra_tsm_is_running "$name"; then
        status="online"
        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        if (( elapsed < 60 )); then
            uptime="${elapsed}s"
        elif (( elapsed < 3600 )); then
            uptime="$((elapsed / 60))m"
        else
            uptime="$((elapsed / 3600))h"
        fi
    else
        status="stopped"
        uptime="-"
    fi

    # --- Resource Usage ---
    local cpu_usage="-"
    local mem_usage="-"
    if [[ "$status" == "online" ]]; then
        # Memory (RSS in KB)
        local mem_kb
        mem_kb=$(ps -p "$pid" -o rss= | awk '{print $1}')
        if [[ -n "$mem_kb" && "$mem_kb" -gt 0 ]]; then
            if (( mem_kb > 1024 * 1024 )); then
                mem_usage="$(printf "%.1f GB" "$(echo "$mem_kb / 1024 / 1024" | bc -l)")"
            elif (( mem_kb > 1024 )); then
                mem_usage="$(printf "%.1f MB" "$(echo "$mem_kb / 1024" | bc -l)")"
            else
                mem_usage="${mem_kb} KB"
            fi
        fi

        # CPU
        cpu_usage="$(ps -p "$pid" -o %cpu= | awk '{print $1}')%"
    fi


    # --- Output ---
    echo "───────── Process Info: $name (id: $resolved_id) ─────────"
    printf "%12s: %s\n" "Status" "$status"
    printf "%12s: %s\n" "PID" "$pid"
    printf "%12s: %s\n" "Uptime" "$uptime"
    printf "%12s: %s\n" "Port" "$port"
    printf "%12s: %s\n" "Script" "$script"
    
    echo ""
    echo "───────── Resource Usage ─────────"
    printf "%12s: %s\n" "CPU" "$cpu_usage"
    printf "%12s: %s\n" "Memory" "$mem_usage"

    echo ""
    echo "───────── Paths ─────────"
    printf "%12s: %s\n" "Meta" "$TETRA_DIR/tsm/processes/$name.meta"
    printf "%12s: %s\n" "PID File" "$TETRA_DIR/tsm/pids/$name.pid"
    printf "%12s: %s\n" "Env" "$TETRA_DIR/tsm/processes/$name.env"
    printf "%12s: %s\n" "Out Log" "$TETRA_DIR/tsm/logs/$name.out"
    printf "%12s: %s\n" "Err Log" "$TETRA_DIR/tsm/logs/$name.err"
    
    local env_file="$TETRA_DIR/tsm/processes/$name.env"
    if [[ -f "$env_file" ]]; then
        echo ""
        echo "───────── Environment (first 10) ─────────"
        cat "$env_file" | sort | head -n 10
    fi
    
    if [[ -n "$port" && "$port" != "-" ]]; then
        echo ""
        echo "───────── Port Status ($port) ─────────"
        if command -v lsof >/dev/null 2>&1; then
             lsof -iTCP:"$port" -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2
        else
            echo "'lsof' not found. Cannot check port status."
        fi
    fi
}
