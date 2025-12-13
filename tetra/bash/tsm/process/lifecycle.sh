#!/usr/bin/env bash

# TSM Process Lifecycle Management
# Extracted from tsm_interface.sh during Phase 2 refactor
# Functions handling process start/stop/restart operations

# NOTE: This is a library file loaded via core/include.sh
# TSM_DIR and TSM_SRC are set by core/config.sh before this file is sourced

# Load TSM logging wrapper if available
[[ -f "$TSM_DIR/tsm_log.sh" ]] && source "$TSM_DIR/tsm_log.sh" 2>/dev/null || true

# === CORE PROCESS STARTING ===
# NOTE: Legacy _tsm_start_process() and _tsm_start_command_process() have been removed.
# All process starting now goes through tsm_start_any_command() in core/start.sh

# === PROCESS STOPPING ===

# Get children of a process
_tsm_get_children() {
    local name="$1"
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"

    if [[ -f "$meta_file" ]]; then
        jq -r '.children // [] | .[]' "$meta_file" 2>/dev/null
    fi
}

# Stop children recursively (depth-first)
_tsm_stop_children() {
    local name="$1"
    local force="${2:-false}"

    local children
    children=$(_tsm_get_children "$name")

    if [[ -n "$children" ]]; then
        echo "tsm: stopping children of '$name'..."
        while IFS= read -r child; do
            [[ -z "$child" ]] && continue
            # Recursively stop children of this child first
            _tsm_stop_children "$child" "$force"
            # Then stop the child itself
            if tetra_tsm_is_running "$child" 2>/dev/null; then
                echo "tsm:   └─ stopping child '$child'"
                tetra_tsm_stop_single "$child" "$force"
            fi
        done <<< "$children"
    fi
}

tetra_tsm_stop_single() {
    local name="$1"
    local force="${2:-false}"
    local cascade="${3:-true}"  # Default: cascade stop children

    # Check if process is running
    if ! tetra_tsm_is_running "$name"; then
        echo "tsm: process '$name' not running"
        return 1
    fi

    # Stop children first if cascade is enabled
    if [[ "$cascade" == "true" ]]; then
        _tsm_stop_children "$name" "$force"
    fi

    # Get PID from JSON metadata
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    local pid=$(jq -r '.pid // empty' "$meta_file")

    # Log stop attempt
    tetra_log_try "tsm" "stop" "$name" "{\"pid\":$pid,\"force\":$force}"

    # Get process group ID
    local pgid=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        pgid=$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')
    else
        pgid=$(ps -p "$pid" -o pgid --no-headers 2>/dev/null | tr -d ' ')
    fi

    echo "tsm: stopping '$name' (PID: $pid)"

    if [[ "$force" == "true" ]]; then
        # Force kill - use SIGKILL
        if [[ -n "$pgid" && "$pgid" != "1" ]]; then
            # Kill entire process group
            kill -9 "-$pgid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
        else
            kill -9 "$pid" 2>/dev/null
        fi
    else
        # Graceful shutdown - use SIGTERM first
        if [[ -n "$pgid" && "$pgid" != "1" ]]; then
            # Terminate entire process group
            kill "-$pgid" 2>/dev/null || kill "$pid" 2>/dev/null
        else
            kill "$pid" 2>/dev/null
        fi

        # Wait for graceful shutdown
        local timeout=10
        local count=0
        while [[ $count -lt $timeout ]] && _tsm_is_process_running "$pid"; do
            sleep 1
            count=$((count + 1))
        done

        # Force kill if still running
        if _tsm_is_process_running "$pid"; then
            echo "tsm: force killing '$name' after timeout"
            if [[ -n "$pgid" && "$pgid" != "1" ]]; then
                kill -9 "-$pgid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
            else
                kill -9 "$pid" 2>/dev/null
            fi
        fi
    fi

    # Unregister from parent if this is a child process
    _tsm_unregister_child_from_parent "$name" 2>/dev/null || true

    # Update metadata status in JSON
    local temp_file="${meta_file}.tmp"
    jq '.status = "stopped" | .stop_time = now' "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"

    # Log success
    tetra_log_success "tsm" "stop" "$name" "{\"pid\":$pid}"

    echo "tsm: stopped '$name'"
}

tetra_tsm_stop_by_id() {
    local id="$1"
    local force="${2:-false}"

    local name
    # Try smart resolver first (handles TSM ID, PID, or port)
    name=$(tetra_tsm_smart_resolve "$id") || {
        # Fallback to original ID-only lookup
        name=$(tetra_tsm_id_to_name "$id") || {
            echo "tsm: process ID/PID/port '$id' not found" >&2
            return 1
        }
    }

    tetra_tsm_stop_single "$name" "$force"
}

# === PROCESS DELETION ===

tetra_tsm_delete_single() {
    local name="$1"
    local process_dir="$TSM_PROCESSES_DIR/$name"

    # Check if process exists
    if [[ ! -d "$process_dir" ]]; then
        echo "tsm: process '$name' not found"
        return 1
    fi

    # Stop the process if running
    tetra_tsm_is_running "$name" && tetra_tsm_stop_single "$name" "true" 2>/dev/null || true

    # Get TSM ID before deleting the directory
    local meta_file="${process_dir}/meta.json"
    local tsm_id=""
    if [[ -f "$meta_file" ]]; then
        tsm_id=$(jq -r '.tsm_id // empty' "$meta_file" 2>/dev/null)
    fi

    # Remove process directory (contains meta.json and any other metadata)
    _tsm_safe_remove_dir "$process_dir"

    # Clean up any reserved ID placeholder for this process
    if [[ -n "$tsm_id" ]]; then
        local reserved_dir="$TSM_PROCESSES_DIR/.reserved-$tsm_id"
        [[ -d "$reserved_dir" ]] && _tsm_safe_remove_dir "$reserved_dir"
    fi

    # Clean up legacy TCS database files if they exist
    local db_pattern="bash/tsm/db/*.tsm.*"
    if compgen -G "$db_pattern" > /dev/null 2>&1; then
        find bash/tsm/db -name "*${name}*.tsm.*" -type f -delete 2>/dev/null || true
    fi

    tetra_log_success "tsm" "delete" "$name" "{}"
    echo "tsm: deleted '$name'"
}

tetra_tsm_delete_by_id() {
    local id="$1"

    local name
    name=$(tetra_tsm_id_to_name "$id") || {
        echo "tsm: process ID '$id' not found" >&2
        return 1
    }

    tetra_tsm_delete_single "$name"
}

# === PROCESS RESTARTING ===

tetra_tsm_restart_single() {
    local name="$1"

    # Get metadata before stopping (use JSON metadata)
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    if [[ ! -f "$meta_file" ]]; then
        echo "tsm: process '$name' not found" >&2
        return 1
    fi

    # Extract metadata from JSON
    local script port type tsm_id cwd
    script=$(jq -r '.command // empty' "$meta_file")
    port=$(jq -r '.port // empty' "$meta_file")
    type=$(jq -r '.process_type // empty' "$meta_file")
    tsm_id=$(jq -r '.tsm_id // empty' "$meta_file")
    cwd=$(jq -r '.cwd // empty' "$meta_file")

    # Stop if running
    tetra_tsm_is_running "$name" && tetra_tsm_stop_single "$name" "true"

    # Restart based on type
    _tsm_restart_unified "$name" "$script" "$port" "$type" "$tsm_id" "$cwd"
}

tetra_tsm_restart_by_id() {
    local id="$1"

    local name
    name=$(tetra_tsm_id_to_name "$id") || {
        echo "tsm: process ID '$id' not found" >&2
        return 1
    }

    tetra_tsm_restart_single "$name"
}

_tsm_restart_unified() {
    local name="$1"
    local command="$2"
    local port="$3"
    local type="$4"
    local preserve_id="$5"
    local cwd="$6"

    # Use unified start - run from correct directory
    (
        cd "$cwd" 2>/dev/null || cd "$PWD"
        tsm_start_any_command "$command" "" "$port" "$name" ""
    ) || {
        echo "tsm: failed to restart '$name'" >&2
        return 1
    }

    # Update metadata with preserved TSM ID
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    if [[ -f "$meta_file" ]]; then
        local temp_file="${meta_file}.tmp"
        jq --arg id "$preserve_id" '.tsm_id = ($id | tonumber) | .restarts += 1' \
            "$meta_file" > "$temp_file" && mv "$temp_file" "$meta_file"
    fi

    local pid=$(jq -r '.pid' "$meta_file" 2>/dev/null)
    local port_info=""
    [[ -n "$port" && "$port" != "none" ]] && port_info=", Port: $port"
    echo "tsm: restarted '$name' (TSM ID: $preserve_id, PID: $pid$port_info)"
}

# Export process functions
export -f _tsm_get_children
export -f _tsm_stop_children
export -f tetra_tsm_stop_single
export -f tetra_tsm_stop_by_id
export -f tetra_tsm_delete_single
export -f tetra_tsm_delete_by_id
export -f tetra_tsm_restart_single
export -f tetra_tsm_restart_by_id
export -f _tsm_restart_unified