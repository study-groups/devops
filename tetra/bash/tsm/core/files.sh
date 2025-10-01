#!/usr/bin/env bash

# TSM Files - File path management and process metadata
# This module handles file locations and process information persistence

# === PROCESS FILE MANAGEMENT ===

_tsm_get_process_file() {
    local process_name="$1"
    echo "$TSM_PROCESSES_DIR/$process_name"
}

_tsm_get_pid_file() {
    local process_name="$1"
    echo "$TSM_PIDS_DIR/$process_name.pid"
}

_tsm_get_log_file() {
    local process_name="$1"
    echo "$TSM_LOGS_DIR/$process_name.log"
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

# Export file management functions
export -f _tsm_get_process_file
export -f _tsm_get_pid_file
export -f _tsm_get_log_file
export -f _tsm_write_process_info
export -f _tsm_read_process_info