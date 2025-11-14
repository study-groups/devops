#!/usr/bin/env bash
# Tetra Audit Logging Module
# TRS-compliant action logging for accountability and debugging

# Source dependencies
if [[ -f "$TETRA_SRC/bash/trs/trs.sh" ]]; then
    source "$TETRA_SRC/bash/trs/trs.sh"
fi

# Module configuration
AUDIT_DIR="${TETRA_DIR}/audit"
AUDIT_DB_DIR="${AUDIT_DIR}/db"
AUDIT_ENABLED="${AUDIT_ENABLED:-true}"

# Initialize audit module
# Usage: audit_init
audit_init() {
    if [[ "$AUDIT_ENABLED" != "true" ]]; then
        return 0
    fi

    # Ensure audit directories exist
    mkdir -p "$AUDIT_DB_DIR"
}

# Log an action execution
# Usage: audit_log event_type action [pipeline_id] [stage] [details]
# Returns: Path to audit log file
audit_log() {
    local event_type="$1"
    local action="$2"
    local pipeline_id="${3:-}"
    local stage="${4:-}"
    local details="${5:-}"

    if [[ "$AUDIT_ENABLED" != "true" ]]; then
        return 0
    fi

    if [[ -z "$event_type" || -z "$action" ]]; then
        echo "Error: audit_log requires event_type and action" >&2
        return 1
    fi

    local timestamp=$(date +%s)
    local iso_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Build audit record
    local audit_record=$(cat <<EOF
{
    "timestamp": $timestamp,
    "iso_timestamp": "$iso_timestamp",
    "event_type": "$event_type",
    "action": "$action",
    "pipeline_id": "${pipeline_id:-null}",
    "stage": "${stage:-null}",
    "details": "${details:-null}",
    "user": "$USER",
    "hostname": "$(hostname)",
    "working_dir": "$(pwd)",
    "pid": $$
}
EOF
)

    # Write using TRS (timestamp.action.log.json)
    # In canonical location: $TETRA_DIR/audit/db/timestamp.action.log.json
    local filepath=$(trs_write_at "$timestamp" "audit" "action" "log" "json" "$audit_record")

    echo "$filepath"
}

# Log pipeline start
# Usage: audit_pipeline_start pipeline_id total_stages
audit_pipeline_start() {
    local pipeline_id="$1"
    local total_stages="$2"

    audit_log "pipeline_start" "pipeline" "$pipeline_id" "" "total_stages:$total_stages"
}

# Log pipeline complete
# Usage: audit_pipeline_complete pipeline_id
audit_pipeline_complete() {
    local pipeline_id="$1"

    audit_log "pipeline_complete" "pipeline" "$pipeline_id" "" "success"
}

# Log pipeline failure
# Usage: audit_pipeline_failure pipeline_id stage error_msg
audit_pipeline_failure() {
    local pipeline_id="$1"
    local stage="$2"
    local error_msg="$3"

    # Escape error message for JSON
    local escaped_error=$(echo "$error_msg" | sed 's/"/\\"/g' | tr '\n' ' ')

    audit_log "pipeline_failure" "pipeline" "$pipeline_id" "$stage" "error:$escaped_error"
}

# Log pipeline cancelled
# Usage: audit_pipeline_cancelled pipeline_id stage
audit_pipeline_cancelled() {
    local pipeline_id="$1"
    local stage="$2"

    audit_log "pipeline_cancelled" "pipeline" "$pipeline_id" "$stage" "user_interrupt"
}

# Log TAS action execution
# Usage: audit_tas_action module action endpoint result [duration_ms]
audit_tas_action() {
    local module="$1"
    local action="$2"
    local endpoint="$3"
    local result="$4"
    local duration_ms="${5:-0}"

    local fqn="${module}.${action}"

    local timestamp=$(date +%s)
    local iso_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Build detailed audit record
    local audit_record=$(cat <<EOF
{
    "timestamp": $timestamp,
    "iso_timestamp": "$iso_timestamp",
    "event_type": "tas_action",
    "module": "$module",
    "action": "$action",
    "fqn": "$fqn",
    "endpoint": "${endpoint:-null}",
    "result": "$result",
    "duration_ms": $duration_ms,
    "user": "$USER",
    "hostname": "$(hostname)",
    "working_dir": "$(pwd)",
    "pid": $$
}
EOF
)

    # Write using TRS
    local filepath=$(trs_write_at "$timestamp" "audit" "tas" "$action" "json" "$audit_record")

    echo "$filepath"
}

# Query audit logs by time range
# Usage: audit_query_range start_timestamp end_timestamp
# Returns: List of audit log files
audit_query_range() {
    local start_ts="$1"
    local end_ts="$2"

    trs_query_range "$start_ts" "$end_ts" "audit"
}

# Query audit logs by event type
# Usage: audit_query_type event_type
# Returns: Matching audit log files
audit_query_type() {
    local event_type="$1"

    if [[ -z "$event_type" ]]; then
        echo "Error: audit_query_type requires event_type" >&2
        return 1
    fi

    # Search audit logs for matching event type
    find "$AUDIT_DB_DIR" -type f -name "*.json" -exec grep -l "\"event_type\": \"$event_type\"" {} \; 2>/dev/null
}

# Query audit logs by pipeline ID
# Usage: audit_query_pipeline pipeline_id
# Returns: All audit logs for pipeline
audit_query_pipeline() {
    local pipeline_id="$1"

    if [[ -z "$pipeline_id" ]]; then
        echo "Error: audit_query_pipeline requires pipeline_id" >&2
        return 1
    fi

    find "$AUDIT_DB_DIR" -type f -name "*.json" -exec grep -l "\"pipeline_id\": \"$pipeline_id\"" {} \; 2>/dev/null | sort
}

# Query recent audit logs
# Usage: audit_recent [count]
# Returns: Most recent N audit logs
audit_recent() {
    local count="${1:-10}"

    trs_latest "audit" "$count"
}

# Display audit log in human-readable format
# Usage: audit_show filepath
audit_show() {
    local filepath="$1"

    if [[ ! -f "$filepath" ]]; then
        echo "Error: Audit log not found: $filepath" >&2
        return 1
    fi

    if type jq &>/dev/null; then
        jq '.' "$filepath"
    else
        cat "$filepath"
    fi
}

# Display pipeline audit trail
# Usage: audit_show_pipeline pipeline_id
audit_show_pipeline() {
    local pipeline_id="$1"

    if [[ -z "$pipeline_id" ]]; then
        echo "Error: audit_show_pipeline requires pipeline_id" >&2
        return 1
    fi

    echo "Audit trail for pipeline: $pipeline_id"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local logs=$(audit_query_pipeline "$pipeline_id")

    if [[ -z "$logs" ]]; then
        echo "No audit logs found for pipeline: $pipeline_id"
        return 0
    fi

    echo "$logs" | while read -r logfile; do
        echo ""
        if type jq &>/dev/null; then
            local iso_ts=$(jq -r '.iso_timestamp' "$logfile" 2>/dev/null)
            local event=$(jq -r '.event_type' "$logfile" 2>/dev/null)
            local stage=$(jq -r '.stage // "N/A"' "$logfile" 2>/dev/null)
            local details=$(jq -r '.details // ""' "$logfile" 2>/dev/null)

            echo "[$iso_ts] $event"
            if [[ "$stage" != "N/A" && "$stage" != "null" ]]; then
                echo "  Stage: $stage"
            fi
            if [[ -n "$details" && "$details" != "null" ]]; then
                echo "  Details: $details"
            fi
        else
            cat "$logfile"
        fi
    done

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Get audit statistics
# Usage: audit_stats
# Returns: JSON with audit statistics
audit_stats() {
    if [[ ! -d "$AUDIT_DB_DIR" ]]; then
        cat <<EOF
{
    "enabled": $AUDIT_ENABLED,
    "total_logs": 0,
    "database_path": "$AUDIT_DB_DIR",
    "error": "Audit database not found"
}
EOF
        return 0
    fi

    local total_logs=$(find "$AUDIT_DB_DIR" -type f -name "*.json" | wc -l)
    local total_size=$(du -sh "$AUDIT_DB_DIR" 2>/dev/null | cut -f1)

    # Count by event type
    local pipeline_starts=$(grep -r "\"event_type\": \"pipeline_start\"" "$AUDIT_DB_DIR" 2>/dev/null | wc -l)
    local pipeline_completes=$(grep -r "\"event_type\": \"pipeline_complete\"" "$AUDIT_DB_DIR" 2>/dev/null | wc -l)
    local pipeline_failures=$(grep -r "\"event_type\": \"pipeline_failure\"" "$AUDIT_DB_DIR" 2>/dev/null | wc -l)
    local pipeline_cancelled=$(grep -r "\"event_type\": \"pipeline_cancelled\"" "$AUDIT_DB_DIR" 2>/dev/null | wc -l)

    cat <<EOF
{
    "enabled": $AUDIT_ENABLED,
    "total_logs": $total_logs,
    "total_size": "$total_size",
    "database_path": "$AUDIT_DB_DIR",
    "pipelines": {
        "started": $pipeline_starts,
        "completed": $pipeline_completes,
        "failed": $pipeline_failures,
        "cancelled": $pipeline_cancelled
    }
}
EOF
}

# Enable audit logging
# Usage: audit_enable
audit_enable() {
    export AUDIT_ENABLED=true
    echo "Audit logging enabled" >&2
}

# Disable audit logging
# Usage: audit_disable
audit_disable() {
    export AUDIT_ENABLED=false
    echo "Audit logging disabled" >&2
}

# Clean old audit logs
# Usage: audit_clean_older_than days
audit_clean_older_than() {
    local days="$1"

    if [[ -z "$days" ]]; then
        echo "Error: audit_clean_older_than requires days parameter" >&2
        return 1
    fi

    local cutoff_timestamp=$(($(date +%s) - (days * 86400)))
    local removed_count=0

    find "$AUDIT_DB_DIR" -type f -name "*.json" | while read -r logfile; do
        local filename=$(basename "$logfile")
        local log_timestamp="${filename%%.*}"

        if [[ "$log_timestamp" =~ ^[0-9]+$ ]] && [[ "$log_timestamp" -lt "$cutoff_timestamp" ]]; then
            rm "$logfile"
            ((removed_count++))
        fi
    done

    echo "Removed $removed_count audit logs older than $days days" >&2
}

# Initialize on source
audit_init

# Export functions
export -f audit_init
export -f audit_log
export -f audit_pipeline_start
export -f audit_pipeline_complete
export -f audit_pipeline_failure
export -f audit_pipeline_cancelled
export -f audit_tas_action
export -f audit_query_range
export -f audit_query_type
export -f audit_query_pipeline
export -f audit_recent
export -f audit_show
export -f audit_show_pipeline
export -f audit_stats
export -f audit_enable
export -f audit_disable
export -f audit_clean_older_than
