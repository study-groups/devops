#!/usr/bin/env bash

# Tetra Unified Logging - TCS 3.0 Compliant
# All modules log to $TETRA_DIR/logs/tetra.jsonl

# === CONFIGURATION ===

: "${TETRA_LOG_FILE:=$TETRA_DIR/logs/tetra.jsonl}"
: "${TETRA_LOG_EXEC_AT:=@local}"  # Can be overridden for remote execution

# === CORE LOGGING FUNCTION ===

# Log an action to the unified tetra.jsonl
# Usage: tetra_log_event <module> <verb> <subject> <status> [metadata_json]
# Example: tetra_log_event tsm start "tetra-4444" try '{}'
# Example: tetra_log_event tsm start "tetra-4444" success '{"pid":29762,"port":4444}'
tetra_log_event() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local status="$4"
    local metadata_json="${5:-{}}"

    # Ensure log directory exists
    local log_dir=$(dirname "$TETRA_LOG_FILE")
    mkdir -p "$log_dir"

    # Generate ISO 8601 timestamp
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Validate metadata JSON or use empty object
    if ! echo "$metadata_json" | jq -e . >/dev/null 2>&1; then
        metadata_json="{}"
    fi

    # Create log entry
    local log_entry=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg module "$module" \
        --arg verb "$verb" \
        --arg subject "$subject" \
        --arg status "$status" \
        --arg exec_at "$TETRA_LOG_EXEC_AT" \
        --argjson metadata "$metadata_json" \
        '{
            timestamp: $timestamp,
            module: $module,
            verb: $verb,
            subject: $subject,
            status: $status,
            exec_at: $exec_at,
            metadata: $metadata
        }')

    # Append to log file (atomic operation)
    echo "$log_entry" >> "$TETRA_LOG_FILE"
}

# === CONVENIENCE FUNCTIONS ===

# Log a try event
tetra_log_try() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "try" "$metadata"
}

# Log a success event
tetra_log_success() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "success" "$metadata"
}

# Log a fail event
tetra_log_fail() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "fail" "$metadata"
}

# Log a generic event (non-try/fail)
tetra_log_info() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "event" "$metadata"
}

# === QUERYING ===

# Query logs by module
tetra_log_query_module() {
    local module="$1"
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        jq -c "select(.module == \"$module\")" "$TETRA_LOG_FILE"
    fi
}

# Query logs by status
tetra_log_query_status() {
    local status="$1"
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        jq -c "select(.status == \"$status\")" "$TETRA_LOG_FILE"
    fi
}

# Query logs by time range (Unix timestamps)
tetra_log_query_range() {
    local start_time="$1"
    local end_time="$2"
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        jq -c --arg start "$start_time" --arg end "$end_time" \
            'select(.timestamp >= $start and .timestamp <= $end)' \
            "$TETRA_LOG_FILE"
    fi
}

# Get last N log entries
tetra_log_tail() {
    local n="${1:-50}"
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        tail -n "$n" "$TETRA_LOG_FILE"
    fi
}

# === LOG ROTATION ===

# Rotate log file if it exceeds size threshold
tetra_log_rotate() {
    local max_size="${1:-10485760}"  # 10MB default

    if [[ -f "$TETRA_LOG_FILE" ]]; then
        local size=$(stat -f%z "$TETRA_LOG_FILE" 2>/dev/null || stat -c%s "$TETRA_LOG_FILE" 2>/dev/null)

        if [[ $size -gt $max_size ]]; then
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local archive="${TETRA_LOG_FILE}.${timestamp}"

            mv "$TETRA_LOG_FILE" "$archive"
            gzip "$archive"

            echo "Log rotated: $archive.gz"
        fi
    fi
}

# === STATS ===

# Show log statistics
tetra_log_stats() {
    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    echo "=== Tetra Log Statistics ==="
    echo ""

    echo "Total Entries:"
    wc -l < "$TETRA_LOG_FILE"

    echo ""
    echo "By Module:"
    jq -r '.module' "$TETRA_LOG_FILE" | sort | uniq -c | sort -rn

    echo ""
    echo "By Status:"
    jq -r '.status' "$TETRA_LOG_FILE" | sort | uniq -c | sort -rn

    echo ""
    echo "Recent Activity (last 10):"
    tetra_log_tail 10 | jq -r '[.timestamp, .module, .verb, .status] | @tsv'
}
