#!/usr/bin/env bash

# TSM CLI Command Handlers
# Extracted from tsm_interface.sh during Phase 2 refactor
# Functions that handle user CLI commands

# === CLI START COMMANDS ===

tetra_tsm_start_cli() {
    local script="${1:-}"
    local custom_name="${2:-}"
    local env_file="${3:-}"

    _tsm_validate_script "$script" || return $?

    # Auto-detect environment file if not explicitly provided
    local resolved_env_file
    resolved_env_file="$(_tsm_auto_detect_env "$script" "$env_file")" || return $?

    # If we found an env file, source it temporarily to get PORT and NAME
    local port env_name
    if [[ -n "$resolved_env_file" ]]; then
        # Source env file in subshell to extract PORT or TETRA_PORT without affecting current environment
        port="$(source "$resolved_env_file" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")"
        # Also extract NAME or TETRA_NAME from environment file
        env_name="$(source "$resolved_env_file" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")"
    fi

    # Fallback to extracting PORT from script if not found in env
    if [[ -z "$port" ]]; then
        port="$(tetra_tsm_extract_port "$script")" || {
            echo "tsm: PORT not set in env file or script" >&2
            return 65
        }
    fi

    local pwd_at_start="$PWD"
    _tsm_start_cli_internal "$script" "$custom_name" "$port" "$resolved_env_file" "$pwd_at_start" "$env_name"
}

_tsm_start_cli_internal() {
    local script="$1"
    local custom_name="$2"
    local port="$3"
    local env_file="$4"
    local pwd_at_start="$5"
    local env_name="$6"

    local name
    # Use env_name from environment file if available, otherwise fall back to custom_name
    local effective_name="${env_name:-$custom_name}"
    name=$(_tsm_generate_name "$script" "$effective_name" "$port" "$env_file")

    tetra_tsm_is_running "$name" && {
        echo "tsm: process '$name' already running" >&2
        return 1
    }

    # CLI scripts run from their parent directory
    local working_dir
    working_dir="$(dirname "$(dirname "$script")")"

    _tsm_start_process "$script" "$name" "$env_file" "$working_dir" || {
        echo "tsm: failed to start '$name'" >&2
        return 1
    }

    local pid
    pid=$(cat "$TSM_PIDS_DIR/$name.pid")

    local tsm_id
    tsm_id=$(_tsm_save_metadata "$name" "$script" "$pid" "$port" "cli" "" "$pwd_at_start")

    echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid)"
}

tetra_tsm_start_command() {
    local command_args=()
    local port="" custom_name="" env_file="" json_output=false env_name="" debug=false

    # Parse command arguments and options - command args come first, then options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --port)
                port="$2"
                shift 2
                ;;
            --name)
                custom_name="$2"
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
            --debug)
                debug=true
                shift
                ;;
            *)
                command_args+=("$1")
                shift
                ;;
        esac
    done

    [[ ${#command_args[@]} -gt 0 ]] || { echo "tsm: command required" >&2; return 64; }

    # Resolve environment file path and extract port if needed
    local resolved_env_file=""
    if [[ -n "$env_file" ]]; then
        if [[ "$env_file" == /* ]]; then
            resolved_env_file="$env_file"
        else
            # Try different variations: env/file, env/file.env, file, file.env
            local candidates=(
                "$PWD/env/${env_file}.env"
                "$PWD/env/$env_file"
                "$PWD/${env_file}.env"
                "$PWD/$env_file"
            )
            for candidate in "${candidates[@]}"; do
                if [[ -f "$candidate" ]]; then
                    resolved_env_file="$candidate"
                    break
                fi
            done
        fi

        # Extract port and name from resolved env file if not provided
        if [[ -z "$port" && -f "$resolved_env_file" ]]; then
            port="$(grep '^export PORT=' "$resolved_env_file" 2>/dev/null | sed 's/^export PORT=//' | sed 's/^"//' | sed 's/"$//' || true)"
            # Fallback to TETRA_PORT if PORT not found
            if [[ -z "$port" ]]; then
                port="$(grep '^export TETRA_PORT=' "$resolved_env_file" 2>/dev/null | sed 's/^export TETRA_PORT=//' | sed 's/^"//' | sed 's/"$//' || true)"
            fi
        fi

        # Extract name from env file if no custom name provided
        if [[ -z "$custom_name" && -f "$resolved_env_file" ]]; then
            env_name="$(grep '^export NAME=' "$resolved_env_file" 2>/dev/null | sed 's/^export NAME=//' | sed 's/^"//' | sed 's/"$//' || true)"
            # Fallback to TETRA_NAME if NAME not found
            if [[ -z "$env_name" ]]; then
                env_name="$(grep '^export TETRA_NAME=' "$resolved_env_file" 2>/dev/null | sed 's/^export TETRA_NAME=//' | sed 's/^"//' | sed 's/"$//' || true)"
            fi
        fi

        # Use the resolved path going forward
        env_file="$resolved_env_file"
    fi

    # Debug output if requested (before calling universal start)
    if [[ "$debug" == "true" ]]; then
        echo "🔍 TSM Command Debug Information:"
        echo "  Env File Arg: ${2:-'(none)'}"  # Second arg after --env
        echo "  Resolved Env File: ${resolved_env_file:-'(none)'}"
        echo "  Extracted PORT: ${port:-'(none)'}"
        echo "  Extracted NAME: ${env_name:-'(none)'}"
        echo "  Command Args: ${command_args[*]}"
        echo ""
    fi

    # No port requirement check here - let tsm_start_any_command handle port discovery

    # Generate command string
    local command_string="${command_args[*]}"

    # Generate name from command, preferring env_name, then custom_name, then command base
    local name
    if [[ -n "$env_name" ]]; then
        name="${env_name}-${port}"
    elif [[ -n "$custom_name" ]]; then
        name="${custom_name}-${port}"
    else
        # Use first word of command as base name
        local base_name="${command_args[0]}"
        # Remove path if present
        base_name="${base_name##*/}"
        name="${base_name}-${port}"
    fi

    tetra_tsm_is_running "$name" && {
        echo "tsm: process '$name' already running" >&2
        return 1
    }

    local working_dir="$PWD"

    _tsm_start_command_process "$command_string" "$name" "$env_file" "$working_dir" || {
        if [[ "$json_output" == "true" ]]; then
            # Get diagnostic info for JSON error
            local diagnostic_info=""
            local existing_pid=$(lsof -ti :$port 2>/dev/null)
            if [[ -n "$existing_pid" ]]; then
                local process_cmd=$(ps -p $existing_pid -o args= 2>/dev/null | head -c 60 || echo "unknown")
                diagnostic_info="Port $port is in use by PID $existing_pid ($process_cmd)"
            else
                diagnostic_info="Process failed to start - check logs at $TSM_LOGS_DIR/$name.out and $TSM_LOGS_DIR/$name.err"
            fi
            tsm_json_error "Failed to start '$name'" 1 "$diagnostic_info"
        else
            echo "tsm: failed to start '$name'" >&2
            echo >&2
            # Run diagnostic to provide helpful error context
            tsm_diagnose_startup_failure "$name" "$port" "$command_string" "$env_file"
        fi
        return 1
    }

    local pid
    pid=$(cat "$TSM_PIDS_DIR/$name.pid")

    local tsm_id
    tsm_id=$(_tsm_save_metadata "$name" "$command_string" "$pid" "$port" "command" "" "$working_dir" "" "false" "$env_file")

    if [[ "$json_output" == "true" ]]; then
        local process_data="{\"tsm_id\": \"$tsm_id\", \"name\": \"$name\", \"pid\": \"$pid\", \"port\": \"$port\", \"command\": \"$(_tsm_json_escape "$command_string")\", \"working_dir\": \"$(_tsm_json_escape "$working_dir")\"}"
        tsm_json_success "Started '$name'" "$process_data"
    else
        echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid, Port: $port)"
    fi
}

# === MAIN CLI COMMANDS ===

tetra_tsm_start() {
    local env_file="" port="" debug=false custom_name=""
    local command_args=()

    # Parse flags first
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                env_file="$2"
                # Resolve env file path: "local" -> "env/local.env"
                if [[ "$env_file" != /* && "$env_file" != */* && "$env_file" != *.env ]]; then
                    env_file="env/${env_file}.env"
                fi
                shift 2
                ;;
            --port)
                port="$2"
                shift 2
                ;;
            --name)
                custom_name="$2"
                shift 2
                ;;
            --debug)
                debug=true
                shift
                ;;
            --*)
                echo "tsm: unknown option '$1'" >&2
                return 64
                ;;
            *)
                # Remaining args are the command
                command_args+=("$1")
                shift
                ;;
        esac
    done

    # Must have a command
    if [[ ${#command_args[@]} -eq 0 ]]; then
        echo "tsm: command required" >&2
        echo "Usage: tsm start [--env FILE] [--port PORT] [--name NAME] <command> [args...]" >&2
        return 64
    fi

    # Check if first arg is a known service
    local first_arg="${command_args[0]}"
    local service_file="$TETRA_DIR/tsm/services-available/${first_arg}.tsm"
    if [[ -f "$service_file" ]]; then
        echo "🚀 Starting service: $first_arg"
        tetra_tsm_start_service "${command_args[@]}"
        return $?
    fi

    # Use universal start for any command
    if declare -f tsm_start_any_command >/dev/null 2>&1; then
        local command_string="${command_args[*]}"
        tsm_start_any_command "$command_string" "$env_file" "$port" "$custom_name"
    else
        # Fallback to old method if universal start not loaded
        local cmd_args=()
        [[ -n "$env_file" ]] && cmd_args+=(--env "$env_file")
        [[ -n "$port" ]] && cmd_args+=(--port "$port")
        [[ -n "$custom_name" ]] && cmd_args+=(--name "$custom_name")
        [[ "$debug" == "true" ]] && cmd_args+=(--debug)

        tetra_tsm_start_command "${cmd_args[@]}" "${command_args[@]}"
    fi
}

# === TSM KILL COMMAND ===

tetra_tsm_kill() {
    local force=false
    local target_type=""
    local targets=()

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                force=true
                shift
                ;;
            --port)
                target_type="port"
                targets+=("$2")
                shift 2
                ;;
            --name)
                target_type="name"
                targets+=("$2")
                shift 2
                ;;
            --id)
                target_type="id"
                targets+=("$2")
                shift 2
                ;;
            --pid)
                target_type="pid"
                targets+=("$2")
                shift 2
                ;;
            --help|-h)
                echo "Usage: tsm kill [OPTIONS] [TARGET...]"
                echo ""
                echo "Kill one or more processes by various identifiers:"
                echo "  --port PORT     Kill process using specific port"
                echo "  --name NAME     Kill process by service name"
                echo "  --id ID         Kill process by TSM ID"
                echo "  --pid PID       Kill process by system PID"
                echo "  --force         Force kill (SIGKILL instead of SIGTERM)"
                echo ""
                echo "Examples:"
                echo "  tsm kill --port 4000"
                echo "  tsm kill --name devpages"
                echo "  tsm kill --id 0"
                echo "  tsm kill --pid 88224"
                echo "  tsm kill 0              # Kill by TSM ID (default)"
                echo "  tsm kill 0 1 2 3        # Kill multiple by TSM ID"
                echo "  tsm kill devpages tetra # Kill multiple by name"
                return 0
                ;;
            -*)
                echo "tsm: unknown option '$1'" >&2
                echo "Use 'tsm kill --help' for usage information" >&2
                return 64
                ;;
            *)
                # Auto-detect target type based on value
                local value="$1"
                if [[ -z "$target_type" ]]; then
                    if [[ "$value" =~ ^[0-9]+$ ]]; then
                        # Pure number - try TSM ID first
                        target_type="id"
                    else
                        # String - assume service name
                        target_type="name"
                    fi
                fi
                targets+=("$value")
                shift
                ;;
        esac
    done

    if [[ ${#targets[@]} -eq 0 ]]; then
        echo "tsm: kill target required" >&2
        echo "Use 'tsm kill --help' for usage information" >&2
        return 64
    fi

    # Execute kill for each target
    local success=0
    local failed=0

    for target in "${targets[@]}"; do
        case "$target_type" in
            port)
                if _tsm_kill_by_port "$target" "$force"; then
                    ((success++))
                else
                    ((failed++))
                fi
                ;;
            name)
                if _tsm_kill_by_name "$target" "$force"; then
                    ((success++))
                else
                    ((failed++))
                fi
                ;;
            id)
                if _tsm_kill_by_id "$target" "$force"; then
                    ((success++))
                else
                    ((failed++))
                fi
                ;;
            pid)
                if _tsm_kill_by_pid "$target" "$force"; then
                    ((success++))
                else
                    ((failed++))
                fi
                ;;
            *)
                echo "tsm: internal error - unknown target type '$target_type'" >&2
                ((failed++))
                ;;
        esac
    done

    # Summary
    if [[ ${#targets[@]} -gt 1 ]]; then
        echo ""
        echo "📊 Summary: $success succeeded, $failed failed"
    fi

    [[ $failed -eq 0 ]]
}

# Kill by port number
_tsm_kill_by_port() {
    local port="$1"
    local force="$2"

    echo "🔍 Finding processes using port $port..."

    # Find PIDs using the port
    local pids=($(lsof -ti :$port 2>/dev/null))

    if [[ ${#pids[@]} -eq 0 ]]; then
        echo "❌ No processes found using port $port"
        return 1
    fi

    echo "📋 Found ${#pids[@]} process(es) using port $port:"
    for pid in "${pids[@]}"; do
        local cmd=$(ps -p $pid -o args= 2>/dev/null | head -c 60 || echo "unknown")
        echo "  PID $pid: $cmd"
    done

    # Kill each process
    local killed=0
    for pid in "${pids[@]}"; do
        if _tsm_kill_process "$pid" "$force"; then
            ((killed++))
        fi
    done

    echo "✅ Killed $killed process(es) on port $port"
    return 0
}

# Kill by service name
_tsm_kill_by_name() {
    local name="$1"
    local force="$2"

    echo "🔍 Finding processes with name '$name'..."

    # Look for TSM managed processes (JSON metadata)
    local found=false

    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for process_dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$process_dir" ]] || continue
            local proc_name=$(basename "$process_dir")

            # Match exact name or prefix (e.g., "http" matches "http-8001")
            if [[ "$proc_name" == "$name" || "$proc_name" == ${name}-* ]]; then
                local meta_file="${process_dir}meta.json"
                if [[ -f "$meta_file" ]]; then
                    local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
                    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                        echo "📋 Found TSM process: $proc_name (PID: $pid)"
                        if _tsm_kill_process "$pid" "$force"; then
                            echo "✅ Killed TSM process: $proc_name"
                            rm -rf "$process_dir"
                            found=true
                        fi
                    fi
                fi
            fi
        done
    fi

    if [[ "$found" == "false" ]]; then
        echo "❌ No TSM-managed processes found with name '$name'"
        return 1
    fi

    return 0
}

# Kill by TSM ID
_tsm_kill_by_id() {
    local id="$1"
    local force="$2"

    echo "🔍 Finding process with TSM ID $id..."

    # Find process directory with this TSM ID (JSON metadata)
    local process_name pid process_dir
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local meta_file="${dir}meta.json"
            if [[ -f "$meta_file" ]]; then
                local file_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
                if [[ "$file_id" == "$id" ]]; then
                    process_name=$(jq -r '.name // empty' "$meta_file" 2>/dev/null)
                    pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
                    process_dir="$dir"
                    break
                fi
            fi
        done
    fi

    if [[ -z "$process_name" || -z "$pid" ]]; then
        echo "❌ No process found with TSM ID $id"
        return 1
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
        echo "❌ Process with TSM ID $id is not running (PID $pid dead)"
        rm -rf "$process_dir"
        return 1
    fi

    echo "📋 Found process: $process_name (TSM ID: $id, PID: $pid)"

    if _tsm_kill_process "$pid" "$force"; then
        echo "✅ Killed process: $process_name (TSM ID: $id)"
        rm -rf "$process_dir"
        return 0
    else
        return 1
    fi
}

# Kill by PID
_tsm_kill_by_pid() {
    local pid="$1"
    local force="$2"

    echo "🔍 Checking process PID $pid..."

    if ! kill -0 "$pid" 2>/dev/null; then
        echo "❌ Process $pid not found or not accessible"
        return 1
    fi

    local cmd=$(ps -p $pid -o args= 2>/dev/null | head -c 60 || echo "unknown")
    echo "📋 Found process: PID $pid ($cmd)"

    if _tsm_kill_process "$pid" "$force"; then
        echo "✅ Killed process: PID $pid"
        return 0
    else
        return 1
    fi
}

# Helper function to kill a process
_tsm_kill_process() {
    local pid="$1"
    local force="$2"

    if [[ "$force" == "true" ]]; then
        echo "💥 Force killing PID $pid (SIGKILL)..."
        kill -9 "$pid" 2>/dev/null
    else
        echo "🛑 Terminating PID $pid (SIGTERM)..."
        kill "$pid" 2>/dev/null

        # Wait a moment for graceful shutdown
        sleep 1

        # Check if still running
        if kill -0 "$pid" 2>/dev/null; then
            echo "⚠️  Process still running, force killing..."
            kill -9 "$pid" 2>/dev/null
        fi
    fi

    # Verify it's dead
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
        echo "❌ Failed to kill PID $pid"
        return 1
    fi

    return 0
}

