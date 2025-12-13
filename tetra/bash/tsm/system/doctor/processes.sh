#!/usr/bin/env bash

# TSM Doctor - Process Diagnostics
# Orphan detection, stale process cleanup

# Scan for orphaned processes that TSM might have started but lost track of
doctor_scan_orphaned_processes() {
    local json_output=false
    local show_all=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --json)
                json_output=true
                shift
                ;;
            --all)
                show_all=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    doctor_log "Scanning for potentially orphaned TSM processes..."
    echo

    # Get all currently tracked TSM processes
    local tracked_pids=()
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for process_file in "$TSM_PROCESSES_DIR"/*; do
            [[ -f "$process_file" ]] || continue
            local pid
            pid=$(grep "^PID=" "$process_file" 2>/dev/null | cut -d'=' -f2)
            [[ -n "$pid" ]] && tracked_pids+=("$pid")
        done
    fi

    # Look for Node.js and Python processes that might be orphaned
    local potential_orphans=()

    # Find Node.js processes
    while IFS= read -r line; do
        [[ -n "$line" ]] || continue
        local pid=$(echo "$line" | awk '{print $1}')
        local cmd=$(echo "$line" | cut -d' ' -f2-)

        # Skip if already tracked by TSM
        local is_tracked=false
        for tracked_pid in "${tracked_pids[@]}"; do
            if [[ "$tracked_pid" == "$pid" ]]; then
                is_tracked=true
                break
            fi
        done

        if [[ "$is_tracked" == "false" ]]; then
            potential_orphans+=("$pid|node|$cmd")
        fi
    done < <(ps -eo pid,args | grep -E "node.*server|npm.*start|yarn.*start" | grep -v grep)

    # Find Python processes
    while IFS= read -r line; do
        [[ -n "$line" ]] || continue
        local pid=$(echo "$line" | awk '{print $1}')
        local cmd=$(echo "$line" | cut -d' ' -f2-)

        # Skip if already tracked by TSM
        local is_tracked=false
        for tracked_pid in "${tracked_pids[@]}"; do
            if [[ "$tracked_pid" == "$pid" ]]; then
                is_tracked=true
                break
            fi
        done

        if [[ "$is_tracked" == "false" ]]; then
            potential_orphans+=("$pid|python|$cmd")
        fi
    done < <(ps -eo pid,args | grep -E "python.*server|python.*-m.*http" | grep -v grep)

    # Display results
    if [[ ${#potential_orphans[@]} -eq 0 ]]; then
        if [[ "$json_output" == "true" ]]; then
            tsm_json_success "No potentially orphaned processes found" "{\"orphans\": [], \"count\": 0}"
        else
            doctor_success "No potentially orphaned processes found"
        fi
        return 0
    fi

    if [[ "$json_output" == "true" ]]; then
        echo "{"
        echo "  \"success\": true,"
        echo "  \"data\": {"
        echo "    \"orphans\": ["

        local first=true
        for orphan in "${potential_orphans[@]}"; do
            IFS='|' read -r pid type cmd <<< "$orphan"

            # Check what ports this process is using
            local ports=$(lsof -Pan -p "$pid" -i 2>/dev/null | awk '$8 ~ /LISTEN/ {print $9}' | cut -d':' -f2 | sort -n | tr '\n' ',' | sed 's/,$//')
            [[ -z "$ports" ]] && ports=""

            if [[ "$first" == true ]]; then
                first=false
            else
                echo ","
            fi

            echo -n "      {"
            echo -n "\"pid\": \"$pid\", "
            echo -n "\"type\": \"$type\", "
            echo -n "\"ports\": \"$ports\", "
            echo -n "\"command\": \"$(_tsm_json_escape "$cmd")\""
            echo -n "}"
        done

        echo ""
        echo "    ],"
        echo "    \"count\": ${#potential_orphans[@]}"
        echo "  }"
        echo "}"
    else
        printf "%-8s %-10s %-8s %s\n" "PID" "TYPE" "PORTS" "COMMAND"
        printf "%-8s %-10s %-8s %s\n" "---" "----" "-----" "-------"

        for orphan in "${potential_orphans[@]}"; do
            IFS='|' read -r pid type cmd <<< "$orphan"

            # Check what ports this process is using
            local ports=$(lsof -Pan -p "$pid" -i 2>/dev/null | awk '$8 ~ /LISTEN/ {print $9}' | cut -d':' -f2 | sort -n | tr '\n' ',' | sed 's/,$//')
            [[ -z "$ports" ]] && ports="-"

            printf "%-8s %-10s %-8s %s\n" "$pid" "$type" "$ports" "$cmd"
        done

        echo
        doctor_info "These processes might be orphaned TSM processes"
        echo "Actions you can take:"
        echo "  tsm doctor kill <port>     # Kill process using specific port"
        echo "  kill <pid>                 # Kill specific process"
        echo "  tsm adopt <pid>           # Take ownership of process (future feature)"
        echo
    fi

    return 0
}

# Clean up stale TSM process tracking files
doctor_clean_stale_processes() {
    local cleaned=0
    local kept=0
    local total=0
    local aggressive="${1:-false}"

    doctor_log "Cleaning up stale TSM process tracking files..."

    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        doctor_success "No process tracking directory found"
        return 0
    fi

    # AGGRESSIVE MODE: Clean directory-based structure
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue

        local name=$(basename "$process_dir")
        local meta_file="${process_dir}meta.json"

        ((total++))

        if [[ ! -f "$meta_file" ]]; then
            doctor_warn "No meta.json in $name, removing entire directory"
            _tsm_safe_remove_dir "$process_dir"
            ((cleaned++))
            continue
        fi

        # Read PID from metadata
        local pid
        pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)

        if [[ -z "$pid" ]]; then
            doctor_warn "Invalid metadata (no PID) in $name, removing"
            _tsm_safe_remove_dir "$process_dir"
            ((cleaned++))
            continue
        fi

        # Check if PID is alive
        if ! tsm_is_pid_alive "$pid"; then
            doctor_info "Cleaning stale process tracking: $name (PID $pid is dead)"
            _tsm_safe_remove_dir "$process_dir"
            ((cleaned++))
            continue
        fi

        # AGGRESSIVE: Check if PID matches the port
        if [[ "$aggressive" == "true" ]]; then
            local port
            port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
            if [[ -n "$port" && "$port" != "null" && "$port" != "none" ]]; then
                local actual_pid
                actual_pid=$(lsof -ti :$port 2>/dev/null | head -1)
                if [[ -n "$actual_pid" && "$actual_pid" != "$pid" ]]; then
                    doctor_warn "PID $pid alive but port $port has PID $actual_pid, removing stale tracking for $name"
                    _tsm_safe_remove_dir "$process_dir"
                    ((cleaned++))
                    continue
                fi
            fi
        fi

        ((kept++))
    done

    # Legacy cleanup: old .meta files
    for process_file in "$TSM_PROCESSES_DIR"/*.meta; do
        [[ -f "$process_file" ]] || continue

        local process_name=$(basename "$process_file" .meta)
        local pid
        pid=$(grep -o "pid=[0-9]*" "$process_file" 2>/dev/null | cut -d'=' -f2)

        ((total++))

        if [[ -z "$pid" ]]; then
            doctor_warn "Invalid process file (no PID): $process_name"
            rm -f "$process_file"
            cleaned=$((cleaned + 1))
            continue
        fi

        # Check if process is still running
        if ! tsm_is_pid_alive "$pid"; then
            doctor_info "Cleaning stale process tracking: $process_name (PID $pid no longer exists)"
            rm -f "$process_file"
            rm -f "$TSM_PIDS_DIR/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
        else
            ((kept++))
        fi
    done

    echo ""
    if [[ $total -eq 0 ]]; then
        doctor_success "No process tracking files found"
    elif [[ $cleaned -eq 0 ]]; then
        doctor_success "No stale process files found ($kept valid processes)"
    else
        doctor_success "Cleaned up $cleaned stale process files ($kept kept)"
    fi

    return 0
}

# Export functions
export -f doctor_scan_orphaned_processes
export -f doctor_clean_stale_processes
