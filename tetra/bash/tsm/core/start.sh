#!/usr/bin/env bash
# TSM Start - service resolution and process startup

# === SERVICE RESOLUTION ===

# Find a service definition file by name
# Searches: $TSM_SERVICES_AVAILABLE, then org-specific paths
# Returns: full path to .tsm file, or empty string if not found
tsm_find_service() {
    local name="$1"
    [[ -z "$name" ]] && return 1

    # 1. Check $TSM_SERVICES_AVAILABLE (primary location)
    local svc_file="$TSM_SERVICES_AVAILABLE/${name}.tsm"
    if [[ -f "$svc_file" ]]; then
        echo "$svc_file"
        return 0
    fi

    # 2. Check org-specific services-available
    local orgs_dir="$TETRA_DIR/orgs"
    if [[ -d "$orgs_dir" ]]; then
        for org_dir in "$orgs_dir"/*/; do
            [[ -d "$org_dir" ]] || continue
            local org_svc="$org_dir/tsm/services-available/${name}.tsm"
            if [[ -f "$org_svc" ]]; then
                echo "$org_svc"
                return 0
            fi
        done
    fi

    return 1
}

# Check if argument is a .tsm file path
# Returns: 0 if valid .tsm file, 1 otherwise
tsm_is_tsm_file() {
    local arg="$1"
    [[ "$arg" == *.tsm && -f "$arg" ]]
}

# Load service from a .tsm file path (not by name)
# Usage: tsm_load_tsm_file <path>
# Sets: TSM_NAME, TSM_COMMAND, TSM_PORT, etc.
tsm_load_tsm_file() {
    local tsm_file="$1"

    [[ -f "$tsm_file" ]] || {
        tsm_error "tsm file not found: $tsm_file"
        return 1
    }

    # Store the file path for reference
    TSM_FILE="$tsm_file"

    # Clear previous values
    TSM_NAME="" TSM_COMMAND="" TSM_PORT="" TSM_ENV="" TSM_CWD=""
    TSM_ORG="" TSM_PORT_TYPE="" TSM_DESCRIPTION="" TSM_PRE_COMMAND=""
    TSM_DEPS="" TSM_HEALTH_CHECK="" TSM_PORTS="" TSM_ENV_FILE=""

    # Source the service file
    source "$tsm_file" 2>/dev/null || {
        tsm_error "failed to load tsm file '$tsm_file'"
        return 1
    }

    # Derive name from filename if not set
    if [[ -z "$TSM_NAME" ]]; then
        TSM_NAME=$(basename "$tsm_file" .tsm)
    fi

    # Handle TSM_ENV_FILE as alias for TSM_ENV (backwards compat)
    [[ -n "$TSM_ENV_FILE" && -z "$TSM_ENV" ]] && TSM_ENV="$TSM_ENV_FILE"

    return 0
}

# Load service definition variables from .tsm file
# Usage: tsm_load_service <name>
# Sets: TSM_NAME, TSM_COMMAND, TSM_PORT, TSM_ENV, TSM_CWD, etc.
tsm_load_service() {
    local name="$1"
    local svc_file

    svc_file=$(tsm_find_service "$name") || return 1

    # Clear previous values
    TSM_NAME="" TSM_COMMAND="" TSM_PORT="" TSM_ENV="" TSM_CWD=""
    TSM_ORG="" TSM_PORT_TYPE="" TSM_DESCRIPTION="" TSM_PRE_COMMAND=""
    TSM_DEPS="" TSM_HEALTH_CHECK="" TSM_PORTS=""

    # Source the service file
    source "$svc_file" 2>/dev/null || {
        tsm_error "failed to load service '$name'"
        return 1
    }

    return 0
}

# === DRYRUN / DESCRIBE ===

# Show what tsm start would do without executing
# Internal helper for --dryrun mode
_tsm_show_dryrun() {
    local proc_name="$1"
    local command="$2"
    local resolved_port="$3"
    local cwd="$4"
    local env_file="$5"
    local env_inline="$6"
    local pre_command="$7"
    local tsm_file="$8"
    local explicit_port="$9"
    local env_port="${10}"

    echo "=== DRYRUN: tsm start ==="
    echo ""
    echo "PROCESS"
    echo "  Name:     $proc_name"
    echo "  Command:  $command"
    echo "  CWD:      $cwd"
    echo ""
    echo "PORT RESOLUTION (3-step ladder)"
    echo "  1. --port arg:    ${explicit_port:-<not set>}"
    echo "  2. env PORT:      ${env_port:-<not set>}"
    echo "  3. auto-allocate: $TSM_PORT_MIN-$TSM_PORT_MAX"
    echo "  → Resolved:       ${resolved_port:-<none>}"
    echo ""
    echo "ENVIRONMENT"
    if [[ -n "$tsm_file" ]]; then
        echo "  TSM file:     $tsm_file"
    fi
    if [[ -n "$env_file" ]]; then
        echo "  Env file:     $env_file"
    elif [[ -n "$env_inline" ]]; then
        echo "  Inline vars:  $env_inline"
    else
        echo "  Env file:     <none>"
    fi
    echo ""
    echo "STARTUP SEQUENCE"
    echo "  1. source \$HOME/tetra/tetra.sh"
    [[ -n "$env_file" ]] && echo "  2. source '$env_file'"
    [[ -n "$env_inline" ]] && echo "  2. export $env_inline"
    [[ -n "$resolved_port" && "$resolved_port" != "0" ]] && echo "  3. export PORT='$resolved_port'"
    echo "  4. export TSM_PROCESS_DIR='\$TSM_PROCESSES_DIR/$proc_name'"
    if [[ -n "$pre_command" ]]; then
        echo ""
        echo "PRE-COMMAND"
        echo "  $pre_command"
    fi
    echo ""
    echo "Would start: $proc_name (port:${resolved_port:-none})"
    echo ""
    echo "Run without --dryrun to execute."
}

# Describe a .tsm file or service without starting
# Shows all configuration and how env would influence startup
# Usage: tsm describe <service|path.tsm> [--env FILE]
tsm_describe() {
    local target="$1"
    local env_override=""
    shift 2>/dev/null || true

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --env|-e) env_override="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    [[ -z "$target" ]] && { tsm_error "usage: tsm describe <service|path.tsm> [--env FILE]"; return 64; }

    local tsm_file=""
    local loaded=false

    # Check if it's a .tsm file path
    if tsm_is_tsm_file "$target"; then
        tsm_file="$target"
        tsm_load_tsm_file "$tsm_file" || return $?
        loaded=true
    # Check if it's a service name
    elif tsm_find_service "$target" &>/dev/null; then
        tsm_file=$(tsm_find_service "$target")
        tsm_load_service "$target" || return $?
        loaded=true
    else
        tsm_error "not found: $target (not a .tsm file or registered service)"
        return 1
    fi

    local env_file="${env_override:-${TSM_ENV:-}}"
    [[ "$env_file" == "none" ]] && env_file=""

    local start_cwd="${TSM_CWD:-$(dirname "$(realpath "$tsm_file")")}"

    # Resolve env file if named reference
    local resolved_env=""
    local env_port=""
    if [[ -n "$env_file" && "$env_file" != *"="* ]]; then
        resolved_env=$(tsm_find_env_file "" "$env_file" 2>/dev/null) || resolved_env=""
        [[ -n "$resolved_env" ]] && env_port=$(tsm_parse_env_port "$resolved_env")
    fi

    local port_spec="${TSM_PORT:-}"
    local resolved_port=""
    if [[ -n "$port_spec" || -n "$env_port" ]]; then
        resolved_port=$(tsm_resolve_port "$port_spec" "$env_port")
    fi

    echo "=== TSM Service: ${TSM_NAME:-$target} ==="
    echo ""
    echo "SOURCE"
    echo "  File:         $tsm_file"
    [[ -n "$TSM_ORG" ]] && echo "  Organization: $TSM_ORG"
    [[ -n "$TSM_DESCRIPTION" ]] && echo "  Description:  $TSM_DESCRIPTION"
    echo ""
    echo "COMMAND"
    echo "  Command:      ${TSM_COMMAND:-<not set>}"
    echo "  CWD:          $start_cwd"
    [[ -n "$TSM_PRE_COMMAND" ]] && echo "  Pre-command:  $TSM_PRE_COMMAND"
    echo ""
    echo "PORT"
    echo "  TSM_PORT:     ${port_spec:-<not set>}"
    if [[ "$port_spec" == *+ ]]; then
        echo "                (auto-increment from ${port_spec%+})"
    fi
    [[ -n "$env_port" ]] && echo "  Env PORT:     $env_port"
    echo "  Resolved:     ${resolved_port:-<auto-allocate from $TSM_PORT_MIN-$TSM_PORT_MAX>}"
    echo ""
    echo "ENVIRONMENT"
    echo "  TSM_ENV:      ${TSM_ENV:-<not set>}"
    if [[ -n "$resolved_env" ]]; then
        echo "  Resolved:     $resolved_env"
        # Show env file contents preview
        if [[ -f "$resolved_env" ]]; then
            echo "  Contents:"
            head -5 "$resolved_env" 2>/dev/null | sed 's/^/    /'
            local lines=$(wc -l < "$resolved_env" 2>/dev/null | tr -d ' ')
            [[ $lines -gt 5 ]] && echo "    ... ($((lines-5)) more lines)"
        fi
    fi
    echo ""
    echo "DEPENDENCIES"
    [[ -n "$TSM_DEPS" ]] && echo "  Requires:     $TSM_DEPS" || echo "  Requires:     <none>"
    [[ -n "$TSM_HEALTH_CHECK" ]] && echo "  Health check: $TSM_HEALTH_CHECK"
    echo ""
    echo "RUN: tsm start $target"
    echo "     tsm start $target --dryrun"
}

# === START ===

# Start any command as a managed process
# Usage: tsm_start <service_name|path.tsm|command> [--port N] [--env FILE|ENV_NAME] [--name NAME] [--dryrun]
# ENV_NAME can be: local, dev, staging, prod → resolves to org-level env file
tsm_start() {
    local command=""
    local port=""
    local env_file=""
    local name=""
    local start_cwd="$PWD"
    local pre_command=""
    local dryrun=false
    local tsm_file=""
    local reuse_id=""

    # Pre-scan for --dryrun flag
    for arg in "$@"; do
        [[ "$arg" == "--dryrun" || "$arg" == "--dry-run" || "$arg" == "-n" ]] && dryrun=true
    done

    # Check if first argument is a .tsm file path
    if [[ $# -gt 0 && "$1" != -* ]] && tsm_is_tsm_file "$1"; then
        tsm_file="$(realpath "$1")"  # Store absolute path for restart
        tsm_load_tsm_file "$tsm_file" || return $?

        command="$TSM_COMMAND"
        port="${TSM_PORT:-}"
        env_file="${TSM_ENV:-}"
        name="${TSM_NAME:-}"
        # CWD defaults to directory containing the .tsm file
        start_cwd="${TSM_CWD:-$(dirname "$(realpath "$tsm_file")")}"
        pre_command="${TSM_PRE_COMMAND:-}"

        [[ "$env_file" == "none" ]] && env_file=""
        shift

        # Allow CLI overrides
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --port|-p) port="$2"; shift 2 ;;
                --env|-e)  env_file="$2"; shift 2 ;;
                --name|-N) name="$2"; shift 2 ;;
                --reuse-id) reuse_id="$2"; shift 2 ;;
                --dryrun|--dry-run|-n) shift ;;  # already handled
                *) shift ;;
            esac
        done

        cd "$start_cwd" 2>/dev/null || {
            tsm_error "cannot cd to '$start_cwd'"
            return 1
        }

        if [[ -n "$pre_command" && "$dryrun" == "false" ]]; then
            eval "$pre_command" || {
                tsm_error "pre-command failed: $pre_command"
                return 1
            }
        fi

    # Check if first argument is a service name (no slashes, no .tsm extension)
    elif [[ $# -gt 0 && "$1" != -* && ! "$1" =~ [[:space:]/] ]]; then
        if tsm_find_service "$1" &>/dev/null; then
            # Load service definition
            tsm_load_service "$1" || return $?

            command="$TSM_COMMAND"
            port="${TSM_PORT:-}"
            env_file="${TSM_ENV:-}"
            name="${TSM_NAME:-$1}"
            start_cwd="${TSM_CWD:-$PWD}"
            pre_command="${TSM_PRE_COMMAND:-}"

            # Skip "none" as env value
            [[ "$env_file" == "none" ]] && env_file=""

            shift  # consume service name

            # Allow CLI overrides for remaining args
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --port|-p) port="$2"; shift 2 ;;
                    --env|-e)  env_file="$2"; shift 2 ;;
                    --name|-N) name="$2"; shift 2 ;;
                    --reuse-id) reuse_id="$2"; shift 2 ;;
                    --dryrun|--dry-run|-n) shift ;;  # already handled
                    *) shift ;;  # ignore extra args for service mode
                esac
            done

            # Change to service CWD first
            cd "$start_cwd" 2>/dev/null || {
                tsm_error "cannot cd to '$start_cwd'"
                return 1
            }

            # Run pre-command after cd (so relative paths work)
            if [[ -n "$pre_command" && "$dryrun" == "false" ]]; then
                eval "$pre_command" || {
                    tsm_error "pre-command failed: $pre_command"
                    return 1
                }
            fi
        fi
    fi

    # Parse args (raw command mode)
    if [[ -z "$command" ]]; then
        while [[ $# -gt 0 ]]; do
            case "$1" in
                --port|-p) port="$2"; shift 2 ;;
                --env|-e)  env_file="$2"; shift 2 ;;
                --name|-N) name="$2"; shift 2 ;;
                --reuse-id) reuse_id="$2"; shift 2 ;;
                --dryrun|--dry-run|-n) shift ;;  # already handled
                *)
                    if [[ -z "$command" ]]; then
                        command="$1"
                    else
                        command="$command $1"
                    fi
                    shift
                    ;;
            esac
        done
    fi

    [[ -z "$command" ]] && { tsm_error "command required"; return 64; }

    # Parse env file for PORT if provided
    # TSM_ENV can be: "local" (file), "/path/to/file.env", or "VAR=val VAR2=val2" (inline)
    local env_port=""
    local env_inline=""
    if [[ -n "$env_file" ]]; then
        if [[ "$env_file" == *"="* ]]; then
            # Inline vars: "PORT=4444 TETRA_ENV=local"
            env_inline="$env_file"
            env_file=""
            # Extract PORT if present
            if [[ "$env_inline" =~ PORT=([0-9]+) ]]; then
                env_port="${BASH_REMATCH[1]}"
            fi
        else
            # File reference
            env_file=$(tsm_find_env_file "" "$env_file") || return $?
            env_port=$(tsm_parse_env_port "$env_file")
        fi
    fi

    # Resolve port (3-step ladder)
    local resolved_port=$(tsm_resolve_port "$port" "$env_port")

    # Generate name
    local proc_name=$(tsm_generate_name "$command" "$resolved_port" "$PWD" "$name")

    # === DRYRUN MODE ===
    if [[ "$dryrun" == "true" ]]; then
        _tsm_show_dryrun \
            "$proc_name" \
            "$command" \
            "$resolved_port" \
            "$PWD" \
            "$env_file" \
            "$env_inline" \
            "$pre_command" \
            "${tsm_file:-}" \
            "$port" \
            "$env_port"
        return 0
    fi

    # Check if already running
    if tsm_process_alive "$proc_name"; then
        tsm_error "process '$proc_name' already running"
        return 1
    fi

    # Setup process directory
    local proc_dir=$(tsm_process_dir "$proc_name")
    mkdir -p "$proc_dir"

    local log_out="$proc_dir/current.out"
    local log_err="$proc_dir/current.err"
    local pid_file="$proc_dir/pid"

    # Clean stale files
    rm -f "$pid_file" "$log_out" "$log_err"

    # Get setsid
    local setsid_cmd=$(tsm_get_setsid) || {
        tsm_error "setsid not found. Install util-linux"
        return 1
    }

    # Build startup script
    local startup="source \$HOME/tetra/tetra.sh"$'\n'

    # Source env file if provided
    [[ -n "$env_file" ]] && startup="${startup}source '$env_file'"$'\n'

    # Handle inline env vars (space-separated KEY=VALUE pairs)
    if [[ -n "$env_inline" ]]; then
        for pair in $env_inline; do
            startup="${startup}export $pair"$'\n'
        done
    fi
    [[ -n "$resolved_port" && "$resolved_port" != "0" ]] && startup="${startup}export PORT='$resolved_port'"$'\n'
    # Export process dir so services can write runtime.json
    startup="${startup}export TSM_PROCESS_DIR='$proc_dir'"$'\n'

    # Start process
    (
        $setsid_cmd bash -c "
            $startup
            $command </dev/null >>'$log_out' 2>>'$log_err' &
            echo \$! > '$pid_file'
        " &
    )

    # Wait for PID file
    local count=0
    while [[ ! -f "$pid_file" && $count -lt 50 ]]; do
        sleep 0.1
        ((count++))
    done

    if [[ ! -f "$pid_file" ]]; then
        tsm_error "failed to start '$proc_name' (no PID)"
        return 1
    fi

    local pid=$(cat "$pid_file")

    # Brief stabilization period to catch early failures
    # (missing modules, port conflicts, syntax errors, etc.)
    local stabilize_ms=${TSM_STABILIZE_MS:-500}
    local stabilize_checks=$((stabilize_ms / 100))
    local check=0
    while [[ $check -lt $stabilize_checks ]]; do
        sleep 0.1
        if ! tsm_is_pid_alive "$pid"; then
            # Process died during stabilization - get exit code
            local exit_code=1
            wait "$pid" 2>/dev/null
            exit_code=$?

            tsm_error "process exited during startup (exit code: $exit_code)"
            if [[ -f "$log_err" && -s "$log_err" ]]; then
                echo "--- stderr (last 10 lines) ---" >&2
                tail -10 "$log_err" >&2
                echo "--- end stderr ---" >&2
            elif [[ -f "$log_out" && -s "$log_out" ]]; then
                echo "--- stdout (last 5 lines) ---" >&2
                tail -5 "$log_out" >&2
            fi
            return $exit_code
        fi
        ((check++))
    done

    # Create metadata (include tsm_file if started from .tsm)
    local id=$(tsm_create_meta "$proc_name" "$pid" "$command" "$resolved_port" "$PWD" "$env_file" "$tsm_file" "" "$reuse_id")

    echo "Started: $proc_name (id:$id pid:$pid port:${resolved_port:-none})"

    # Run post-start hooks
    tsm_hooks_run "post_start" "$proc_name" "$resolved_port"
}

export -f tsm_find_service tsm_load_service tsm_is_tsm_file tsm_load_tsm_file
export -f _tsm_show_dryrun tsm_describe tsm_start
