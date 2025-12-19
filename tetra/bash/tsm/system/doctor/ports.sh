#!/usr/bin/env bash

# TSM Doctor - Port Diagnostics
# Port scanning, conflict detection, and port process management

# === CONFIGURATION LOADING ===
# Load persistent config from $TETRA_DIR/orgs/tetra/tsm/doctor.conf if it exists
# This allows settings to persist across sessions and be easily edited
TSM_DOCTOR_CONFIG_FILE="${TETRA_DIR:-$HOME/tetra}/orgs/tetra/tsm/doctor.conf"

_tsm_doctor_load_config() {
    if [[ -f "$TSM_DOCTOR_CONFIG_FILE" ]]; then
        # Source the config file (simple KEY=value format)
        # shellcheck disable=SC1090
        source "$TSM_DOCTOR_CONFIG_FILE"
    fi
}

# Initialize or show doctor config
# Usage: doctor_config [init|show|edit|path]
doctor_config() {
    local action="${1:-show}"

    case "$action" in
        init|create)
            local config_dir="${TSM_DOCTOR_CONFIG_FILE%/*}"
            if [[ ! -d "$config_dir" ]]; then
                mkdir -p "$config_dir"
                doctor_log "Created config directory: $config_dir"
            fi

            if [[ -f "$TSM_DOCTOR_CONFIG_FILE" ]]; then
                doctor_warn "Config file already exists: $TSM_DOCTOR_CONFIG_FILE"
                echo "Use 'tsm doctor config edit' to modify or 'tsm doctor config reset' to overwrite"
                return 1
            fi

            cat > "$TSM_DOCTOR_CONFIG_FILE" << 'EOF'
# TSM Doctor Configuration
# This file is sourced by TSM doctor on startup
# Edit values below to customize doctor behavior

# Port scan range (default: 1024-10000)
TSM_DOCTOR_PORT_MIN=1024
TSM_DOCTOR_PORT_MAX=10000

# Exclude port ranges (space-separated "min-max" pairs)
# Example: TSM_DOCTOR_PORT_EXCLUDE="5000-5100 8080"
TSM_DOCTOR_PORT_EXCLUDE=""

# Additional process patterns to ignore (one per line in array format)
# These are added to the built-in list (ControlCenter, Discord, etc.)
# TSM_DOCTOR_CUSTOM_IGNORE_PATTERNS=(
#     "MyCustomApp"
#     "AnotherProcess"
# )
EOF
            doctor_success "Created config file: $TSM_DOCTOR_CONFIG_FILE"
            echo "Edit with: tsm doctor config edit"
            ;;
        reset)
            rm -f "$TSM_DOCTOR_CONFIG_FILE"
            doctor_config init
            ;;
        show)
            if [[ -f "$TSM_DOCTOR_CONFIG_FILE" ]]; then
                echo "Config file: $TSM_DOCTOR_CONFIG_FILE"
                echo "---"
                cat "$TSM_DOCTOR_CONFIG_FILE"
            else
                doctor_info "No config file found (using defaults)"
                echo "Config path: $TSM_DOCTOR_CONFIG_FILE"
                echo ""
                echo "Current effective settings:"
                echo "  TSM_DOCTOR_PORT_MIN=$TSM_DOCTOR_PORT_MIN"
                echo "  TSM_DOCTOR_PORT_MAX=$TSM_DOCTOR_PORT_MAX"
                echo "  TSM_DOCTOR_PORT_EXCLUDE=$TSM_DOCTOR_PORT_EXCLUDE"
                echo ""
                echo "Create config with: tsm doctor config init"
            fi
            ;;
        edit)
            if [[ ! -f "$TSM_DOCTOR_CONFIG_FILE" ]]; then
                doctor_info "Config file doesn't exist, creating..."
                doctor_config init
            fi
            "${EDITOR:-vi}" "$TSM_DOCTOR_CONFIG_FILE"
            _tsm_doctor_load_config
            doctor_success "Config reloaded"
            ;;
        path)
            echo "$TSM_DOCTOR_CONFIG_FILE"
            ;;
        *)
            echo "Usage: tsm doctor config [init|show|edit|reset|path]"
            echo ""
            echo "Commands:"
            echo "  init   - Create default config file"
            echo "  show   - Display current config (default)"
            echo "  edit   - Open config in \$EDITOR"
            echo "  reset  - Reset config to defaults"
            echo "  path   - Print config file path"
            ;;
    esac
}

export -f doctor_config

# Load config on module load
_tsm_doctor_load_config

# === PORT RANGE CONFIGURATION ===
# Default scan range (can be overridden via config file, environment, or CLI)
# TSM_ prefix allows grouping with other TSM environment variables
: "${TSM_DOCTOR_PORT_MIN:=1024}"
: "${TSM_DOCTOR_PORT_MAX:=10000}"

# Exclude ranges (space-separated "min-max" pairs, e.g., "5000-5100 8000-8010")
: "${TSM_DOCTOR_PORT_EXCLUDE:=}"

# === IGNORE LIST CONFIGURATION ===
# Default ignored process patterns (common macOS system processes)
# Format: one pattern per line (regex matched against command path)
TSM_DOCTOR_DEFAULT_IGNORE_PATTERNS=(
    "ControlCenter"
    "rapportd"
    "Transmission"
    "Discord"
    "WavesLocalServer"
    "mDNSResponder"
    "airplayaudioagent"
    "AirPlayXPCHelper"
    "Spotify"
    "Slack"
    "zoom.us"
    "Microsoft"
    "Google Chrome"
    "Safari"
    "Firefox"
)

# Default ignored ports (well-known system ports)
TSM_DOCTOR_DEFAULT_IGNORE_PORTS=(
    5000    # ControlCenter AirPlay receiver
    5353    # mDNS/Bonjour
    7000    # ControlCenter AirPlay
)

# User ignore file location
TSM_DOCTOR_IGNORE_FILE="${TETRA_DIR:-$HOME/.tetra}/tsm/doctor_ignore.txt"

# Check if a process command matches ignore patterns
_doctor_process_ignored() {
    local cmd="$1"
    local port="$2"
    local patterns_ref="$3"  # nameref to patterns array
    local ports_ref="$4"     # nameref to ports array

    # Check against port ignore list
    local -n _ports="$ports_ref" 2>/dev/null || true
    for ignored_port in "${_ports[@]}"; do
        [[ "$port" == "$ignored_port" ]] && return 0
    done

    # Check against pattern ignore list
    local -n _patterns="$patterns_ref" 2>/dev/null || true
    for pattern in "${_patterns[@]}"; do
        [[ "$cmd" =~ $pattern ]] && return 0
    done

    return 1
}

# Load ignore patterns from user file
_doctor_load_ignore_file() {
    local -n patterns_out="$1"
    local -n ports_out="$2"

    # Start with defaults
    patterns_out=("${TSM_DOCTOR_DEFAULT_IGNORE_PATTERNS[@]}")
    ports_out=("${TSM_DOCTOR_DEFAULT_IGNORE_PORTS[@]}")

    # Load user file if exists
    if [[ -f "$TSM_DOCTOR_IGNORE_FILE" ]]; then
        while IFS= read -r line; do
            # Skip comments and empty lines
            [[ "$line" =~ ^[[:space:]]*# ]] && continue
            [[ -z "${line// /}" ]] && continue

            # Port entries start with "port:"
            if [[ "$line" =~ ^port:([0-9]+) ]]; then
                ports_out+=("${BASH_REMATCH[1]}")
            else
                patterns_out+=("$line")
            fi
        done < "$TSM_DOCTOR_IGNORE_FILE"
    fi
}

# Check if port is in exclude range
_doctor_port_excluded() {
    local port="$1"
    local exclude_spec

    for exclude_spec in $TSM_DOCTOR_PORT_EXCLUDE; do
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
# Usage: doctor_scan_common_ports [min] [max] [--exclude "range1 range2"] [--no-ignore] [--show-ignored]
doctor_scan_common_ports() {
    local port_min="$TSM_DOCTOR_PORT_MIN"
    local port_max="$TSM_DOCTOR_PORT_MAX"
    local exclude_ranges="$TSM_DOCTOR_PORT_EXCLUDE"
    local use_ignore=true
    local show_ignored=false

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
            --no-ignore|-A|--all)
                use_ignore=false
                shift
                ;;
            --show-ignored|--ignored)
                show_ignored=true
                shift
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

    # Load ignore patterns
    local ignore_patterns=()
    local ignore_ports=()
    if [[ "$use_ignore" == "true" ]] || [[ "$show_ignored" == "true" ]]; then
        _doctor_load_ignore_file ignore_patterns ignore_ports
    fi

    # Temporarily set exclude for helper function
    local old_exclude="$TSM_DOCTOR_PORT_EXCLUDE"
    TSM_DOCTOR_PORT_EXCLUDE="$exclude_ranges"

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
        TSM_DOCTOR_PORT_EXCLUDE="$old_exclude"
        echo
        return 0
    fi

    # Calculate available space for COMMAND column based on terminal width
    local term_width=${COLUMNS:-80}
    # Fixed columns: PORT(6) + PROTO(7) + STATUS(8) + TSM(5) + PID(8) + spaces(5) = 39
    local fixed_width=39
    local cmd_width=$((term_width - fixed_width))
    # Ensure cmd_width is at least 10 but never exceeds what would fit in term_width
    [[ $cmd_width -lt 10 ]] && cmd_width=10
    [[ $cmd_width -gt 100 ]] && cmd_width=100

    # Track ignored count for summary
    local ignored_count=0
    local shown_count=0

    echo
    if [[ "$show_ignored" == "true" ]]; then
        printf "%-6s %-7s %-8s %-5s %-8s %s\n" "PORT" "PROTO" "STATUS" "TSM" "PID" "COMMAND (IGNORED)"
    else
        printf "%-6s %-7s %-8s %-5s %-8s %s\n" "PORT" "PROTO" "STATUS" "TSM" "PID" "COMMAND"
    fi
    printf "%-6s %-7s %-8s %-5s %-8s %s\n" "----" "-----" "------" "---" "---" "-------"

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

        # Get command for ignore check
        local cmd_full=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")

        # Check ignore list
        local is_ignored=false
        if [[ "$use_ignore" == "true" ]] && \
           _doctor_process_ignored "$cmd_full" "$port" ignore_patterns ignore_ports; then
            is_ignored=true
            ((ignored_count++))
            # Skip if not showing ignored
            [[ "$show_ignored" != "true" ]] && continue
        fi

        # If show_ignored mode, only show ignored processes
        if [[ "$show_ignored" == "true" && "$is_ignored" != "true" ]]; then
            continue
        fi

        ((shown_count++))

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
        local cmd=$(doctor_truncate_middle "$cmd_full" $cmd_width)
        printf "%-6s %-7s " "$port" "$proto_display"
        # Use status.error token if available, otherwise fall back to hardcoded red
        if declare -f tsm_color_apply >/dev/null 2>&1; then
            tsm_color_apply "status.error"
        else
            text_color "FF0044"
        fi
        printf "%-8s" "USED"
        reset_color
        printf " %-5s %-8s %s\n" "$is_tsm_managed" "$pid" "$cmd"
    done

    # Show summary if ignoring
    if [[ "$use_ignore" == "true" && "$ignored_count" -gt 0 && "$show_ignored" != "true" ]]; then
        echo ""
        echo "(${ignored_count} system processes hidden. Use --no-ignore to show all, --show-ignored to list them)"
    fi

    # Restore original exclude setting
    TSM_DOCTOR_PORT_EXCLUDE="$old_exclude"
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

    # Double-check port is free (with retries for UDP ports)
    local port_free=false
    for attempt in 1 2 3; do
        if [[ -z "$(lsof -ti :$port 2>/dev/null)" ]]; then
            port_free=true
            break
        fi
        [[ $attempt -lt 3 ]] && sleep 1
    done

    if [[ "$port_free" == "true" ]]; then
        doctor_success "Port $port is now free"
    else
        doctor_warn "Port $port still shows as in use (may take a moment to clear)"
    fi

    [[ $killed -eq ${#pids[@]} ]]
}

# Claim a port - kill whatever is using it (unless TSM-managed)
# Usage: tsm_claim_port <port> [-f|--force]
tsm_claim_port() {
    local port="$1"
    local force=""
    [[ "$2" == "-f" || "$2" == "--force" ]] && force="true"

    if [[ -z "$port" ]]; then
        echo "Usage: tsm claim <port> [-f|--force]"
        echo ""
        echo "Claim a port by killing whatever non-TSM process is using it."
        echo ""
        echo "Options:"
        echo "  -f, --force    Skip confirmation prompt"
        echo ""
        echo "Examples:"
        echo "  tsm claim 1985           # Interactively reclaim port 1985"
        echo "  tsm claim 1985 -f        # Force kill without confirmation"
        return 1
    fi

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        echo "❌ Invalid port number: $port" >&2
        return 1
    fi

    # Check if port is in use
    local tcp_pid=$(lsof -ti TCP:$port 2>/dev/null | head -1)
    local udp_pid=$(lsof -ti UDP:$port 2>/dev/null | head -1)

    if [[ -z "$tcp_pid" && -z "$udp_pid" ]]; then
        echo "✓ Port $port is already free"
        return 0
    fi

    # Show what's using the port
    echo "Port $port is in use:"
    echo ""

    local primary_pid=""
    if [[ -n "$tcp_pid" ]]; then
        primary_pid="$tcp_pid"
        local cmd=$(ps -p $tcp_pid -o args= 2>/dev/null || echo "unknown")
        echo "  TCP: PID $tcp_pid"
        echo "       $cmd"
    fi
    if [[ -n "$udp_pid" ]]; then
        [[ -z "$primary_pid" ]] && primary_pid="$udp_pid"
        local cmd=$(ps -p $udp_pid -o args= 2>/dev/null || echo "unknown")
        echo "  UDP: PID $udp_pid"
        echo "       $cmd"
    fi
    echo ""

    # Check if it's a TSM process
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue
            local meta_file="${process_dir}meta.json"
            if [[ -f "$meta_file" ]]; then
                local meta_port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
                local meta_pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
                if [[ "$meta_port" == "$port" || "$meta_pid" == "$primary_pid" ]]; then
                    local name=$(basename "$process_dir")
                    echo "⚠️  This is TSM-managed process: $name"
                    echo "   Use: tsm stop $name"
                    return 1
                fi
            fi
        done
    fi

    # Not TSM managed - offer to kill
    echo "This is NOT a TSM-managed process."

    if [[ "$force" != "true" ]]; then
        echo -n "Kill and claim port $port? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "Cancelled"
            return 0
        fi
    fi

    # Kill the process(es)
    local killed=0
    for pid in $tcp_pid $udp_pid; do
        [[ -z "$pid" ]] && continue
        # Avoid killing same PID twice
        if kill -0 "$pid" 2>/dev/null; then
            echo "Killing PID $pid..."
            kill "$pid" 2>/dev/null
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                echo "Process $pid still running, sending SIGKILL..."
                kill -9 "$pid" 2>/dev/null
                sleep 1
            fi
            if ! kill -0 "$pid" 2>/dev/null; then
                ((killed++))
            fi
        fi
    done

    # Verify port is free
    sleep 1
    tcp_pid=$(lsof -ti TCP:$port 2>/dev/null | head -1)
    udp_pid=$(lsof -ti UDP:$port 2>/dev/null | head -1)

    if [[ -z "$tcp_pid" && -z "$udp_pid" ]]; then
        echo "✓ Port $port is now free"
        return 0
    else
        echo "⚠️  Port $port still in use (may take a moment to clear)"
        return 1
    fi
}

# Export functions
export -f doctor_scan_common_ports
export -f doctor_scan_port
export -f doctor_kill_port_process
export -f tsm_claim_port
