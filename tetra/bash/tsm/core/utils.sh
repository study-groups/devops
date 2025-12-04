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
    local processes_dir="$TSM_PROCESSES_DIR"
    local processes=()

    if [[ -d "$processes_dir" ]]; then
        for process_file in "$processes_dir"/*; do
            [[ -f "$process_file" ]] || continue

            local process_name=$(basename "$process_file")
            local TSM_ID="" PROCESS_NAME="" PID="" COMMAND="" PORT="" CWD="" ENV_FILE="" START_TIME="" STATUS=""

            source "$process_file" 2>/dev/null || continue

            # Check if process is actually running
            local actual_status="stopped"
            if tsm_is_pid_alive "$PID"; then
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
        elif [[ -n "$HOMEBREW_PREFIX" && -x "$HOMEBREW_PREFIX/opt/util-linux/bin/setsid" ]]; then
            echo "$HOMEBREW_PREFIX/opt/util-linux/bin/setsid"
        else
            echo ""
        fi
    else
        echo "setsid"
    fi
}

# Thread-safe ID allocation - SINGLE SOURCE OF TRUTH
tetra_tsm_get_next_id() {
    local lock_file="$TSM_PROCESSES_DIR/.id_allocation_lock"
    local lock_fd=200
    local used_ids=()

    mkdir -p "$TSM_PROCESSES_DIR"

    # Acquire exclusive lock (with fallback if flock not available)
    if command -v flock >/dev/null 2>&1; then
        # Use flock if available (proper locking)
        exec 200>"$lock_file"
        if ! flock -x -w 5 200; then
            echo "tsm: failed to acquire ID allocation lock (timeout after 5s)" >&2
            exec 200>&-
            return 1
        fi
    else
        # Fallback: simple lock file without flock (macOS without util-linux)
        # Not thread-safe but works for single-threaded use
        local retries=50
        while [[ -f "$lock_file" && $retries -gt 0 ]]; do
            sleep 0.1
            retries=$((retries - 1))
        done
        if [[ $retries -eq 0 ]]; then
            echo "tsm: failed to acquire ID allocation lock (timeout)" >&2
            return 1
        fi
        echo $$ > "$lock_file"
    fi

    # Check for PM2-style meta.json in subdirectories
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local dir_name=$(basename "$process_dir")
        [[ "$dir_name" == .* ]] && continue

        local meta_file="${process_dir}meta.json"
        if [[ -f "$meta_file" ]]; then
            local tsm_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
            [[ -n "$tsm_id" ]] && used_ids+=("$tsm_id")
        fi
    done

    # Check for reserved ID placeholders
    for reserved_dir in "$TSM_PROCESSES_DIR"/.reserved-*/; do
        [[ -d "$reserved_dir" ]] || continue
        local reserved_id=$(basename "$reserved_dir" | sed 's/^\.reserved-//')
        [[ -n "$reserved_id" && "$reserved_id" =~ ^[0-9]+$ ]] && used_ids+=("$reserved_id")
    done

    # Sort and find gap
    if [[ ${#used_ids[@]} -gt 0 ]]; then
        used_ids=($(printf '%s\n' "${used_ids[@]}" | sort -n))
    fi

    local next_id=0
    for used_id in "${used_ids[@]}"; do
        if [[ $next_id -eq $used_id ]]; then
            next_id=$((next_id + 1))
        else
            break
        fi
    done

    # Reserve this ID
    local placeholder_dir="$TSM_PROCESSES_DIR/.reserved-$next_id"
    mkdir -p "$placeholder_dir"
    echo "Reserved at $(date +%s)" > "$placeholder_dir/.timestamp"

    # Release lock
    if command -v flock >/dev/null 2>&1; then
        flock -u 200
        exec 200>&-
    else
        rm -f "$lock_file"
    fi

    echo "$next_id"
}

# === PROCESS NAME/ID RESOLUTION (JSON metadata only) ===

# Convert ID to process name
# Smart resolver: detect if input is TSM ID, PID, or port and convert to process name
tetra_tsm_smart_resolve() {
    local input="$1"

    # First try: TSM ID
    if tetra_tsm_id_to_name "$input" >/dev/null 2>&1; then
        tetra_tsm_id_to_name "$input"
        return 0
    fi

    # Second try: PID (check if it matches any tracked process)
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local meta_file="${process_dir}meta.json"
        [[ -f "$meta_file" ]] || continue

        local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
        if [[ "$pid" == "$input" ]]; then
            basename "$process_dir"
            return 0
        fi
    done

    # Third try: Port (check if it matches any tracked process)
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local meta_file="${process_dir}meta.json"
        [[ -f "$meta_file" ]] || continue

        local port=$(jq -r '.port // empty' "$meta_file" 2>/dev/null)
        if [[ "$port" == "$input" ]]; then
            basename "$process_dir"
            return 0
        fi
    done

    return 1
}

tetra_tsm_id_to_name() {
    local id="$1"
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local meta_file="${process_dir}meta.json"
        [[ -f "$meta_file" ]] || continue

        local tsm_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
        if [[ "$tsm_id" == "$id" ]]; then
            basename "$process_dir"
            return 0
        fi
    done
    return 1
}

# Convert name to TSM ID
tetra_tsm_name_to_id() {
    local name="$1"
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    [[ -f "$meta_file" ]] || return 1

    jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null
}

# Resolve input (name or ID) to TSM ID with fuzzy matching
tetra_tsm_resolve_to_id() {
    local input="$1"

    # Numeric input = TSM ID
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        if tetra_tsm_id_to_name "$input" >/dev/null 2>&1; then
            echo "$input"
            return 0
        fi
        return 1
    fi

    # Exact name match
    if [[ -d "$TSM_PROCESSES_DIR/$input" ]]; then
        tetra_tsm_name_to_id "$input"
        return $?
    fi

    # Fuzzy matching
    local matches=() match_ids=()
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local name=$(basename "$process_dir")
        if [[ "$name" == *"$input"* ]]; then
            matches+=("$name")
            local tsm_id=$(jq -r '.tsm_id // empty' "${process_dir}meta.json" 2>/dev/null)
            match_ids+=("$tsm_id")
        fi
    done

    case ${#matches[@]} in
        0) return 1 ;;
        1) echo "${match_ids[0]}"; return 0 ;;
        *)
            echo "tsm: ambiguous name '$input', matches:" >&2
            for i in "${!matches[@]}"; do
                echo "  ${match_ids[i]}: ${matches[i]}" >&2
            done
            return 1
            ;;
    esac
}

# Check if a PID is alive (simple wrapper for repeated pattern)
tsm_is_pid_alive() {
    local pid="$1"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# Check if process is running
tetra_tsm_is_running() {
    local process_name="$1"
    [[ -z "$process_name" ]] && return 1

    local meta_file="$TSM_PROCESSES_DIR/$process_name/meta.json"
    [[ -f "$meta_file" ]] || return 1

    local pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
    tsm_is_pid_alive "$pid"
}

# === SECURITY UTILITIES ===

# Safe directory removal - prevents accidental damage
_tsm_safe_remove_dir() {
    local dir="$1"

    # Validate directory path
    if [[ -z "$dir" ]]; then
        echo "tsm: Cannot remove empty directory path" >&2
        return 1
    fi

    # Must be under TSM_PROCESSES_DIR
    if [[ ! "$dir" =~ ^"$TSM_PROCESSES_DIR"/.+ ]]; then
        echo "tsm: Invalid process directory path: $dir" >&2
        return 1
    fi

    # Must exist and be a directory
    if [[ -d "$dir" ]]; then
        rm -rf "$dir"
    fi
    # Not an error if already gone
    return 0
}

# Validate path for security - no shell metacharacters or suspicious patterns
_tsm_validate_path() {
    local path="$1"

    # Must be absolute path
    if [[ ! "$path" =~ ^/ ]]; then
        echo "tsm: Path must be absolute: $path" >&2
        return 1
    fi

    # Must exist
    if [[ ! -d "$path" ]]; then
        echo "tsm: Directory does not exist: $path" >&2
        return 1
    fi

    # No shell metacharacters in path
    if [[ "$path" =~ [\;\&\|\`\$\(\)] ]]; then
        echo "tsm: Path contains invalid characters: $path" >&2
        return 1
    fi

    return 0
}

# Validate command for security - basic sanity check
_tsm_validate_command() {
    local cmd="$1"

    # Check for obviously malicious patterns
    if [[ "$cmd" =~ (rm[[:space:]]+-rf[[:space:]]+/|eval[[:space:]]|source[[:space:]]+/dev/|;[[:space:]]*rm|&&[[:space:]]*rm|\|[[:space:]]*rm) ]]; then
        echo "tsm: Command contains suspicious pattern: $cmd" >&2
        return 1
    fi

    # Check for shell metacharacters that could enable command injection
    if [[ "$cmd" =~ (\$\(|\`|;[[:space:]]*[a-z]|&&|\|\||>>) ]]; then
        echo "tsm: Command contains shell metacharacters: $cmd" >&2
        return 1
    fi

    return 0
}

# === PROCESS DIRECTORY ITERATOR ===
# Iterate over all process directories with a callback

tsm_foreach_process() {
    local callback="$1"
    shift
    local callback_args=("$@")

    [[ -d "$TSM_PROCESSES_DIR" ]] || return 0

    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local name=$(basename "$process_dir")
        [[ "$name" == .* ]] && continue  # Skip hidden dirs like .reserved-*

        local meta_file="${process_dir}meta.json"
        [[ -f "$meta_file" ]] || continue

        "$callback" "$name" "$process_dir" "$meta_file" "${callback_args[@]}"
    done
}

# Find process by TSM ID, returns process name
tsm_find_by_id() {
    local target_id="$1"
    local found_name=""

    _find_callback() {
        local name="$1" dir="$2" meta="$3" search_id="$4"
        local tsm_id=$(jq -r '.tsm_id // empty' "$meta" 2>/dev/null)
        if [[ "$tsm_id" == "$search_id" ]]; then
            echo "$name"
            return 1  # Signal to stop iteration
        fi
    }

    tsm_foreach_process _find_callback "$target_id"
}

# Find process by PID, returns process name
tsm_find_by_pid() {
    local target_pid="$1"

    _find_pid_callback() {
        local name="$1" dir="$2" meta="$3" search_pid="$4"
        local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
        if [[ "$pid" == "$search_pid" ]]; then
            echo "$name"
            return 1
        fi
    }

    tsm_foreach_process _find_pid_callback "$target_pid"
}

# Find process by port, returns process name
tsm_find_by_port() {
    local target_port="$1"

    _find_port_callback() {
        local name="$1" dir="$2" meta="$3" search_port="$4"
        local port=$(jq -r '.port // empty' "$meta" 2>/dev/null)
        if [[ "$port" == "$search_port" ]]; then
            echo "$name"
            return 1
        fi
    }

    tsm_foreach_process _find_port_callback "$target_port"
}

# Get PID using port (from lsof)
tsm_get_port_pid() {
    local port="$1"
    lsof -ti :"$port" 2>/dev/null | head -1
}

# Export utility functions
export -f tsm_is_pid_alive
export -f _tsm_safe_remove_dir
export -f _tsm_validate_path
export -f _tsm_validate_command
export -f tsm_foreach_process
export -f tsm_find_by_id
export -f tsm_find_by_pid
export -f tsm_find_by_port
export -f tsm_get_port_pid
