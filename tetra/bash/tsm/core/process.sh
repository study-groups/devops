#!/usr/bin/env bash
# TSM Process - stop/restart/kill/delete/logs
# Note: tsm_start is in core/start.sh

# === STOP ===

# Stop a process by name or id
tsm_stop() {
    local target="$1"
    local force="${2:-false}"

    local name=$(tsm_resolve_name "$target" "true") || {
        tsm_error "process '$target' not found"
        return 1
    }

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

    local name=$(tsm_resolve_name "$target" "true") || {
        tsm_error "process '$target' not found"
        return 1
    }

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

    local name=$(tsm_resolve_name "$target" "true") || {
        tsm_error "process '$target' not found"
        return 1
    }

    local meta=$(tsm_meta_file "$name")
    [[ -f "$meta" ]] || { tsm_error "no metadata for '$name'"; return 1; }

    # Read metadata
    local command=$(jq -r '.command // empty' "$meta")
    local port=$(jq -r '.port // empty' "$meta")
    local cwd=$(jq -r '.cwd // empty' "$meta")
    local env_file=$(jq -r '.env_file // empty' "$meta")
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

    # Restart from original directory
    (
        cd "$cwd" 2>/dev/null || true
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
    [[ -z "$target" ]] && { tsm_error "usage: tsm info <name|id>"; return 1; }

    local name=$(tsm_resolve_name "$target" "true") || {
        tsm_error "process '$target' not found"
        return 1
    }

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

    local name=$(tsm_resolve_name "$target" "true") || {
        tsm_error "process '$target' not found"
        return 1
    }

    local dir=$(tsm_process_dir "$name")
    local log_out="$dir/current.out"
    local log_err="$dir/current.err"

    if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
        tail -f "$log_out" "$log_err" 2>/dev/null
    else
        echo "=== stdout ==="
        tail -50 "$log_out" 2>/dev/null || echo "(no output)"
        echo ""
        echo "=== stderr ==="
        tail -50 "$log_err" 2>/dev/null || echo "(no errors)"
    fi
}

export -f tsm_stop tsm_stop_all tsm_kill tsm_delete tsm_cleanup tsm_restart tsm_info tsm_logs
