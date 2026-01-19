#!/usr/bin/env bash
# TSM Process - stop/restart/kill/delete/logs
# Note: tsm_start is in core/start.sh

# === STOP ===

# Stop processes by name or id (supports multiple targets)
tsm_stop() {
    local force="false"
    local targets=()

    # Parse arguments
    for arg in "$@"; do
        case "$arg" in
            -f|--force|true) force="true" ;;
            *) targets+=("$arg") ;;
        esac
    done

    [[ ${#targets[@]} -eq 0 ]] && { tsm_error "usage: tsm stop <name|id>..."; return 64; }

    # Handle multiple targets
    if [[ ${#targets[@]} -gt 1 ]]; then
        local rc=0
        for target in "${targets[@]}"; do
            _tsm_stop_one "$target" "$force" || rc=1
        done
        return $rc
    fi

    _tsm_stop_one "${targets[0]}" "$force"
}

# Internal: stop a single process
_tsm_stop_one() {
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
    local stopped_port=$(jq -r '.port // empty' "$meta" 2>/dev/null)

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

    # Run post-stop hooks
    tsm_hooks_run "post_stop" "$name" "$stopped_port"
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

# Kill processes by name or id (supports multiple targets)
tsm_kill() {
    [[ $# -eq 0 ]] && { tsm_error "usage: tsm kill <name|id>..."; return 64; }
    tsm_stop "$@" --force
}

# === DELETE ===

# Delete processes by name or id (supports multiple targets)
tsm_delete() {
    [[ $# -eq 0 ]] && { tsm_error "usage: tsm delete <name|id>..."; return 64; }

    # Handle multiple targets
    if [[ $# -gt 1 ]]; then
        local rc=0
        for target in "$@"; do
            _tsm_delete_one "$target" || rc=1
        done
        return $rc
    fi

    _tsm_delete_one "$1"
}

# Internal: delete a single process
_tsm_delete_one() {
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
    tsm_process_alive "$name" && _tsm_stop_one "$name" "true"

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

# Restart processes by name or id (supports multiple targets)
tsm_restart() {
    [[ $# -eq 0 ]] && { tsm_error "usage: tsm restart <name|id>..."; return 64; }

    # Handle multiple targets
    if [[ $# -gt 1 ]]; then
        local rc=0
        for target in "$@"; do
            _tsm_restart_one "$target" || rc=1
        done
        return $rc
    fi

    _tsm_restart_one "$1"
}

# Internal: restart a single process
_tsm_restart_one() {
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
    tsm_process_alive "$name" && _tsm_stop_one "$name" "true"

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
        tsm_start "$tsm_file" --port "$port" --reuse-id "$old_id"
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
            tsm_start "$command" --port "$port" --env "$env_file" --name "${name%-*}" --reuse-id "$old_id"
        else
            tsm_start "$command" --port "$port" --name "${name%-*}" --reuse-id "$old_id"
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
    local tsm_file=$(jq -r '.tsm_file // "-"' "$meta")
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
    echo "TSM File: $tsm_file"
    echo "Env File: $env_file"
    echo "Started:  $started"

    # Show process dir
    local proc_dir=$(tsm_process_dir "$name")
    echo "Dir:      $proc_dir"

    # Show environment variables if env file exists and is readable
    if [[ -n "$env_file" && "$env_file" != "-" && "$env_file" != "null" && -f "$env_file" ]]; then
        echo ""
        echo "Environment:"
        # Parse env file, skip comments and empty lines, indent output
        while IFS= read -r line || [[ -n "$line" ]]; do
            # Skip comments and empty lines
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            # Only show lines that look like VAR=value
            [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && echo "  $line"
        done < "$env_file"
    fi
}

# === LOGS ===

# Enhanced log viewer with timestamps, delta, filtering
# Usage: tsm logs <name|id> [options]
#        tsm logs <subcommand> [args]
# Options:
#   -f, --follow       Stream in real-time
#   -n, --lines N      Show last N lines (default: 50)
#   --since TIME       Show logs since duration (e.g., 5m, 1h) or timestamp
#   -t, --timestamps   Prepend compact ISO timestamps
#   --delta            Show delta time between consecutive lines
#   -e, --stderr-only  Show only stderr
#   -o, --stdout-only  Show only stdout
#   --json             Output as JSON array
# Subcommands:
#   rotate <name|all>  Rotate current logs to timestamped archive
#   archive <name|all> Compress uncompressed archives
#   clean <name|all>   Remove archives older than retention period
#   export <name|all>  Upload archives to S3/Spaces
#   list [name]        List archived logs
tsm_logs() {
    # Check for subcommands first
    case "${1:-}" in
        rotate|archive|clean|export|list)
            tsm_logs_subcommand "$@"
            return $?
            ;;
    esac

    local target=""
    local follow=false
    local lines=50
    local since=""
    local show_timestamps=false
    local show_delta=false
    local stderr_only=false
    local stdout_only=false
    local json_output=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -f|--follow)
                follow=true
                shift
                ;;
            -n|--lines)
                lines="${2:-50}"
                shift 2
                ;;
            --since)
                since="$2"
                shift 2
                ;;
            -t|--timestamps)
                show_timestamps=true
                shift
                ;;
            --delta)
                show_delta=true
                shift
                ;;
            -e|--stderr-only)
                stderr_only=true
                shift
                ;;
            -o|--stdout-only)
                stdout_only=true
                shift
                ;;
            --json)
                json_output=true
                shift
                ;;
            -*)
                tsm_error "unknown option: $1"
                return 64
                ;;
            *)
                [[ -z "$target" ]] && target="$1" || { tsm_error "unexpected argument: $1"; return 64; }
                shift
                ;;
        esac
    done

    [[ -z "$target" ]] && { tsm_error "usage: tsm logs <name|id> [options]"; return 64; }

    # Validate mutually exclusive options
    if [[ "$stderr_only" == "true" && "$stdout_only" == "true" ]]; then
        tsm_error "cannot use both --stderr-only and --stdout-only"
        return 64
    fi

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

    # Follow mode - simple tail -f
    if [[ "$follow" == "true" ]]; then
        local files=()
        [[ "$stderr_only" != "true" && -f "$log_out" ]] && files+=("$log_out")
        [[ "$stdout_only" != "true" && -f "$log_err" ]] && files+=("$log_err")

        if [[ ${#files[@]} -eq 0 ]]; then
            tsm_error "no log files found in $dir"
            return 1
        fi

        if [[ "$show_timestamps" == "true" || "$show_delta" == "true" ]]; then
            # Enhanced follow with timestamps/delta
            _tsm_logs_follow_enhanced "${files[@]}"
        else
            tail -f "${files[@]}" 2>/dev/null
        fi
        return $?
    fi

    # Static mode - show last N lines with optional formatting
    _tsm_logs_static "$name" "$log_out" "$log_err" "$lines" "$since" \
        "$show_timestamps" "$show_delta" "$stderr_only" "$stdout_only" "$json_output"
}

# Internal: Display static logs with formatting options
_tsm_logs_static() {
    local name="$1"
    local log_out="$2"
    local log_err="$3"
    local lines="$4"
    local since="$5"
    local show_timestamps="$6"
    local show_delta="$7"
    local stderr_only="$8"
    local stdout_only="$9"
    local json_output="${10}"

    local -a all_lines=()

    # Collect stdout lines
    if [[ "$stderr_only" != "true" && -f "$log_out" && -s "$log_out" ]]; then
        while IFS= read -r line; do
            all_lines+=("out|$line")
        done < <(tail -"$lines" "$log_out")
    fi

    # Collect stderr lines
    if [[ "$stdout_only" != "true" && -f "$log_err" && -s "$log_err" ]]; then
        while IFS= read -r line; do
            all_lines+=("err|$line")
        done < <(tail -"$lines" "$log_err")
    fi

    # No lines found
    if [[ ${#all_lines[@]} -eq 0 ]]; then
        if [[ "$json_output" == "true" ]]; then
            echo '{"service":"'"$name"'","entries":[]}'
        else
            echo "(no log entries)"
        fi
        return 0
    fi

    # JSON output
    if [[ "$json_output" == "true" ]]; then
        _tsm_logs_json "$name" "${all_lines[@]}"
        return $?
    fi

    # Text output with optional timestamps/delta
    local prev_ms=0
    local now_ms
    now_ms=$(tsm_epoch_ms)
    local first=true

    for entry in "${all_lines[@]}"; do
        local stream="${entry%%|*}"
        local line="${entry#*|}"
        local prefix=""

        if [[ "$show_timestamps" == "true" ]]; then
            prefix="$(tsm_timestamp) | "
        fi

        if [[ "$show_delta" == "true" ]]; then
            local curr_ms
            curr_ms=$(tsm_epoch_ms)
            if [[ "$first" == "true" ]]; then
                prefix="${prefix}+0.000 | "
                first=false
            else
                prefix="${prefix}$(tsm_delta "$prev_ms" "$curr_ms") | "
            fi
            prev_ms="$curr_ms"
        fi

        # Stream indicator for combined view
        if [[ "$stderr_only" != "true" && "$stdout_only" != "true" ]]; then
            case "$stream" in
                out) prefix="${prefix}[O] " ;;
                err) prefix="${prefix}[E] " ;;
            esac
        fi

        echo "${prefix}${line}"
    done
}

# Internal: Output logs as JSON
_tsm_logs_json() {
    local name="$1"
    shift
    local -a entries=("$@")

    echo -n '{"service":"'"$name"'","entries":['

    local first=true
    local prev_ms=0
    local i=0

    for entry in "${entries[@]}"; do
        local stream="${entry%%|*}"
        local line="${entry#*|}"

        # Escape JSON special chars
        line=$(_tsm_json_escape "$line")

        local ts
        ts=$(tsm_timestamp)

        local curr_ms
        curr_ms=$(tsm_epoch_ms)

        local delta
        if [[ $i -eq 0 ]]; then
            delta="+0.000"
        else
            delta=$(tsm_delta "$prev_ms" "$curr_ms")
        fi
        prev_ms="$curr_ms"

        # Comma before all but first entry
        [[ $i -gt 0 ]] && echo -n ","

        echo -n '{"ts":"'"$ts"'","delta":"'"$delta"'","stream":"'"$stream"'","line":"'"$line"'"}'
        ((i++))
    done

    echo ']}'
}

# Internal: Enhanced follow mode with timestamps
_tsm_logs_follow_enhanced() {
    local -a files=("$@")
    local prev_ms=0
    local first=true

    # Use tail -f and process each line
    tail -f "${files[@]}" 2>/dev/null | while IFS= read -r line; do
        local curr_ms
        curr_ms=$(tsm_epoch_ms)

        local prefix=""
        prefix="$(tsm_timestamp) | "

        if [[ "$first" == "true" ]]; then
            prefix="${prefix}+0.000 | "
            first=false
        else
            prefix="${prefix}$(tsm_delta "$prev_ms" "$curr_ms") | "
        fi
        prev_ms="$curr_ms"

        echo "${prefix}${line}"
    done
}

export -f tsm_stop _tsm_stop_one tsm_stop_all tsm_kill
export -f tsm_delete _tsm_delete_one tsm_cleanup
export -f tsm_restart _tsm_restart_one tsm_info tsm_logs
export -f _tsm_logs_static _tsm_logs_json _tsm_logs_follow_enhanced
