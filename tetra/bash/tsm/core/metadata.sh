#!/usr/bin/env bash

# TSM Metadata - Simple JSON metadata for process tracking
# PM2-inspired: Keep it simple, keep it fast

# Get process directory
tsm_get_process_dir() {
    local name="$1"
    echo "$TSM_PROCESSES_DIR/$name"
}

# Get process metadata file
tsm_get_meta_file() {
    local name="$1"
    echo "$(tsm_get_process_dir "$name")/meta.json"
}

# Create process metadata
tsm_create_metadata() {
    local name="$1"
    local pid="$2"
    local command="$3"
    local port="$4"
    local cwd="$5"
    local interpreter="$6"
    local type="$7"
    local env_file="$8"

    local tsm_id=$(tsm_get_next_id)
    local start_time=$(date +%s)
    local process_dir=$(tsm_get_process_dir "$name")
    local meta_file=$(tsm_get_meta_file "$name")

    # Create process directory
    mkdir -p "$process_dir"

    # Create metadata JSON
    jq -n \
        --arg tsm_id "$tsm_id" \
        --arg name "$name" \
        --arg pid "$pid" \
        --arg command "$command" \
        --arg port "$port" \
        --arg cwd "$cwd" \
        --arg interpreter "$interpreter" \
        --arg type "$type" \
        --arg env_file "$env_file" \
        --arg start_time "$start_time" \
        '{
            tsm_id: ($tsm_id | tonumber),
            name: $name,
            pid: ($pid | tonumber),
            command: $command,
            port: ($port | tonumber? // $port),
            cwd: $cwd,
            interpreter: $interpreter,
            type: $type,
            env_file: $env_file,
            status: "online",
            start_time: ($start_time | tonumber),
            restarts: 0,
            unstable_restarts: 0
        }' > "$meta_file"

    # Clean up ID reservation placeholder if it exists
    local placeholder_dir="$TSM_PROCESSES_DIR/.reserved-$tsm_id"
    [[ -d "$placeholder_dir" ]] && rm -rf "$placeholder_dir"

    echo "$tsm_id"
}

# Read metadata field
tsm_read_metadata() {
    local name="$1"
    local field="$2"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ -f "$meta_file" ]]; then
        jq -r ".${field} // empty" "$meta_file" 2>/dev/null
    else
        return 1
    fi
}

# Read all metadata as JSON
tsm_read_metadata_json() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ -f "$meta_file" ]]; then
        cat "$meta_file"
    else
        return 1
    fi
}

# Update metadata field
tsm_update_metadata() {
    local name="$1"
    local field="$2"
    local value="$3"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    local temp_file="${meta_file}.tmp"
    jq --arg field "$field" --arg value "$value" \
        '.[$field] = $value' "$meta_file" > "$temp_file"

    mv "$temp_file" "$meta_file"
}

# Update status
tsm_set_status() {
    local name="$1"
    local status="$2"
    tsm_update_metadata "$name" "status" "$status"
}

# Increment restart counter
tsm_increment_restarts() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ ! -f "$meta_file" ]]; then
        return 1
    fi

    local temp_file="${meta_file}.tmp"
    jq '.restarts += 1' "$meta_file" > "$temp_file"
    mv "$temp_file" "$meta_file"
}

# Check if process is tracked
tsm_process_exists() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")
    [[ -f "$meta_file" ]]
}

# List all tracked processes
tsm_list_processes() {
    if [[ ! -d "$TSM_PROCESSES_DIR" ]]; then
        return 0
    fi

    for process_dir in "$TSM_PROCESSES_DIR"/*/; do
        [[ -d "$process_dir" ]] || continue
        basename "$process_dir"
    done
}

# Get next TSM ID - delegates to thread-safe implementation in utils.sh
tsm_get_next_id() {
    tetra_tsm_get_next_id
}

# Calculate uptime
tsm_calculate_uptime() {
    local start_time="$1"
    local current_time=$(date +%s)
    local uptime_seconds=$((current_time - start_time))

    if [[ $uptime_seconds -lt 60 ]]; then
        echo "${uptime_seconds}s"
    elif [[ $uptime_seconds -lt 3600 ]]; then
        echo "$((uptime_seconds / 60))m"
    elif [[ $uptime_seconds -lt 86400 ]]; then
        echo "$((uptime_seconds / 3600))h"
    else
        echo "$((uptime_seconds / 86400))d"
    fi
}

# Remove process metadata (cleanup)
tsm_remove_process() {
    local name="$1"
    local process_dir=$(tsm_get_process_dir "$name")

    if [[ -d "$process_dir" ]]; then
        rm -rf "$process_dir"
    fi
}

# === REMOVED: Legacy TCS 3.0 compatibility shims ===
# Migration to PM2-style JSON metadata is complete
# All code now uses tsm_* functions directly

# Export public API only
export -f tsm_get_process_dir
export -f tsm_create_metadata
export -f tsm_read_metadata
export -f tsm_set_status
export -f tsm_process_exists
export -f tsm_remove_process
