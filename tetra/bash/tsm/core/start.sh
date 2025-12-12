#!/usr/bin/env bash

# TSM Universal Start - Works with ANY bash command
# Smart port discovery from command arguments

# Discover port from command (4-5 digit integers)
tsm_discover_port() {
    local command="$1"
    local env_file="$2"
    local explicit_port="$3"
    local parsed_port="${4:-}"  # Optional: pre-parsed ENV_PORT

    # Priority: --port > env file > script file > command scan > none
    [[ -n "$explicit_port" ]] && { echo "$explicit_port"; return 0; }

    # Use pre-parsed port if available, otherwise read env file
    if [[ -n "$parsed_port" ]]; then
        echo "$parsed_port"
        return 0
    elif [[ -n "$env_file" && -f "$env_file" ]]; then
        local port=$(_tsm_get_env_port "$env_file")
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
    local parsed_name="${5:-}"  # Optional: pre-parsed ENV_NAME

    local base_name
    if [[ -n "$explicit_name" ]]; then
        base_name="$explicit_name"
    else
        # Use pre-parsed name if available, otherwise read env file
        if [[ -n "$parsed_name" ]]; then
            base_name="$parsed_name"
        elif [[ -n "$env_file" && -f "$env_file" ]]; then
            base_name=$(_tsm_get_env_name "$env_file")
        fi

        # If still no name, try package.json
        if [[ -z "$base_name" && -f "package.json" ]]; then
            base_name=$(grep -E '"name"[[:space:]]*:' package.json | head -1 | grep -oE '"[^"]+"[[:space:]]*$' | tr -d '"' | tr -d ' ')
        fi

        # If still no name, extract from script file or module
        if [[ -z "$base_name" ]]; then
            local dir_name=$(basename "$PWD")

            # Match: python script.py, node app.js, python -m module.name
            if [[ "$command" =~ (node|python|python3)[[:space:]]+-m[[:space:]]+([a-zA-Z0-9_.]+) ]]; then
                # Python module: combine directory name + module name
                # Example: python -m http.server -> mydemo-http
                local module_name="${BASH_REMATCH[2]}"
                base_name="${dir_name}-${module_name%%.*}"
            elif [[ "$command" =~ (node|python|python3)[[:space:]]+([^[:space:]-][^[:space:]]*) ]]; then
                # Script file: combine directory name + script name
                # Example: python server.py -> mydemo-server
                local script_file="${BASH_REMATCH[2]}"
                local script_base=$(basename "$script_file" .js 2>/dev/null || echo "$script_file")
                script_base=$(basename "$script_base" .py 2>/dev/null || echo "$script_base")
                base_name="${dir_name}-${script_base}"
            else
                # Fallback: first command word (no directory prefix for non-scripting commands)
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
    local explicit_prehook="$5"  # Optional: --pre-hook value

    [[ -z "$command" ]] && {
        echo "tsm: command required" >&2
        return 64
    }

    # Parse env file ONCE at the beginning (extracts PORT and NAME)
    local ENV_PORT="" ENV_NAME=""
    if [[ -n "$env_file" && -f "$env_file" ]]; then
        # Safe parsing without eval - read output line by line
        while IFS='=' read -r key value; do
            case "$key" in
                ENV_PORT) ENV_PORT="$value" ;;
                ENV_NAME) ENV_NAME="$value" ;;
            esac
        done < <(tsm_parse_env_file "$env_file")
    fi

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

    # Apply port resolution ladder (6-step with IRON FIST env file priority)
    local port template service_type
    if declare -f tsm_resolve_port >/dev/null 2>&1; then
        local resolution=$(tsm_resolve_port "$command" "$explicit_port" "$ENV_PORT")
        IFS='|' read -r port template service_type <<< "$resolution"

        # If template returned, rewrite command
        if [[ "$template" != "{cmd}" ]]; then
            final_command=$(tsm_apply_template "$final_command" "$port" "$template")
        fi
    else
        # Fallback: use old discovery method
        port=$(tsm_discover_port "$command" "$env_file" "$explicit_port" "$ENV_PORT")
        template="{cmd}"
        service_type="port"
    fi

    [[ -z "$port" || "$port" == "none" ]] && port="none" && service_type="pid"

    # Generate name (pass parsed value to avoid re-reading)
    local name
    name=$(tsm_generate_process_name "$command" "$port" "$explicit_name" "$env_file" "$ENV_NAME")

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

    # Setup socket if service_type is socket
    local socket_path=""
    if [[ "$service_type" == "socket" ]] && declare -f tsm_socket_create >/dev/null 2>&1; then
        socket_path=$(tsm_socket_create "$name")
    fi

    # Build environment activation and user env file
    local env_setup=""

    # Build pre-hook (priority: explicit > service def > auto-detected)
    local prehook_cmd
    if declare -f tsm_build_prehook >/dev/null 2>&1; then
        prehook_cmd=$(tsm_build_prehook "$explicit_prehook" "$process_type" "")
    else
        # Fallback to old method if hooks.sh not loaded
        prehook_cmd=$(tsm_build_env_activation "$process_type")
    fi

    [[ -n "$prehook_cmd" ]] && env_setup="$prehook_cmd"$'\n'

    # Add user env file if specified
    if [[ -n "$env_file" && -f "$env_file" ]]; then
        env_setup="${env_setup}source '$env_file'"
    fi

    # Export socket path for socket-based services
    if [[ -n "$socket_path" ]]; then
        env_setup="${env_setup}"$'\n'"export TSM_SOCKET_PATH='$socket_path'"
    fi

    # Start process
    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup'" >&2
        return 1
    }

    # Validate command for security
    if ! _tsm_validate_command "$final_command"; then
        echo "tsm: Command validation failed" >&2
        return 1
    fi

    # Create wrapper error log to capture setup/bash errors
    local log_wrapper="$process_dir/wrapper.err"

    (
        $setsid_cmd bash -c "
            $env_setup
            $final_command </dev/null >>'${log_out}' 2>>'${log_err}' &
            echo \$! > '${pid_file}'
        " 2>>'${log_wrapper}' &
    )

    sleep 0.5

    # Verify started
    if [[ ! -f "$pid_file" ]]; then
        echo "❌ Failed to start: $name (no PID file)" >&2

        # Show wrapper errors if any (env file errors, pre-hook failures, etc.)
        if [[ -f "$log_wrapper" && -s "$log_wrapper" ]]; then
            echo "" >&2
            echo "Startup wrapper errors:" >&2
            tail -10 "$log_wrapper" >&2
        fi

        return 1
    fi

    local pid=$(cat "$pid_file")
    if ! tsm_is_pid_alive "$pid"; then
        echo "❌ Failed to start: $name (process died immediately)" >&2
        echo >&2

        # Check for port conflict first
        if [[ "$port" != "none" ]] && command -v lsof >/dev/null 2>&1; then
            local existing_pid=$(tsm_get_port_pid "$port")
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

        # No port conflict, show all available error logs
        local has_errors=false

        # Show wrapper errors (env file, pre-hook failures)
        if [[ -f "$log_wrapper" && -s "$log_wrapper" ]]; then
            echo "Startup wrapper errors:" >&2
            tail -10 "$log_wrapper" >&2
            has_errors=true
        fi

        # Show process stderr
        if [[ -f "$log_err" && -s "$log_err" ]]; then
            [[ "$has_errors" == "true" ]] && echo "" >&2
            echo "Process error output:" >&2
            tail -10 "$log_err" >&2
            has_errors=true
        fi

        # If no errors captured, provide generic message
        if [[ "$has_errors" == "false" ]]; then
            echo "Process started but crashed immediately with no error output." >&2
            echo "Check logs: $log_out and $log_err" >&2
        fi

        return 1
    fi

    # Create JSON metadata with service_type
    local tsm_id=$(tsm_create_metadata \
        "$name" \
        "$pid" \
        "$final_command" \
        "$port" \
        "$PWD" \
        "$interpreter" \
        "$process_type" \
        "$env_file" \
        "$explicit_prehook" \
        "$service_type")

    # Log success (construct JSON safely)
    local success_meta=$(jq -n --arg pid "$pid" --arg port "$port" --arg id "$tsm_id" \
        '{pid: ($pid | tonumber), port: $port, tsm_id: ($id | tonumber)}')
    tetra_log_success "tsm" "start" "$name" "$success_meta"

    # Track port allocation
    if [[ "$port" != "none" && "$port" != "0" ]] && declare -f tsm_track_port >/dev/null 2>&1; then
        tsm_track_port "$port" "$name" "$pid"
    fi

    # Success message showing service type
    local success_msg="✅ Started: $name (TSM ID: $tsm_id, PID: $pid"
    if [[ "$port" != "none" && "$port" != "0" ]]; then
        success_msg="$success_msg, Port: $port"
    fi
    if [[ "$service_type" == "socket" ]]; then
        success_msg="$success_msg, Socket: ${socket_path##*/}"
    fi
    success_msg="$success_msg)"
    echo "$success_msg"
}

export -f tsm_discover_port
export -f tsm_generate_process_name
export -f tsm_start_any_command
