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
    pid=$(cat "$TETRA_DIR/tsm/runtime/pids/$name.pid")

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
            port="$(source "$resolved_env_file" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")"
        fi

        # Extract name from env file if no custom name provided
        if [[ -z "$custom_name" && -f "$resolved_env_file" ]]; then
            env_name="$(source "$resolved_env_file" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")"
        fi

        # Use the resolved path going forward
        env_file="$resolved_env_file"
    fi

    # Debug output if requested
    if [[ "$debug" == "true" ]]; then
        echo "🔍 TSM Command Debug Information:"
        echo "  Env File Arg: ${2:-'(none)'}"  # Second arg after --env
        echo "  Resolved Env File: ${resolved_env_file:-'(none)'}"
        echo "  Extracted PORT: ${port:-'(none)'}"
        echo "  Extracted NAME: ${env_name:-'(none)'}"
        echo "  Command Args: ${command_args[*]}"
        echo ""
    fi

    [[ -n "$port" ]] || { echo "tsm: port required for command mode (not found in env file or --port)" >&2; return 64; }

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
                diagnostic_info="Process failed to start - check logs at $TETRA_DIR/tsm/logs/$name.log"
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
    pid=$(cat "$TETRA_DIR/tsm/runtime/pids/$name.pid")

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
    local file="" env_file="" custom_name="" python_start=false python_cmd="" port="" dirname=""
    local command_mode=false command_args=() debug=false

    # Check if first argument is a service from services-available
    if [[ $# -ge 1 ]]; then
        local first_arg="$1"

        # First priority: Check services-available directory for .tsm files
        local new_service_file="$TETRA_DIR/tsm/services-available/${first_arg}.tsm"
        if [[ -f "$new_service_file" ]]; then
            echo "🚀 Starting service: $first_arg"
            tetra_tsm_start_service "$first_arg"
            return $?
        fi

        # Fallback: Check old .tsm.sh service definitions
        local old_service_file="$TETRA_DIR/services/${first_arg}.tsm.sh"
        if [[ -f "$old_service_file" ]]; then
            _tsm_start_from_service_definition "$@"
            return $?
        fi

        # Service discovery: suggest available services if not found
        if [[ ! -f "$first_arg" && ! -x "$first_arg" ]]; then
            local available_services=()
            if [[ -d "$TETRA_DIR/tsm/services-available" ]]; then
                for service_file in "$TETRA_DIR/tsm/services-available"/*.tsm; do
                    [[ -f "$service_file" ]] || continue
                    local service_name=$(basename "$service_file" .tsm)
                    available_services+=("$service_name")
                done
            fi

            if [[ ${#available_services[@]} -gt 0 ]]; then
                echo "❌ Service '$first_arg' not found."
                echo ""
                echo "Available services:"
                printf "  %s\n" "${available_services[@]}"
                echo ""
                echo "Usage: tsm start <service-name>"
                echo "   or: tsm start <command> [args...]"
                return 1
            fi
        fi
    fi

    # Special case for webserver with no arguments
    if [[ "$1" == "webserver" && $# -eq 1 ]]; then
        tetra_tsm_start_webserver
        return $?
    fi

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                env_file="$2"
                shift 2
                ;;
            --python)
                python_start=true
                shift
                ;;
            --port)
                port="$2"
                shift 2
                ;;
            --dir)
                dirname="$2"
                shift 2
                ;;
            --debug)
                debug=true
                shift
                ;;
            webserver)
                file="webserver"
                shift
                ;;
            *)
                if [[ "$python_start" == "true" ]]; then
                    python_cmd+="$1 "
                    shift
                elif [[ "$file" == "webserver" ]]; then
                    if [[ -z "$dirname" ]]; then
                        dirname="$1"
                    elif [[ -z "$port" && "$1" =~ ^[0-9]+$ ]]; then
                        port="$1"
                    else
                        echo "tsm: unexpected argument '$1'" >&2
                        return 64
                    fi
                    shift
                elif [[ -z "$file" ]]; then
                    file="$1"
                    # Check if this is a command (not an executable file)
                    # Command mode triggers if:
                    # 1. File doesn't exist as executable AND port is set, OR
                    # 2. File doesn't exist as executable AND env_file is set (port will be extracted)
                    if [[ ! -f "$file" ]] && [[ -n "$port" || -n "$env_file" ]]; then
                        # This looks like command mode - collect all remaining args
                        command_mode=true
                        command_args=("$file")
                        shift
                        while [[ $# -gt 0 && "$1" != "--"* ]]; do
                            command_args+=("$1")
                            shift
                        done
                        break
                    else
                        shift
                    fi
                elif [[ -z "$custom_name" ]]; then
                    custom_name="$1"
                    shift
                else
                    echo "tsm: unexpected argument '$1'" >&2
                    return 64
                fi
                ;;
        esac
    done

    # Handle different start modes
    if [[ "$command_mode" == "true" ]]; then
        local cmd_args=()

        # Resolve environment file path
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
        fi

        # Extract port and name from resolved env file if not explicitly provided
        if [[ -n "$resolved_env_file" && -z "$port" ]]; then
            port="$(source "$resolved_env_file" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")"
        fi
        if [[ -n "$resolved_env_file" && -z "$custom_name" ]]; then
            custom_name="$(source "$resolved_env_file" 2>/dev/null && echo "${NAME:-${TETRA_NAME:-}}")"
        fi

        # Debug output if requested
        if [[ "$debug" == "true" ]]; then
            echo "🔍 TSM Debug Information:"
            echo "  Command Mode: true"
            echo "  Env File Arg: ${env_file:-'(none)'}"
            echo "  Resolved Env File: ${resolved_env_file:-'(none)'}"
            echo "  Extracted PORT: ${port:-'(none)'}"
            echo "  Extracted NAME: ${custom_name:-'(none)'}"
            echo "  Command Args: ${command_args[*]}"
            echo "  Final Args: --port ${port:-'(none)'} --env ${env_file:-'(none)'} --name ${custom_name:-'(none)'}"
            echo ""
        fi

        [[ -n "$port" ]] && cmd_args+=(--port "$port")
        [[ -n "$env_file" ]] && cmd_args+=(--env "$env_file")
        [[ -n "$custom_name" ]] && cmd_args+=(--name "$custom_name")
        [[ "$debug" == "true" ]] && cmd_args+=(--debug)
        tetra_tsm_start_command "${cmd_args[@]}" "${command_args[@]}"
    elif [[ "$python_start" == "true" ]]; then
        tetra_tsm_start_python "$python_cmd" "$port" "$dirname" "$custom_name"
    elif [[ "$file" == "webserver" ]]; then
        tetra_tsm_start_webserver "$dirname" "$port"
    elif [[ -n "$file" ]]; then
        tetra_tsm_start_cli "$file" "$custom_name" "$env_file"
    else
        echo "tsm: start [--env env.sh] [--debug] <script.sh|command> [name]" >&2
        return 64
    fi
}

tetra_tsm_stop() {
    [[ $# -gt 0 ]] || {
        echo "tsm: stop [--force] <process|id|*> [process|id...]" >&2
        return 64
    }

    local force=false
    local targets=()

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force=true
                shift
                ;;
            *)
                targets+=("$1")
                shift
                ;;
        esac
    done

    for target in "${targets[@]}"; do
        if [[ "$target" == "*" ]]; then
            # Stop all processes
            local all_processes=()
            for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
                [[ -f "$metafile" ]] || continue
                local name
                name=$(basename "$metafile" .meta)
                all_processes+=("$name")
            done

            for name in "${all_processes[@]}"; do
                tetra_tsm_stop_single "$name" "$force"
            done
        elif [[ "$target" =~ ^[0-9]+$ ]]; then
            tetra_tsm_stop_by_id "$target" "$force"
        else
            tetra_tsm_stop_single "$target" "$force"
        fi
    done
}

tetra_tsm_delete() {
    [[ $# -gt 0 ]] || {
        echo "tsm: delete <process|id|*> [process|id...]" >&2
        return 64
    }

    for target in "$@"; do
        if [[ "$target" == "*" ]]; then
            # Delete all processes
            local all_processes=()
            for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
                [[ -f "$metafile" ]] || continue
                local name
                name=$(basename "$metafile" .meta)
                all_processes+=("$name")
            done

            for name in "${all_processes[@]}"; do
                tetra_tsm_delete_single "$name"
            done
        elif [[ "$target" =~ ^[0-9]+$ ]]; then
            tetra_tsm_delete_by_id "$target"
        else
            tetra_tsm_delete_single "$target"
        fi
    done
}

tetra_tsm_restart() {
    [[ $# -gt 0 ]] || {
        echo "tsm: restart <process|id|*> [process|id...]" >&2
        return 64
    }

    for target in "$@"; do
        if [[ "$target" == "*" ]]; then
            # Restart all processes
            local all_processes=()
            for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
                [[ -f "$metafile" ]] || continue
                local name
                name=$(basename "$metafile" .meta)
                all_processes+=("$name")
            done

            for name in "${all_processes[@]}"; do
                tetra_tsm_restart_single "$name"
            done
        elif [[ "$target" =~ ^[0-9]+$ ]]; then
            tetra_tsm_restart_by_id "$target"
        else
            tetra_tsm_restart_single "$target"
        fi
    done
}

tetra_tsm_kill() {
    tetra_tsm_stop --force "$@"
}

# === SERVICE DEFINITIONS ===

_tsm_start_from_service_definition() {
    local service_name="$1"
    shift
    local additional_args=("$@")

    local service_file="$TETRA_DIR/services/${service_name}.tsm.sh"

    if [[ ! -f "$service_file" ]]; then
        echo "tsm: service definition not found: $service_file" >&2
        return 1
    fi

    echo "tsm: starting service '$service_name'"

    # Source the service definition to get configuration
    local TSM_NAME="" TSM_COMMAND="" TSM_CWD="" TSM_ENV_FILE="" TSM_PORT="" TSM_ARGS=()
    source "$service_file" || {
        echo "tsm: failed to load service definition: $service_file" >&2
        return 1
    }

    # Change to service working directory
    local original_dir="$PWD"
    if [[ -n "$TSM_CWD" && -d "$TSM_CWD" ]]; then
        cd "$TSM_CWD" || {
            echo "tsm: failed to change to service directory: $TSM_CWD" >&2
            return 1
        }
    fi

    # Build command with service args and additional args
    local full_command="$TSM_COMMAND"
    if [[ ${#TSM_ARGS[@]} -gt 0 ]]; then
        full_command+=" ${TSM_ARGS[*]}"
    fi
    if [[ ${#additional_args[@]} -gt 0 ]]; then
        full_command+=" ${additional_args[*]}"
    fi

    # Use service name or generate one
    local name="${TSM_NAME:-$service_name}"
    if [[ -n "$TSM_PORT" ]]; then
        name="${name}-${TSM_PORT}"
    fi

    # Start the service
    tetra_tsm_start_command --port "${TSM_PORT:-8080}" --name "$service_name" ${TSM_ENV_FILE:+--env "$TSM_ENV_FILE"} $full_command

    # Return to original directory
    cd "$original_dir"
}

# Export CLI functions
export -f tetra_tsm_start_cli
export -f _tsm_start_cli_internal
export -f tetra_tsm_start_command
export -f tetra_tsm_start
export -f tetra_tsm_stop
export -f tetra_tsm_delete
export -f tetra_tsm_restart
export -f tetra_tsm_kill
export -f _tsm_start_from_service_definition