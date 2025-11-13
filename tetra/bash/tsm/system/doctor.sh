#!/usr/bin/env bash

# TSM Doctor - Port diagnostics and conflict resolution
# Scans ports, identifies conflicts, and helps resolve them

# Load color module
if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
    source "$TETRA_SRC/bash/color/color_core.sh"
    source "$TETRA_SRC/bash/color/color_palettes.sh"
fi

# Helper functions using tetra color palette
log() {
    text_color "0088FF"
    printf "[DOCTOR] %s" "$1"
    reset_color
    echo
}
warn() {
    text_color "FFAA00"
    printf "%s" "$1"
    reset_color
    echo
}
error() {
    text_color "FF0044"
    printf "%s" "$1"
    reset_color
    echo
}
success() {
    text_color "00AA00"
    printf "%s" "$1"
    reset_color
    echo
}
info() {
    text_color "00AAAA"
    printf "%s" "$1"
    reset_color
    echo
}

# Truncate string with ellipsis in middle to fit width
truncate_middle() {
    local str="$1"
    local max_width="${2:-40}"

    # If string fits, return as-is
    if [[ ${#str} -le $max_width ]]; then
        echo "$str"
        return
    fi

    # Calculate how much to show on each side (leave 3 chars for "...")
    local side_width=$(( (max_width - 3) / 2 ))
    local start_width=$side_width
    local end_width=$side_width

    # If odd number, give extra char to end
    if [[ $(( (max_width - 3) % 2 )) -eq 1 ]]; then
        end_width=$((end_width + 1))
    fi

    # Extract start and end, join with ellipsis
    local start="${str:0:$start_width}"
    local end="${str: -$end_width}"
    echo "${start}...${end}"
}

# Check if lsof is available
check_dependencies() {
    local missing=()

    # Check required dependencies
    if ! command -v lsof >/dev/null 2>&1; then
        error "✗ lsof not found (required for port scanning)"
        missing+=("lsof")
    else
        success "✓ lsof available"
    fi

    # Check optional but recommended dependencies (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v flock >/dev/null 2>&1 || ! command -v setsid >/dev/null 2>&1; then
            warn "⚠ util-linux not in PATH (provides flock, setsid for better process management)"
            echo "  Install with: brew install util-linux"
            echo "  TSM will work without it but with reduced functionality"
        else
            success "✓ util-linux available (flock, setsid)"
        fi
    fi

    [[ ${#missing[@]} -eq 0 ]] && return 0

    echo
    error "Missing required dependencies: ${missing[*]}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Install with: brew install ${missing[*]}"
    fi
    return 1
}

# Scan common development ports + TSM-managed ports
scan_common_ports() {
    # Scan all ports in development range (1024-10000) that are actually in use
    log "Scanning development ports (1024-10000)..."

    # Get all listening ports in the range using lsof
    local ports=()
    while IFS= read -r port; do
        [[ -n "$port" ]] || continue
        # Filter to development port range
        if [[ "$port" -ge 1024 && "$port" -le 10000 ]]; then
            ports+=("$port")
        fi
    done < <(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk 'NR>1 {print $9}' | sed 's/.*://g' | sort -nu)

    # If no ports found in range, show common defaults as reference
    if [[ ${#ports[@]} -eq 0 ]]; then
        log "No ports in use in range 1024-10000"
        echo
        return 0
    fi

    # Calculate available space for COMMAND column based on terminal width
    local term_width=${COLUMNS:-80}
    # Fixed columns: PORT(6) + STATUS(8) + TSM(5) + PID(8) + spaces(4) = 31
    # Subtract 1 more for right margin breathing room
    local fixed_width=32
    local cmd_width=$((term_width - fixed_width))
    # Set reasonable bounds
    [[ $cmd_width -lt 40 ]] && cmd_width=40  # Minimum width
    [[ $cmd_width -gt 120 ]] && cmd_width=120  # Maximum width

    echo
    printf "%-6s %-8s %-5s %-8s %s\n" "PORT" "STATUS" "TSM" "PID" "COMMAND"
    printf "%-6s %-8s %-5s %-8s %s\n" "----" "------" "---" "---" "-------"

    for port in "${ports[@]}"; do
        # Get PID for this port (we know it's in use from lsof)
        local pid=$(lsof -ti :$port 2>/dev/null | head -1)
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

        # All ports in this list are USED (we got them from lsof)
        local cmd_full=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")
        local cmd=$(truncate_middle "$cmd_full" $cmd_width)
        printf "%-6s " "$port"
        text_color "FF0044"; printf "%-8s" "USED"; reset_color
        printf " %-5s %-8s %s\n" "$is_tsm_managed" "$pid" "$cmd"
    done
    echo
}

# Scan specific port
scan_port() {
    local port="$1"

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        error "Invalid port number: $port"
        return 1
    fi

    log "Scanning port $port..."

    local result=$(tsm_get_port_pid "$port")
    if [[ -n "$result" ]]; then
        local pid="$result"
        local process_full=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        local process=$(truncate_middle "$process_full" 30)
        local cmd_full=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")
        local cmd=$(truncate_middle "$cmd_full" 60)
        local user=$(ps -p $pid -o user= 2>/dev/null || echo "unknown")

        warn "Port $port is in use"
        echo "  PID:     $pid"
        echo "  Process: $process"
        echo "  User:    $user"
        echo "  Command: $cmd"
        echo

        # Check if it's a TSM process
        if tsm list 2>/dev/null | grep -q "$pid"; then
            info "This is a TSM-managed process"
            echo "  Use: tsm stop <process-name>"
        else
            info "This is NOT a TSM-managed process"
            echo "  Use: tsm doctor --kill $port"
            echo "  Or:  kill $pid"
        fi

        return 1
    else
        success "Port $port is free"
        return 0
    fi
}

# Kill process using a port
kill_port_process() {
    local port="$1"
    local force="$2"

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        error "Invalid port number: $port"
        return 1
    fi

    local result=$(tsm_get_port_pid "$port")
    if [[ -z "$result" ]]; then
        info "Port $port is already free"
        return 0
    fi

    local pid="$result"
    local process_full=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
    local process=$(truncate_middle "$process_full" 30)
    local cmd_full=$(ps -p $pid -o args= 2>/dev/null || echo "unknown")
    local cmd=$(truncate_middle "$cmd_full" 60)

    log "Found process using port $port:"
    echo "  PID:     $pid"
    echo "  Process: $process"
    echo "  Command: $cmd"
    echo

    # Check if it's a TSM process
    if tsm list 2>/dev/null | grep -q "$pid"; then
        warn "This is a TSM-managed process. Use 'tsm stop <process-name>' instead."
        return 1
    fi

    # Confirm unless force flag
    if [[ "$force" != "true" ]]; then
        echo -n "Kill process $pid using port $port? (y/N): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            info "Cancelled"
            return 0
        fi
    fi

    # Try graceful kill first
    log "Sending SIGTERM to process $pid..."
    if kill "$pid" 2>/dev/null; then
        sleep 2

        # Check if still running
        if tsm_is_pid_alive "$pid"; then
            warn "Process still running, sending SIGKILL..."
            kill -9 "$pid" 2>/dev/null
            sleep 1
        fi

        # Verify it's gone
        if ! tsm_is_pid_alive "$pid"; then
            success "Process $pid killed successfully"

            # Double-check port is free
            if [[ -z "$(lsof -ti :$port 2>/dev/null)" ]]; then
                success "Port $port is now free"
            else
                warn "Port $port still shows as in use (may take a moment to clear)"
            fi
        else
            error "Failed to kill process $pid"
            return 1
        fi
    else
        error "Failed to send signal to process $pid"
        return 1
    fi
}

# Diagnose environment loading issues
diagnose_env_loading() {
    local env_file="${1:-env/local.env}"

    log "Diagnosing environment file loading: $env_file"
    echo

    # Check if file exists
    if [[ ! -f "$env_file" ]]; then
        error "Environment file not found: $env_file"
        echo "  Checked from: $(pwd)"
        echo "  Try: tetra env init local"
        return 1
    fi

    success "Environment file exists: $env_file"

    # Check file permissions
    if [[ ! -r "$env_file" ]]; then
        error "Environment file is not readable"
        echo "  Try: chmod 644 $env_file"
        return 1
    fi

    success "Environment file is readable"

    # Check for PORT variable
    if grep -q "^export PORT=" "$env_file"; then
        local port_value=$(grep "^export PORT=" "$env_file" | cut -d'=' -f2)
        success "PORT variable found: $port_value"

        # Check if that port is available
        local port_num="${port_value//[^0-9]/}"
        if [[ -n "$port_num" ]]; then
            if scan_port "$port_num" >/dev/null 2>&1; then
                success "Target port $port_num is available"
            else
                warn "Target port $port_num is in use - this may cause TSM to use fallback port"
                scan_port "$port_num"
            fi
        fi
    else
        warn "No PORT variable found in $env_file"
        echo "  TSM may default to port 3000"
        echo "  Add: export PORT=4000"
    fi

    # Check for other common variables
    local required_vars=("NODE_ENV" "PD_DIR")
    for var in "${required_vars[@]}"; do
        if grep -q "^export $var=" "$env_file"; then
            success "$var variable found"
        else
            warn "$var variable not found in $env_file"
        fi
    done

    # Test sourcing the file
    log "Testing environment file sourcing..."
    # Source once and capture both validation and variable output
    local env_output
    if env_output=$(source "$env_file" 2>&1 && env | grep -E "^(PORT|NODE_ENV|PD_DIR)="); then
        success "Environment file sources without errors"

        # Show extracted variables
        echo "  Extracted variables:"
        echo "$env_output" | sed 's/^/    /'
    else
        error "Environment file has syntax errors"
        echo "  Try: bash -n $env_file"
    fi
}

# Diagnose startup failure - provide detailed error context
tsm_diagnose_startup_failure() {
    local service_name="$1"
    local port="$2"
    local command="$3"
    local env_file="$4"

    echo "tsm: diagnosing startup failure for '$service_name'" >&2
    echo >&2

    # Check port conflict
    local existing_pid
    existing_pid=$(tsm_get_port_pid "$port")
    if [[ -n "$existing_pid" ]]; then
        local process_name_full process_name process_cmd_full process_cmd user_name
        process_name_full=$(ps -p $existing_pid -o comm= 2>/dev/null | tr -d ' ' || echo "unknown")
        process_name=$(truncate_middle "$process_name_full" 30)
        process_cmd_full=$(ps -p $existing_pid -o args= 2>/dev/null || echo "unknown")
        process_cmd=$(truncate_middle "$process_cmd_full" 80)
        user_name=$(ps -p $existing_pid -o user= 2>/dev/null | tr -d ' ' || echo "unknown")

        error "Port $port is already in use"
        echo "  PID:     $existing_pid" >&2
        echo "  Process: $process_name" >&2
        echo "  User:    $user_name" >&2
        echo "  Command: $process_cmd" >&2
        echo >&2

        # Check if it's TSM-managed
        local tsm_process_name=""
        if [[ -d "$TSM_PROCESSES_DIR" ]]; then
            for process_file in "$TSM_PROCESSES_DIR"/*; do
                [[ -f "$process_file" ]] || continue
                local stored_pid
                stored_pid=$(grep "^PID=" "$process_file" 2>/dev/null | cut -d'=' -f2)
                if [[ "$stored_pid" == "$existing_pid" ]]; then
                    tsm_process_name=$(basename "$process_file")
                    break
                fi
            done
        fi

        if [[ -n "$tsm_process_name" ]]; then
            info "This is a TSM-managed process: $tsm_process_name"
            echo "  Run: tsm stop $tsm_process_name" >&2
        else
            info "This is NOT a TSM-managed process"
            echo "  Run: tsm doctor kill $port    # Interactive kill" >&2
            echo "  Or:  kill $existing_pid       # Manual kill" >&2
        fi
        echo >&2
        return 1
    fi

    # Check environment file if specified
    if [[ -n "$env_file" ]]; then
        if [[ ! -f "$env_file" ]]; then
            error "Environment file not found: $env_file"
            echo "  Run: tetra env init <environment-name>" >&2
            echo >&2
        elif [[ ! -r "$env_file" ]]; then
            error "Environment file not readable: $env_file"
            echo "  Run: chmod 644 $env_file" >&2
            echo >&2
        else
            success "Environment file exists and is readable: $env_file"
        fi
    fi

    # Check command executable
    if [[ -n "$command" ]]; then
        local cmd_parts=($command)
        local executable="${cmd_parts[0]}"

        if ! command -v "$executable" >/dev/null 2>&1; then
            error "Command not found: $executable"
            echo "  Make sure '$executable' is installed and in PATH" >&2
            echo >&2
        else
            success "Command executable found: $executable"
        fi
    fi

    # Check for recent TSM process failures
    local log_file="$TSM_LOGS_DIR/${service_name}.out"
    if [[ -f "$log_file" ]]; then
        local recent_errors
        recent_errors=$(tail -20 "$log_file" 2>/dev/null | grep -i "error\|failed\|cannot\|permission" | tail -3)
        if [[ -n "$recent_errors" ]]; then
            warn "Recent errors found in log file:"
            echo "$recent_errors" | sed 's/^/  /' >&2
            echo "  Full log: $log_file" >&2
            echo >&2
        fi
    fi

    # Check disk space
    local available_space
    available_space=$(df -h "$TETRA_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
    if [[ "$available_space" != "unknown" ]]; then
        info "Available disk space: $available_space"
    fi

    return 0
}

# Scan for orphaned processes that TSM might have started but lost track of
tsm_scan_orphaned_processes() {
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

    log "Scanning for potentially orphaned TSM processes..."
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
            success "No potentially orphaned processes found"
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
        info "These processes might be orphaned TSM processes"
        echo "Actions you can take:"
        echo "  tsm doctor kill <port>     # Kill process using specific port"
        echo "  kill <pid>                 # Kill specific process"
        echo "  tsm adopt <pid>           # Take ownership of process (future feature)"
        echo
    fi

    return 0
}

# Validate command before starting - pre-flight checks
tsm_validate_command() {
    local command="$1"
    local port="$2"
    local env_file="$3"
    local json_output="${4:-false}"

    local validation_errors=()
    local validation_warnings=()
    local validation_info=()

    # Check command executable
    if [[ -n "$command" ]]; then
        local cmd_parts=($command)
        local executable="${cmd_parts[0]}"

        if ! command -v "$executable" >/dev/null 2>&1; then
            validation_errors+=("Command not found: $executable")
        else
            validation_info+=("Command executable found: $executable")
        fi
    else
        validation_errors+=("No command specified")
    fi

    # Check port availability
    if [[ -n "$port" ]]; then
        local existing_pid=$(tsm_get_port_pid "$port")
        if [[ -n "$existing_pid" ]]; then
            local process_cmd_full=$(ps -p $existing_pid -o args= 2>/dev/null || echo "unknown")
            local process_cmd=$(truncate_middle "$process_cmd_full" 60)
            validation_errors+=("Port $port is already in use by PID $existing_pid ($process_cmd)")
        else
            validation_info+=("Port $port is available")
        fi

        # Check if port is in valid range
        if [[ ! "$port" =~ ^[0-9]+$ ]] || [[ "$port" -lt 1 ]] || [[ "$port" -gt 65535 ]]; then
            validation_errors+=("Invalid port number: $port")
        elif [[ "$port" -lt 1024 ]]; then
            validation_warnings+=("Port $port is privileged (requires sudo)")
        fi
    fi

    # Check environment file
    if [[ -n "$env_file" ]]; then
        if [[ ! -f "$env_file" ]]; then
            validation_errors+=("Environment file not found: $env_file")
        elif [[ ! -r "$env_file" ]]; then
            validation_errors+=("Environment file not readable: $env_file")
        else
            validation_info+=("Environment file exists and is readable: $env_file")

            # Check for placeholder values
            if grep -q "your_.*_here\|your-.*-name" "$env_file"; then
                validation_warnings+=("Environment file contains placeholder values")
            fi
        fi
    fi

    # Check disk space
    local available_space
    available_space=$(df -h "$TETRA_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
    if [[ "$available_space" != "unknown" ]]; then
        validation_info+=("Available disk space: $available_space")
    fi

    # Output results
    if [[ "$json_output" == "true" ]]; then
        echo "{"
        echo "  \"valid\": $([[ ${#validation_errors[@]} -eq 0 ]] && echo "true" || echo "false"),"
        echo "  \"errors\": ["
        local first=true
        for error in "${validation_errors[@]}"; do
            [[ "$first" == true ]] && first=false || echo ","
            echo -n "    \"$(_tsm_json_escape "$error")\""
        done
        echo ""
        echo "  ],"
        echo "  \"warnings\": ["
        first=true
        for warning in "${validation_warnings[@]}"; do
            [[ "$first" == true ]] && first=false || echo ","
            echo -n "    \"$(_tsm_json_escape "$warning")\""
        done
        echo ""
        echo "  ],"
        echo "  \"info\": ["
        first=true
        for info in "${validation_info[@]}"; do
            [[ "$first" == true ]] && first=false || echo ","
            echo -n "    \"$(_tsm_json_escape "$info")\""
        done
        echo ""
        echo "  ]"
        echo "}"
    else
        log "Pre-flight validation results:"
        echo

        # Show errors
        if [[ ${#validation_errors[@]} -gt 0 ]]; then
            for error in "${validation_errors[@]}"; do
                error "$error"
            done
            echo
        fi

        # Show warnings
        if [[ ${#validation_warnings[@]} -gt 0 ]]; then
            for warning in "${validation_warnings[@]}"; do
                warn "$warning"
            done
            echo
        fi

        # Show info
        if [[ ${#validation_info[@]} -gt 0 ]]; then
            for info in "${validation_info[@]}"; do
                success "$info"
            done
            echo
        fi

        if [[ ${#validation_errors[@]} -eq 0 ]]; then
            success "✅ Validation passed - ready to start"
        else
            error "❌ Validation failed - ${#validation_errors[@]} error(s) found"
        fi
    fi

    # Return success/failure based on errors
    return $([[ ${#validation_errors[@]} -eq 0 ]] && echo 0 || echo 1)
}

# Clean up stale TSM process tracking files
tsm_clean_stale_processes() {
    local cleaned=0
    local kept=0
    local total=0
    local aggressive="${1:-false}"

    log "Cleaning up stale TSM process tracking files..."

    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        success "No process tracking directory found"
        return 0
    fi

    # AGGRESSIVE MODE: Clean directory-based structure
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue

        local name=$(basename "$process_dir")
        local meta_file="${process_dir}meta.json"

        ((total++))

        if [[ ! -f "$meta_file" ]]; then
            warn "No meta.json in $name, removing entire directory"
            rm -rf "$process_dir"
            ((cleaned++))
            continue
        fi

        # Read PID from metadata
        local pid
        pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)

        if [[ -z "$pid" ]]; then
            warn "Invalid metadata (no PID) in $name, removing"
            rm -rf "$process_dir"
            ((cleaned++))
            continue
        fi

        # Check if PID is alive
        if ! tsm_is_pid_alive "$pid"; then
            info "Cleaning stale process tracking: $name (PID $pid is dead)"
            rm -rf "$process_dir"
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
                    warn "PID $pid alive but port $port has PID $actual_pid, removing stale tracking for $name"
                    rm -rf "$process_dir"
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
            warn "Invalid process file (no PID): $process_name"
            rm -f "$process_file"
            cleaned=$((cleaned + 1))
            continue
        fi

        # Check if process is still running
        if ! tsm_is_pid_alive "$pid"; then
            info "Cleaning stale process tracking: $process_name (PID $pid no longer exists)"
            rm -f "$process_file"
            rm -f "$TSM_PIDS_DIR/$process_name.pid" 2>/dev/null
            cleaned=$((cleaned + 1))
        else
            ((kept++))
        fi
    done

    echo ""
    if [[ $total -eq 0 ]]; then
        success "No process tracking files found"
    elif [[ $cleaned -eq 0 ]]; then
        success "No stale process files found ($kept valid processes)"
    else
        success "Cleaned up $cleaned stale process files ($kept kept)"
    fi

    return 0
}

# Health check - validate TSM environment and state
tsm_healthcheck() {
    local errors=0
    local warnings=0
    local fix_suggestions=()

    log "TSM Health Check"
    echo "==================="
    echo

    # Check TETRA core variables
    log "Core Environment:"
    if [[ -n "${TETRA_SRC:-}" ]]; then
        success "  [OK] TETRA_SRC=$TETRA_SRC"
    else
        error "  [ERROR] TETRA_SRC not set"
        fix_suggestions+=("Run: source ~/tetra/tetra.sh")
        ((errors++))
    fi

    if [[ -n "${TETRA_DIR:-}" ]]; then
        success "  [OK] TETRA_DIR=$TETRA_DIR"
    else
        error "  [ERROR] TETRA_DIR not set"
        fix_suggestions+=("Run: source ~/tetra/tetra.sh")
        ((errors++))
    fi

    echo

    # Check TSM runtime variables
    log "TSM Runtime Variables:"
    local tsm_vars=("TSM_PROCESSES_DIR" "TSM_LOGS_DIR" "TSM_PIDS_DIR" "TSM_PORTS_DIR")
    for var in "${tsm_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            success "  [OK] $var=${!var}"
        else
            error "  [ERROR] $var not set"
            fix_suggestions+=("TSM not properly initialized. Run: source $TETRA_SRC/bash/tsm/tsm.sh")
            ((errors++))
        fi
    done

    echo

    # Check runtime directories exist
    log "Runtime Directories:"
    for var in "${tsm_vars[@]}"; do
        local dir_path="${!var:-}"
        if [[ -z "$dir_path" ]]; then
            warn "  [WARN] $var: skipped (not set)"
            ((warnings++))
        elif [[ -d "$dir_path" ]]; then
            success "  [OK] $var: exists"
        else
            warn "  [WARN] $var: missing"
            fix_suggestions+=("Create with: mkdir -p $dir_path")
            ((warnings++))
        fi
    done

    echo

    # Check dependencies
    log "Dependencies:"
    local deps=("lsof" "jq" "ps" "kill")
    for dep in "${deps[@]}"; do
        if command -v "$dep" >/dev/null 2>&1; then
            success "  [OK] $dep: installed"
        else
            error "  [ERROR] $dep: not found"
            if [[ "$dep" == "lsof" ]]; then
                fix_suggestions+=("Install: brew install lsof")
            elif [[ "$dep" == "jq" ]]; then
                fix_suggestions+=("Install: brew install jq")
            fi
            ((errors++))
        fi
    done

    # Check optional dependencies (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v flock >/dev/null 2>&1 && command -v setsid >/dev/null 2>&1; then
            success "  [OK] util-linux: installed (flock, setsid)"
        else
            warn "  [OPTIONAL] util-linux: not in PATH"
            fix_suggestions+=("Install util-linux: brew install util-linux OR run: bash \$TETRA_SRC/bash/tsm/install.sh")
            ((warnings++))
        fi
    fi

    echo

    # Check for running processes vs tracked processes
    log "Process Tracking:"
    if [[ -n "${TSM_PROCESSES_DIR:-}" && -d "${TSM_PROCESSES_DIR:-}" ]]; then
        local meta_count=$(find "$TSM_PROCESSES_DIR" -name "*.meta" -o -name "meta.json" 2>/dev/null | wc -l | tr -d ' ')
        info "  Tracked processes: $meta_count"

        # Check for stale tracking
        local stale=0
        if [[ $meta_count -gt 0 ]]; then
            for process_dir in "$TSM_PROCESSES_DIR"/*/; do
                [[ -d "$process_dir" ]] || continue
                local meta_file="${process_dir}meta.json"
                if [[ -f "$meta_file" ]]; then
                    local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
                    if ! tsm_is_pid_alive "$pid"; then
                        ((stale++))
                    fi
                fi
            done

            if [[ $stale -gt 0 ]]; then
                warn "  [WARN] Stale process files: $stale"
                fix_suggestions+=("Clean stale processes: tsm doctor clean")
                ((warnings++))
            else
                success "  [OK] No stale process files"
            fi
        fi
    else
        warn "  [WARN] Cannot check (TSM_PROCESSES_DIR not available)"
        ((warnings++))
    fi

    echo

    # Check for orphaned processes
    log "Orphaned Processes:"
    if command -v lsof >/dev/null 2>&1; then
        local orphan_count=$(ps -eo pid,args | grep -E "python.*http.server|node.*server" | grep -v grep | wc -l | tr -d ' ')
        if [[ $orphan_count -gt 0 ]]; then
            warn "  [WARN] Potential orphans: $orphan_count"
            fix_suggestions+=("Check orphans: tsm doctor orphans")
            ((warnings++))
        else
            success "  [OK] No obvious orphans"
        fi
    fi

    echo

    # Summary
    log "Summary:"
    if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
        success "  All checks passed"
        return 0
    elif [[ $errors -eq 0 ]]; then
        warn "  $warnings warning(s) found"
    else
        error "  $errors error(s), $warnings warning(s) found"
    fi

    echo

    # Show fix suggestions
    if [[ ${#fix_suggestions[@]} -gt 0 ]]; then
        log "Suggested Fixes:"
        for suggestion in "${fix_suggestions[@]}"; do
            echo "  -> $suggestion"
        done
        echo
    fi

    return $(( errors > 0 ? 1 : 0 ))
}

# Main doctor command
tetra_tsm_doctor() {
    local subcommand="$1"
    shift

    # healthcheck doesn't need lsof dependency check
    if [[ "$subcommand" != "healthcheck" && "$subcommand" != "health" ]]; then
        check_dependencies || return 1
    fi

    case "$subcommand" in
        "healthcheck"|"health")
            tsm_healthcheck
            ;;
        "scan"|"ports"|"")
            scan_common_ports
            ;;
        "port")
            local port="$1"
            if [[ -z "$port" ]]; then
                error "Port number required"
                echo "Usage: tsm doctor port <port-number>"
                return 1
            fi
            scan_port "$port"
            ;;
        "kill")
            local port="$1"
            local force="$2"
            if [[ -z "$port" ]]; then
                error "Port number required"
                echo "Usage: tsm doctor kill <port-number> [--force]"
                return 1
            fi
            kill_port_process "$port" "$([[ "$force" == "--force" ]] && echo "true" || echo "false")"
            ;;
        "env")
            local env_file="$1"
            diagnose_env_loading "$env_file"
            ;;
        "orphans")
            tsm_scan_orphaned_processes
            ;;
        "clean")
            local aggressive="false"
            if [[ "$1" == "--aggressive" || "$1" == "-a" ]]; then
                aggressive="true"
            fi
            tsm_clean_stale_processes "$aggressive"
            ;;
        "validate")
            local command="" port="" env_file="" json_output=false

            # Parse validate arguments
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --port)
                        port="$2"
                        shift 2
                        ;;
                    --env)
                        env_file="$2"
                        shift 2
                        ;;
                    --json)
                        json_output=true
                        shift
                        ;;
                    *)
                        if [[ -z "$command" ]]; then
                            command="$1"
                        else
                            command="$command $1"
                        fi
                        shift
                        ;;
                esac
            done

            tsm_validate_command "$command" "$port" "$env_file" "$json_output"
            ;;
        "reconcile"|"ports-reconcile")
            if declare -f tsm_reconcile_ports >/dev/null 2>&1; then
                tsm_reconcile_ports
            else
                error "Port reconciliation not available (ports_double.sh not loaded)"
                return 1
            fi
            ;;
        "ports-declared")
            if declare -f tsm_show_declared_ports >/dev/null 2>&1; then
                tsm_show_declared_ports
            else
                error "Port registry not available (ports_double.sh not loaded)"
                return 1
            fi
            ;;
        "ports-actual")
            if declare -f tsm_show_actual_ports >/dev/null 2>&1; then
                tsm_show_actual_ports
            else
                error "Port scanning not available (ports_double.sh not loaded)"
                return 1
            fi
            ;;
        "help"|"-h"|"--help")
            cat <<EOF
TSM Doctor - Port diagnostics and conflict resolution

Usage:
  tsm doctor healthcheck         Run comprehensive health check (TSM env, deps, processes)
  tsm doctor [scan]              Scan common development ports
  tsm doctor port <number>       Check specific port
  tsm doctor kill <port> [--force]  Kill process using port
  tsm doctor env [file]          Diagnose environment file loading
  tsm doctor orphans [--json]    Find potentially orphaned TSM processes
  tsm doctor clean [-a|--aggressive]  Clean up stale process tracking files
  tsm doctor validate <command> [--port <port>] [--env <file>] [--json]  Pre-flight validation
  tsm doctor reconcile           Run port reconciliation (declared vs actual)
  tsm doctor ports-declared      Show TSM port registry (System A)
  tsm doctor ports-actual        Show actual listening ports (System B)
  tsm doctor help                Show this help

Examples:
  tsm doctor healthcheck         # Validate TSM environment and state (START HERE!)
  tsm doctor                     # Scan common ports
  tsm doctor port 4000           # Check if port 4000 is free
  tsm doctor kill 4000           # Kill process using port 4000
  tsm doctor kill 3000 --force   # Kill without confirmation
  tsm doctor env env/local.env   # Check environment file
  tsm doctor orphans             # Find processes TSM lost track of
  tsm doctor clean               # Clean up stale tracking files
  tsm doctor reconcile           # Check declared vs actual ports
  tsm doctor validate "node server.js" --port 4000 --env env/dev.env  # Validate before start

Common Issues:
  - TSM variables not set (TSM_PROCESSES_DIR, etc.) → Run: tsm doctor healthcheck
  - Port conflicts preventing service startup
  - Environment variables not loading
  - TSM defaulting to unexpected ports
  - Processes left running after crashes
  - Orphaned processes from previous TSM sessions
  - Port mismatches (declared vs actual)
EOF
            ;;
        *)
            error "Unknown subcommand: $subcommand"
            echo "Use 'tsm doctor help' for usage information"
            return 1
            ;;
    esac
}

# Export the function if this script is sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    export -f tetra_tsm_doctor
fi