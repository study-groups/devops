#!/usr/bin/env bash
# TSM Doctor - consolidated diagnostics

# Main doctor command
# Usage: tsm doctor [health|ports|orphans|clean]
tsm_doctor() {
    local cmd="${1:-health}"
    shift 2>/dev/null || true

    case "$cmd" in
        health|healthcheck)  _doctor_health ;;
        ports|scan)          _doctor_ports "$@" ;;
        orphans)             _doctor_orphans ;;
        clean)               _doctor_clean ;;
        port)                _doctor_port "$1" ;;
        kill)                _doctor_kill "$1" ;;
        help|-h|--help)      _doctor_help ;;
        *)
            tsm_error "unknown: $cmd"
            _doctor_help
            return 1
            ;;
    esac
}

# Health check
_doctor_health() {
    local errors=0 warnings=0

    echo "TSM Health Check"
    echo "================"
    echo ""

    # Core environment
    echo "Environment:"
    if [[ -n "${TETRA_SRC:-}" ]]; then
        echo "  [OK] TETRA_SRC=$TETRA_SRC"
    else
        echo "  [ERROR] TETRA_SRC not set"
        ((errors++))
    fi

    if [[ -n "${TETRA_DIR:-}" ]]; then
        echo "  [OK] TETRA_DIR=$TETRA_DIR"
    else
        echo "  [ERROR] TETRA_DIR not set"
        ((errors++))
    fi

    if [[ -n "${TSM_PROCESSES_DIR:-}" ]]; then
        echo "  [OK] TSM_PROCESSES_DIR=$TSM_PROCESSES_DIR"
    else
        echo "  [ERROR] TSM_PROCESSES_DIR not set"
        ((errors++))
    fi
    echo ""

    # Dependencies
    echo "Dependencies:"
    for dep in lsof jq; do
        if command -v "$dep" >/dev/null 2>&1; then
            echo "  [OK] $dep installed"
        else
            echo "  [ERROR] $dep not found"
            ((errors++))
        fi
    done

    if tsm_has_setsid; then
        echo "  [OK] setsid available"
    else
        echo "  [WARN] setsid not found (install util-linux)"
        ((warnings++))
    fi
    echo ""

    # Process tracking
    echo "Processes:"
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        local total=0 running=0 stale=0
        for dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == .* ]] && continue
            ((total++))

            local meta="${dir}meta.json"
            [[ -f "$meta" ]] || continue
            local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)

            if tsm_is_pid_alive "$pid"; then
                ((running++))
            else
                ((stale++))
            fi
        done

        echo "  Tracked: $total"
        echo "  Running: $running"
        if [[ $stale -gt 0 ]]; then
            echo "  [WARN] Stale: $stale (run: tsm doctor clean)"
            ((warnings++))
        fi
    else
        echo "  [WARN] TSM_PROCESSES_DIR missing"
        ((warnings++))
    fi
    echo ""

    # Active ports - comprehensive view (deduplicated across IPv4/IPv6)
    echo "Active Ports:"
    local tsm_pgids=()

    # Collect all TSM-managed process groups
    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == .* ]] && continue
        local meta="${dir}meta.json"
        [[ -f "$meta" ]] || continue
        local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
        if [[ -n "$pid" ]] && tsm_is_pid_alive "$pid"; then
            local pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
            [[ -n "$pgid" ]] && tsm_pgids+=("$pgid")
        fi
    done

    # Get all listening ports, dedup by port:pid
    local port_count=0 external_count=0
    declare -A _seen_port_pid=()
    declare -A _port_pids=()     # port -> space-separated pids
    local -a _port_lines=()

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local pid=$(echo "$line" | awk '{print $2}')
        local port_info=$(echo "$line" | awk '{print $9}')
        local port=$(echo "$port_info" | sed 's/.*://' | sed 's/\*//')

        # Skip non-numeric ports
        [[ "$port" =~ ^[0-9]+$ ]] || continue

        # Deduplicate IPv4/IPv6 for same port:pid
        local key="${port}:${pid}"
        [[ -v _seen_port_pid["$key"] ]] && continue
        _seen_port_pid["$key"]=1

        # Track which pids are on each port (for conflict detection)
        _port_pids["$port"]="${_port_pids["$port"]:-} $pid"

        local cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 40)
        [[ -z "$cmd" ]] && continue

        # Check if TSM-managed by matching process group
        local is_tsm=false
        local proc_pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
        for tpgid in "${tsm_pgids[@]}"; do
            [[ "$proc_pgid" == "$tpgid" ]] && { is_tsm=true; break; }
        done

        ((port_count++))
        if [[ "$is_tsm" == "true" ]]; then
            printf "  [TSM] %5s  pid:%-6s  %s\n" "$port" "$pid" "$cmd"
        else
            printf "  [EXT] %5s  pid:%-6s  %s\n" "$port" "$pid" "$cmd"
            ((external_count++))
        fi
    done < <(lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null | grep -v "^COMMAND" | sort -t: -k2 -n)

    if [[ $port_count -eq 0 ]]; then
        echo "  No listening ports found"
    else
        echo ""
        echo "  Total: $port_count ports ($external_count external)"
        if [[ $external_count -gt 0 ]]; then
            ((warnings++))
        fi
    fi

    # Detect port conflicts (multiple distinct PIDs on same port)
    local conflicts=0
    for port in "${!_port_pids[@]}"; do
        # Get unique pids for this port
        local unique_pids
        unique_pids=$(echo "${_port_pids[$port]}" | tr ' ' '\n' | sort -u | grep -c .)
        if [[ $unique_pids -gt 1 ]]; then
            ((conflicts++))
            local pids_list
            pids_list=$(echo "${_port_pids[$port]}" | tr ' ' '\n' | sort -un | paste -sd, -)
            echo "  [CONFLICT] port $port has $unique_pids listeners (pids: $pids_list)"
        fi
    done
    if [[ $conflicts -gt 0 ]]; then
        ((warnings += conflicts))
    fi

    unset _seen_port_pid _port_pids
    echo ""

    # Summary
    echo "Summary:"
    if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
        echo "  All checks passed"
        return 0
    elif [[ $errors -eq 0 ]]; then
        echo "  $warnings warning(s)"
        return 0
    else
        echo "  $errors error(s), $warnings warning(s)"
        return 1
    fi
}

# Port scan
_doctor_ports() {
    local min="${1:-8000}"
    local max="${2:-8999}"

    # Parse range argument like "3000-5000"
    if [[ "$min" =~ ^([0-9]+)-([0-9]+)$ ]]; then
        min="${BASH_REMATCH[1]}"
        max="${BASH_REMATCH[2]}"
    fi

    echo "Scanning ports $min-$max..."
    echo ""
    printf "%-6s  %-6s  %-5s  %s\n" "PORT" "PID" "CONN" "COMMAND"
    printf "%-6s  %-6s  %-5s  %s\n" "------" "------" "-----" "-------"

    local found=0
    command -v lsof >/dev/null 2>&1 || { tsm_error "lsof required"; return 1; }

    for ((port = min; port <= max; port++)); do
        local info=$(lsof -ti ":$port" 2>/dev/null | head -1)
        if [[ -n "$info" ]]; then
            local pid="$info"
            local cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 45)
            local conn=$(tsm_port_connections "$port")
            printf "%-6s  %-6s  %-5s  %s\n" "$port" "$pid" "$conn" "$cmd"
            ((found++))
        fi
    done

    echo ""
    echo "Found $found port(s) in use"
}

# Check specific port
_doctor_port() {
    local port="$1"
    [[ -z "$port" ]] && { tsm_error "port required"; return 1; }

    if tsm_port_available "$port"; then
        echo "Port $port: available"
    else
        local pid=$(tsm_port_pid "$port")
        local cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 60)
        local conn_info=$(tsm_port_connection_details "$port")
        echo "Port $port: in use"
        echo "  PID:         $pid"
        echo "  Command:     $cmd"
        echo "  Connections: $conn_info"
    fi
}

# Kill process on port
_doctor_kill() {
    local port="$1"
    [[ -z "$port" ]] && { tsm_error "port required"; return 1; }

    local pid=$(tsm_port_pid "$port")
    if [[ -z "$pid" ]]; then
        echo "Port $port: not in use"
        return 0
    fi

    local cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 60)
    echo "Killing PID $pid on port $port"
    echo "  Command: $cmd"

    kill "$pid" 2>/dev/null
    sleep 1
    if tsm_is_pid_alive "$pid"; then
        kill -9 "$pid" 2>/dev/null
    fi

    echo "Done"
}

# Find orphaned processes
_doctor_orphans() {
    echo "Scanning for orphaned processes..."
    echo ""

    local found=0

    # Look for common server processes not tracked by TSM
    while IFS= read -r line; do
        local pid=$(echo "$line" | awk '{print $1}')
        local cmd=$(echo "$line" | cut -d' ' -f2-)

        # Check if tracked by TSM
        local tracked=false
        for dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local meta="${dir}meta.json"
            [[ -f "$meta" ]] || continue
            local meta_pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
            if [[ "$meta_pid" == "$pid" ]]; then
                tracked=true
                break
            fi
        done

        if [[ "$tracked" == "false" ]]; then
            printf "PID %-6s  %s\n" "$pid" "${cmd:0:60}"
            ((found++))
        fi
    done < <(ps -eo pid,args 2>/dev/null | grep -E "python.*http\.server|node.*server|npm.*start" | grep -v grep)

    echo ""
    if [[ $found -eq 0 ]]; then
        echo "No orphaned processes found"
    else
        echo "Found $found potential orphan(s)"
        echo "Kill with: kill <PID>"
    fi
}

# Clean stale process files
_doctor_clean() {
    echo "Cleaning stale process files..."

    local cleaned=0
    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == .* ]] && continue

        local meta="${dir}meta.json"
        [[ -f "$meta" ]] || continue

        local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
        if ! tsm_is_pid_alive "$pid"; then
            echo "  Removing: $name (pid:$pid dead)"
            rm -rf "$dir"
            ((cleaned++))
        fi
    done

    # Clean reserved placeholders
    for rdir in "$TSM_PROCESSES_DIR"/.reserved-*/; do
        [[ -d "$rdir" ]] || continue
        rm -rf "$rdir"
    done

    echo "Cleaned $cleaned stale process(es)"
}

# Help
_doctor_help() {
    cat <<EOF
TSM Doctor - diagnostics and maintenance

Usage:
  tsm doctor              Run health check (default)
  tsm doctor health       Full health check
  tsm doctor ports [MIN-MAX]  Scan ports (default: 8000-8999)
  tsm doctor port <N>     Check specific port
  tsm doctor kill <N>     Kill process on port
  tsm doctor orphans      Find untracked processes
  tsm doctor clean        Clean stale process files

Examples:
  tsm doctor              # Health check
  tsm doctor ports 3000-5000
  tsm doctor port 4000
  tsm doctor kill 4000
  tsm doctor orphans
  tsm doctor clean
EOF
}

