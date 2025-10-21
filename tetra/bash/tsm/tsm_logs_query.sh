#!/usr/bin/env bash

# TSM Logs Query Interface - TCS 4.0 Compliant
# Query and analyze TSM logs from unified logging system

# Ensure unified logging and TSM logging are loaded
if ! type tetra_log_query_module >/dev/null 2>&1; then
    source "${TETRA_SRC}/bash/utils/unified_log.sh"
fi

if ! type tsm_log_query >/dev/null 2>&1; then
    TSM_DIR="${TSM_DIR:-${TETRA_SRC}/bash/tsm}"
    source "$TSM_DIR/tsm_log.sh"
fi

# === QUERY COMMANDS ===

# Query all TSM events
tsm_logs_events() {
    local format="${1:-table}"  # table, json, raw

    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    case "$format" in
        json)
            tsm_log_query | jq '.'
            ;;
        raw)
            tsm_log_query
            ;;
        table|*)
            echo "TSM Event Log"
            echo "─────────────────────────────────────────────────────────────────────"
            printf "%-20s %-10s %-20s %-10s %-10s\n" "TIMESTAMP" "VERB" "SUBJECT" "STATUS" "LEVEL"
            echo "─────────────────────────────────────────────────────────────────────"

            tsm_log_query | jq -r '[.timestamp, .verb, .subject, .status, .level] | @tsv' | \
            while IFS=$'\t' read -r ts verb subject status level; do
                # Format timestamp for display
                local display_ts=$(echo "$ts" | cut -c12-19)  # HH:MM:SS
                printf "%-20s %-10s %-20s %-10s %-10s\n" "$display_ts" "$verb" "$subject" "$status" "$level"
            done
            ;;
    esac
}

# Query process lifecycle events (start/stop/restart)
tsm_logs_lifecycle() {
    local format="${1:-table}"

    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    case "$format" in
        json)
            tsm_log_query_lifecycle | jq '.'
            ;;
        raw)
            tsm_log_query_lifecycle
            ;;
        table|*)
            echo "TSM Process Lifecycle Events"
            echo "─────────────────────────────────────────────────────────────────────"
            printf "%-20s %-10s %-20s %-10s %-10s\n" "TIMESTAMP" "ACTION" "PROCESS" "STATUS" "PID"
            echo "─────────────────────────────────────────────────────────────────────"

            tsm_log_query_lifecycle | jq -r '[.timestamp, .verb, .subject, .status, (.metadata.pid // "N/A")] | @tsv' | \
            while IFS=$'\t' read -r ts verb subject status pid; do
                local display_ts=$(echo "$ts" | cut -c12-19)
                printf "%-20s %-10s %-20s %-10s %-10s\n" "$display_ts" "$verb" "$subject" "$status" "$pid"
            done
            ;;
    esac
}

# Query errors and failures
tsm_logs_errors() {
    local format="${1:-table}"

    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    case "$format" in
        json)
            tsm_log_query_errors | jq '.'
            ;;
        raw)
            tsm_log_query_errors
            ;;
        table|*)
            echo "TSM Errors and Failures"
            echo "─────────────────────────────────────────────────────────────────────"
            printf "%-20s %-10s %-20s %-30s\n" "TIMESTAMP" "VERB" "SUBJECT" "ERROR"
            echo "─────────────────────────────────────────────────────────────────────"

            tsm_log_query_errors | jq -r '[.timestamp, .verb, .subject, (.metadata.error // "N/A")] | @tsv' | \
            while IFS=$'\t' read -r ts verb subject error; do
                local display_ts=$(echo "$ts" | cut -c12-19)
                # Truncate error if too long
                error=$(echo "$error" | cut -c1-30)
                printf "%-20s %-10s %-20s %-30s\n" "$display_ts" "$verb" "$subject" "$error"
            done
            ;;
    esac
}

# Query logs for a specific process
tsm_logs_process() {
    local process_name="$1"
    local format="${2:-table}"

    if [[ -z "$process_name" ]]; then
        echo "Usage: tsm logs process <process_name> [format]"
        return 64
    fi

    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    case "$format" in
        json)
            tsm_log_query_process "$process_name" | jq '.'
            ;;
        raw)
            tsm_log_query_process "$process_name"
            ;;
        table|*)
            echo "Events for Process: $process_name"
            echo "─────────────────────────────────────────────────────────────────────"
            printf "%-20s %-10s %-10s %-10s %-30s\n" "TIMESTAMP" "VERB" "STATUS" "LEVEL" "METADATA"
            echo "─────────────────────────────────────────────────────────────────────"

            tsm_log_query_process "$process_name" | jq -r '[.timestamp, .verb, .status, .level, (.metadata | tostring)] | @tsv' | \
            while IFS=$'\t' read -r ts verb status level metadata; do
                local display_ts=$(echo "$ts" | cut -c12-19)
                metadata=$(echo "$metadata" | cut -c1-30)
                printf "%-20s %-10s %-10s %-10s %-30s\n" "$display_ts" "$verb" "$status" "$level" "$metadata"
            done
            ;;
    esac
}

# Query logs by time range
tsm_logs_range() {
    local start_time="$1"
    local end_time="$2"
    local format="${3:-table}"

    if [[ -z "$start_time" ]] || [[ -z "$end_time" ]]; then
        echo "Usage: tsm logs range <start_time> <end_time> [format]"
        echo "Time format: ISO 8601 (e.g., 2025-10-18T12:00:00Z)"
        return 64
    fi

    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    case "$format" in
        json)
            tetra_log_query_range "$start_time" "$end_time" | jq 'select(.module == "tsm") | .'
            ;;
        raw)
            tetra_log_query_range "$start_time" "$end_time" | jq -c 'select(.module == "tsm")'
            ;;
        table|*)
            echo "TSM Events: $start_time to $end_time"
            echo "─────────────────────────────────────────────────────────────────────"
            printf "%-20s %-10s %-20s %-10s\n" "TIMESTAMP" "VERB" "SUBJECT" "STATUS"
            echo "─────────────────────────────────────────────────────────────────────"

            tetra_log_query_range "$start_time" "$end_time" | jq -c 'select(.module == "tsm")' | \
            jq -r '[.timestamp, .verb, .subject, .status] | @tsv' | \
            while IFS=$'\t' read -r ts verb subject status; do
                local display_ts=$(echo "$ts" | cut -c12-19)
                printf "%-20s %-10s %-20s %-10s\n" "$display_ts" "$verb" "$subject" "$status"
            done
            ;;
    esac
}

# === ANALYTICS ===

# Show TSM statistics
tsm_logs_stats() {
    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    echo "=== TSM Logging Statistics ==="
    echo ""

    local total_events=$(tsm_log_query | wc -l | tr -d ' ')
    echo "Total TSM Events: $total_events"

    echo ""
    echo "Events by Action:"
    tsm_log_query | jq -r '.verb' | sort | uniq -c | sort -rn | \
    while read count verb; do
        printf "  %-15s: %d\n" "$verb" "$count"
    done

    echo ""
    echo "Events by Status:"
    tsm_log_query | jq -r '.status' | sort | uniq -c | sort -rn | \
    while read count status; do
        printf "  %-15s: %d\n" "$status" "$count"
    done

    echo ""
    echo "Events by Level:"
    tsm_log_query | jq -r '.level' | sort | uniq -c | sort -rn | \
    while read count level; do
        printf "  %-15s: %d\n" "$level" "$count"
    done

    echo ""
    echo "Top 10 Processes:"
    tsm_log_query | jq -r '.subject' | sort | uniq -c | sort -rn | head -10 | \
    while read count subject; do
        printf "  %-20s: %d events\n" "$subject" "$count"
    done

    echo ""
    local error_count=$(tsm_log_query_errors | wc -l | tr -d ' ')
    echo "Total Errors/Failures: $error_count"

    if [[ $error_count -gt 0 ]]; then
        echo ""
        echo "Recent Errors (last 5):"
        tsm_log_query_errors | tail -5 | jq -r '[.timestamp, .verb, .subject, (.metadata.error // "N/A")] | @tsv' | \
        while IFS=$'\t' read -r ts verb subject error; do
            local display_ts=$(echo "$ts" | cut -c12-19)
            printf "  [%s] %s:%s - %s\n" "$display_ts" "$verb" "$subject" "$error"
        done
    fi
}

# Show process activity timeline
tsm_logs_timeline() {
    local process_name="${1:-}"
    local hours="${2:-1}"

    if [[ ! -f "$TETRA_LOG_FILE" ]]; then
        echo "No log file found at: $TETRA_LOG_FILE"
        return 1
    fi

    # Calculate time range
    local end_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local start_time=$(date -u -v-${hours}H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "${hours} hours ago" +"%Y-%m-%dT%H:%M:%SZ")

    echo "=== TSM Activity Timeline (last ${hours}h) ==="
    echo ""

    if [[ -n "$process_name" ]]; then
        echo "Process: $process_name"
        tsm_log_query_process "$process_name" | \
        tetra_log_query_range "$start_time" "$end_time" | \
        jq -r '[.timestamp, .verb, .status, (.metadata.pid // "")] | @tsv' | \
        while IFS=$'\t' read -r ts verb status pid; do
            local display_ts=$(echo "$ts" | cut -c1-19 | tr 'T' ' ')
            local pid_display=""
            [[ -n "$pid" ]] && pid_display=" (PID: $pid)"
            printf "[%s] %s -> %s%s\n" "$display_ts" "$verb" "$status" "$pid_display"
        done
    else
        tetra_log_query_range "$start_time" "$end_time" | jq -c 'select(.module == "tsm")' | \
        jq -r '[.timestamp, .verb, .subject, .status] | @tsv' | \
        while IFS=$'\t' read -r ts verb subject status; do
            local display_ts=$(echo "$ts" | cut -c1-19 | tr 'T' ' ')
            printf "[%s] %s:%s -> %s\n" "$display_ts" "$verb" "$subject" "$status"
        done
    fi
}

# === COMBINED LOGS (events + process output) ===

# Show combined view: events from unified log + process stdout/stderr
tsm_logs_combined() {
    local process_name="$1"
    local lines="${2:-50}"

    if [[ -z "$process_name" ]]; then
        echo "Usage: tsm logs combined <process_name> [lines]"
        return 64
    fi

    echo "=== Combined Logs for: $process_name ==="
    echo ""

    # Show event log
    echo "Event Log (from unified logging):"
    echo "─────────────────────────────────────────────────────────────────────"
    tsm_logs_process "$process_name" table 2>/dev/null || echo "  No events found"

    echo ""
    echo "Process Output (last $lines lines):"
    echo "─────────────────────────────────────────────────────────────────────"

    # Show process stdout
    local stdout_file="$TSM_LOGS_DIR/$process_name.out"
    if [[ -f "$stdout_file" ]]; then
        echo ""
        echo "STDOUT:"
        tail -n "$lines" "$stdout_file"
    else
        echo "  No stdout log found"
    fi

    # Show process stderr
    local stderr_file="$TSM_LOGS_DIR/$process_name.err"
    if [[ -f "$stderr_file" ]] && [[ -s "$stderr_file" ]]; then
        echo ""
        echo "STDERR:"
        tail -n "$lines" "$stderr_file"
    fi
}

# === CLI INTERFACE ===

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        "events")
            tsm_logs_events "${2:-table}"
            ;;
        "lifecycle")
            tsm_logs_lifecycle "${2:-table}"
            ;;
        "errors")
            tsm_logs_errors "${2:-table}"
            ;;
        "process")
            tsm_logs_process "${2:-}" "${3:-table}"
            ;;
        "range")
            tsm_logs_range "${2:-}" "${3:-}" "${4:-table}"
            ;;
        "stats")
            tsm_logs_stats
            ;;
        "timeline")
            tsm_logs_timeline "${2:-}" "${3:-1}"
            ;;
        "combined")
            tsm_logs_combined "${2:-}" "${3:-50}"
            ;;
        *)
            echo "TSM Logs Query Interface - TCS 4.0"
            echo ""
            echo "Usage: tsm logs <command> [options]"
            echo ""
            echo "Commands:"
            echo "  events [format]                Show all TSM events"
            echo "  lifecycle [format]             Show process lifecycle events (start/stop/restart)"
            echo "  errors [format]                Show errors and failures"
            echo "  process <name> [format]        Show logs for specific process"
            echo "  range <start> <end> [format]   Show logs in time range (ISO 8601)"
            echo "  stats                          Show TSM logging statistics"
            echo "  timeline [process] [hours]     Show activity timeline"
            echo "  combined <process> [lines]     Show combined event + output logs"
            echo ""
            echo "Formats: table (default), json, raw"
            echo ""
            echo "Examples:"
            echo "  tsm logs events                # All TSM events in table format"
            echo "  tsm logs lifecycle json        # Lifecycle events as JSON"
            echo "  tsm logs process devpages      # All events for devpages process"
            echo "  tsm logs errors                # Show all errors"
            echo "  tsm logs stats                 # Statistics summary"
            echo "  tsm logs timeline devpages 2   # Timeline for devpages (last 2 hours)"
            echo "  tsm logs combined devpages 100 # Events + last 100 lines of output"
            ;;
    esac
fi
