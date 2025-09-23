#!/usr/bin/env bash

# tetra_tsm_ inspect - Inspection and debugging commands for tsm

# Get system resource summary in watchdog format
_tsm_get_resource_summary() {
    case "$(uname)" in
        "Linux")
            _tsm_system_summary_linux
            ;;
        "Darwin")
            _tsm_system_summary_macos
            ;;
        *)
            echo "CPU: -, MEM: -, SWAP: -"
            ;;
    esac
}

# Linux system summary (from watchdog)
_tsm_system_summary_linux() {
    local cpu_us mem_used mem_total swap_used swap_total

    # Simple CPU using top (faster than /proc/stat method)
    cpu_us=$(top -bn1 | awk '/%Cpu\(s\):/ {print $2+$4}' | head -1)
    [[ -z "$cpu_us" ]] && cpu_us="0"

    # Memory info
    read mem_used mem_total < <(free -m | awk '/Mem:/ {print $3, $2}')
    read swap_used swap_total < <(free -m | awk '/Swap:/ {print $3, $2}')

    echo "CPU: ${cpu_us}/100, MEM: ${mem_used}/${mem_total}, SWAP: ${swap_used}/${swap_total}"
}

# macOS system summary
_tsm_system_summary_macos() {
    local cpu_us mem_used mem_total swap_used

    # CPU usage from top
    cpu_us=$(top -l1 -n0 | awk '/CPU usage:/ {print $3}' | sed 's/%//')
    [[ -z "$cpu_us" ]] && cpu_us="0"

    # Memory info from vm_stat and system_profiler
    local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
    [[ -z "$page_size" ]] && page_size=4096

    local pages_free pages_active pages_inactive pages_wired
    eval $(vm_stat | awk '
        /Pages free:/ {print "pages_free=" $3}
        /Pages active:/ {print "pages_active=" $3}
        /Pages inactive:/ {print "pages_inactive=" $3}
        /Pages wired down:/ {print "pages_wired=" $4}
    ' | tr -d '.')

    # Calculate memory in MB
    mem_used=$(( (pages_active + pages_inactive + pages_wired) * page_size / 1024 / 1024 ))
    mem_total=$(( (pages_free + pages_active + pages_inactive + pages_wired) * page_size / 1024 / 1024 ))

    # macOS doesn't use traditional swap files, so simplified
    swap_used="-"

    echo "CPU: ${cpu_us}/100, MEM: ${mem_used}/${mem_total}, SWAP: ${swap_used}"
}

tetra_tsm_list() {
    _tetra_tsm_get_all_processes
    tsm_format_process_list
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
    
    local env_file="$TETRA_DIR/tsm/runtime/processes/$name.env"
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
    echo "  meta: $TETRA_DIR/tsm/runtime/processes/$name.meta"
    echo "  pid:  $TETRA_DIR/tsm/runtime/pids/$name.pid"
    echo "  env:  $TETRA_DIR/tsm/runtime/processes/$name.env"
    echo "  out:  $TETRA_DIR/tsm/runtime/logs/$name.out"
    echo "  err:  $TETRA_DIR/tsm/runtime/logs/$name.err"
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
        for metafile in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
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
    
    local metafile="$TETRA_DIR/tsm/runtime/processes/$name.meta"
    [[ -f "$metafile" ]] || { echo "tsm: process '$name' not found" >&2; return 1; }
    
    # All processes use standard TSM log structure
    local outlog="$TETRA_DIR/tsm/runtime/logs/$name.out"
    local errlog="$TETRA_DIR/tsm/runtime/logs/$name.err"
    
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

    tsm_format_port_scan

    declare -A reported_ports
    
    # Check ports managed by TSM
    for i in "${!_tsm_procs_name[@]}"; do
        local name="${_tsm_procs_name[i]}"
        local id="${_tsm_procs_id[i]}"
        local port="${_tsm_procs_port[i]}"
        local pid="${_tsm_procs_pid[i]}"
        local proc_status="${_tsm_procs_status[i]}"
        
        [[ "$port" == "-" ]] && continue
        reported_ports[$port]=1

        if [[ -n "${open_ports[$port]}" ]]; then
            # Port is open
            local open_pid="${open_ports_pid[$port]}"
            local open_cmd="${open_ports_cmd[$port]}"
            
            if [[ "$proc_status" == "online" ]]; then
                if [[ "$pid" == "$open_pid" ]]; then
                    tsm_format_port_line "$port" "$pid" "$open_cmd" "Online (TSM: $name)"
                else
                    tsm_format_port_line "$port" "$open_pid" "$open_cmd" "CONFLICT (TSM: $name)"
                fi
            else # status is stopped
                tsm_format_port_line "$port" "$open_pid" "$open_cmd" "LEAKED (TSM: $name)"
            fi
        else
            # Port is not open
            if [[ "$proc_status" == "online" ]]; then
                tsm_format_port_line "$port" "$pid" "-" "ERROR (port not open)"
            fi
        fi
    done

    # Report unmanaged open ports
    for port in "${!open_ports[@]}"; do
        if [[ -z "${reported_ports[$port]}" ]]; then
            local pid="${open_ports_pid[$port]}"
            local cmd="${open_ports_cmd[$port]}"
            tsm_format_port_line "$port" "$pid" "$cmd" "Unmanaged"
        fi
    done

    tsm_format_port_scan_close
}


tetra_tsm_ports() {
    for metafile in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
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
    local metafile="$TETRA_DIR/tsm/runtime/processes/$name.meta"
    local pid port start_time script tsm_id
    eval "$(cat "$metafile")"

    local proc_status uptime
    if tetra_tsm_is_running "$name"; then
        proc_status="online"
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
        proc_status="stopped"
        uptime="-"
    fi

    # --- Resource Usage ---
    local cpu_usage="-"
    local mem_usage="-"
    if [[ "$proc_status" == "online" ]]; then
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
    printf "%12s: %s\n" "Status" "$proc_status"
    printf "%12s: %s\n" "PID" "$pid"
    printf "%12s: %s\n" "Uptime" "$uptime"
    printf "%12s: %s\n" "Port" "$port"
    printf "%12s: %s\n" "Script" "$script"

    # Show which env file was loaded (if any)
    local env_file="$TETRA_DIR/tsm/runtime/processes/$name.env"
    if [[ -f "$env_file" ]]; then
        # Try to determine the original env file from the script path
        local original_env_file=""
        if [[ -f "$script" ]]; then
            original_env_file="$(grep -o "env/[^'\"]*\.env" "$script" 2>/dev/null | head -1)"
        fi
        if [[ -n "$original_env_file" ]]; then
            printf "%12s: %s\n" "Env File" "$original_env_file"
        else
            printf "%12s: %s\n" "Env File" "detected"
        fi
    else
        printf "%12s: %s\n" "Env File" "none"
    fi

    # One-line resource summary
    local resources="$(_tsm_get_resource_summary)"
    printf "%12s: %s\n" "Resources" "$resources"

    echo ""
    echo "───────── Working Dirs ─────────"
    printf "%12s: %s\n" "CWD@start" "${cwd:-unknown}"
    printf "%12s: %s\n" "Start Dir" "${start_dir:-unknown}"
    
    echo ""
    echo "───────── Paths ─────────"
    printf "%12s: %s\n" "Meta" "$TETRA_DIR/tsm/runtime/processes/$name.meta"
    printf "%12s: %s\n" "PID File" "$TETRA_DIR/tsm/pids/$name.pid"
    printf "%12s: %s\n" "Env" "$TETRA_DIR/tsm/runtime/processes/$name.env"
    printf "%12s: %s\n" "Out Log" "$TETRA_DIR/tsm/logs/$name.out"
    printf "%12s: %s\n" "Err Log" "$TETRA_DIR/tsm/logs/$name.err"
    
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
