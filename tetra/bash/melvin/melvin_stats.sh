#!/usr/bin/env bash

# MELVIN Stats - Usage Tracking and Refresh Logic
# Tracks queries and determines when to refresh knowledge

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

MELVIN_STATS_FILE="$MELVIN_DIR/stats.jsonl"
MELVIN_REFRESH_FILE="$MELVIN_DIR/last_refresh.txt"

# Log a query
# Usage: melvin_log_query <query> <hit|miss>
melvin_log_query() {
    local query="$1"
    local result="${2:-hit}"  # hit or miss

    mkdir -p "$MELVIN_DIR"

    # JSONL format
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local session_id=$$

    printf '{"timestamp":"%s","session_id":"%s","query":"%s","result":"%s"}\n' \
        "$timestamp" "$session_id" "$query" "$result" >> "$MELVIN_STATS_FILE"
}

# Get stats summary
# Usage: melvin_stats_summary
melvin_stats_summary() {
    if [[ ! -f "$MELVIN_STATS_FILE" ]]; then
        echo "No usage statistics available."
        return 0
    fi

    local total=$(wc -l < "$MELVIN_STATS_FILE" | tr -d ' ')
    local hits=$(grep -c '"result":"hit"' "$MELVIN_STATS_FILE" 2>/dev/null || echo "0")
    local misses=$(grep -c '"result":"miss"' "$MELVIN_STATS_FILE" 2>/dev/null || echo "0")

    local hit_rate=0
    if [[ $total -gt 0 ]]; then
        hit_rate=$(awk "BEGIN {printf \"%.1f\", ($hits / $total) * 100}")
    fi

    echo "MELVIN Usage Statistics"
    echo "======================="
    echo "Total queries: $total"
    echo "Hits: $hits"
    echo "Misses: $misses"
    echo "Hit rate: ${hit_rate}%"

    # Last refresh
    if [[ -f "$MELVIN_REFRESH_FILE" ]]; then
        local last_refresh=$(cat "$MELVIN_REFRESH_FILE")
        echo "Last refresh: $last_refresh"

        # Days since refresh
        if command -v date >/dev/null 2>&1; then
            local refresh_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_refresh" +%s 2>/dev/null || echo "0")
            local now_epoch=$(date +%s)
            local days_ago=$(( (now_epoch - refresh_epoch) / 86400 ))
            echo "Days since refresh: $days_ago"
        fi
    else
        echo "Last refresh: Never"
    fi
}

# Get popular queries
# Usage: melvin_stats_popular [N]
melvin_stats_popular() {
    local limit="${1:-10}"

    if [[ ! -f "$MELVIN_STATS_FILE" ]]; then
        echo "No usage statistics available."
        return 0
    fi

    echo "Popular Queries (Top $limit)"
    echo "============================"

    # Extract queries and count
    grep -o '"query":"[^"]*"' "$MELVIN_STATS_FILE" 2>/dev/null | \
        cut -d'"' -f4 | \
        sort | uniq -c | sort -rn | head -n "$limit" | \
        awk '{printf "  %3d  %s\n", $1, substr($0, index($0,$2))}'
}

# Check if refresh is needed
# Usage: melvin_needs_refresh
# Returns: 0 if refresh needed, 1 if not
melvin_needs_refresh() {
    # Refresh if never refreshed
    if [[ ! -f "$MELVIN_REFRESH_FILE" ]]; then
        return 0
    fi

    # Get days since last refresh
    local last_refresh=$(cat "$MELVIN_REFRESH_FILE")
    local refresh_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_refresh" +%s 2>/dev/null || echo "0")
    local now_epoch=$(date +%s)
    local days_ago=$(( (now_epoch - refresh_epoch) / 86400 ))

    # Refresh if > 7 days
    if [[ $days_ago -gt 7 ]]; then
        return 0
    fi

    # Check miss rate if we have enough queries
    if [[ -f "$MELVIN_STATS_FILE" ]]; then
        local total=$(wc -l < "$MELVIN_STATS_FILE" | tr -d ' ')

        if [[ $total -gt 20 ]]; then
            local misses=$(grep -c '"result":"miss"' "$MELVIN_STATS_FILE" 2>/dev/null || echo "0")
            local miss_rate=$(awk "BEGIN {printf \"%.0f\", ($misses / $total) * 100}")

            # Refresh if miss rate > 20%
            if [[ $miss_rate -gt 20 ]]; then
                return 0
            fi
        fi
    fi

    # No refresh needed
    return 1
}

# Mark refresh timestamp
# Usage: melvin_mark_refresh
melvin_mark_refresh() {
    mkdir -p "$MELVIN_DIR"
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$MELVIN_REFRESH_FILE"
}

# Get staleness score (0-100)
# Usage: melvin_staleness_score
melvin_staleness_score() {
    if [[ ! -f "$MELVIN_REFRESH_FILE" ]]; then
        echo "100"
        return
    fi

    local last_refresh=$(cat "$MELVIN_REFRESH_FILE")
    local refresh_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_refresh" +%s 2>/dev/null || echo "0")
    local now_epoch=$(date +%s)
    local days_ago=$(( (now_epoch - refresh_epoch) / 86400 ))

    # Score: 0 = fresh, 100 = very stale
    # Linear scale: 0 days = 0, 14 days = 100
    local score=$(awk "BEGIN {printf \"%.0f\", ($days_ago / 14.0) * 100}")

    # Cap at 100
    [[ $score -gt 100 ]] && score=100

    echo "$score"
}

# Full stats report
# Usage: melvin_stats_report
melvin_stats_report() {
    melvin_stats_summary
    echo ""

    melvin_stats_popular 5
    echo ""

    local staleness=$(melvin_staleness_score)
    echo "Staleness Score: ${staleness}/100"

    if melvin_needs_refresh; then
        echo ""
        echo "⚠ MELVIN recommends a knowledge refresh"
        echo "  Run: refresh"
    fi
}

# Export functions
export -f melvin_log_query
export -f melvin_stats_summary
export -f melvin_stats_popular
export -f melvin_needs_refresh
export -f melvin_mark_refresh
export -f melvin_staleness_score
export -f melvin_stats_report
