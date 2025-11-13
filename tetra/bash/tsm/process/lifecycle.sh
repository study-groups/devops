#!/usr/bin/env bash

# TSM Process Lifecycle Management
# Extracted from tsm_interface.sh during Phase 2 refactor
# Functions handling process start/stop/restart operations

# NOTE: This is a library file loaded via core/include.sh
# TSM_DIR and TSM_SRC are set by core/config.sh before this file is sourced

# Load TSM logging wrapper if available
[[ -f "$TSM_DIR/tsm_log.sh" ]] && source "$TSM_DIR/tsm_log.sh" 2>/dev/null || true

# === CORE PROCESS STARTING ===

_tsm_start_process() {
    local script="$1"
    local name="$2"
    local env_file="$3"
    local working_dir="$4"

    local logdir="$TSM_LOGS_DIR"
    local piddir="$TSM_PIDS_DIR"

    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
        return 1
    }

    local cd_cmd=""
    if [[ -n "$working_dir" ]]; then
        # Validate working directory for security
        _tsm_validate_path "$working_dir" || return 1
        cd_cmd="cd '$working_dir'"
    fi

    local env_cmd=""
    [[ -n "$env_file" && -f "$env_file" ]] && env_cmd="source '$env_file'"

    # Validate script path for security
    if [[ -n "$script" ]]; then
        _tsm_validate_command "$script" || return 1
    fi

    (
        $setsid_cmd bash -c "
            $cd_cmd
            $env_cmd
            exec '$script' </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
            echo \$! > '$piddir/$name.pid'
        " &
    )

    sleep 0.5
}

_tsm_start_command_process() {
    local command="$1"
    local name="$2"
    local env_file="$3"
    local working_dir="$4"

    local logdir="$TSM_LOGS_DIR"
    local piddir="$TSM_PIDS_DIR"

    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
        return 1
    }

    local cd_cmd=""
    if [[ -n "$working_dir" ]]; then
        # Validate working directory for security
        _tsm_validate_path "$working_dir" || return 1
        cd_cmd="cd '$working_dir'"
    fi

    local env_cmd=""
    [[ -n "$env_file" && -f "$env_file" ]] && env_cmd="source '$env_file'"

    # Validate command for security
    if [[ -n "$command" ]]; then
        _tsm_validate_command "$command" || return 1
    fi

    (
        $setsid_cmd bash -c "
            $cd_cmd
            $env_cmd
            exec $command </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
            echo \$! > '$piddir/$name.pid'
        " &
    )

    sleep 0.5
}

# === SPECIALIZED PROCESS TYPES ===

tetra_tsm_start_python() {
    local python_cmd="${1:-}"
    local port="${2:-}"
    local dirname="${3:-}"
    local custom_name="${4:-}"
    local pwd_at_start_override="${5:-}"

    [[ -n "$python_cmd" ]] || { echo "tsm: python start requires a command" >&2; return 64; }

    tetra_python_activate

    # Default port if not provided
    if [[ -z "$port" ]]; then
        port=$(python3 -c "import socket; s=socket.socket(); s.bind(('', 0)); port=s.getsockname()[1]; s.close(); print(port)")
    fi

    local name="${custom_name:-python-server}-${port}"

    # Log start attempt
    type tsm_log_process_start_try >/dev/null 2>&1 && \
        tsm_log_process_start_try "$name" "$port"

    tetra_tsm_is_running "$name" && {
        echo "tsm: process '$name' already running" >&2
        type tsm_log_process_start_fail >/dev/null 2>&1 && \
            tsm_log_process_start_fail "$name" "already running"
        return 1
    }

    # Change to specified directory if provided
    local start_dir="$PWD"
    if [[ -n "$dirname" ]]; then
        [[ -d "$dirname" ]] || { echo "tsm: directory '$dirname' not found" >&2; return 66; }
        start_dir="$dirname"
    fi

    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
        return 1
    }

    local logdir="$TSM_LOGS_DIR"
    local piddir="$TSM_PIDS_DIR"

    # Validate directory and command for security
    _tsm_validate_path "$start_dir" || return 1
    _tsm_validate_command "$python_cmd" || return 1

    (
        $setsid_cmd bash -c "
            cd '$start_dir'
            export PYTHONUNBUFFERED=1
            $python_cmd </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
            echo \$! > '$piddir/$name.pid'
        " &
    )

    sleep 0.5
    if tetra_tsm_is_running "$name"; then
        local pid
        pid=$(cat "$piddir/$name.pid")

        local cwd_value
        if [[ -n "$pwd_at_start_override" ]]; then
            cwd_value="$pwd_at_start_override"
        else
            cwd_value="$PWD"
        fi

        local tsm_id
        tsm_id=$(tsm_create_metadata "$name" "$pid" "$python_cmd" "$port" "$cwd_value" "python" "python" "")

        # Log success
        type tsm_log_process_start_success >/dev/null 2>&1 && \
            tsm_log_process_start_success "$name" "$pid" "$port"

        echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid, Port: $port)"
    else
        echo "tsm: failed to start '$name'" >&2
        echo >&2
        # Log failure
        type tsm_log_process_start_fail >/dev/null 2>&1 && \
            tsm_log_process_start_fail "$name" "process failed to start"
        # Run diagnostic to provide helpful error context
        tsm_diagnose_startup_failure "$name" "$port" "$python_cmd" ""
        return 1
    fi
}

tetra_tsm_start_webserver() {
    local dirname="${1:-$TETRA_DIR/public}"
    local port="${2:-8888}"

    [[ -d "$dirname" ]] || {
        echo "tsm: directory '$dirname' not found" >&2
        return 66
    }

    local python_cmd="python3 -m http.server $port"
    tetra_tsm_start_python "$python_cmd" "$port" "$dirname" "webserver"
}

# === PROCESS STOPPING ===

tetra_tsm_stop_single() {
    local name="$1"
    local force="${2:-false}"

    # Check if process is running
    if ! tetra_tsm_is_running "$name"; then
        echo "tsm: process '$name' not running"
        return 1
    fi

    # Get PID from JSON metadata
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    local pid=$(jq -r '.pid // empty' "$meta_file")

    # Log stop attempt
    tetra_log_try "tsm" "stop" "$name" "{\"pid\":$pid,\"force\":$force}"

    # Get process group ID
    local pgid=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
    else
        pgid=$(ps -p "$pid" -o pgid --no-headers 2>/dev/null | tr -d ' ')
    fi

    echo "tsm: stopping '$name' (PID: $pid)"

    if [[ "$force" == "true" ]]; then
        # Force kill - use SIGKILL
        if [[ -n "$pgid" && "$pgid" != "1" ]]; then
            # Kill entire process group
            kill -9 "-$pgid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
        else
            kill -9 "$pid" 2>/dev/null
        fi
    else
        # Graceful shutdown - use SIGTERM first
        if [[ -n "$pgid" && "$pgid" != "1" ]]; then
            # Terminate entire process group
            kill "-$pgid" 2>/dev/null || kill "$pid" 2>/dev/null
        else
            kill "$pid" 2>/dev/null
        fi

        # Wait for graceful shutdown
        local timeout=10
        local count=0
        while [[ $count -lt $timeout ]] && _tsm_is_process_running "$pid"; do
            sleep 1
            count=$((count + 1))
        done

        # Force kill if still running
        if _tsm_is_process_running "$pid"; then
            echo "tsm: force killing '$name' after timeout"
            if [[ -n "$pgid" && "$pgid" != "1" ]]; then
                kill -9 "-$pgid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
            else
                kill -9 "$pid" 2>/dev/null
            fi
        fi
    fi

    # Update metadata status in JSON
    local temp_file="${meta_file}.tmp"
    jq '.status = "stopped" | .stop_time = now' "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"

    # Log success
    tetra_log_success "tsm" "stop" "$name" "{\"pid\":$pid}"

    echo "tsm: stopped '$name'"
}

tetra_tsm_stop_by_id() {
    local id="$1"
    local force="${2:-false}"

    local name
    # Try smart resolver first (handles TSM ID, PID, or port)
    name=$(tetra_tsm_smart_resolve "$id") || {
        # Fallback to original ID-only lookup
        name=$(tetra_tsm_id_to_name "$id") || {
            echo "tsm: process ID/PID/port '$id' not found" >&2
            return 1
        }
    }

    tetra_tsm_stop_single "$name" "$force"
}

# === PROCESS DELETION ===

tetra_tsm_delete_single() {
    local name="$1"
    local process_dir="$TSM_PROCESSES_DIR/$name"

    # Check if process exists
    if [[ ! -d "$process_dir" ]]; then
        echo "tsm: process '$name' not found"
        return 1
    fi

    # Stop the process if running
    tetra_tsm_is_running "$name" && tetra_tsm_stop_single "$name" "true" 2>/dev/null || true

    # Get TSM ID before deleting the directory
    local meta_file="${process_dir}/meta.json"
    local tsm_id=""
    if [[ -f "$meta_file" ]]; then
        tsm_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
    fi

    # Remove process directory (contains meta.json and any other metadata)
    _tsm_safe_remove_dir "$process_dir"

    # Clean up any reserved ID placeholder for this process
    if [[ -n "$tsm_id" ]]; then
        local reserved_dir="$TSM_PROCESSES_DIR/.reserved-$tsm_id"
        [[ -d "$reserved_dir" ]] && _tsm_safe_remove_dir "$reserved_dir"
    fi

    # Clean up legacy TCS database files if they exist
    local db_pattern="bash/tsm/db/*.tsm.*"
    if compgen -G "$db_pattern" > /dev/null 2>&1; then
        find bash/tsm/db -name "*${name}*.tsm.*" -type f -delete 2>/dev/null || true
    fi

    tetra_log_success "tsm" "delete" "$name" "{}"
    echo "tsm: deleted '$name'"
}

tetra_tsm_delete_by_id() {
    local id="$1"

    local name
    name=$(tetra_tsm_id_to_name "$id") || {
        echo "tsm: process ID '$id' not found" >&2
        return 1
    }

    tetra_tsm_delete_single "$name"
}

# === PROCESS RESTARTING ===

tetra_tsm_restart_single() {
    local name="$1"

    # Get metadata before stopping (use JSON metadata)
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    if [[ ! -f "$meta_file" ]]; then
        echo "tsm: process '$name' not found" >&2
        return 1
    fi

    # Extract metadata from JSON
    local script port type tsm_id cwd
    script=$(jq -r '.command // empty' "$meta_file")
    port=$(jq -r '.port // empty' "$meta_file")
    type=$(jq -r '.process_type // empty' "$meta_file")
    tsm_id=$(jq -r '.tsm_id // empty' "$meta_file")
    cwd=$(jq -r '.cwd // empty' "$meta_file")

    # Stop if running
    tetra_tsm_is_running "$name" && tetra_tsm_stop_single "$name" "true"

    # Restart based on type
    _tsm_restart_unified "$name" "$script" "$port" "$type" "$tsm_id" "$cwd"
}

tetra_tsm_restart_by_id() {
    local id="$1"

    local name
    name=$(tetra_tsm_id_to_name "$id") || {
        echo "tsm: process ID '$id' not found" >&2
        return 1
    }

    tetra_tsm_restart_single "$name"
}

_tsm_restart_unified() {
    local name="$1"
    local script="$2"
    local port="$3"
    local type="$4"
    local preserve_id="$5"
    local cwd="$6"

    case "$type" in
        python)
            # Python processes need special handling
            local working_dir="$(dirname "$script")"

            local setsid_cmd
            setsid_cmd=$(tetra_tsm_get_setsid) || {
                echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
                return 1
            }

            local logdir="$TSM_LOGS_DIR"
            local piddir="$TSM_PIDS_DIR"

            # Validate directory and command for security
            _tsm_validate_path "$working_dir" || return 1
            _tsm_validate_command "$script" || return 1

            (
                $setsid_cmd bash -c "
                    cd '$working_dir'
                    export PYTHONUNBUFFERED=1
                    $script </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
                    echo \$! > '$piddir/$name.pid'
                " &
            )

            sleep 0.5
            if tetra_tsm_is_running "$name"; then
                local pid
                pid=$(cat "$piddir/$name.pid")

                # Update existing metadata for restart
                local meta_file=$(tsm_get_meta_file "$name")
                local temp_file="${meta_file}.tmp"
                jq --arg pid "$pid" \
                   --arg start_time "$(date +%s)" \
                   '.pid = ($pid | tonumber) | .start_time = ($start_time | tonumber) | .status = "online" | .restarts += 1' \
                   "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"

                # Log restart success
                type tsm_log_process_restart >/dev/null 2>&1 && \
                    tsm_log_process_restart "$name" "$preserve_id" "$pid"

                echo "tsm: restarted '$name' (TSM ID: $preserve_id, PID: $pid, Port: $port)"
            else
                echo "tsm: failed to restart '$name'" >&2
                type tsm_log_fail >/dev/null 2>&1 && \
                    tsm_log_fail "restart" "$name" '{"error":"process failed to start"}'
                return 1
            fi
            ;;
        cli)
            local script_path
            script_path=$(_tsm_resolve_script_path "$script") || return 1
            _tsm_validate_script "$script_path" || return $?

            # CLI scripts run from their parent directory
            local working_dir
            working_dir="$(dirname "$(dirname "$script_path")")"

            _tsm_start_process "$script_path" "$name" "" "$working_dir" || {
                echo "tsm: failed to restart '$name'" >&2
                return 1
            }

            local pid
            pid=$(cat "$TSM_PIDS_DIR/$name.pid")

            # Update existing metadata for restart
            local meta_file=$(tsm_get_meta_file "$name")
            local temp_file="${meta_file}.tmp"
            jq --arg pid "$pid" \
               --arg start_time "$(date +%s)" \
               '.pid = ($pid | tonumber) | .start_time = ($start_time | tonumber) | .status = "online" | .restarts += 1' \
               "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"

            echo "tsm: restarted '$name' (TSM ID: $preserve_id, PID: $pid)"
            ;;
        command)
            _tsm_start_command_process "$script" "$name" "" "$cwd" || {
                echo "tsm: failed to restart '$name'" >&2
                return 1
            }

            local pid
            pid=$(cat "$TSM_PIDS_DIR/$name.pid")

            # Update existing metadata for restart
            local meta_file=$(tsm_get_meta_file "$name")
            local temp_file="${meta_file}.tmp"
            jq --arg pid "$pid" \
               --arg start_time "$(date +%s)" \
               '.pid = ($pid | tonumber) | .start_time = ($start_time | tonumber) | .status = "online" | .restarts += 1' \
               "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"

            echo "tsm: restarted '$name' (TSM ID: $preserve_id, PID: $pid, Port: $port)"
            ;;
        node)
            # Node processes - similar to command but tracked as node type
            _tsm_start_command_process "$script" "$name" "" "$cwd" || {
                echo "tsm: failed to restart '$name'" >&2
                return 1
            }

            local pid
            pid=$(cat "$TSM_PIDS_DIR/$name.pid")

            # Update JSON metadata for restart
            local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
            local temp_file="${meta_file}.tmp"
            jq --arg pid "$pid" \
               --arg start_time "$(date +%s)" \
               '.pid = ($pid | tonumber) | .start_time = ($start_time | tonumber) | .status = "online" | .restarts += 1' \
               "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"

            echo "tsm: restarted '$name' (TSM ID: $preserve_id, PID: $pid, Port: $port)"
            ;;
        *)
            echo "tsm: unknown process type '$type'" >&2
            return 1
            ;;
    esac
}

# Export process functions
export -f _tsm_start_process
export -f _tsm_start_command_process
export -f tetra_tsm_start_python
export -f tetra_tsm_start_webserver
export -f tetra_tsm_stop_single
export -f tetra_tsm_stop_by_id
export -f tetra_tsm_delete_single
export -f tetra_tsm_delete_by_id
export -f tetra_tsm_restart_single
export -f tetra_tsm_restart_by_id
export -f _tsm_restart_unified