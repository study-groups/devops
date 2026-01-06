#!/usr/bin/env bash
# TSM Metadata - simplified 10-field JSON schema

# Thread-safe ID allocation
# Uses flock if available, falls back to mkdir-based locking on macOS
tsm_get_next_id() {
    local lock_file="$TSM_PROCESSES_DIR/.id_allocation_lock"
    local lock_dir="$TSM_PROCESSES_DIR/.id_lock_dir"
    local use_flock=false
    local used_ids=()

    mkdir -p "$TSM_PROCESSES_DIR"

    # Check if flock is available
    if command -v flock >/dev/null 2>&1; then
        use_flock=true
    fi

    # Acquire lock using appropriate method
    if [[ "$use_flock" == "true" ]]; then
        exec 200>"$lock_file"
        if ! flock -x -w 5 200; then
            echo "tsm: failed to acquire ID allocation lock" >&2
            exec 200>&-
            return 1
        fi
    else
        # Fallback: mkdir-based lock (atomic on POSIX)
        local attempts=0
        while ! mkdir "$lock_dir" 2>/dev/null; do
            ((attempts++))
            if [[ $attempts -ge 50 ]]; then
                local lock_time=$(cat "$lock_dir/.timestamp" 2>/dev/null || echo "0")
                local current_time=$(date +%s)
                if [[ $((current_time - lock_time)) -gt 30 ]]; then
                    rm -rf "$lock_dir"
                    continue
                fi
                echo "tsm: failed to acquire ID allocation lock" >&2
                return 1
            fi
            sleep 0.1
        done
        echo "$(date +%s)" > "$lock_dir/.timestamp"
    fi

    # Collect used IDs from meta.json files
    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        local dir_name=$(basename "$process_dir")
        [[ "$dir_name" == .* ]] && continue

        local meta_file="${process_dir}meta.json"
        if [[ -f "$meta_file" ]]; then
            local id=$(jq -r '.id // empty' "$meta_file" 2>/dev/null)
            [[ -n "$id" ]] && used_ids+=("$id")
        fi
    done

    # Check for reserved ID placeholders
    for reserved_dir in "$TSM_PROCESSES_DIR"/.reserved-*/; do
        [[ -d "$reserved_dir" ]] || continue
        local reserved_id=$(basename "$reserved_dir" | sed 's/^\.reserved-//')
        [[ -n "$reserved_id" && "$reserved_id" =~ ^[0-9]+$ ]] && used_ids+=("$reserved_id")
    done

    # Sort and deduplicate IDs
    if [[ ${#used_ids[@]} -gt 0 ]]; then
        local sorted_ids=()
        readarray -t sorted_ids < <(printf '%s\n' "${used_ids[@]}" | sort -n -u)
        used_ids=("${sorted_ids[@]}")
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
    echo "$(date +%s)" > "$placeholder_dir/.timestamp"

    # Release lock
    if [[ "$use_flock" == "true" ]]; then
        flock -u 200
        exec 200>&-
    else
        rm -rf "$lock_dir"
    fi

    echo "$next_id"
}

# Get process directory
tsm_process_dir() {
    echo "$TSM_PROCESSES_DIR/$1"
}

# Get metadata file path
tsm_meta_file() {
    echo "$TSM_PROCESSES_DIR/$1/meta.json"
}

# Create process metadata with simplified schema
# Args: name pid command port cwd env_file [tsm_file]
tsm_create_meta() {
    local name="$1"
    local pid="$2"
    local command="$3"
    local port="${4:-}"
    local cwd="${5:-$PWD}"
    local env_file="${6:-}"
    local tsm_file="${7:-}"

    local id=$(tsm_get_next_id)
    local started=$(date +%s)
    local dir=$(tsm_process_dir "$name")
    local meta=$(tsm_meta_file "$name")

    mkdir -p "$dir"

    # Determine port type
    local port_type="tcp"
    if [[ -n "$port" && "$port" != "0" ]]; then
        if command -v lsof >/dev/null 2>&1; then
            lsof -Pan -p "$pid" -iUDP:"$port" 2>/dev/null | grep -q "$port" && port_type="udp"
        fi
    fi

    # Build ports array
    local ports_json="[]"
    if [[ -n "$port" && "$port" != "0" ]]; then
        ports_json="[{\"port\":$port,\"proto\":\"$port_type\"}]"
    fi

    # Create metadata JSON
    jq -n \
        --argjson id "$id" \
        --arg name "$name" \
        --argjson pid "$pid" \
        --arg command "$command" \
        --argjson port "${port:-null}" \
        --argjson ports "$ports_json" \
        --arg cwd "$cwd" \
        --arg env_file "$env_file" \
        --arg tsm_file "$tsm_file" \
        --argjson started "$started" \
        '{
            id: $id,
            name: $name,
            pid: $pid,
            command: $command,
            port: $port,
            ports: $ports,
            cwd: $cwd,
            env_file: (if $env_file == "" then null else $env_file end),
            tsm_file: (if $tsm_file == "" then null else $tsm_file end),
            status: "online",
            started: $started
        }' > "$meta"

    # Clean up ID reservation
    rm -rf "$TSM_PROCESSES_DIR/.reserved-$id" 2>/dev/null

    echo "$id"
}

# Read metadata field
tsm_read_meta() {
    local name="$1"
    local field="$2"
    local meta=$(tsm_meta_file "$name")
    [[ -f "$meta" ]] && jq -r ".${field} // empty" "$meta" 2>/dev/null
}

# Read full metadata as JSON
tsm_read_meta_json() {
    local name="$1"
    local meta=$(tsm_meta_file "$name")
    [[ -f "$meta" ]] && cat "$meta"
}

# Update metadata field
tsm_update_meta() {
    local name="$1"
    local field="$2"
    local value="$3"
    local meta=$(tsm_meta_file "$name")

    [[ -f "$meta" ]] || return 1

    local tmp="${meta}.tmp"
    jq --arg f "$field" --arg v "$value" '.[$f] = $v' "$meta" > "$tmp" && mv "$tmp" "$meta"
}

# Update status
tsm_set_status() {
    local name="$1"
    local status="$2"
    tsm_update_meta "$name" "status" "$status"
}

# Check if process exists and is running
tsm_process_alive() {
    local name="$1"
    local meta=$(tsm_meta_file "$name")

    [[ -f "$meta" ]] || return 1

    local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
    [[ -n "$pid" ]] && tsm_is_pid_alive "$pid"
}

# List all tracked process names
tsm_list_tracked() {
    [[ -d "$TSM_PROCESSES_DIR" ]] || return 0
    for dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == .* ]] && continue
        echo "$name"
    done
}

# Remove process metadata
tsm_remove_meta() {
    local name="$1"
    local dir=$(tsm_process_dir "$name")
    [[ -d "$dir" ]] && rm -rf "$dir"
}

# Add secondary port
tsm_add_port() {
    local name="$1"
    local port="$2"
    local proto="${3:-tcp}"
    local meta=$(tsm_meta_file "$name")

    [[ -f "$meta" ]] || return 1

    local tmp="${meta}.tmp"
    jq --argjson p "$port" --arg t "$proto" \
        '.ports = ((.ports // []) | map(select(.port != $p)) + [{port: $p, proto: $t}])' \
        "$meta" > "$tmp" && mv "$tmp" "$meta"
}

# Remove port
tsm_remove_port() {
    local name="$1"
    local port="$2"
    local meta=$(tsm_meta_file "$name")

    [[ -f "$meta" ]] || return 1

    local tmp="${meta}.tmp"
    jq --argjson p "$port" '.ports = ((.ports // []) | map(select(.port != $p)))' \
        "$meta" > "$tmp" && mv "$tmp" "$meta"
}

# Get uptime string
tsm_uptime() {
    local name="$1"
    local started=$(tsm_read_meta "$name" "started")
    [[ -z "$started" ]] && { echo "-"; return; }

    local now=$(date +%s)
    local secs=$((now - started))
    tsm_format_uptime "$secs"
}

export -f tsm_get_next_id tsm_process_dir tsm_meta_file
export -f tsm_create_meta tsm_read_meta tsm_read_meta_json tsm_update_meta
export -f tsm_set_status tsm_process_alive tsm_list_tracked tsm_remove_meta
export -f tsm_add_port tsm_remove_port tsm_uptime
