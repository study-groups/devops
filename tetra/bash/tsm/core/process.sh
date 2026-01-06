#!/usr/bin/env bash
# TSM Process - stop/restart/kill/delete/logs
# Note: tsm_start is in core/start.sh

# === STOP ===

# Stop a process by name or id
tsm_stop() {
    local target="$1"
    local force="${2:-false}"

    [[ -z "$target" ]] && { tsm_error "usage: tsm stop <name|id>"; return 64; }

    local name
    name=$(tsm_resolve_name "$target" "true")
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        tsm_error "$(_tsm_resolve_error "$target" "$rc" "$name")"
        return 1
    fi

    if ! tsm_process_alive "$name"; then
        echo "tsm: '$name' not running"
        tsm_set_status "$name" "stopped"
        return 0
    fi

    local meta=$(tsm_meta_file "$name")
    local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)

    echo "Stopping '$name' (pid:$pid)"

    # Get process group
    local pgid=""
    if [[ "$TSM_PLATFORM" == "macos" ]]; then
        pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
    else
        pgid=$(ps -p "$pid" -o pgid --no-headers 2>/dev/null | tr -d ' ')
    fi

    if [[ "$force" == "true" || "$force" == "-f" ]]; then
        # Force kill
        if [[ -n "$pgid" && "$pgid" != "1" ]]; then
            kill -9 "-$pgid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
        else
            kill -9 "$pid" 2>/dev/null
        fi
    else
        # Graceful: SIGTERM then wait
        if [[ -n "$pgid" && "$pgid" != "1" ]]; then
            kill "-$pgid" 2>/dev/null || kill "$pid" 2>/dev/null
        else
            kill "$pid" 2>/dev/null
        fi

        # Wait up to 10s
        local count=0
        while [[ $count -lt 10 ]] && tsm_is_pid_alive "$pid"; do
            sleep 1
            ((count++))
        done

        # Force kill if still alive
        if tsm_is_pid_alive "$pid"; then
            echo "Force killing after timeout"
            kill -9 "$pid" 2>/dev/null
        fi
    fi

    tsm_set_status "$name" "stopped"
    echo "Stopped: $name"
}

# Stop all processes
tsm_stop_all() {
    local force="${1:-false}"
    local count=0

    for name in $(tsm_list_tracked); do
        tsm_process_alive "$name" || continue
        tsm_stop "$name" "$force"
        ((count++))
    done

    echo "Stopped $count process(es)"
}

# === KILL ===

tsm_kill() {
    tsm_stop "$1" "true"
}

# === DELETE ===

tsm_delete() {
    local target="$1"

    [[ -z "$target" ]] && { tsm_error "usage: tsm delete <name|id>"; return 64; }

    local name
    name=$(tsm_resolve_name "$target" "true")
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        tsm_error "$(_tsm_resolve_error "$target" "$rc" "$name")"
        return 1
    fi

    # Stop if running
    tsm_process_alive "$name" && tsm_stop "$name" "true"

    # Remove metadata
    tsm_remove_meta "$name"
    echo "Deleted: $name"
}

# Delete all stopped processes
tsm_cleanup() {
    local count=0
    for name in $(tsm_list_tracked); do
        tsm_process_alive "$name" && continue
        tsm_remove_meta "$name"
        ((count++))
    done
    echo "Cleaned up $count stopped process(es)"
}

# === RESTART ===

tsm_restart() {
    local target="$1"

    [[ -z "$target" ]] && { tsm_error "usage: tsm restart <name|id>"; return 64; }

    local name
    name=$(tsm_resolve_name "$target" "true")
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        tsm_error "$(_tsm_resolve_error "$target" "$rc" "$name")"
        return 1
    fi

    local meta=$(tsm_meta_file "$name")
    [[ -f "$meta" ]] || { tsm_error "no metadata for '$name'"; return 1; }

    # Read metadata
    local command=$(jq -r '.command // empty' "$meta")
    local port=$(jq -r '.port // empty' "$meta")
    local cwd=$(jq -r '.cwd // empty' "$meta")
    local env_file=$(jq -r '.env_file // empty' "$meta")
    local tsm_file=$(jq -r '.tsm_file // empty' "$meta")
    local old_id=$(jq -r '.id // empty' "$meta")

    # Stop if running
    tsm_process_alive "$name" && tsm_stop "$name" "true"

    # Wait for port
    if [[ -n "$port" && "$port" != "null" && "$port" != "0" ]]; then
        local wait=0
        while [[ $wait -lt 30 ]] && ! tsm_port_available "$port"; do
            sleep 0.1
            ((wait++))
        done
    fi

    # If we have a .tsm file, restart from that (preserves all inline env vars)
    if [[ -n "$tsm_file" && "$tsm_file" != "null" && -f "$tsm_file" ]]; then
        tsm_start "$tsm_file" --port "$port"
        return $?
    fi

    # Fallback: restart from original directory with command
    if [[ ! -d "$cwd" ]]; then
        tsm_error "original directory missing: $cwd"
        return 1
    fi

    (
        cd "$cwd" || { tsm_error "cannot cd to $cwd"; exit 1; }
        if [[ -n "$env_file" && "$env_file" != "null" ]]; then
            tsm_start "$command" --port "$port" --env "$env_file" --name "${name%-*}"
        else
            tsm_start "$command" --port "$port" --name "${name%-*}"
        fi
    )
}

# === INFO ===

# Show detailed info for a process
tsm_info() {
    local target="$1"
    [[ -z "$target" ]] && { tsm_error "usage: tsm info <name|id>"; return 64; }

    local name
    name=$(tsm_resolve_name "$target" "true")
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        tsm_error "$(_tsm_resolve_error "$target" "$rc" "$name")"
        return 1
    fi

    local meta=$(tsm_meta_file "$name")
    [[ -f "$meta" ]] || { tsm_error "no metadata for '$name'"; return 1; }

    # Read and display metadata
    local id=$(jq -r '.id // "-"' "$meta")
    local pid=$(jq -r '.pid // "-"' "$meta")
    local port=$(jq -r '.port // "-"' "$meta")
    local command=$(jq -r '.command // "-"' "$meta")
    local cwd=$(jq -r '.cwd // "-"' "$meta")
    local env_file=$(jq -r '.env_file // "-"' "$meta")
    local started=$(jq -r '.started // "-"' "$meta")
    local status

    if tsm_process_alive "$name"; then
        status="online"
    else
        status="stopped"
    fi

    echo "Name:     $name"
    echo "ID:       $id"
    echo "PID:      $pid"
    echo "Port:     $port"
    echo "Status:   $status"
    echo "Command:  $command"
    echo "CWD:      $cwd"
    echo "Env:      $env_file"
    echo "Started:  $started"

    # Show process dir
    local proc_dir=$(tsm_process_dir "$name")
    echo "Dir:      $proc_dir"
}

# === LOGS ===

tsm_logs() {
    local target="$1"
    local follow="${2:-}"

    [[ -z "$target" ]] && { tsm_error "usage: tsm logs <name|id> [-f]"; return 64; }

    local name
    name=$(tsm_resolve_name "$target" "true")
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        tsm_error "$(_tsm_resolve_error "$target" "$rc" "$name")"
        return 1
    fi

    local dir=$(tsm_process_dir "$name")
    local log_out="$dir/current.out"
    local log_err="$dir/current.err"

    # Check process dir exists
    if [[ ! -d "$dir" ]]; then
        tsm_error "process directory missing: $dir"
        return 1
    fi

    if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
        # Check files exist before tailing
        if [[ ! -f "$log_out" && ! -f "$log_err" ]]; then
            tsm_error "no log files found in $dir"
            return 1
        fi
        tail -f "$log_out" "$log_err" 2>/dev/null
    else
        echo "=== stdout ==="
        if [[ -f "$log_out" ]]; then
            if [[ -s "$log_out" ]]; then
                tail -50 "$log_out"
            else
                echo "(empty)"
            fi
        else
            echo "(file not found: $log_out)"
        fi
        echo ""
        echo "=== stderr ==="
        if [[ -f "$log_err" ]]; then
            if [[ -s "$log_err" ]]; then
                tail -50 "$log_err"
            else
                echo "(empty)"
            fi
        else
            echo "(file not found: $log_err)"
        fi
    fi
}

export -f tsm_stop tsm_stop_all tsm_kill tsm_delete tsm_cleanup tsm_restart tsm_info tsm_logs
