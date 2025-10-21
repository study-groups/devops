#!/usr/bin/env bash

# Tetra Unified Logging - TCS 4.0 Compliant
# All modules log to $TETRA_DIR/logs/tetra.jsonl with console integration

# === CONFIGURATION ===

: "${TETRA_LOG_FILE:=$TETRA_DIR/logs/tetra.jsonl}"
: "${TETRA_LOG_EXEC_AT:=@local}"  # Can be overridden for remote execution
: "${TETRA_LOG_LEVEL:=INFO}"      # DEBUG, INFO, WARN, ERROR
: "${TETRA_LOG_CONSOLE:=1}"       # 0=silent, 1=console output, 2=verbose console
: "${TETRA_LOG_CONSOLE_COLOR:=1}" # 0=no color, 1=color (requires color module)

# Log level priorities (for filtering)
declare -A TETRA_LOG_LEVEL_PRIORITY=(
    ["DEBUG"]=0
    ["INFO"]=1
    ["WARN"]=2
    ["ERROR"]=3
)

# Get current log level priority
TETRA_CURRENT_LOG_PRIORITY=${TETRA_LOG_LEVEL_PRIORITY[$TETRA_LOG_LEVEL]:-1}

# === CONSOLE OUTPUT ===

# Output to console if enabled
_tetra_log_console() {
    local level="$1"
    local module="$2"
    local verb="$3"
    local subject="$4"
    local status="$5"
    local metadata="$6"

    [[ $TETRA_LOG_CONSOLE -eq 0 ]] && return 0

    # Build console message
    local timestamp=$(date '+%H:%M:%S')
    local msg="[$timestamp] $module:$verb $subject"

    # Add status if verbose mode
    if [[ $TETRA_LOG_CONSOLE -eq 2 ]]; then
        msg="$msg ($status)"
    fi

    # Color output if enabled and color module is loaded
    if [[ $TETRA_LOG_CONSOLE_COLOR -eq 1 ]] && type tetra_console_info >/dev/null 2>&1; then
        case "$status" in
            success|online|running|active)
                tetra_console_success "$msg"
                ;;
            fail|failed|error|ERROR)
                tetra_console_error "$msg"
                ;;
            warn|warning|WARN)
                tetra_console_warn "$msg"
                ;;
            try|pending)
                tetra_console_info "$msg"
                ;;
            debug|DEBUG)
                tetra_console_debug "$msg"
                ;;
            *)
                tetra_console_log "$msg"
                ;;
        esac
    else
        # No color available
        echo "$msg"
    fi

    # Show metadata in verbose mode
    if [[ $TETRA_LOG_CONSOLE -eq 2 ]] && [[ "$metadata" != "{}" ]]; then
        echo "  metadata: $metadata" | head -c 200
        echo ""
    fi
}

# === CORE LOGGING FUNCTION ===

# Log an action to the unified tetra.jsonl
# Usage: tetra_log_event <module> <verb> <subject> <status> [metadata_json] [level]
# Example: tetra_log_event tsm start "tetra-4444" try '{}'
# Example: tetra_log_event tsm start "tetra-4444" success '{"pid":29762,"port":4444}'
# Example: tetra_log_event tsm debug "cache-check" event '{"cached":true}' DEBUG
tetra_log_event() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local status="$4"
    local metadata_json="${5:-{}}"
    local level="${6:-INFO}"  # DEBUG, INFO, WARN, ERROR

    # Check if this message should be logged based on level
    local msg_priority=${TETRA_LOG_LEVEL_PRIORITY[$level]:-1}
    if [[ $msg_priority -lt $TETRA_CURRENT_LOG_PRIORITY ]]; then
        return 0  # Skip logging (below threshold)
    fi

    # Ensure log directory exists
    local log_dir=$(dirname "$TETRA_LOG_FILE")
    mkdir -p "$log_dir"

    # Generate ISO 8601 timestamp
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Validate metadata JSON or use empty object
    if ! echo "$metadata_json" | jq -e . >/dev/null 2>&1; then
        metadata_json="{}"
    fi

    # Create log entry (compact format for JSONL)
    local log_entry=$(jq -nc \
        --arg timestamp "$timestamp" \
        --arg module "$module" \
        --arg verb "$verb" \
        --arg subject "$subject" \
        --arg status "$status" \
        --arg level "$level" \
        --arg exec_at "$TETRA_LOG_EXEC_AT" \
        --argjson metadata "$metadata_json" \
        '{
            timestamp: $timestamp,
            module: $module,
            verb: $verb,
            subject: $subject,
            status: $status,
            level: $level,
            exec_at: $exec_at,
            metadata: $metadata
        }')

    # Append to log file (atomic operation)
    echo "$log_entry" >> "$TETRA_LOG_FILE"

    # Console output
    _tetra_log_console "$level" "$module" "$verb" "$subject" "$status" "$metadata_json"
}

# === CONVENIENCE FUNCTIONS ===

# Log a try event
tetra_log_try() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "try" "$metadata" "INFO"
}

# Log a success event
tetra_log_success() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "success" "$metadata" "INFO"
}

# Log a fail event
tetra_log_fail() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "fail" "$metadata" "ERROR"
}

# Log a generic info event (non-try/fail)
tetra_log_info() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "event" "$metadata" "INFO"
}

# Log a debug event
tetra_log_debug() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "debug" "$metadata" "DEBUG"
}

# Log a warning event
tetra_log_warn() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "warn" "$metadata" "WARN"
}

# Log an error event
tetra_log_error() {
    local module="$1"
    local verb="$2"
    local subject="$3"
    local metadata="${4:-{}}"
    tetra_log_event "$module" "$verb" "$subject" "error" "$metadata" "ERROR"
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

# Query logs by level
tetra_log_query_level() {
    local level="$1"
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        jq -c "select(.level == \"$level\")" "$TETRA_LOG_FILE"
    fi
}

# Query logs by time range (ISO 8601 timestamps)
tetra_log_query_range() {
    local start_time="$1"
    local end_time="$2"
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        jq -c --arg start "$start_time" --arg end "$end_time" \
            'select(.timestamp >= $start and .timestamp <= $end)' \
            "$TETRA_LOG_FILE"
    fi
}

# Query errors only
tetra_log_query_errors() {
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        jq -c 'select(.level == "ERROR" or .status == "fail" or .status == "error")' "$TETRA_LOG_FILE"
    fi
}

# Query warnings and errors
tetra_log_query_issues() {
    if [[ -f "$TETRA_LOG_FILE" ]]; then
        jq -c 'select(.level == "ERROR" or .level == "WARN" or .status == "fail" or .status == "warn")' "$TETRA_LOG_FILE"
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
