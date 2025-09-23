#!/usr/bin/env bash

# TSM Core - Essential process lifecycle functions
# This module has NO dependencies and provides core functionality

# === DIRECTORY SETUP ===

tetra_tsm_setup() {
    # Ensure setsid is available on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local util_linux_bin="/opt/homebrew/opt/util-linux/bin"
        if [[ -d "$util_linux_bin" ]] && [[ ":$PATH:" != *":$util_linux_bin:"* ]]; then
            PATH="$util_linux_bin:$PATH"
            export PATH
            echo "tsm: added util-linux to PATH for setsid support"
        fi

        if ! command -v setsid >/dev/null 2>&1; then
            echo "tsm: warning - setsid not found. Install with: brew install util-linux" >&2
            return 1
        fi
    fi

    # Create TSM directories
    local dirs=("$TETRA_DIR/tsm/runtime/logs" "$TETRA_DIR/tsm/runtime/pids" "$TETRA_DIR/tsm/runtime/processes" "$TETRA_DIR/tsm/services-available" "$TETRA_DIR/tsm/services-enabled")
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done

    # Initialize ID counter
    local id_file="$TETRA_DIR/tsm/runtime/next_id"
    [[ -f "$id_file" ]] || echo "0" > "$id_file"

    echo "tsm: setup complete"
}

# === CORE HELPERS ===

_tsm_get_next_id() {
    local id_file="$TETRA_DIR/tsm/runtime/next_id"
    local next_id

    if [[ -f "$id_file" ]]; then
        next_id=$(cat "$id_file")
    else
        next_id=0
    fi

    echo $((next_id + 1)) > "$id_file"
    echo "$next_id"
}

_tsm_validate_script() {
    local script="$1"
    [[ -n "$script" ]] || { echo "tsm: script required" >&2; return 64; }
    [[ -f "$script" && -x "$script" ]] || { echo "tsm: '$script' not found or not executable" >&2; return 66; }
}

_tsm_generate_process_name() {
    local command="$1"
    local port="$2"
    local custom_name="$3"

    if [[ -n "$custom_name" ]]; then
        echo "$custom_name"
    elif [[ -n "$port" ]]; then
        local basename=$(basename "$command" .sh)
        echo "${basename}-${port}"
    else
        basename "$command" .sh
    fi
}

# === PROCESS FILE MANAGEMENT ===

_tsm_get_process_file() {
    local process_name="$1"
    echo "$TETRA_DIR/tsm/runtime/processes/$process_name"
}

_tsm_get_pid_file() {
    local process_name="$1"
    echo "$TETRA_DIR/tsm/pids/$process_name.pid"
}

_tsm_get_log_file() {
    local process_name="$1"
    echo "$TETRA_DIR/tsm/logs/$process_name.log"
}

_tsm_write_process_info() {
    local tsm_id="$1"
    local process_name="$2"
    local pid="$3"
    local command="$4"
    local port="$5"
    local cwd="$6"
    local env_file="$7"

    local process_file="$(_tsm_get_process_file "$process_name")"

    cat > "$process_file" <<EOF
TSM_ID=$tsm_id
PROCESS_NAME=$process_name
PID=$pid
COMMAND=$command
PORT=$port
CWD=$cwd
ENV_FILE=$env_file
START_TIME=$(date '+%s')
STATUS=running
EOF
}

_tsm_read_process_info() {
    local process_name="$1"
    local process_file="$(_tsm_get_process_file "$process_name")"

    if [[ -f "$process_file" ]]; then
        source "$process_file"
    else
        return 1
    fi
}

# === PID MANAGEMENT ===

_tsm_is_process_running() {
    local pid="$1"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

_tsm_get_process_by_name() {
    local name="$1"
    local process_file="$(_tsm_get_process_file "$name")"

    if [[ -f "$process_file" ]]; then
        local PID
        source "$process_file"
        if _tsm_is_process_running "$PID"; then
            echo "$PID"
            return 0
        else
            # Clean up stale process file
            rm -f "$process_file"
            return 1
        fi
    else
        return 1
    fi
}

# === BASIC PROCESS OPERATIONS ===

_tsm_kill_process() {
    local pid="$1"
    local process_name="$2"
    local timeout="${3:-10}"

    if ! _tsm_is_process_running "$pid"; then
        return 0  # Already dead
    fi

    # Try SIGTERM first
    kill "$pid" 2>/dev/null

    # Wait for graceful shutdown
    local count=0
    while [[ $count -lt $timeout ]] && _tsm_is_process_running "$pid"; do
        sleep 1
        count=$((count + 1))
    done

    # Force kill if still running
    if _tsm_is_process_running "$pid"; then
        kill -9 "$pid" 2>/dev/null
        sleep 1
    fi

    # Clean up files
    local process_file="$(_tsm_get_process_file "$process_name")"
    local pid_file="$(_tsm_get_pid_file "$process_name")"

    rm -f "$process_file" "$pid_file"

    return 0
}

# === ENVIRONMENT LOADING ===

_tsm_load_environment() {
    local env_file="$1"
    local cwd="$2"

    if [[ -n "$env_file" && -f "$cwd/$env_file" ]]; then
        # Export variables from env file
        set -a  # Mark all variables for export
        source "$cwd/$env_file"
        set +a  # Turn off auto-export
        return 0
    else
        return 1
    fi
}

# === CORE START FUNCTION ===

# _tsm_start_process() moved to tsm_interface.sh to avoid duplication

# Export core functions
export -f tetra_tsm_setup
export -f _tsm_get_next_id
export -f _tsm_validate_script
export -f _tsm_generate_process_name
export -f _tsm_get_process_file
export -f _tsm_get_pid_file
export -f _tsm_get_log_file
export -f _tsm_write_process_info
export -f _tsm_read_process_info
export -f _tsm_is_process_running
export -f _tsm_get_process_by_name
export -f _tsm_kill_process
export -f _tsm_load_environment
# _tsm_start_process exported from tsm_interface.sh