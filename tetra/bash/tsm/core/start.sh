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

# === START ===

# Start any command as a managed process
# Usage: tsm_start <service_name|command> [--port N] [--env FILE] [--name NAME]
tsm_start() {
    local command=""
    local port=""
    local env_file=""
    local name=""
    local start_cwd="$PWD"
    local pre_command=""

    # Check if first argument is a service name
    if [[ $# -gt 0 && "$1" != -* && ! "$1" =~ [[:space:]/] ]]; then
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
                    --name|-n) name="$2"; shift 2 ;;
                    *) shift ;;  # ignore extra args for service mode
                esac
            done

            # Change to service CWD first
            cd "$start_cwd" 2>/dev/null || {
                tsm_error "cannot cd to '$start_cwd'"
                return 1
            }

            # Run pre-command after cd (so relative paths work)
            if [[ -n "$pre_command" ]]; then
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
                --name|-n) name="$2"; shift 2 ;;
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
    if ! tsm_is_pid_alive "$pid"; then
        tsm_error "process died immediately"
        [[ -f "$log_err" && -s "$log_err" ]] && tail -5 "$log_err" >&2
        return 1
    fi

    # Create metadata
    local id=$(tsm_create_meta "$proc_name" "$pid" "$command" "$resolved_port" "$PWD" "$env_file")

    echo "Started: $proc_name (id:$id pid:$pid port:${resolved_port:-none})"
}

export -f tsm_find_service tsm_load_service tsm_start
