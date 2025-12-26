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
    local service_type="${10:-pid}"  # Service type: port|socket|pid|subprocess
    local parent="${11:-}"  # Optional: parent service name
    local comm_type="${12:-}"  # Optional: pipe|fifo|socket|tcp|none
    local comm_path="${13:-}"  # Optional: path to FIFO or socket
    local coupling_mode="${14:-local}"  # TDP: local|web|hybrid
    local adapter_type="${15:-}"  # TDP: midi|gamepad|osc|keyboard
    local tdp_topic="${16:-}"  # TDP: MQTT-style topic prefix (e.g., tetra/game/trax)

    local tsm_id=$(tsm_get_next_id)
    local start_time=$(date +%s)
    local process_dir=$(tsm_get_process_dir "$name")
    local meta_file=$(tsm_get_meta_file "$name")

    # Create process directory
    mkdir -p "$process_dir"

    # Capture git metadata
    local git_json
    git_json=$(_tsm_capture_git_metadata "$cwd")

    # Resolve parent's tsm_id if parent is specified
    local parent_tsm_id="null"
    if [[ -n "$parent" ]]; then
        local parent_meta=$(tsm_get_meta_file "$parent")
        if [[ -f "$parent_meta" ]]; then
            parent_tsm_id=$(jq -r '.tsm_id // "null"' "$parent_meta" 2>/dev/null)
        fi
    fi

    # Detect port type (tcp/udp) for primary port
    local port_type="tcp"
    if [[ -n "$port" && "$port" != "none" && "$port" != "null" ]]; then
        if lsof -Pan -p "$pid" -iUDP:"$port" 2>/dev/null | grep -q "$port"; then
            port_type="udp"
        fi
    fi

    # Create metadata JSON with ports array
    jq -n \
        --arg tsm_id "$tsm_id" \
        --arg name "$name" \
        --arg pid "$pid" \
        --arg command "$command" \
        --arg port "$port" \
        --arg port_type "$port_type" \
        --arg cwd "$cwd" \
        --arg interpreter "$interpreter" \
        --arg type "$type" \
        --arg env_file "$env_file" \
        --arg prehook "$prehook" \
        --arg service_type "$service_type" \
        --arg start_time "$start_time" \
        --arg parent "$parent" \
        --argjson parent_tsm_id "$parent_tsm_id" \
        --arg comm_type "$comm_type" \
        --arg comm_path "$comm_path" \
        --arg coupling_mode "$coupling_mode" \
        --arg adapter_type "$adapter_type" \
        --arg tdp_topic "$tdp_topic" \
        --argjson git "$git_json" \
        '{
            tsm_id: ($tsm_id | tonumber),
            name: $name,
            pid: ($pid | tonumber),
            command: $command,
            port: ($port | tonumber? // $port),
            port_type: $port_type,
            ports: (if $port == "none" or $port == "" then [] else [{
                port: ($port | tonumber? // null),
                type: $port_type,
                protocol: "primary"
            }] end),
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
            parent: (if $parent == "" then null else $parent end),
            parent_tsm_id: $parent_tsm_id,
            children: [],
            comm_type: (if $comm_type == "" then null else $comm_type end),
            comm_path: (if $comm_path == "" then null else $comm_path end),
            coupling_mode: $coupling_mode,
            adapter_type: (if $adapter_type == "" then null else $adapter_type end),
            tdp_topic: (if $tdp_topic == "" then null else $tdp_topic end),
            siblings: [],
            git: $git
        }' > "$meta_file"

    # If this is a child, register with parent
    if [[ -n "$parent" ]]; then
        _tsm_register_child_with_parent "$name" "$parent"
    fi

    # Clean up ID reservation placeholder if it exists
    local placeholder_dir="$TSM_PROCESSES_DIR/.reserved-$tsm_id"
    [[ -d "$placeholder_dir" ]] && _tsm_safe_remove_dir "$placeholder_dir"

    echo "$tsm_id"
}

# Register a child with its parent (updates parent's children array)
_tsm_register_child_with_parent() {
    local child_name="$1"
    local parent_name="$2"
    local parent_meta=$(tsm_get_meta_file "$parent_name")

    if [[ -f "$parent_meta" ]]; then
        local temp_file="${parent_meta}.tmp"
        jq --arg child "$child_name" \
            '.children = ((.children // []) + [$child] | unique)' \
            "$parent_meta" > "$temp_file"
        mv "$temp_file" "$parent_meta"
    fi
}

# Unregister a child from its parent (removes from parent's children array)
_tsm_unregister_child_from_parent() {
    local child_name="$1"
    local child_meta=$(tsm_get_meta_file "$child_name")

    # Get parent name from child's metadata
    local parent_name=""
    if [[ -f "$child_meta" ]]; then
        parent_name=$(jq -r '.parent // empty' "$child_meta" 2>/dev/null)
    fi

    if [[ -n "$parent_name" ]]; then
        local parent_meta=$(tsm_get_meta_file "$parent_name")
        if [[ -f "$parent_meta" ]]; then
            local temp_file="${parent_meta}.tmp"
            jq --arg child "$child_name" \
                '.children = ((.children // []) - [$child])' \
                "$parent_meta" > "$temp_file"
            mv "$temp_file" "$parent_meta"
        fi
    fi
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

# Add a port to a process with relationship type
# Usage: tsm_add_port <process_name> <port> [type] [protocol] [relation] [group]
#
# Relations:
#   bind           - Exclusively owns/binds port (default)
#   bind-shared    - Binds with SO_REUSEADDR (multicast capable)
#   multicast-join - Joins multicast group on port
#   send-to        - Sends to this port (doesn't bind)
#
# Example: tsm_add_port quasar-1985 1986 udp osc bind
# Example: tsm_add_port midi-mp-1987 1983 udp osc-in multicast-join 239.1.1.1
tsm_add_port() {
    local name="$1"
    local port="$2"
    local port_type="${3:-tcp}"      # tcp or udp
    local protocol="${4:-secondary}" # osc, http, ws, grpc, etc.
    local relation="${5:-bind}"      # bind, bind-shared, multicast-join, send-to
    local group="${6:-}"             # multicast group address (optional)
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ ! -f "$meta_file" ]]; then
        echo "tsm: process '$name' not found" >&2
        return 1
    fi

    # Validate relation type
    case "$relation" in
        bind|bind-shared|multicast-join|send-to) ;;
        *)
            echo "tsm: invalid relation '$relation'" >&2
            echo "Valid: bind, bind-shared, multicast-join, send-to" >&2
            return 1
            ;;
    esac

    # Add port to ports array (avoid duplicates by port number)
    local temp_file="${meta_file}.tmp"
    if [[ -n "$group" ]]; then
        jq --argjson port "$port" \
           --arg type "$port_type" \
           --arg protocol "$protocol" \
           --arg relation "$relation" \
           --arg group "$group" \
           '.ports = ((.ports // []) | map(select(.port != $port)) + [{port: $port, type: $type, protocol: $protocol, relation: $relation, group: $group}])' \
           "$meta_file" > "$temp_file"
    else
        jq --argjson port "$port" \
           --arg type "$port_type" \
           --arg protocol "$protocol" \
           --arg relation "$relation" \
           '.ports = ((.ports // []) | map(select(.port != $port)) + [{port: $port, type: $type, protocol: $protocol, relation: $relation}])' \
           "$meta_file" > "$temp_file"
    fi

    mv "$temp_file" "$meta_file"

    # Format output based on relation
    local symbol="●"
    case "$relation" in
        bind-shared|multicast-join) symbol="⊙" ;;
        send-to) symbol="→" ;;
    esac

    local group_info=""
    [[ -n "$group" ]] && group_info=" group=$group"
    echo "tsm: added ${symbol}${port}/${port_type} ($protocol, $relation${group_info}) to '$name'"
}

# Remove a secondary port from a process
# Usage: tsm_remove_port <process_name> <port>
tsm_remove_port() {
    local name="$1"
    local port="$2"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ ! -f "$meta_file" ]]; then
        echo "tsm: process '$name' not found" >&2
        return 1
    fi

    local temp_file="${meta_file}.tmp"
    jq --argjson port "$port" \
       '.ports = ((.ports // []) | map(select(.port != $port)))' \
       "$meta_file" > "$temp_file"

    mv "$temp_file" "$meta_file"
    echo "tsm: removed port $port from '$name'"
}

# List all ports for a process
# Usage: tsm_list_ports <process_name>
tsm_list_ports() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ ! -f "$meta_file" ]]; then
        echo "tsm: process '$name' not found" >&2
        return 1
    fi

    jq -r '.ports // [] | .[] | "\(.port)\t\(.type)\t\(.protocol)"' "$meta_file"
}

# Auto-detect secondary ports for a running process
# Scans lsof for all ports used by the PID and adds missing ones
# Usage: tsm_detect_ports <process_name>
tsm_detect_ports() {
    local name="$1"
    local meta_file=$(tsm_get_meta_file "$name")

    if [[ ! -f "$meta_file" ]]; then
        echo "tsm: process '$name' not found" >&2
        return 1
    fi

    local pid=$(jq -r '.pid // empty' "$meta_file")
    local primary_port=$(jq -r '.port // empty' "$meta_file")

    if [[ -z "$pid" ]]; then
        echo "tsm: no PID found for '$name'" >&2
        return 1
    fi

    # Get all ports used by this PID
    local detected=0
    while IFS= read -r line; do
        local port_info
        # Parse lsof output: extract port and protocol
        if [[ "$line" =~ :([0-9]+)\ \(LISTEN\) ]]; then
            local port="${BASH_REMATCH[1]}"
            [[ "$port" == "$primary_port" ]] && continue
            tsm_add_port "$name" "$port" "tcp" "detected"
            ((detected++))
        elif [[ "$line" =~ UDP.*:([0-9]+) ]]; then
            local port="${BASH_REMATCH[1]}"
            [[ "$port" == "$primary_port" ]] && continue
            tsm_add_port "$name" "$port" "udp" "detected"
            ((detected++))
        fi
    done < <(lsof -Pan -p "$pid" -i 2>/dev/null)

    echo "tsm: detected $detected additional port(s) for '$name'"
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

# Export parent-child relationship functions
export -f _tsm_register_child_with_parent
export -f _tsm_unregister_child_from_parent

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
export -f tsm_add_port
export -f tsm_remove_port
export -f tsm_list_ports
export -f tsm_detect_ports
