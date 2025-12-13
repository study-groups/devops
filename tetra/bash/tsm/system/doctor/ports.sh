#!/usr/bin/env bash

# TSM Doctor - Port Diagnostics
# Port scanning, conflict detection, and port process management

# === PORT RANGE CONFIGURATION ===
# Default scan range (can be overridden via environment or CLI)
: "${DOCTOR_PORT_MIN:=1024}"
: "${DOCTOR_PORT_MAX:=10000}"

# Exclude ranges (space-separated "min-max" pairs, e.g., "5000-5100 8000-8010")
: "${DOCTOR_PORT_EXCLUDE:=}"

# Check if port is in exclude range
_doctor_port_excluded() {
    local port="$1"
    local exclude_spec

    for exclude_spec in $DOCTOR_PORT_EXCLUDE; do
        local ex_min="${exclude_spec%-*}"
        local ex_max="${exclude_spec#*-}"
        # Handle single port (no dash)
        [[ "$ex_min" == "$exclude_spec" ]] && ex_max="$ex_min"

        if [[ "$port" -ge "$ex_min" && "$port" -le "$ex_max" ]]; then
            return 0  # excluded
        fi
    done
    return 1  # not excluded
}

# Scan common development ports + TSM-managed ports (TCP and UDP)
# Usage: doctor_scan_common_ports [min] [max] [--exclude "range1 range2"]
doctor_scan_common_ports() {
    local port_min="$DOCTOR_PORT_MIN"
    local port_max="$DOCTOR_PORT_MAX"
    local exclude_ranges="$DOCTOR_PORT_EXCLUDE"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --range)
                port_min="${2%-*}"
                port_max="${2#*-}"
                shift 2
                ;;
            --exclude)
                exclude_ranges="$2"
                shift 2
                ;;
            --min)
                port_min="$2"
                shift 2
                ;;
            --max)
                port_max="$2"
                shift 2
                ;;
            *)
                # Positional: first is min, second is max
                if [[ "$1" =~ ^[0-9]+-[0-9]+$ ]]; then
                    port_min="${1%-*}"
                    port_max="${1#*-}"
                elif [[ "$1" =~ ^[0-9]+$ ]]; then
                    if [[ -z "${_pos_min_set:-}" ]]; then
                        port_min="$1"
                        _pos_min_set=1
                    else
                        port_max="$1"
                    fi
                fi
                shift
                ;;
        esac
    done
    unset _pos_min_set

    # Temporarily set exclude for helper function
    local old_exclude="$DOCTOR_PORT_EXCLUDE"
    DOCTOR_PORT_EXCLUDE="$exclude_ranges"

    # Show active org if set (via symlink)
    local active_org=""
    if [[ -L "$TETRA_DIR/config/tetra.toml" ]]; then
        local org_path=$(readlink "$TETRA_DIR/config/tetra.toml")
        active_org=$(echo "$org_path" | sed -n 's|.*/orgs/\([^/]*\)/.*|\1|p')
    fi
    [[ -n "$active_org" ]] && doctor_log "Org: $active_org"

    doctor_log "Scanning ports ${port_min}-${port_max}..."
    [[ -n "$exclude_ranges" ]] && doctor_log "Excluding: $exclude_ranges"

    # Associative array to track port -> protocol mapping
    declare -A port_info  # port -> "tcp|udp|both"

    # Get TCP listening ports
    while IFS= read -r port; do
        [[ -n "$port" ]] || continue
        # Skip non-numeric values (e.g., "*" for wildcard addresses)
        [[ "$port" =~ ^[0-9]+$ ]] || continue
        if [[ "$port" -ge "$port_min" && "$port" -le "$port_max" ]]; then
            # Check exclusions
            _doctor_port_excluded "$port" && continue
            port_info[$port]="tcp"
        fi
    done < <(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk 'NR>1 {print $9}' | sed 's/.*://g' | sort -nu)

    # Get UDP ports (no LISTEN state for UDP, just check for bound ports)
    while IFS= read -r port; do
        [[ -n "$port" ]] || continue
        # Skip non-numeric values (e.g., "*" for wildcard addresses)
        [[ "$port" =~ ^[0-9]+$ ]] || continue
        if [[ "$port" -ge "$port_min" && "$port" -le "$port_max" ]]; then
            # Check exclusions
            _doctor_port_excluded "$port" && continue
            if [[ -n "${port_info[$port]}" ]]; then
                port_info[$port]="both"
            else
                port_info[$port]="udp"
            fi
        fi
    done < <(lsof -iUDP -P -n 2>/dev/null | awk 'NR>1 {print $9}' | sed 's/.*://g' | sort -nu)

    # Get sorted list of ports
    local ports=($(echo "${!port_info[@]}" | tr ' ' '\n' | sort -n))

    # If no ports found in range, show common defaults as reference
    if [[ ${#ports[@]} -eq 0 ]]; then
        doctor_log "No ports in use in range ${port_min}-${port_max}"
        DOCTOR_PORT_EXCLUDE="$old_exclude"
        echo
        return 0
    fi

    # Calculate available space for COMMAND column based on terminal width
    local term_width=${COLUMNS:-80}
    # Fixed columns: PORT(6) + PROTO(6) + STATUS(8) + TSM(5) + PID(8) + spaces(5) = 38
    local fixed_width=38
    local cmd_width=$((term_width - fixed_width))
    # Set reasonable bounds
    [[ $cmd_width -lt 40 ]] && cmd_width=40  # Minimum width
    [[ $cmd_width -gt 120 ]] && cmd_width=120  # Maximum width

    echo
    printf "%-6s %-6s %-8s %-5s %-8s %s\n" "PORT" "PROTO" "STATUS" "TSM" "PID" "COMMAND"
    printf "%-6s %-6s %-8s %-5s %-8s %s\n" "----" "-----" "------" "---" "---" "-------"

    for port in "${ports[@]}"; do
        local proto="${port_info[$port]}"

        # Get PID for this port (try TCP first, then UDP)
        local pid=""
        if [[ "$proto" == "tcp" || "$proto" == "both" ]]; then
            pid=$(lsof -ti TCP:$port 2>/dev/null | head -1)
        fi
        if [[ -z "$pid" && ("$proto" == "udp" || "$proto" == "both") ]]; then
            pid=$(lsof -ti UDP:$port 2>/dev/null | head -1)
        fi

        local is_tsm_managed="-"

        # Check if this port is managed by TSM
        if [[ -d "$TSM_PROCESSES_DIR" ]]; then
            for process_dir in "$TSM_PROCESSES_DIR"/*/; do
                [[ -d "$process_dir" ]] || continue
                local meta_file="${process_dir}meta.json"
                if [[ -f "$meta_file" ]]; then
                    local meta_port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
                    if [[ "$meta_port" == "$port" ]]; then
                        is_tsm_managed="TSM"
                        break
                    fi
                fi
            done
        fi

        # Format protocol display
        local proto_display="$proto"
        [[ "$proto" == "both" ]] && proto_display="tcp+udp"

        # All ports in this list are USED (we got them from lsof)
        local cmd_full=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")
        local cmd=$(doctor_truncate_middle "$cmd_full" $cmd_width)
        printf "%-6s %-6s " "$port" "$proto_display"
        text_color "FF0044"; printf "%-8s" "USED"; reset_color
        printf " %-5s %-8s %s\n" "$is_tsm_managed" "$pid" "$cmd"
    done

    # Restore original exclude setting
    DOCTOR_PORT_EXCLUDE="$old_exclude"
    echo
}

# Scan specific port (TCP and UDP)
doctor_scan_port() {
    local port="$1"

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        doctor_error "Invalid port number: $port"
        return 1
    fi

    doctor_log "Scanning port $port (TCP and UDP)..."

    # Check both protocols
    local tcp_pid=$(lsof -ti TCP:$port 2>/dev/null | head -1)
    local udp_pid=$(lsof -ti UDP:$port 2>/dev/null | head -1)

    if [[ -z "$tcp_pid" && -z "$udp_pid" ]]; then
        doctor_success "Port $port is free (TCP and UDP)"
        return 0
    fi

    # Show TCP usage
    if [[ -n "$tcp_pid" ]]; then
        local process_full=$(ps -p $tcp_pid -o comm= 2>/dev/null || echo "unknown")
        local process=$(doctor_truncate_middle "$process_full" 30)
        local cmd_full=$(ps -p $tcp_pid -o args= 2>/dev/null || echo "unknown")
        local cmd=$(doctor_truncate_middle "$cmd_full" 60)
        local user=$(ps -p $tcp_pid -o user= 2>/dev/null || echo "unknown")

        doctor_warn "Port $port/TCP is in use"
        echo "  PID:      $tcp_pid"
        echo "  Protocol: TCP"
        echo "  Process:  $process"
        echo "  User:     $user"
        echo "  Command:  $cmd"
        echo
    fi

    # Show UDP usage
    if [[ -n "$udp_pid" ]]; then
        local process_full=$(ps -p $udp_pid -o comm= 2>/dev/null || echo "unknown")
        local process=$(doctor_truncate_middle "$process_full" 30)
        local cmd_full=$(ps -p $udp_pid -o args= 2>/dev/null || echo "unknown")
        local cmd=$(doctor_truncate_middle "$cmd_full" 60)
        local user=$(ps -p $udp_pid -o user= 2>/dev/null || echo "unknown")

        doctor_warn "Port $port/UDP is in use"
        echo "  PID:      $udp_pid"
        echo "  Protocol: UDP"
        echo "  Process:  $process"
        echo "  User:     $user"
        echo "  Command:  $cmd"
        echo
    fi

    # Determine primary PID for TSM check
    local primary_pid="${tcp_pid:-$udp_pid}"

    # Check if it's a TSM process
    if tsm list 2>/dev/null | grep -q "$primary_pid"; then
        doctor_info "This is a TSM-managed process"
        echo "  Use: tsm stop <process-name>"
    else
        doctor_info "This is NOT a TSM-managed process"
        echo "  Use: tsm doctor kill $port"
        echo "  Or:  kill $primary_pid"
    fi

    return 1
}

# Kill process using a port (TCP or UDP)
doctor_kill_port_process() {
    local port="$1"
    local force="$2"

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        doctor_error "Invalid port number: $port"
        return 1
    fi

    # Find all PIDs using this port (TCP and UDP)
    local tcp_pid=$(lsof -ti TCP:$port 2>/dev/null | head -1)
    local udp_pid=$(lsof -ti UDP:$port 2>/dev/null | head -1)

    if [[ -z "$tcp_pid" && -z "$udp_pid" ]]; then
        doctor_info "Port $port is already free (TCP and UDP)"
        return 0
    fi

    # Collect unique PIDs
    local pids=()
    [[ -n "$tcp_pid" ]] && pids+=("$tcp_pid")
    [[ -n "$udp_pid" && "$udp_pid" != "$tcp_pid" ]] && pids+=("$udp_pid")

    doctor_log "Found ${#pids[@]} process(es) using port $port:"
    for pid in "${pids[@]}"; do
        local process_full=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        local process=$(doctor_truncate_middle "$process_full" 30)
        local cmd_full=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")
        local cmd=$(doctor_truncate_middle "$cmd_full" 60)

        # Determine protocol
        local proto=""
        [[ "$pid" == "$tcp_pid" ]] && proto="TCP"
        [[ "$pid" == "$udp_pid" ]] && { [[ -n "$proto" ]] && proto="$proto+UDP" || proto="UDP"; }

        echo "  PID:      $pid"
        echo "  Protocol: $proto"
        echo "  Process:  $process"
        echo "  Command:  $cmd"
        echo
    done

    # Check if any is a TSM process
    for pid in "${pids[@]}"; do
        if tsm list 2>/dev/null | grep -q "$pid"; then
            doctor_warn "PID $pid is a TSM-managed process. Use 'tsm stop <process-name>' instead."
            return 1
        fi
    done

    # Confirm unless force flag
    if [[ "$force" != "true" ]]; then
        echo -n "Kill ${#pids[@]} process(es) using port $port? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            doctor_info "Cancelled"
            return 0
        fi
    fi

    # Kill all processes
    local killed=0
    for pid in "${pids[@]}"; do
        doctor_log "Sending SIGTERM to process $pid..."
        if kill "$pid" 2>/dev/null; then
            sleep 2

            # Check if still running
            if tsm_is_pid_alive "$pid"; then
                doctor_warn "Process $pid still running, sending SIGKILL..."
                kill -9 "$pid" 2>/dev/null
                sleep 1
            fi

            # Verify it's gone
            if ! tsm_is_pid_alive "$pid"; then
                doctor_success "Process $pid killed successfully"
                ((killed++))
            else
                doctor_error "Failed to kill process $pid"
            fi
        else
            doctor_error "Failed to send signal to process $pid"
        fi
    done

    # Double-check port is free
    if [[ -z "$(lsof -ti :$port 2>/dev/null)" ]]; then
        doctor_success "Port $port is now free"
    else
        doctor_warn "Port $port still shows as in use (may take a moment to clear)"
    fi

    [[ $killed -eq ${#pids[@]} ]]
}

# Export functions
export -f doctor_scan_common_ports
export -f doctor_scan_port
export -f doctor_kill_port_process
