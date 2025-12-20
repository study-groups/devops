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

    # If we found an env file, parse it once to get PORT and NAME
    local port env_name ENV_PORT="" ENV_NAME=""
    if [[ -n "$resolved_env_file" ]]; then
        # Safe parsing without eval - read output line by line
        while IFS='=' read -r key value; do
            case "$key" in
                ENV_PORT) ENV_PORT="$value" ;;
                ENV_NAME) ENV_NAME="$value" ;;
            esac
        done < <(tsm_parse_env_file "$resolved_env_file")
        port="${ENV_PORT:-}"
        env_name="${ENV_NAME:-}"
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

    # Use env_name from environment file if available, otherwise fall back to custom_name
    local effective_name="${env_name:-$custom_name}"

    # CLI scripts run from their parent directory
    local working_dir
    working_dir="$(dirname "$(dirname "$script")")"

    # Use unified start
    (
        cd "$working_dir" 2>/dev/null || cd "$PWD"
        tsm_start_any_command "$script" "$env_file" "$port" "$effective_name" ""
    )
}

# Legacy command start function - now redirects to unified start
# Kept for backwards compatibility with scripts that call this directly
tetra_tsm_start_command() {
    local command_args=()
    local port="" custom_name="" env_file="" json_output=false env_name="" debug=false

    # Parse command arguments and options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --port) port="$2"; shift 2 ;;
            --name) custom_name="$2"; shift 2 ;;
            --env) env_file="$2"; shift 2 ;;
            --json) json_output=true; shift ;;
            --debug) debug=true; shift ;;
            *) command_args+=("$1"); shift ;;
        esac
    done

    [[ ${#command_args[@]} -gt 0 ]] || { echo "tsm: command required" >&2; return 64; }

    # Resolve environment file path
    local resolved_env_file=""
    if [[ -n "$env_file" ]]; then
        if [[ "$env_file" == /* ]]; then
            resolved_env_file="$env_file"
        else
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
        env_file="$resolved_env_file"
    fi

    # Debug output if requested
    if [[ "$debug" == "true" ]]; then
        echo "🔍 TSM Command Debug (legacy path):"
        echo "  Resolved Env File: ${resolved_env_file:-'(none)'}"
        echo "  Port: ${port:-'(none)'}"
        echo "  Name: ${custom_name:-'(none)'}"
        echo "  Command: ${command_args[*]}"
        echo ""
    fi

    # Use unified start
    local command_string="${command_args[*]}"
    tsm_start_any_command "$command_string" "$env_file" "$port" "$custom_name" ""
}

# === MAIN CLI COMMANDS ===

tetra_tsm_start() {
    # Check for --help first
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        if declare -f tsm_help_start >/dev/null 2>&1; then
            tsm_help_start
        else
            echo "Usage: tsm start [OPTIONS] <command> [-- args...]"
            echo ""
            echo "Options:"
            echo "  --env FILE         Environment file to source"
            echo "  --port PORT        Explicit port number"
            echo "  --name NAME        Custom process name (port will be appended)"
            echo "  --pre-hook CMD     Pre-execution hook command"
            echo "  --                 Pass remaining args to command"
            echo ""
            echo "Use 'tsm help start' for detailed help"
        fi
        return 0
    fi

    local env_file="" port="" debug=false custom_name="" prehook=""
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
            --pre-hook)
                prehook="$2"
                shift 2
                ;;
            --debug)
                debug=true
                shift
                ;;
            --)
                # End of TSM options, rest goes to command
                shift
                command_args+=("$@")
                break
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

    local first_arg="${command_args[0]}"

    # Check if first arg is a LOCAL .tsm file
    if [[ "$first_arg" == *.tsm && -f "$first_arg" ]]; then
        tetra_tsm_start_local "$first_arg"
        return $?
    fi

    # Check if first arg is a known service (USE MULTI-ORG LOOKUP)
    local _org _service_file
    if _tsm_find_service "$first_arg" _org _service_file; then
        # Second arg may be a directory override
        local dir_override="${command_args[1]:-}"
        echo "🚀 Starting service: $_org/$first_arg"
        tetra_tsm_start_service "$first_arg" "$dir_override"
        return $?
    fi

    # Use universal start for any command
    local command_string="${command_args[*]}"
    tsm_start_any_command "$command_string" "$env_file" "$port" "$custom_name" "$prehook"
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

    # Find PIDs using the port (use readarray to avoid IFS-dependent word splitting)
    local pids=()
    readarray -t pids < <(lsof -ti :"$port" 2>/dev/null)

    if [[ ${#pids[@]} -eq 0 ]]; then
        echo "❌ No processes found using port $port"
        return 1
    fi

    echo "📋 Found ${#pids[@]} process(es) using port $port:"
    for pid in "${pids[@]}"; do
        local cmd=$(ps -p $pid -o args= 2>/dev/null | head -c 60 || echo "unknown")
        echo "  PID $pid: $cmd"
    done

    # Kill each process (don't pass port to avoid redundant checks per-process)
    local killed=0
    for pid in "${pids[@]}"; do
        if _tsm_kill_process "$pid" "$force"; then
            ((killed++))
        fi
    done

    # Final port verification with retries
    local port_free=false
    local attempt
    for attempt in 1 2 3; do
        local remaining=$(lsof -ti :$port 2>/dev/null | head -1)
        if [[ -z "$remaining" ]]; then
            port_free=true
            break
        fi
        [[ $attempt -lt 3 ]] && sleep 1
    done

    if [[ "$port_free" == "true" ]]; then
        echo "✅ Killed $killed process(es), port $port is now free"
    else
        local remaining_pid=$(lsof -ti :$port 2>/dev/null | head -1)
        local remaining_cmd=$(ps -p $remaining_pid -o args= 2>/dev/null | head -c 60 || echo "unknown")
        echo "⚠️  Killed $killed process(es), but port $port still in use"
        echo "   PID $remaining_pid: $remaining_cmd"
        echo "   (Process may have respawned)"
        return 1
    fi

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
                    local port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)

                    # Cross-verify PID against actual port usage
                    local actual_pid=""
                    if [[ -n "$port" ]]; then
                        actual_pid=$(lsof -ti :$port 2>/dev/null | head -1)
                        if [[ -n "$actual_pid" && "$actual_pid" != "$pid" ]]; then
                            echo "⚠️  PID mismatch for $proc_name!"
                            echo "   Metadata PID: $pid"
                            echo "   Actual PID on port $port: $actual_pid"
                            echo "   Killing actual process on port instead..."
                            pid="$actual_pid"
                        fi
                    fi

                    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                        echo "📋 Found TSM process: $proc_name (PID: $pid, Port: ${port:-unknown})"
                        if _tsm_kill_process "$pid" "$force" "$port"; then
                            echo "✅ Killed TSM process: $proc_name"
                            _tsm_safe_remove_dir "$process_dir"
                            found=true
                        fi
                    elif [[ -n "$port" ]]; then
                        # PID dead but check if port is still in use
                        actual_pid=$(lsof -ti :$port 2>/dev/null | head -1)
                        if [[ -n "$actual_pid" ]]; then
                            echo "⚠️  Metadata PID $pid is dead, but port $port is in use by PID $actual_pid"
                            echo "   Killing actual process on port..."
                            if _tsm_kill_process "$actual_pid" "$force" "$port"; then
                                echo "✅ Killed process on port $port"
                                _tsm_safe_remove_dir "$process_dir"
                                found=true
                            fi
                        else
                            echo "📋 Process $proc_name already dead, cleaning up metadata"
                            _tsm_safe_remove_dir "$process_dir"
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
    local process_name pid port process_dir
    if [[ -d "$TSM_PROCESSES_DIR" ]]; then
        for dir in "$TSM_PROCESSES_DIR"/*/; do
            [[ -d "$dir" ]] || continue
            local meta_file="${dir}meta.json"
            if [[ -f "$meta_file" ]]; then
                local file_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
                if [[ "$file_id" == "$id" ]]; then
                    process_name=$(jq -r '.name // empty' "$meta_file" 2>/dev/null)
                    pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
                    port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
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

    echo "📋 Found process: $process_name (TSM ID: $id, PID: $pid, Port: ${port:-unknown})"

    # Cross-verify: check if the PID in metadata matches what's actually using the port
    local actual_pid=""
    if [[ -n "$port" ]]; then
        actual_pid=$(lsof -ti :$port 2>/dev/null | head -1)
        if [[ -n "$actual_pid" && "$actual_pid" != "$pid" ]]; then
            echo "⚠️  PID mismatch detected!"
            echo "   Metadata PID: $pid"
            echo "   Actual PID on port $port: $actual_pid"
            local actual_cmd=$(ps -p $actual_pid -o args= 2>/dev/null | head -c 60 || echo "unknown")
            echo "   Actual process: $actual_cmd"
            echo ""
            echo "   The process may have respawned or been restarted outside TSM."
            echo "   Killing the actual process on port $port instead..."
            pid="$actual_pid"
        fi
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
        echo "❌ Process with TSM ID $id is not running (PID $pid dead)"
        # Check if something else is on the port
        if [[ -n "$port" ]]; then
            actual_pid=$(lsof -ti :$port 2>/dev/null | head -1)
            if [[ -n "$actual_pid" ]]; then
                echo "⚠️  But port $port is in use by PID $actual_pid"
                echo "   Use 'tsm kill --port $port' to kill the actual process"
            fi
        fi
        _tsm_safe_remove_dir "$process_dir"
        return 1
    fi

    if _tsm_kill_process "$pid" "$force" "$port"; then
        echo "✅ Killed process: $process_name (TSM ID: $id)"
        _tsm_safe_remove_dir "$process_dir"
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
# Usage: _tsm_kill_process <pid> <force> [port]
# If port is provided, verifies the port is free after killing
_tsm_kill_process() {
    local pid="$1"
    local force="$2"
    local port="${3:-}"

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

    # Verify process is dead
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
        echo "❌ Failed to kill PID $pid"
        return 1
    fi

    # If port was provided, verify it's actually free
    if [[ -n "$port" ]]; then
        # Wait a moment for port to be released
        sleep 0.5

        # Check port with retries (UDP ports can be slow to release)
        local port_free=false
        local attempt
        for attempt in 1 2 3; do
            local port_pid=$(lsof -ti :$port 2>/dev/null | head -1)
            if [[ -z "$port_pid" ]]; then
                port_free=true
                break
            fi
            # If something else grabbed the port, warn
            if [[ "$port_pid" != "$pid" ]]; then
                echo "⚠️  Port $port now in use by different process (PID $port_pid)"
                local new_cmd=$(ps -p $port_pid -o args= 2>/dev/null | head -c 60 || echo "unknown")
                echo "   Process: $new_cmd"
                echo "   (Process may have respawned or another service claimed the port)"
                return 1
            fi
            [[ $attempt -lt 3 ]] && sleep 1
        done

        if [[ "$port_free" == "true" ]]; then
            echo "✓ Port $port is now free"
        else
            echo "⚠️  Port $port still in use after kill"
            return 1
        fi
    fi

    return 0
}

# === WRAPPER COMMANDS FOR TSM.SH ===
# These functions route to the appropriate *_single or *_by_id functions

tetra_tsm_stop() {
    local target="$1"
    local force="${2:-false}"

    if [[ -z "$target" ]]; then
        echo "tsm: stop requires a process name or ID" >&2
        return 64
    fi

    # Handle wildcard - stop all
    if [[ "$target" == "*" ]]; then
        echo "tsm: stopping all processes..."
        if [[ -d "$TSM_PROCESSES_DIR" ]]; then
            local count=0
            for process_dir in "$TSM_PROCESSES_DIR"/*/; do
                [[ -d "$process_dir" ]] || continue
                local name=$(basename "$process_dir")
                if tetra_tsm_is_running "$name"; then
                    tetra_tsm_stop_single "$name" "$force" && ((count++))
                fi
            done
            echo "tsm: stopped $count process(es)"
        fi
        return 0
    fi

    # Resolve target to name (handles ID, exact name, and fuzzy match)
    local resolved_name resolve_status
    resolved_name=$(tetra_tsm_resolve_to_name "$target")
    resolve_status=$?
    if [[ $resolve_status -ne 0 ]]; then
        # Exit code 2 = ambiguous (message already printed), 1 = not found
        [[ $resolve_status -eq 1 ]] && echo "tsm: process '$target' not found" >&2
        return 1
    fi

    tetra_tsm_stop_single "$resolved_name" "$force"
}

tetra_tsm_delete() {
    local target="$1"

    if [[ -z "$target" ]]; then
        echo "tsm: delete requires a process name or ID" >&2
        return 64
    fi

    # Handle wildcard - delete all
    if [[ "$target" == "*" ]]; then
        echo "tsm: deleting all processes..."
        if [[ -d "$TSM_PROCESSES_DIR" ]]; then
            local count=0
            for process_dir in "$TSM_PROCESSES_DIR"/*/; do
                [[ -d "$process_dir" ]] || continue
                local name=$(basename "$process_dir")
                tetra_tsm_delete_single "$name" && ((count++))
            done
            echo "tsm: deleted $count process(es)"
        fi
        return 0
    fi

    # Resolve target to name (handles ID, exact name, and fuzzy match)
    # For delete, include stopped processes
    local resolved_name resolve_status
    resolved_name=$(tetra_tsm_resolve_to_name "$target" "true")
    resolve_status=$?
    if [[ $resolve_status -ne 0 ]]; then
        [[ $resolve_status -eq 1 ]] && echo "tsm: process '$target' not found" >&2
        return 1
    fi

    tetra_tsm_delete_single "$resolved_name"
}

tetra_tsm_cleanup() {
    echo "🧹 Cleaning up crashed/dead processes..."

    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        echo "No process directory found."
        return 0
    fi

    local count=0
    local removed=0

    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue

        local name=$(basename "$process_dir")
        local meta_file="$process_dir/meta.json"
        [[ -f "$meta_file" ]] || continue

        # Read PID from metadata
        local pid
        pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
        [[ -z "$pid" ]] && continue

        count=$((count + 1))

        # Check if process is actually alive
        if ! tsm_is_pid_alive "$pid"; then
            echo "  Removing crashed process: $name (PID $pid)"
            tsm_remove_process "$name"
            removed=$((removed + 1))
        fi
    done

    echo ""
    echo "Summary: Checked $count processes, removed $removed crashed processes"
}

tetra_tsm_restart() {
    local target="$1"

    if [[ -z "$target" ]]; then
        echo "tsm: restart requires a process name or ID" >&2
        return 64
    fi

    # Handle wildcard - restart all
    if [[ "$target" == "*" ]]; then
        echo "tsm: restarting all processes..."
        if [[ -d "$TSM_PROCESSES_DIR" ]]; then
            local count=0
            for process_dir in "$TSM_PROCESSES_DIR"/*/; do
                [[ -d "$process_dir" ]] || continue
                local name=$(basename "$process_dir")
                if tetra_tsm_is_running "$name"; then
                    tetra_tsm_restart_single "$name" && ((count++))
                fi
            done
            echo "tsm: restarted $count process(es)"
        fi
        return 0
    fi

    # Resolve target to name (handles ID, exact name, and fuzzy match)
    local resolved_name resolve_status
    resolved_name=$(tetra_tsm_resolve_to_name "$target")
    resolve_status=$?
    if [[ $resolve_status -ne 0 ]]; then
        [[ $resolve_status -eq 1 ]] && echo "tsm: process '$target' not found" >&2
        return 1
    fi

    tetra_tsm_restart_single "$resolved_name"
}

# Export wrapper functions
export -f tetra_tsm_stop
export -f tetra_tsm_delete
export -f tetra_tsm_cleanup
export -f tetra_tsm_restart

