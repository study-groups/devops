#!/usr/bin/env bash

# Action Executor - From 013 with tetra.jsonl logging

EXEC_LOG_FILE="${TETRA_DIR:-/tmp}/logs/tetra.jsonl"
mkdir -p "$(dirname "$EXEC_LOG_FILE")" 2>/dev/null

# Get time in milliseconds
get_time_ms() {
    if [[ "$(uname)" == "Darwin" ]]; then
        if command -v python3 &>/dev/null; then
            python3 -c 'import time; print(int(time.time() * 1000))'
        else
            echo "$(date +%s)000"
        fi
    else
        date +%s%3N 2>/dev/null || echo "$(date +%s)000"
    fi
}

# Log to tetra.jsonl
tetra_log() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local status="$4"
    local metadata="${5:-{}}"

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local log_entry="{\"timestamp\":\"$timestamp\",\"module\":\"$module\",\"verb\":\"$verb\",\"subject\":\"$subject\",\"status\":\"$status\",\"exec_at\":\"@local\",\"metadata\":$metadata}"

    echo "$log_entry" >> "$EXEC_LOG_FILE"
}

# Execute action with feedback
execute_action_with_feedback() {
    local action="$1"
    local verb="${action%%:*}"
    local noun="${action##*:}"

    tetra_log "demo014" "$verb" "$noun" "try" '{}'
    local start_time_ms=$(get_time_ms)

    # Execute implementation
    local output
    local exit_code
    output=$(execute_action_impl "$action" 2>&1)
    exit_code=$?

    local end_time_ms=$(get_time_ms)
    local duration=$((end_time_ms - start_time_ms))

    if [[ $exit_code -ne 0 ]]; then
        tetra_log "demo014" "$verb" "$noun" "fail" "{\"exit_code\":$exit_code,\"duration_ms\":$duration}"
        TUI_BUFFERS["@tui[content]"]="$output"
        TUI_BUFFERS["@tui[footer]"]="✗ Failed (${duration}ms)"
        set_action_error "$action" "Execution failed"
        return 1
    fi

    tetra_log "demo014" "$verb" "$noun" "success" "{\"duration_ms\":$duration}"
    set_action_state "$action" "success"
    TUI_BUFFERS["@tui[content]"]="$output"
    TUI_BUFFERS["@tui[footer]"]="completed:${duration}ms"

    return 0
}
