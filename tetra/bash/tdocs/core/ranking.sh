#!/usr/bin/env bash

# TDOCS Ranking - Simplified lifecycle-based sorting
# Sort order: C > S > W > D > X, then by date (newest first)

# Lifecycle sort priority (higher = better)
declare -gA TDOC_LIFECYCLE_PRIORITY=(
    [C]=5  # Canonical - highest
    [S]=4  # Stable
    [W]=3  # Working
    [D]=2  # Draft
    [X]=1  # Archived - lowest
)

# Get sort priority for lifecycle
tdoc_lifecycle_priority() {
    local lifecycle="${1:-W}"
    echo "${TDOC_LIFECYCLE_PRIORITY[$lifecycle]:-3}"
}

# Get sort key for a document (for use with sort)
# Format: "priority:timestamp:path" - sorts correctly with sort -t: -k1,1rn -k2,2rn
tdoc_sort_key() {
    local lifecycle="$1"
    local timestamp="$2"  # ISO date or epoch
    local path="$3"

    local priority=$(tdoc_lifecycle_priority "$lifecycle")

    # Convert ISO to epoch if needed
    if [[ "$timestamp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
        timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${timestamp%%Z*}" +%s 2>/dev/null || \
                   date -d "${timestamp%%Z*}" +%s 2>/dev/null || \
                   echo "0")
    fi

    echo "${priority}:${timestamp}:${path}"
}

# Legacy compatibility - returns simple lifecycle-based score
# Kept for any code that still calls tdoc_get_rank
tdoc_get_rank() {
    local doc_path="$1"
    local meta_file=$(tdoc_get_db_path "$doc_path" 2>/dev/null)

    if [[ -f "$meta_file" ]]; then
        local lifecycle=$(jq -r '.lifecycle // "W"' "$meta_file" 2>/dev/null)
        echo "$(tdoc_lifecycle_priority "$lifecycle").0"
    else
        echo "3.0"  # Default W priority
    fi
}

# Export functions
export -f tdoc_lifecycle_priority
export -f tdoc_sort_key
export -f tdoc_get_rank
