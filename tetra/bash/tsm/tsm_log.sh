#!/usr/bin/env bash

# TSM Logging Wrapper - TCS 4.0 Compliant
# Provides convenience functions for TSM module logging

# Ensure unified logging is loaded
if ! type tetra_log_event >/dev/null 2>&1; then
    source "${TETRA_SRC}/bash/utils/unified_log.sh"
fi

# === TSM LOGGING WRAPPERS ===

# Generic TSM log event
tsm_log() {
    tetra_log_event tsm "$@"
}

# TSM try events
tsm_log_try() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_try tsm "$verb" "$subject" "$metadata"
}

# TSM success events
tsm_log_success() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_success tsm "$verb" "$subject" "$metadata"
}

# TSM fail events
tsm_log_fail() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_fail tsm "$verb" "$subject" "$metadata"
}

# TSM info events
tsm_log_info() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_info tsm "$verb" "$subject" "$metadata"
}

# TSM debug events
tsm_log_debug() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_debug tsm "$verb" "$subject" "$metadata"
}

# TSM warning events
tsm_log_warn() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_warn tsm "$verb" "$subject" "$metadata"
}

# TSM error events
tsm_log_error() {
    local verb="$1"
    local subject="$2"
    local metadata="${3:-{}}"
    tetra_log_error tsm "$verb" "$subject" "$metadata"
}

# === PROCESS LIFECYCLE LOGGING ===

# Log process start attempt
tsm_log_process_start_try() {
    local name="$1"
    local port="${2:-}"
    local metadata="{}"

    if [[ -n "$port" ]]; then
        metadata=$(jq -n --arg port "$port" '{port: $port}')
    fi

    tsm_log_try "start" "$name" "$metadata"
}

# Log process start success
tsm_log_process_start_success() {
    local name="$1"
    local pid="$2"
    local port="${3:-}"

    local metadata
    if [[ -n "$port" ]]; then
        metadata=$(jq -n --arg pid "$pid" --arg port "$port" '{pid: $pid, port: $port}')
    else
        metadata=$(jq -n --arg pid "$pid" '{pid: $pid}')
    fi

    tsm_log_success "start" "$name" "$metadata"
}

# Log process start failure
tsm_log_process_start_fail() {
    local name="$1"
    local error="${2:-unknown error}"

    local metadata=$(jq -n --arg error "$error" '{error: $error}')
    tsm_log_fail "start" "$name" "$metadata"
}

# Log process stop attempt
tsm_log_process_stop_try() {
    local name="$1"
    local pid="${2:-}"

    local metadata="{}"
    if [[ -n "$pid" ]]; then
        metadata=$(jq -n --arg pid "$pid" '{pid: $pid}')
    fi

    tsm_log_try "stop" "$name" "$metadata"
}

# Log process stop success
tsm_log_process_stop_success() {
    local name="$1"
    local pid="${2:-}"

    local metadata="{}"
    if [[ -n "$pid" ]]; then
        metadata=$(jq -n --arg pid "$pid" '{pid: $pid}')
    fi

    tsm_log_success "stop" "$name" "$metadata"
}

# Log process stop failure
tsm_log_process_stop_fail() {
    local name="$1"
    local error="${2:-unknown error}"

    local metadata=$(jq -n --arg error "$error" '{error: $error}')
    tsm_log_fail "stop" "$name" "$metadata"
}

# Log process restart
tsm_log_process_restart() {
    local name="$1"
    local old_pid="${2:-}"
    local new_pid="${3:-}"

    local metadata
    if [[ -n "$old_pid" ]] && [[ -n "$new_pid" ]]; then
        metadata=$(jq -n --arg old_pid "$old_pid" --arg new_pid "$new_pid" '{old_pid: $old_pid, new_pid: $new_pid}')
    else
        metadata="{}"
    fi

    tsm_log_info "restart" "$name" "$metadata"
}

# === QUERY HELPERS ===

# Query TSM logs
tsm_log_query() {
    tetra_log_query_module tsm
}

# Query TSM process lifecycle events
tsm_log_query_lifecycle() {
    tetra_log_query_module tsm | jq -c 'select(.verb == "start" or .verb == "stop" or .verb == "restart")'
}

# Query TSM errors
tsm_log_query_errors() {
    tetra_log_query_module tsm | jq -c 'select(.status == "fail" or .level == "ERROR")'
}

# Query specific process logs
tsm_log_query_process() {
    local name="$1"
    tetra_log_query_module tsm | jq -c --arg name "$name" 'select(.subject == $name)'
}
