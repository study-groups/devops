#!/usr/bin/env bash

# tetra_tsm_ utils - Utility functions for tsm

# === JSON OUTPUT UTILITIES ===

# JSON escape string
_tsm_json_escape() {
    local str="$1"
    # Escape quotes, backslashes, and newlines
    echo "$str" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n' | sed 's/\\n$//'
}

# Output JSON error response
tsm_json_error() {
    local message="$1"
    local code="${2:-1}"
    local details="${3:-}"

    echo "{"
    echo "  \"success\": false,"
    echo "  \"error\": {"
    echo "    \"message\": \"$(_tsm_json_escape "$message")\","
    echo "    \"code\": $code"
    if [[ -n "$details" ]]; then
        echo "    ,\"details\": \"$(_tsm_json_escape "$details")\""
    fi
    echo "  }"
    echo "}"
}

# Output JSON success response
tsm_json_success() {
    local message="$1"
    local data="${2:-{}}"

    echo "{"
    echo "  \"success\": true,"
    echo "  \"message\": \"$(_tsm_json_escape "$message")\","
    echo "  \"data\": $data"
    echo "}"
}

# Convert process list to JSON using jq
tsm_processes_to_json() {
    local processes_dir="$TETRA_DIR/tsm/runtime/processes"
    local processes=()

    if [[ -d "$processes_dir" ]]; then
        for process_file in "$processes_dir"/*; do
            [[ -f "$process_file" ]] || continue

            local process_name=$(basename "$process_file")
            local TSM_ID="" PROCESS_NAME="" PID="" COMMAND="" PORT="" CWD="" ENV_FILE="" START_TIME="" STATUS=""

            source "$process_file" 2>/dev/null || continue

            # Check if process is actually running
            local actual_status="stopped"
            if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
                actual_status="running"
            fi

            # Calculate uptime
            local uptime=""
            if [[ -n "$START_TIME" && "$actual_status" == "running" ]]; then
                local current_time=$(date +%s)
                local uptime_seconds=$((current_time - START_TIME))
                uptime="${uptime_seconds}s"
            fi

            # Build JSON object using jq
            local process_json
            process_json=$(jq -n \
                --arg tsm_id "${TSM_ID:-}" \
                --arg name "${PROCESS_NAME:-$process_name}" \
                --arg pid "${PID:-}" \
                --arg command "${COMMAND:-}" \
                --arg port "${PORT:-}" \
                --arg status "$actual_status" \
                --arg uptime "$uptime" \
                --arg cwd "${CWD:-}" \
                --arg env_file "${ENV_FILE:-}" \
                '{
                    tsm_id: $tsm_id,
                    name: $name,
                    pid: $pid,
                    command: $command,
                    port: $port,
                    status: $status,
                    uptime: $uptime,
                    cwd: $cwd,
                    env_file: $env_file
                }')

            processes+=("$process_json")
        done
    fi

    # Combine all process objects and build final response
    local process_array=""
    if [[ ${#processes[@]} -gt 0 ]]; then
        process_array=$(printf '%s\n' "${processes[@]}" | jq -s '.')
    else
        process_array="[]"
    fi

    local count=$(find "$processes_dir" -name "*" -type f 2>/dev/null | wc -l | tr -d ' ')

    jq -n \
        --argjson processes "$process_array" \
        --arg count "$count" \
        '{
            success: true,
            data: {
                processes: $processes,
                count: ($count | tonumber)
            }
        }'
}

tetra_tsm_get_setsid() {
    # Get the correct setsid command for the platform
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v setsid >/dev/null 2>&1; then
            echo "setsid"
        elif [[ -x "/opt/homebrew/opt/util-linux/bin/setsid" ]]; then
            echo "/opt/homebrew/opt/util-linux/bin/setsid"
        else
            echo ""
        fi
    else
        echo "setsid"
    fi
}

tetra_tsm_get_next_id() {
    # Find the lowest unused ID by checking existing metadata files
    local used_ids=()
    local meta_files=("$TETRA_DIR/tsm/runtime/processes"/*.meta)

    # Extract all currently used IDs
    if [[ -f "${meta_files[0]}" ]]; then  # Check if any meta files exist
        for meta_file in "${meta_files[@]}"; do
            if [[ -f "$meta_file" ]]; then
                local tsm_id
                tsm_id=$(grep -o 'tsm_id=[0-9]*' "$meta_file" 2>/dev/null | cut -d= -f2)
                [[ -n "$tsm_id" ]] && used_ids+=("$tsm_id")
            fi
        done
    fi

    # Sort the used IDs numerically
    if [[ ${#used_ids[@]} -gt 0 ]]; then
        used_ids=($(printf '%s\n' "${used_ids[@]}" | sort -n))
    fi

    # Find the lowest unused ID starting from 0
    local next_id=0
    for used_id in "${used_ids[@]}"; do
        if [[ $next_id -eq $used_id ]]; then
            next_id=$((next_id + 1))
        else
            break
        fi
    done

    echo "$next_id"
}

# --- Process Info Gathering ---
# Global arrays to hold process info
_tsm_procs_name=()
_tsm_procs_id=()
_tsm_procs_pid=()
_tsm_procs_port=()
_tsm_procs_status=()
_tsm_procs_uptime=()
_tsm_procs_script=()
_tsm_procs_env_file=()
_tsm_procs_restarts=()

_tetra_tsm_get_all_processes() {
    # Reset arrays
    _tsm_procs_name=()
    _tsm_procs_id=()
    _tsm_procs_pid=()
    _tsm_procs_port=()
    _tsm_procs_status=()
    _tsm_procs_uptime=()
    _tsm_procs_script=()
    _tsm_procs_env_file=()
    _tsm_procs_restarts=()

    for metafile in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        
        local name
        name=$(basename "$metafile" .meta)
        local pid port start_time script tsm_id
        
        # In case a var is not in the file
        pid="-" port="-" start_time="-" script="-" tsm_id="-" restart_count="0"

        # Extract environment file info
        local tsm_env_file="-"
        local envfile="$TETRA_DIR/tsm/runtime/processes/$name.env"
        if [[ -f "$envfile" ]]; then
            local env_line
            env_line=$(grep '^TSM_ENV_FILE=' "$envfile" 2>/dev/null | head -n1)
            if [[ -n "$env_line" ]]; then
                tsm_env_file="${env_line#TSM_ENV_FILE=}"
                # Extract just the filename from the path
                tsm_env_file="$(basename "$tsm_env_file")"
            fi
        fi
        
        eval "$(cat "$metafile")"
        
        local proc_status uptime
        if tetra_tsm_is_running "$name"; then
            proc_status="online"
            local current_time
            current_time=$(date +%s)
            local elapsed=$((current_time - start_time))
            if (( elapsed < 60 )); then
                uptime="${elapsed}s"
            elif (( elapsed < 3600 )); then
                uptime="$((elapsed / 60))m"
            else
                uptime="$((elapsed / 3600))h"
            fi
        else
            proc_status="stopped"
            uptime="-"
        fi
        
        _tsm_procs_name+=("$name")
        _tsm_procs_id+=("$tsm_id")
        _tsm_procs_pid+=("$pid")
        _tsm_procs_port+=("$port")
        _tsm_procs_status+=("$proc_status")
        _tsm_procs_uptime+=("$uptime")
        _tsm_procs_script+=("$script")
        _tsm_procs_env_file+=("$tsm_env_file")
        _tsm_procs_restarts+=("$restart_count")
    done
}


# Convert ID to process name
tetra_tsm_id_to_name() {
    local id="$1"
    for metafile in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        local tsm_id=""
        eval "$(cat "$metafile")"
        if [[ "$tsm_id" == "$id" ]]; then
            basename "$metafile" .meta
            return 0
        fi
    done
    return 1
}

# Convert name to TSM ID
tetra_tsm_name_to_id() {
    local name="$1"
    local metafile="$TETRA_DIR/tsm/runtime/processes/$name.meta"
    [[ -f "$metafile" ]] || return 1
    
    local tsm_id=""
    eval "$(cat "$metafile")"
    [[ -n "$tsm_id" ]] && echo "$tsm_id" || return 1
}

# Resolve input (name or ID) to TSM ID - this is the new primary resolution function
tetra_tsm_resolve_to_id() {
    local input="$1"
    
    # If input is numeric, treat as TSM ID and validate it exists
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        if tetra_tsm_id_to_name "$input" >/dev/null 2>&1; then
            echo "$input"
            return 0
        else
            return 1
        fi
    fi
    
    # Check for exact name match first
    if [[ -f "$TETRA_DIR/tsm/runtime/processes/$input.meta" ]]; then
        tetra_tsm_name_to_id "$input"
        return $?
    fi
    
    # Fuzzy matching: find processes containing the input string
    local matches=()
    local match_ids=()
    for metafile in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        local name=$(basename "$metafile" .meta)
        if [[ "$name" == *"$input"* ]]; then
            matches+=("$name")
            local tsm_id=""
            eval "$(cat "$metafile")"
            match_ids+=("$tsm_id")
        fi
    done
    
    # Handle fuzzy match results
    case ${#matches[@]} in
        0)
            return 1
            ;;
        1)
            echo "${match_ids[0]}"
            return 0
            ;;
        *)
            # Multiple matches - show options and fail
            echo "tsm: ambiguous name '$input', matches:" >&2
            for i in "${!matches[@]}"; do
                local match_name="${matches[i]}"
                local match_id="${match_ids[i]}"
                [[ -z "$match_id" ]] && match_id="-"
                echo "  $match_id: $match_name" >&2
            done
            return 1
            ;;
    esac
}

tetra_tsm_resolve_name() {
    local input="$1"
    local matches=()
    
    # If input is numeric, treat as TSM ID
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        for metafile in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            if [[ "$tsm_id" == "$input" ]]; then
                basename "$metafile" .meta
                return 0
            fi
        done
        return 1
    fi
    
    # Check for exact match first
    if [[ -f "$TETRA_DIR/tsm/runtime/processes/$input.meta" ]]; then
        echo "$input"
        return 0
    fi
    
    # Fuzzy matching: find processes containing the input string
    for metafile in "$TETRA_DIR/tsm/runtime/processes"/*.meta; do
        [[ -f "$metafile" ]] || continue
        local name=$(basename "$metafile" .meta)
        if [[ "$name" == *"$input"* ]]; then
            matches+=("$name")
        fi
    done
    
    # Handle fuzzy match results
    case ${#matches[@]} in
        0)
            return 1
            ;;
        1)
            echo "${matches[0]}"
            return 0
            ;;
        *)
            # Multiple matches - show options and fail
            echo "tsm: ambiguous name '$input', matches:" >&2
            for match in "${matches[@]}"; do
                local tsm_id=""
                eval "$(cat "$TETRA_DIR/tsm/runtime/processes/$match.meta")"
                [[ -z "$tsm_id" ]] && tsm_id="-"
                echo "  $tsm_id: $match" >&2
            done
            return 1
            ;;
    esac
}

# Check if process is running by TSM ID
tetra_tsm_is_running_by_id() {
    local id="$1"
    local name
    name=$(tetra_tsm_id_to_name "$id") || return 1
    tetra_tsm_is_running_by_name "$name"
}

# Check if process is running by name
tetra_tsm_is_running_by_name() {
    local name="$1"
    local pidfile="$TETRA_DIR/tsm/pids/$name.pid"
    
    [[ -f "$pidfile" ]] || return 1
    local pid=$(cat "$pidfile")
    
    # Cross-platform process existence check
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS: use ps
        ps -p "$pid" >/dev/null 2>&1
    else
        # Linux: check /proc
        [[ -d "/proc/$pid" ]]
    fi
}

# Legacy wrapper
tetra_tsm_is_running() {
    tetra_tsm_is_running_by_name "$1"
}

tetra_tsm_extract_port() {
    local script="$1"
    local port="${PORT:-}"
    local tetra_port="${TETRA_PORT:-}"

    # If PORT is already set in environment, use it (many-valued)
    if [[ -n "$port" ]]; then
        echo "$port"
        return 0
    fi

    # If TETRA_PORT is set, use it (single value: 4444)
    if [[ -n "$tetra_port" ]]; then
        echo "$tetra_port"
        return 0
    fi

    # Extract PORT from script file
    local line val
    line="$(grep -E '^(export[[:space:]]+)?PORT=' "$script" | head -n1 || true)"
    if [[ -n "$line" ]]; then
        val="${line#*=}"
        val="${val%%#*}"
        val="${val//\"/}"
        val="${val//\'/}"
        val="${val//[[:space:]]/}"

        # Validate port range
        if [[ "$val" =~ ^[0-9]+$ ]] && (( val >= 1024 && val <= 65535 )); then
            echo "$val"
            return 0
        fi
    fi

    # Try TETRA_PORT from script file
    line="$(grep -E '^(export[[:space:]]+)?TETRA_PORT=' "$script" | head -n1 || true)"
    if [[ -n "$line" ]]; then
        val="${line#*=}"
        val="${val%%#*}"
        val="${val//\"/}"
        val="${val//\'/}"
        val="${val//[[:space:]]/}"

        # Validate port range
        if [[ "$val" =~ ^[0-9]+$ ]] && (( val >= 1024 && val <= 65535 )); then
            echo "$val"
            return 0
        fi
    fi

    return 1
}
