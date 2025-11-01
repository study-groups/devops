#!/usr/bin/env bash

# TDOC RAG Integration
# Evidence provider for RAG queries with weighted document lists

# Get evidence-weighted document list for a RAG query
# Returns: List of documents with relevance scores
tdoc_evidence_for_query() {
    local query="$1"
    shift
    local primary_only=false
    local tag_filter=""

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --primary)
                primary_only=true
                shift
                ;;
            --tags)
                tag_filter="$2"
                shift 2
                ;;
            --help|-h)
                cat <<EOF
tdoc evidence - Get evidence-weighted documents for RAG queries

USAGE:
  tdoc evidence [OPTIONS] <query>

OPTIONS:
  --primary            Return only core (primary evidence) documents
  --tags <tags>        Filter by tags (comma-separated)

EXAMPLES:
  tdoc evidence "bash completion system"
  tdoc evidence --primary "tetra architecture"
  tdoc evidence --tags refactor,rag "repl fixes"

OUTPUT FORMAT:
  Each line: <weight> <path> <category> <type> <tags>
  Weights: 1.0 (primary/core), 0.5 (secondary), 0.2 (tertiary)

EOF
                return 0
                ;;
            *)
                shift
                ;;
        esac
    done

    if [[ -z "$query" ]]; then
        echo "Error: Query required" >&2
        return 1
    fi

    local results=()
    local -A scored_docs=()

    # Search through database
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")
        local doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)
        local category=$(echo "$meta" | grep -o '"category": "[^"]*"' | cut -d'"' -f4)
        local type=$(echo "$meta" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
        local evidence_weight=$(echo "$meta" | grep -o '"evidence_weight": "[^"]*"' | cut -d'"' -f4)
        local tags_json=$(echo "$meta" | grep -o '"tags": \[[^\]]*\]')

        # Filter by primary-only
        if [[ "$primary_only" == "true" && "$evidence_weight" != "primary" ]]; then
            continue
        fi

        # Filter by tags if specified
        if [[ -n "$tag_filter" ]]; then
            local tag_match=false
            IFS=',' read -ra filter_tags <<< "$tag_filter"
            for filter_tag in "${filter_tags[@]}"; do
                filter_tag=$(echo "$filter_tag" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
                if echo "$tags_json" | grep -q "\"$filter_tag\""; then
                    tag_match=true
                    break
                fi
            done
            [[ "$tag_match" == false ]] && continue
        fi

        # Calculate relevance score
        local score=0.0

        # Base weight from evidence_weight field
        case "$evidence_weight" in
            primary) score=1.0 ;;
            secondary) score=0.5 ;;
            tertiary) score=0.2 ;;
            *) score=0.1 ;;
        esac

        # Boost score if query matches metadata
        if echo "$meta" | grep -qi "$query"; then
            score=$(awk "BEGIN {print $score + 0.3}")
        fi

        # Boost score if query matches document content
        if [[ -f "$doc_path" ]] && grep -qi "$query" "$doc_path" 2>/dev/null; then
            score=$(awk "BEGIN {print $score + 0.2}")
        fi

        # Cap score at 1.0
        score=$(awk "BEGIN {if ($score > 1.0) print 1.0; else print $score}")

        # Store result
        scored_docs["$doc_path"]="$score|$category|$type|$tags_json"
    done

    # Sort by score (descending) and output
    for doc_path in "${!scored_docs[@]}"; do
        local info="${scored_docs[$doc_path]}"
        local score=$(echo "$info" | cut -d'|' -f1)
        local category=$(echo "$info" | cut -d'|' -f2)
        local type=$(echo "$info" | cut -d'|' -f3)
        local tags=$(echo "$info" | cut -d'|' -f4)

        printf "%.1f %s [%s/%s] %s\n" "$score" "$doc_path" "$category" "$type" "$tags"
    done | sort -rn
}

# RAG-compatible evidence list (simplified output)
tdoc_evidence_list() {
    local query="$1"
    shift

    tdoc_evidence_for_query "$query" "$@" | while read -r line; do
        # Extract just the path
        echo "$line" | awk '{print $2}'
    done
}

# Get weighted evidence for specific module
tdoc_evidence_module() {
    local module="$1"
    local query="$2"

    local results=()

    # Filter by module
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        if grep -q "\"module\": \"$module\"" "$meta_file" 2>/dev/null; then
            local meta=$(cat "$meta_file")
            local doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)

            # Check query match if provided
            if [[ -n "$query" ]]; then
                if echo "$meta" | grep -qi "$query" || \
                   ([[ -f "$doc_path" ]] && grep -qi "$query" "$doc_path" 2>/dev/null); then
                    echo "$doc_path"
                fi
            else
                echo "$doc_path"
            fi
        fi
    done
}

# Export for RAG module to use
export -f tdoc_evidence_for_query
export -f tdoc_evidence_list
export -f tdoc_evidence_module
