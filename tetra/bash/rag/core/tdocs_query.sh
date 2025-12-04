#!/usr/bin/env bash
# tdocs_query.sh - RAG integration for querying TDOCS documentation
# RAG reads from TDOCS (read-only) to find relevant reference documentation

: "${TDOCS_SRC:=$TETRA_SRC/bash/tdocs}"

# Check if TDOCS is available
_rag_tdocs_available() {
    [[ -f "$TDOCS_SRC/tdocs.sh" ]] && command -v tdoc_evidence_for_query >/dev/null 2>&1
}

# Query TDOCS for relevant documentation
# Args: query [--primary]
rag_query_tdocs() {
    local query="$1"
    shift

    if ! _rag_tdocs_available; then
        echo "TDOCS not available - skipping documentation query" >&2
        return 1
    fi

    # Source TDOCS if not already loaded
    if ! command -v tdoc_evidence_for_query >/dev/null 2>&1; then
        source "$TDOCS_SRC/tdocs.sh" 2>/dev/null || {
            echo "Failed to load TDOCS" >&2
            return 1
        }
    fi

    # Query TDOCS for relevant documentation
    tdoc_evidence_for_query "$query" "$@" 2>/dev/null
}

# List TDOCS docs matching query (simplified output, just paths)
rag_list_tdocs() {
    local query="$1"
    shift

    rag_query_tdocs "$query" "$@" | awk '{print $2}'
}

# Show TDOCS docs matching query with context
rag_show_tdocs() {
    local query="$1"
    local max_results="${2:-5}"

    if ! _rag_tdocs_available; then
        echo "TDOCS not available"
        return 1
    fi

    echo "Reference Documentation for: \"$query\""
    echo "════════════════════════════════════════════════════════"
    echo ""

    local count=0
    rag_query_tdocs "$query" | head -n "$max_results" | while IFS= read -r line; do
        ((count++))
        local weight=$(echo "$line" | awk '{print $1}')
        local path=$(echo "$line" | awk '{print $2}')
        local category=$(echo "$line" | awk -F'[\\[\\]]' '{print $2}')
        local tags=$(echo "$line" | awk -F'[\\[\\]]' '{print $4}')

        printf "%d. [%.1f] %s\n" "$count" "$weight" "$path"
        printf "   %s  %s\n" "$category" "$tags"
        echo ""
    done

    echo "Tip: Use 'cat <path>' to view, or '/e add <path>' to add as evidence"
}

# Helper: Suggest TDOCS docs for current flow description
rag_suggest_tdocs() {
    local flow_id="${1:-}"

    if [[ -z "$flow_id" ]]; then
        flow_id=$(flow_active)
    fi

    if [[ -z "$flow_id" ]]; then
        echo "No active flow" >&2
        return 1
    fi

    local state=$(txn_state "$flow_id")
    if [[ -z "$state" ]]; then
        echo "Could not get flow state" >&2
        return 1
    fi

    local description=$(echo "$state" | jq -r '.description')

    echo "Suggested documentation for: \"$description\""
    echo ""

    rag_show_tdocs "$description" 5
}

# Export functions
export -f rag_query_tdocs
export -f rag_list_tdocs
export -f rag_show_tdocs
export -f rag_suggest_tdocs
