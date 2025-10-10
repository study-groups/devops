#!/usr/bin/env bash

# TSM Universal Start - Works with ANY bash command
# Smart port discovery from command arguments

# Discover port from command (4-5 digit integers)
tsm_discover_port() {
    local command="$1"
    local env_file="$2"
    local explicit_port="$3"

    # Priority: --port > env file > command scan > none
    [[ -n "$explicit_port" ]] && { echo "$explicit_port"; return 0; }

    # Check env file for PORT or TETRA_PORT
    if [[ -n "$env_file" && -f "$env_file" ]]; then
        local port=$(grep -E '^export (PORT|TETRA_PORT)=' "$env_file" | head -1 | grep -oE '[0-9]{4,5}')
        [[ -n "$port" ]] && { echo "$port"; return 0; }
    fi

    # Scan command for port patterns (:8000, --port 8000, -p 8000, PORT=8000, or standalone 4-5 digit)
    local port=$(echo "$command" | grep -oE '(:|--port|-p|PORT=| )[0-9]{4,5}' | grep -oE '[0-9]{4,5}' | head -1)
    [[ -n "$port" ]] && { echo "$port"; return 0; }

    echo ""
    return 1
}

# Generate process name
tsm_generate_process_name() {
    local command="$1"
    local port="$2"
    local explicit_name="$3"

    local base_name
    if [[ -n "$explicit_name" ]]; then
        base_name="$explicit_name"
    else
        # Extract first command word
        base_name="${command%% *}"
        base_name="${base_name##*/}"
        base_name="${base_name%.sh}"
    fi

    # Add port or timestamp
    if [[ -n "$port" && "$port" != "none" ]]; then
        echo "${base_name}-${port}"
    else
        echo "${base_name}-$(date +%s)"
    fi
}

# Universal start function - works with any command
tsm_start_any_command() {
    local command="$1"
    local env_file="$2"
    local explicit_port="$3"
    local explicit_name="$4"

    [[ -z "$command" ]] && {
        echo "tsm: command required" >&2
        return 64
    }

    # Discover port
    local port
    port=$(tsm_discover_port "$command" "$env_file" "$explicit_port")
    [[ -z "$port" ]] && port="none"

    # Generate name
    local name
    name=$(tsm_generate_process_name "$command" "$port" "$explicit_name")

    # Check if already running
    if tetra_tsm_is_running "$name"; then
        echo "❌ Process '$name' already running" >&2
        return 1
    fi

    # Get TSM ID
    local tsm_id=$(tetra_tsm_get_next_id)

    # Setup paths
    local log_out="$TSM_LOGS_DIR/${name}.out"
    local log_err="$TSM_LOGS_DIR/${name}.err"
    local pid_file="$TSM_PIDS_DIR/${name}.pid"

    # Build env command
    local env_cmd=""
    [[ -n "$env_file" && -f "$env_file" ]] && env_cmd="source '$env_file'"

    # Start process
    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup'" >&2
        return 1
    }

    (
        $setsid_cmd bash -c "
            $env_cmd
            exec $command </dev/null >>'$log_out' 2>>'$log_err' &
            echo \$! > '$pid_file'
        " &
    )

    sleep 0.5

    # Verify started
    if [[ ! -f "$pid_file" ]]; then
        echo "❌ Failed to start: $name (no PID file)" >&2
        return 1
    fi

    local pid=$(cat "$pid_file")
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "❌ Failed to start: $name (process died immediately)" >&2
        [[ -f "$log_err" ]] && tail -5 "$log_err" >&2
        return 1
    fi

    # Save metadata
    cat > "$TSM_PROCESSES_DIR/${name}.meta" <<EOF
tsm_id=$tsm_id
name=$name
pid=$pid
command='$command'
port=$port
start_time=$(date +%s)
env_file='$env_file'
cwd='$PWD'
type=command
EOF

    # Register port (will be implemented in ports_double.sh)
    if declare -f tsm_register_port >/dev/null 2>&1; then
        tsm_register_port "$tsm_id" "$name" "$port" "$pid"

        # Verify actual port if declared
        if [[ "$port" != "none" ]]; then
            sleep 1
            local actual_port=$(lsof -Pan -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $9}' | grep -oE '[0-9]+$' | head -1)

            if [[ -z "$actual_port" ]]; then
                echo "⚠️  Warning: Process started but not listening on expected port $port" >&2
            elif [[ "$actual_port" != "$port" ]]; then
                echo "⚠️  Warning: Port mismatch (declared=$port, actual=$actual_port)" >&2
                if declare -f tsm_update_actual_port >/dev/null 2>&1; then
                    tsm_update_actual_port "$tsm_id" "$actual_port"
                fi
            fi
        fi
    fi

    echo "✅ Started: $name (TSM ID: $tsm_id, PID: $pid, Port: $port)"
}

export -f tsm_discover_port
export -f tsm_generate_process_name
export -f tsm_start_any_command
