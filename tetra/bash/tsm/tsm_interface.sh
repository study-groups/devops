#!/usr/bin/env bash

# TSM Core - Process lifecycle management

# === SETUP ===

tetra_tsm_setup() {
    # Ensure setsid is available on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local util_linux_bin="/opt/homebrew/opt/util-linux/bin"
        if [[ -d "$util_linux_bin" ]] && [[ ":$PATH:" != *":$util_linux_bin:"* ]]; then
            PATH="$util_linux_bin:$PATH"
            export PATH
            echo "tsm: added util-linux to PATH for setsid support"
        fi
        
        if ! command -v setsid >/dev/null 2>&1; then
            echo "tsm: warning - setsid not found. Install with: brew install util-linux" >&2
            return 1
        fi
    fi
    
    # Create directories
    local dirs=("$TETRA_DIR/tsm/logs" "$TETRA_DIR/tsm/pids" "$TETRA_DIR/tsm/processes")
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done
    
    # Initialize ID counter
    local id_file="$TETRA_DIR/tsm/next_id"
    [[ -f "$id_file" ]] || echo "0" > "$id_file"
    
    echo "tsm: setup complete"
}

# === HELPERS ===

_tsm_validate_script() {
    local script="$1"
    [[ -n "$script" ]] || { echo "tsm: script required" >&2; return 64; }
    [[ -f "$script" && -x "$script" ]] || { echo "tsm: '$script' not found or not executable" >&2; return 66; }
}

_tsm_auto_detect_env() {
    local script="$1"
    local explicit_env="$2"

    local script_dir="$(dirname "$script")"
    local project_root="$(dirname "$script_dir")"

    # If explicit env provided, handle it with secure template integration
    if [[ -n "$explicit_env" ]]; then
        local target_env_file

        # If it's just an environment name (no path), try env/{name}.env
        if [[ "$explicit_env" != *"/"* && "$explicit_env" != *".env" ]]; then
            target_env_file="$project_root/env/${explicit_env}.env"
        else
            target_env_file="$explicit_env"
        fi

        # Check if the environment file exists
        if [[ -f "$target_env_file" ]]; then
            # Validate environment file for security
            if _tsm_validate_env_file "$target_env_file" "$explicit_env"; then
                echo "$target_env_file"
                return 0
            else
                return 66
            fi
        fi

        # Environment file doesn't exist - offer template-based solution
        local env_name=$(basename "$target_env_file" .env)
        local template_file="$project_root/env/${env_name}.env.tmpl"

        if [[ -f "$template_file" ]]; then
            echo >&2
            echo "tsm: Environment file not found: $target_env_file" >&2
            echo "tsm: Template available: $template_file" >&2
            echo >&2
            echo "🔒 Create secure environment file:" >&2
            echo "   tetra env init $env_name" >&2
            echo "   # Edit $target_env_file with your real secrets" >&2
            echo "   tsm start --env $env_name $script" >&2
            echo >&2
        else
            echo "tsm: env file '$explicit_env' not found" >&2
            echo "tsm: no template available at $template_file" >&2
        fi
        return 66
    fi

    # Auto-detect: try common environment files in secure order
    local env_candidates=("dev" "local")

    for env_name in "${env_candidates[@]}"; do
        local env_file="$project_root/env/${env_name}.env"
        if [[ -f "$env_file" ]]; then
            if _tsm_validate_env_file "$env_file" "$env_name"; then
                echo "$env_file"
                return 0
            fi
        fi
    done

    # No environment file found - check for templates and guide user
    local template_files=("$project_root/env/dev.env.tmpl" "$project_root/env/local.env.tmpl")
    local found_template=false

    for template in "${template_files[@]}"; do
        if [[ -f "$template" ]]; then
            found_template=true
            break
        fi
    done

    if [[ "$found_template" == true ]]; then
        echo >&2
        echo "tsm: No environment files found" >&2
        echo "🔒 Create secure environment file:" >&2
        echo "   tetra env init dev    # Create env/dev.env from template" >&2
        echo "   # Edit env/dev.env with your real secrets" >&2
        echo "   tsm start $script" >&2
        echo >&2
        return 66
    fi

    # No environment file or template found - continue without environment
    echo ""
    return 0
}

# Validate environment file for security and completeness
_tsm_validate_env_file() {
    local env_file="$1"
    local env_name="$2"

    # Check for placeholder values that weren't replaced
    if grep -q "your_.*_here\|your-.*-name" "$env_file"; then
        echo >&2
        echo "tsm: Environment file contains placeholder values: $env_file" >&2
        echo "❌ Found unreplaced placeholders:" >&2
        grep "your_.*_here\|your-.*-name" "$env_file" | head -3 >&2
        echo >&2
        echo "🔧 Fix by editing $env_file and replacing placeholder values with real secrets" >&2
        echo >&2
        return 1
    fi

    # Check for required variables
    local missing_vars=()
    local required_vars=("PORT" "NODE_ENV")

    for var in "${required_vars[@]}"; do
        if ! grep -q "^export $var=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo >&2
        echo "tsm: Environment file missing required variables: $env_file" >&2
        echo "❌ Missing: ${missing_vars[*]}" >&2
        echo >&2
        return 1
    fi

    return 0
}

_tsm_resolve_script_path() {
    local script_path="$1"
    
    # Already absolute
    [[ "$script_path" =~ ^/ ]] && { echo "$script_path"; return 0; }
    
    # Try common locations
    local locations=(
        "$TETRA_DIR/$script_path"
        "$TETRA_DIR/../devpages/$script_path"
        "/Users/mricos/src/devops/devpages/$script_path"
    )
    
    for location in "${locations[@]}"; do
        [[ -f "$location" ]] && { echo "$location"; return 0; }
    done
    
    echo "tsm: script '$script_path' not found" >&2
    return 1
}

_tsm_generate_name() {
    local script="$1"
    local custom_name="$2"
    local port="$3"
    local env_file="$4"

    local base
    base="$(basename "$script" .sh)"

    # If custom name provided, use it as-is
    if [[ -n "$custom_name" ]]; then
        echo "${custom_name}-${port}"
        return 0
    fi

    # Extract environment name from env file path
    local env_name="local"  # default
    if [[ -n "$env_file" ]]; then
        local env_basename="$(basename "$env_file" .env)"
        if [[ "$env_basename" != "env" ]]; then  # avoid using "env" as env name
            env_name="$env_basename"
        fi
    fi

    echo "${base}-${env_name}-${port}"
}

_tsm_save_metadata() {
    local name="$1"
    local script="$2"
    local pid="$3"
    local port="$4"
    local type="$5"
    local start_dir="${6:-}"
    local cwd="${7:-}"
    local preserve_id="${8:-}"
    local is_restart="${9:-false}"

    local tsm_id restart_count=0 last_restart_time=""
    if [[ -n "$preserve_id" ]]; then
        tsm_id="$preserve_id"
        # If preserving ID, check for existing restart count
        local existing_metafile="$TETRA_DIR/tsm/processes/$name.meta"
        if [[ -f "$existing_metafile" ]] && [[ "$is_restart" == "true" ]]; then
            # Extract existing restart count
            local existing_restart_count=""
            eval "$(grep -o 'restart_count=[0-9]*' "$existing_metafile" 2>/dev/null || echo 'restart_count=0')"
            restart_count=$((existing_restart_count + 1))
            last_restart_time=$(date +%s)
        fi
    else
        tsm_id=$(tetra_tsm_get_next_id)
    fi

    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    local meta_content="script='$script' pid=$pid port=$port start_time=$(date +%s) type=$type tsm_id=$tsm_id restart_count=$restart_count"
    [[ -n "$start_dir" ]] && meta_content+=" start_dir='$start_dir'"
    [[ -n "$cwd" ]] && meta_content+=" cwd='$cwd'"
    [[ -n "$last_restart_time" ]] && meta_content+=" last_restart_time=$last_restart_time"

    echo "$meta_content" > "$metafile"

    # Save environment
    printenv > "$TETRA_DIR/tsm/processes/$name.env"

    echo "$tsm_id"
}

_tsm_start_process() {
    local script="$1"
    local name="$2"
    local env_file="$3"
    local working_dir="$4"
    
    local logdir="$TETRA_DIR/tsm/logs"
    local piddir="$TETRA_DIR/tsm/pids"
    
    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
        return 1
    }
    
    local cd_cmd=""
    [[ -n "$working_dir" ]] && cd_cmd="cd '$working_dir'"
    
    local env_cmd=""
    [[ -n "$env_file" && -f "$env_file" ]] && env_cmd="source '$env_file'"
    
    (
        $setsid_cmd bash -c "
            $cd_cmd
            $env_cmd
            exec '$script' </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
            echo \$! > '$piddir/$name.pid'
        " &
    )
    
    sleep 0.5
    tetra_tsm_is_running "$name"
}

_tsm_start_command_process() {
    local command="$1"
    local name="$2"
    local env_file="$3"
    local working_dir="$4"
    
    local logdir="$TETRA_DIR/tsm/logs"
    local piddir="$TETRA_DIR/tsm/pids"
    
    local setsid_cmd
    setsid_cmd=$(tetra_tsm_get_setsid) || {
        echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
        return 1
    }
    
    local cd_cmd=""
    [[ -n "$working_dir" ]] && cd_cmd="cd '$working_dir'"
    
    local env_cmd=""
    [[ -n "$env_file" && -f "$env_file" ]] && env_cmd="source '$env_file'"
    
    (
        $setsid_cmd bash -c "
            $cd_cmd
            $env_cmd
            exec $command </dev/null >>'$logdir/$name.out' 2>>'$logdir/$name.err' &
            echo \$! > '$piddir/$name.pid'
        " &
    )
    
    sleep 0.5
    tetra_tsm_is_running "$name"
}

# === CLI PROCESSES ===

tetra_tsm_start_cli() {
    local script="${1:-}"
    local custom_name="${2:-}"
    local env_file="${3:-}"

    _tsm_validate_script "$script" || return $?

    # Auto-detect environment file if not explicitly provided
    local resolved_env_file
    resolved_env_file="$(_tsm_auto_detect_env "$script" "$env_file")" || return $?

    # If we found an env file, source it temporarily to get PORT
    local port
    if [[ -n "$resolved_env_file" ]]; then
        # Source env file in subshell to extract PORT or TETRA_PORT without affecting current environment
        port="$(source "$resolved_env_file" 2>/dev/null && echo "${PORT:-${TETRA_PORT:-}}")"
    fi

    # Fallback to extracting PORT from script if not found in env
    if [[ -z "$port" ]]; then
        port="$(tetra_tsm_extract_port "$script")" || {
            echo "tsm: PORT not set in env file or script" >&2
            return 65
        }
    fi

    local pwd_at_start="$PWD"
    _tsm_start_cli_internal "$script" "$custom_name" "$port" "$resolved_env_file" "$pwd_at_start"
}

_tsm_start_cli_internal() {
    local script="$1"
    local custom_name="$2"
    local port="$3"
    local env_file="$4"
    local pwd_at_start="$5"

    local name
    name=$(_tsm_generate_name "$script" "$custom_name" "$port" "$env_file")
    
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
    pid=$(cat "$TETRA_DIR/tsm/pids/$name.pid")
    
    local tsm_id
    tsm_id=$(_tsm_save_metadata "$name" "$script" "$pid" "$port" "cli" "" "$pwd_at_start")
    
    echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid)"
}

# === PYTHON PROCESSES ===

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

    tetra_tsm_is_running "$name" && {
        echo "tsm: process '$name' already running" >&2
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

    local logdir="$TETRA_DIR/tsm/logs"
    local piddir="$TETRA_DIR/tsm/pids"

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
        tsm_id=$(_tsm_save_metadata "$name" "$python_cmd" "$pid" "$port" "python" "$start_dir" "$cwd_value")
        
        echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid, Port: $port)"
    else
        echo "tsm: failed to start '$name'" >&2
        return 1
    fi
}

# === WEBSERVER ===

tetra_tsm_start_webserver() {
    local dirname="${1:-/Users/mricos/tetra/public}"
    local port="${2:-8888}"

    [[ -d "$dirname" ]] || { 
        echo "tsm: directory '$dirname' not found" >&2
        return 66 
    }

    local python_cmd="python3 -m http.server $port"
    tetra_tsm_start_python "$python_cmd" "$port" "$dirname" "webserver"
}

# === COMMAND ===

tetra_tsm_start_command() {
    local command_args=()
    local port="" custom_name="" env_file=""
    
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
            *)
                command_args+=("$1")
                shift
                ;;
        esac
    done
    
    [[ ${#command_args[@]} -gt 0 ]] || { echo "tsm: command required" >&2; return 64; }
    [[ -n "$port" ]] || { echo "tsm: port required for command mode" >&2; return 64; }
    
    # Generate command string
    local command_string="${command_args[*]}"
    
    # Generate name from command
    local name
    if [[ -n "$custom_name" ]]; then
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
    
    # Commands run from current directory
    local working_dir="$PWD"
    
    _tsm_start_command_process "$command_string" "$name" "$env_file" "$working_dir" || {
        echo "tsm: failed to start '$name'" >&2
        return 1
    }
    
    local pid
    pid=$(cat "$TETRA_DIR/tsm/pids/$name.pid")
    
    local tsm_id
    tsm_id=$(_tsm_save_metadata "$name" "$command_string" "$pid" "$port" "command" "" "$working_dir")
    
    echo "tsm: started '$name' (TSM ID: $tsm_id, PID: $pid, Port: $port)"
}

# === MAIN START FUNCTION ===

tetra_tsm_start() {
    local file="" env_file="" custom_name="" python_start=false python_cmd="" port="" dirname=""
    local command_mode=false command_args=()

    # Check if first argument is a .tsm.sh service definition
    if [[ $# -ge 1 ]]; then
        local first_arg="$1"
        local service_file="$TETRA_DIR/services/${first_arg}.tsm.sh"
        if [[ -f "$service_file" ]]; then
            _tsm_start_from_service_definition "$@"
            return $?
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
                    if [[ ! -f "$file" || ! -x "$file" ]]; then
                        command_mode=true
                        command_args=("$file")
                        shift
                        
                        # Collect all remaining non-option arguments
                        local all_remaining=()
                        while [[ $# -gt 0 ]]; do
                            case $1 in
                                --env|--port|--dir)
                                    break
                                    ;;
                                *)
                                    all_remaining+=("$1")
                                    shift
                                    ;;
                            esac
                        done
                        
                        # If we have remaining args, check if last one is a custom name
                        if [[ ${#all_remaining[@]} -gt 0 ]]; then
                            local last_arg="${all_remaining[-1]}"
                            # Simple heuristic: if it doesn't contain dots or slashes and isn't a file, treat as name
                            if [[ ${#all_remaining[@]} -gt 1 && "$last_arg" != *"/"* && "$last_arg" != *"."* && ! -f "$last_arg" ]]; then
                                custom_name="$last_arg"
                                # Add all but the last to command args
                                for ((i=0; i<${#all_remaining[@]}-1; i++)); do
                                    command_args+=("${all_remaining[i]}")
                                done
                            else
                                # Add all to command args
                                command_args+=("${all_remaining[@]}")
                            fi
                        fi
                        # Continue processing any remaining options
                        continue
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
    
    # Python start mode
    if [[ "$python_start" == "true" ]]; then
        [[ -n "$python_cmd" ]] || { echo "tsm: python start requires a command" >&2; return 64; }
        tetra_tsm_start_python "$python_cmd" "$port" "$dirname" "$custom_name"
        return $?
    fi

    # Webserver start mode
    if [[ "$file" == "webserver" ]]; then
        [[ -z "$dirname" ]] && dirname="/Users/mricos/tetra/public"
        [[ -z "$port" ]] && port=8888
        
        tetra_tsm_start_webserver "$dirname" "$port"
        return $?
    fi

    # Command mode
    if [[ "$command_mode" == "true" ]]; then
        [[ ${#command_args[@]} -gt 0 ]] || { echo "tsm: command required" >&2; return 64; }
        
        # Use provided port or resolve using named port registry
        if [[ -z "$port" ]]; then
            port=$(tsm_resolve_service_port "$custom_name" "" "" 2>/dev/null || echo "3000")
        fi
        
        tetra_tsm_start_command "${command_args[@]}" --port "$port" --name "$custom_name" --env "$env_file"
        return $?
    fi

    # CLI start mode (executable files)
    [[ -n "$file" ]] || { echo "tsm: start [--env env.sh] <script.sh|command> [name]" >&2; return 64; }
    [[ -f "$file" ]] || { echo "tsm: '$file' not found" >&2; return 66; }

    # Let tetra_tsm_start_cli handle env file validation with auto-detection
    tetra_tsm_start_cli "$file" "$custom_name" "$env_file"
}

# === STOP ===

tetra_tsm_kill() {
    tetra_tsm_stop --force "$@"
}

tetra_tsm_stop() {
    local force=false
    local patterns=()
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                force=true
                shift
                ;;
            *)
                patterns+=("$1")
                shift
                ;;
        esac
    done
    
    [[ ${#patterns[@]} -gt 0 ]] || { echo "tsm: stop [--force] <process|id|*> [process|id...]" >&2; return 64; }
    
    local exit_code=0
    
    for pattern in "${patterns[@]}"; do
        if [[ "$pattern" == "*" ]]; then
            for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
                [[ -f "$metafile" ]] || continue
                local tsm_id=""
                eval "$(cat "$metafile")"
                tetra_tsm_stop_by_id "$tsm_id" "$force" || exit_code=1
            done
        else
            local resolved_id
            if resolved_id=$(tetra_tsm_resolve_to_id "$pattern"); then
                tetra_tsm_stop_by_id "$resolved_id" "$force" || exit_code=1
            else
                echo "tsm: process '$pattern' not found" >&2
                exit_code=1
            fi
        fi
    done
    
    return $exit_code
}

tetra_tsm_stop_by_id() {
    local id="$1"
    local force="${2:-false}"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_stop_single "$name" "$force"
}

tetra_tsm_stop_single() {
    local name="$1"
    local force="${2:-false}"
    local pidfile="$TETRA_DIR/tsm/pids/$name.pid"
    
    tetra_tsm_is_running "$name" || {
        echo "tsm: process '$name' not running"
        return 1
    }
    
    local pid
    pid=$(cat "$pidfile")
    
    # Get process group ID
    local pgid=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
    else
        pgid=$(ps -p "$pid" -o pgid --no-headers 2>/dev/null | tr -d ' ')
    fi
    
    if [[ "$force" == "true" ]]; then
        # Force kill
        [[ -n "$pgid" && "$pgid" != "$pid" ]] && kill -KILL -"$pgid" 2>/dev/null || true
        kill -KILL "$pid" 2>/dev/null || true
    else
        # Graceful shutdown
        [[ -n "$pgid" && "$pgid" != "$pid" ]] && kill -TERM -"$pgid" 2>/dev/null || true
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local wait_count=0
        local max_wait=5
        
        while [[ $wait_count -lt $max_wait ]] && tetra_tsm_is_running "$name"; do
            sleep 1
            wait_count=$((wait_count + 1))
        done
        
        # Force kill if still running
        if tetra_tsm_is_running "$name"; then
            [[ -n "$pgid" && "$pgid" != "$pid" ]] && kill -KILL -"$pgid" 2>/dev/null || true
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi
    
    # Clean up port
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"
    if [[ -f "$metafile" ]] && command -v lsof >/dev/null 2>&1; then
        local port=""
        eval "$(cat "$metafile")"
        
        if [[ -n "$port" && "$port" != "-" ]]; then
            local port_pids
            port_pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
            [[ -n "$port_pids" ]] && echo "$port_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    fi
    
    rm -f "$pidfile"
    echo "tsm: stopped '$name'"
}

# === DELETE ===

tetra_tsm_delete() {
    local patterns=("$@")
    
    [[ ${#patterns[@]} -gt 0 ]] || { echo "tsm: delete <process|id|*> [process|id...]" >&2; return 64; }
    
    local exit_code=0
    
    for pattern in "${patterns[@]}"; do
        if [[ "$pattern" == "*" ]]; then
            for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
                [[ -f "$metafile" ]] || continue
                local tsm_id=""
                eval "$(cat "$metafile")"
                tetra_tsm_delete_by_id "$tsm_id" || exit_code=1
            done
        else
            local resolved_id
            if resolved_id=$(tetra_tsm_resolve_to_id "$pattern"); then
                tetra_tsm_delete_by_id "$resolved_id" || exit_code=1
            else
                echo "tsm: process '$pattern' not found" >&2
                exit_code=1
            fi
        fi
    done
    
    return $exit_code
}

tetra_tsm_delete_by_id() {
    local id="$1"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_delete_single "$name"
}

tetra_tsm_delete_single() {
    local name="$1"
    
    # Stop if running
    tetra_tsm_is_running "$name" && tetra_tsm_stop_single "$name" "true"
    
    # Remove all traces
    rm -f "$TETRA_DIR/tsm/pids/$name.pid"
    rm -f "$TETRA_DIR/tsm/processes/$name.meta"
    rm -f "$TETRA_DIR/tsm/processes/$name.env"
    rm -f "$TETRA_DIR/tsm/logs/$name.out"
    rm -f "$TETRA_DIR/tsm/logs/$name.err"
    
    echo "tsm: deleted '$name'"
}

# === RESTART ===

tetra_tsm_restart() {
    local patterns=("$@")
    
    [[ ${#patterns[@]} -gt 0 ]] || { echo "tsm: restart <process|id|*> [process|id...]" >&2; return 64; }
    
    local exit_code=0
    
    for pattern in "${patterns[@]}"; do
        if [[ "$pattern" == "*" ]]; then
            for metafile in "$TETRA_DIR/tsm/processes"/*.meta; do
                [[ -f "$metafile" ]] || continue
                local tsm_id=""
                eval "$(cat "$metafile")"
                tetra_tsm_restart_by_id "$tsm_id" || exit_code=1
            done
        else
            local resolved_id
            if resolved_id=$(tetra_tsm_resolve_to_id "$pattern"); then
                tetra_tsm_restart_by_id "$resolved_id" || exit_code=1
            else
                echo "tsm: process '$pattern' not found" >&2
                exit_code=1
            fi
        fi
    done
    
    return $exit_code
}

tetra_tsm_restart_by_id() {
    local id="$1"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_restart_single "$name"
}

tetra_tsm_restart_single() {
    local name="$1"
    local metafile="$TETRA_DIR/tsm/processes/$name.meta"

    [[ -f "$metafile" ]] || { echo "tsm: process '$name' not found" >&2; return 1; }

    # Parse metadata and preserve the original TSM ID
    local script type port start_dir cwd tsm_id restart_count
    eval "$(cat "$metafile")"

    # Stop current process but don't delete metadata yet
    tetra_tsm_is_running "$name" && tetra_tsm_stop_single "$name" "true" 2>/dev/null || true

    # Extract original name (pre-port)
    local original_name
    if [[ "$name" =~ ^(.+)-[0-9]+$ ]]; then
        original_name="${BASH_REMATCH[1]}"
    else
        original_name="$name"
    fi

    # Use unified restart logic
    _tsm_restart_unified "$script" "$type" "$port" "$start_dir" "$cwd" "$original_name" "$tsm_id"
}

# === UNIFIED RESTART LOGIC ===

_tsm_restart_unified() {
    local script="$1"
    local type="$2"
    local port="$3"
    local start_dir="$4"
    local cwd="$5"
    local original_name="$6"
    local preserve_id="$7"

    local name="${original_name}-${port}"

    case "$type" in
        python)
            tetra_python_activate
            local working_dir="$start_dir"
            [[ -n "$working_dir" ]] || working_dir="$PWD"
            [[ -d "$working_dir" ]] || { echo "tsm: directory '$working_dir' not found" >&2; return 66; }

            local setsid_cmd
            setsid_cmd=$(tetra_tsm_get_setsid) || {
                echo "tsm: setsid not available. Run 'tsm setup' or 'brew install util-linux' on macOS" >&2
                return 1
            }

            local logdir="$TETRA_DIR/tsm/logs"
            local piddir="$TETRA_DIR/tsm/pids"

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

                local tsm_id
                tsm_id=$(_tsm_save_metadata "$name" "$script" "$pid" "$port" "python" "$working_dir" "$cwd" "$preserve_id" "true")

                echo "tsm: restarted '$name' (TSM ID: $tsm_id, PID: $pid, Port: $port)"
            else
                echo "tsm: failed to restart '$name'" >&2
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
            pid=$(cat "$TETRA_DIR/tsm/pids/$name.pid")

            local tsm_id
            tsm_id=$(_tsm_save_metadata "$name" "$script_path" "$pid" "$port" "cli" "" "$cwd" "$preserve_id" "true")

            echo "tsm: restarted '$name' (TSM ID: $tsm_id, PID: $pid)"
            ;;
        command)
            _tsm_start_command_process "$script" "$name" "" "$cwd" || {
                echo "tsm: failed to restart '$name'" >&2
                return 1
            }

            local pid
            pid=$(cat "$TETRA_DIR/tsm/pids/$name.pid")

            local tsm_id
            tsm_id=$(_tsm_save_metadata "$name" "$script" "$pid" "$port" "command" "" "$cwd" "$preserve_id" "true")

            echo "tsm: restarted '$name' (TSM ID: $tsm_id, PID: $pid, Port: $port)"
            ;;
        *)
            echo "tsm: unknown process type '$type'" >&2
            return 1
            ;;
    esac
}

# === ID MANAGEMENT ===

tetra_tsm_get_next_id() {
    local id_file="$TETRA_DIR/tsm/next_id"
    local current_id
    current_id=$(cat "$id_file")
    
    current_id=$((current_id + 1))
    echo "$current_id" > "$id_file"

    echo "$current_id"
}

# Start service from .tsm.sh service definition file
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

    # Build command with arguments
    local full_command=("$TSM_COMMAND")
    if [[ ${#TSM_ARGS[@]} -gt 0 ]]; then
        full_command+=("${TSM_ARGS[@]}")
    fi

    # Build TSM start command with proper argument order
    local tsm_command=()

    # Add environment file if specified (must come before command)
    if [[ -n "$TSM_ENV_FILE" ]]; then
        tsm_command+=("--env" "$TSM_ENV_FILE")
    fi

    # Add the command and arguments
    tsm_command+=("${full_command[@]}")

    # Extract port using priority resolution system
    local env_port=""
    if [[ -n "$TSM_ENV_FILE" && -f "$TSM_CWD/$TSM_ENV_FILE" ]]; then
        env_port="$(cd "$TSM_CWD" && source "$TSM_ENV_FILE" 2>/dev/null && echo "${PORT:-}")"
    fi

    # Use port resolution priority: explicit TSM_PORT → env file PORT → named registry → default
    local port
    port=$(tsm_resolve_service_port "$service_name" "$TSM_PORT" "$env_port")

    # Add port (required for command mode)
    if [[ -n "$port" ]]; then
        tsm_command+=("--port" "$port")
    fi

    # Add service name using --name flag
    tsm_command+=("--name" "$TSM_NAME")

    # Add any additional arguments passed to start command
    if [[ ${#additional_args[@]} -gt 0 ]]; then
        tsm_command=("${tsm_command[@]}" "${additional_args[@]}")
    fi

    # Start the service using TSM command mode
    tetra_tsm_start_command "${tsm_command[@]}"
    local result=$?

    # Return to original directory
    cd "$original_dir"

    return $result
}

tetra_tsm_reset_id() {
    local id_file="$TETRA_DIR/tsm/next_id"
    local processes_dir="$TETRA_DIR/tsm/processes"
    
    # Find the maximum current TSM ID
    local max_id=0
    local meta_files=("$processes_dir"/*.meta)
    
    if [[ -f "${meta_files[0]}" ]]; then
        for metafile in "${meta_files[@]}"; do
            [[ -f "$metafile" ]] || continue
            local current_tsm_id=""
            eval "$(grep 'tsm_id=' "$metafile")"
            if [[ -n "$current_tsm_id" ]] && [[ "$current_tsm_id" -gt "$max_id" ]]; then
                max_id="$current_tsm_id"
            fi
        done
    fi
    
    # Reset to a small value, but higher than the current max
    local reset_id=$((max_id + 1))
    [[ "$reset_id" -lt 10 ]] && reset_id=10
    
    echo "$reset_id" > "$id_file"
    echo "tsm: reset ID to $reset_id"
}