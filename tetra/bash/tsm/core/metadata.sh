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
    local prehook="${9:-}"  # Optional: pre-hook used
    local service_type="${10:-pid}"  # Service type: port|socket|pid
    local port_type="${11:-tcp}"  # Port protocol: tcp|udp|ws|none

    local tsm_id=$(tsm_get_next_id)
    local start_time=$(date +%s)
    local process_dir=$(tsm_get_process_dir "$name")
    local meta_file=$(tsm_get_meta_file "$name")

    # Capture org at process start (immutable)
    local org="${TETRA_ORG:-none}"

    # Create process directory
    mkdir -p "$process_dir"

    # Capture git metadata
    local git_json
    git_json=$(_tsm_capture_git_metadata "$cwd")

    # Create metadata JSON
    jq -n \
        --arg tsm_id "$tsm_id" \
        --arg org "$org" \
        --arg name "$name" \
        --arg pid "$pid" \
        --arg command "$command" \
        --arg port "$port" \
        --arg cwd "$cwd" \
        --arg interpreter "$interpreter" \
        --arg type "$type" \
        --arg env_file "$env_file" \
        --arg prehook "$prehook" \
        --arg service_type "$service_type" \
        --arg port_type "$port_type" \
        --arg start_time "$start_time" \
        --argjson git "$git_json" \
        '{
            tsm_id: ($tsm_id | tonumber),
            org: $org,
            name: $name,
            pid: ($pid | tonumber),
            command: $command,
            port: ($port | tonumber? // $port),
            port_type: $port_type,
            cwd: $cwd,
            interpreter: $interpreter,
            process_type: $type,
            service_type: $service_type,
            env_file: $env_file,
            prehook: $prehook,
            status: "online",
            start_time: ($start_time | tonumber),
            restarts: 0,
            unstable_restarts: 0,
            git: $git
        }' > "$meta_file"

    # Clean up ID reservation placeholder if it exists
    local placeholder_dir="$TSM_PROCESSES_DIR/.reserved-$tsm_id"
    [[ -d "$placeholder_dir" ]] && _tsm_safe_remove_dir "$placeholder_dir"

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

# === EFFICIENT BATCH METADATA ACCESSORS ===
# Read multiple fields in one jq call (efficient!)

# Read core process info: tsm_id, pid, port, status
tsm_read_core_info() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")
    [[ -f "$meta_file" ]] || return 1
    jq -r '[.tsm_id, .pid, .port, .status] | @tsv' "$meta_file" 2>/dev/null
}

# Read extended info: tsm_id, pid, port, port_type, start_time, env_file, service_type
tsm_read_extended_info() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")
    [[ -f "$meta_file" ]] || return 1
    jq -r '[.tsm_id, .pid, .port, (.port_type // "tcp"), .start_time, (.env_file // ""), (.service_type // "pid")] | @tsv' "$meta_file" 2>/dev/null
}

# Read runtime info: interpreter, command, cwd
tsm_read_runtime_info() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")
    [[ -f "$meta_file" ]] || return 1
    jq -r '[(.interpreter // "bash"), .command, .cwd] | @tsv' "$meta_file" 2>/dev/null
}

# Get specific fields as shell variables (use with: eval "$(tsm_meta_vars name field1 field2)")
tsm_meta_vars() {
    local name="$1"
    shift
    local fields=("$@")
    local meta_file=$(tsm_get_meta_file "$name")

    [[ -f "$meta_file" ]] || return 1

    for field in "${fields[@]}"; do
        local value=$(jq -r ".${field} // empty" "$meta_file" 2>/dev/null)
        # Escape for safe eval
        value="${value//\\/\\\\}"
        value="${value//\"/\\\"}"
        value="${value//\$/\\\$}"
        echo "${field}=\"${value}\""
    done
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

# Check if process is tracked AND actually running
tsm_process_exists() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    # No metadata file = not tracked
    [[ -f "$meta_file" ]] || return 1

    # Read PID from metadata
    local pid
    pid=$(jq -r '.pid // empty' "$meta_file" 2>/dev/null)
    [[ -z "$pid" ]] && return 1

    # Check if process is actually alive
    if ! tsm_is_pid_alive "$pid"; then
        # Process is dead - clean up the metadata
        tsm_set_status "$name" "crashed"
        return 1
    fi

    # Process exists and is running
    return 0
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

    # Validate start_time: must be numeric and reasonable
    if [[ -z "$start_time" || ! "$start_time" =~ ^[0-9]+$ ]]; then
        echo "-"
        return 1
    fi

    # Sanity check: start_time should be in the past and not too old (10 years)
    if [[ "$start_time" -gt "$current_time" ]] || \
       [[ "$((current_time - start_time))" -gt 315360000 ]]; then
        echo "-"
        return 1
    fi

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
        _tsm_safe_remove_dir "$process_dir"
    fi
}

# === GIT METADATA FUNCTIONS ===

# Check if a directory is in a git repository
_tsm_is_git_repo() {
    local dir="${1:-.}"
    git -C "$dir" rev-parse --git-dir >/dev/null 2>&1
}

# Get current git branch name
_tsm_get_git_branch() {
    local dir="${1:-.}"
    if _tsm_is_git_repo "$dir"; then
        git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
    fi
}

# Get git commit hash (short version)
_tsm_get_git_revision() {
    local dir="${1:-.}"
    if _tsm_is_git_repo "$dir"; then
        git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo ""
    fi
}

# Get git commit hash (full version)
_tsm_get_git_revision_full() {
    local dir="${1:-.}"
    if _tsm_is_git_repo "$dir"; then
        git -C "$dir" rev-parse HEAD 2>/dev/null || echo ""
    fi
}

# Get last commit message
_tsm_get_git_commit_message() {
    local dir="${1:-.}"
    if _tsm_is_git_repo "$dir"; then
        git -C "$dir" log -1 --pretty=format:"%s" 2>/dev/null || echo ""
    fi
}

# Capture all git metadata for a directory
# Returns JSON object with git info or empty string if not a git repo
_tsm_capture_git_metadata() {
    local dir="${1:-.}"

    if ! _tsm_is_git_repo "$dir"; then
        echo "null"
        return 0
    fi

    local branch revision comment
    branch=$(_tsm_get_git_branch "$dir")
    revision=$(_tsm_get_git_revision "$dir")
    comment=$(_tsm_get_git_commit_message "$dir")

    # Escape strings for JSON
    branch=$(printf '%s' "$branch" | jq -R '.' 2>/dev/null || echo "\"$branch\"")
    revision=$(printf '%s' "$revision" | jq -R '.' 2>/dev/null || echo "\"$revision\"")
    comment=$(printf '%s' "$comment" | jq -R '.' 2>/dev/null || echo "\"$comment\"")

    # Build JSON object
    echo "{\"branch\": $branch, \"revision\": $revision, \"comment\": $comment}"
}

# Export git functions
export -f _tsm_is_git_repo
export -f _tsm_get_git_branch
export -f _tsm_get_git_revision
export -f _tsm_get_git_revision_full
export -f _tsm_get_git_commit_message
export -f _tsm_capture_git_metadata

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
