#!/usr/bin/env bash

# TSM Universal Start - Works with ANY bash command
# Smart port discovery from command arguments

# Discover port from command (4-5 digit integers)
tsm_discover_port() {
    local command="$1"
    local env_file="$2"
    local explicit_port="$3"

    # Priority: --port > env file > script file > command scan > none
    [[ -n "$explicit_port" ]] && { echo "$explicit_port"; return 0; }

    # Check env file for PORT or TETRA_PORT (with or without export)
    if [[ -n "$env_file" && -f "$env_file" ]]; then
        local port=$(grep -E '^(export )?(PORT|TETRA_PORT)=' "$env_file" | head -1 | grep -oE '[0-9]{4,5}')
        [[ -n "$port" ]] && { echo "$port"; return 0; }
    fi

    # Check script file for PORT (if command is "node script.js" or "python script.py")
    # Skip python -m module commands (they don't have script files to check)
    local script_file=""
    if [[ "$command" =~ (node|python|python3)[[:space:]]+([^[:space:]-][^[:space:]]*) ]]; then
        script_file="${BASH_REMATCH[2]}"
        if [[ -f "$script_file" ]]; then
            # Look for PORT= or process.env.PORT with default value
            local port=$(grep -oE '(PORT.*=.*(process\.env\.PORT.*\|\|.*)?[0-9]{4,5}|const.*PORT.*=.*[0-9]{4,5})' "$script_file" | grep -oE '[0-9]{4,5}' | head -1)
            [[ -n "$port" ]] && { echo "$port"; return 0; }
        fi
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
    local env_file="$4"

    local base_name
    if [[ -n "$explicit_name" ]]; then
        base_name="$explicit_name"
    else
        # Try to get NAME from env file
        if [[ -n "$env_file" && -f "$env_file" ]]; then
            base_name=$(grep -E '^(export )?NAME=' "$env_file" | head -1 | cut -d= -f2 | tr -d '"' | tr -d "'")
        fi

        # If still no name, try package.json
        if [[ -z "$base_name" && -f "package.json" ]]; then
            base_name=$(grep -E '"name"[[:space:]]*:' package.json | head -1 | grep -oE '"[^"]+"[[:space:]]*$' | tr -d '"' | tr -d ' ')
        fi

        # If still no name, extract from script file or module
        if [[ -z "$base_name" ]]; then
            # Match: python script.py, node app.js, python -m module.name
            if [[ "$command" =~ (node|python|python3)[[:space:]]+-m[[:space:]]+([a-zA-Z0-9_.]+) ]]; then
                # Python module: python -m http.server -> http
                local module_name="${BASH_REMATCH[2]}"
                base_name="${module_name%%.*}"  # Get first part before dot
            elif [[ "$command" =~ (node|python|python3)[[:space:]]+([^[:space:]-][^[:space:]]*) ]]; then
                # Script file: python script.py -> script
                local script_file="${BASH_REMATCH[2]}"
                base_name=$(basename "$script_file" .js 2>/dev/null || echo "$script_file")
                base_name=$(basename "$base_name" .py 2>/dev/null || echo "$base_name")
            else
                # Fallback: first command word
                base_name="${command%% *}"
                base_name="${base_name##*/}"
                base_name="${base_name%.sh}"
            fi
        fi
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

    # Detect process type and resolve interpreter
    local process_type
    process_type=$(tsm_detect_type "$command")

    local interpreter
    interpreter=$(tsm_resolve_interpreter "$process_type")

    # Rewrite command with resolved interpreter
    local final_command
    if [[ -n "$interpreter" && "$process_type" != "command" ]]; then
        final_command=$(tsm_rewrite_command_with_interpreter "$command" "$process_type" "$interpreter")
    else
        final_command="$command"
    fi

    # Discover port
    local port
    port=$(tsm_discover_port "$command" "$env_file" "$explicit_port")
    [[ -z "$port" ]] && port="none"

    # Generate name
    local name
    name=$(tsm_generate_process_name "$command" "$port" "$explicit_name" "$env_file")

    # Check if already running
    if tsm_process_exists "$name"; then
        echo "❌ Process '$name' already running" >&2
        return 1
    fi

    # Log start attempt (construct JSON safely)
    local log_meta=$(jq -n --arg cmd "$command" --arg p "$port" '{command: $cmd, port: $p}')
    tetra_log_try "tsm" "start" "$name" "$log_meta"

    # Setup process directory (PM2-style)
    local process_dir="$TSM_PROCESSES_DIR/$name"
    mkdir -p "$process_dir"

    local log_out="$process_dir/current.out"
    local log_err="$process_dir/current.err"
    local pid_file="$process_dir/${name}.pid"

    # Build environment activation and user env file
    local env_setup=""

    # Add runtime environment activation (pyenv, nvm, etc.)
    local runtime_activation
    runtime_activation=$(tsm_build_env_activation "$process_type")
    [[ -n "$runtime_activation" ]] && env_setup="$runtime_activation"$'\n'

    # Add user env file if specified
    if [[ -n "$env_file" && -f "$env_file" ]]; then
        env_setup="${env_setup}source '$env_file'"
    fi

    # Start process
    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup'" >&2
        return 1
    }

    (
        $setsid_cmd bash -c "
            $env_setup
            $final_command </dev/null >>'${log_out}' 2>>'${log_err}' &
            echo \$! > '${pid_file}'
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
        echo >&2

        # Check for port conflict first
        if [[ "$port" != "none" ]] && command -v lsof >/dev/null 2>&1; then
            local existing_pid=$(lsof -ti :$port 2>/dev/null)
            if [[ -n "$existing_pid" ]]; then
                local process_cmd=$(ps -p $existing_pid -o args= 2>/dev/null | head -c 80 || echo "unknown")
                echo "🔴 Port $port is already in use!" >&2
                echo "   Blocking process: PID $existing_pid" >&2
                echo "   Command: $process_cmd" >&2
                echo >&2
                echo "Solutions:" >&2
                echo "   • Stop the process: kill $existing_pid" >&2
                echo "   • Or use a different port in your config" >&2
                echo "   • Or use: tsm doctor" >&2
                return 1
            fi
        fi

        # No port conflict, show stderr
        echo "Process started but crashed. Check error logs:" >&2
        [[ -f "$log_err" ]] && tail -10 "$log_err" >&2
        return 1
    fi

    # Create simple JSON metadata (PM2-style)
    local tsm_id=$(tsm_create_metadata \
        "$name" \
        "$pid" \
        "$final_command" \
        "$port" \
        "$PWD" \
        "$interpreter" \
        "$process_type" \
        "$env_file")

    # Log success (construct JSON safely)
    local success_meta=$(jq -n --arg pid "$pid" --arg port "$port" --arg id "$tsm_id" \
        '{pid: ($pid | tonumber), port: $port, tsm_id: ($id | tonumber)}')
    tetra_log_success "tsm" "start" "$name" "$success_meta"

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
