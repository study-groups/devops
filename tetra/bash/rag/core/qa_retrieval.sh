#!/usr/bin/env bash
# qa_retrieval.sh - QA database retrieval and evidence integration for RAG
# Enables RAG to search and use historical QA interactions as evidence

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${QA_DIR:=$TETRA_DIR/qa}"
: "${QA_DB_DIR:=$QA_DIR/db}"

# Search QA database for relevant Q&A pairs
# Usage: qa_retrieval_search <query>
# Returns: List of QA IDs with relevance scores
qa_retrieval_search() {
    local query="$1"

    if [[ -z "$query" ]]; then
        echo "Error: Search query required" >&2
        return 1
    fi

    if [[ ! -d "$QA_DB_DIR" ]]; then
        echo "Error: QA database not found at $QA_DB_DIR" >&2
        return 1
    fi

    echo "Searching QA history for: $query" >&2
    echo "" >&2

    # Search through prompts and answers
    local results=()
    local count=0

    for prompt_file in "$QA_DB_DIR"/*.prompt; do
        [[ ! -f "$prompt_file" ]] && continue

        local qa_id=$(basename "$prompt_file" .prompt)
        local answer_file="$QA_DB_DIR/$qa_id.answer"
        local metadata_file="$QA_DB_DIR/$qa_id.metadata.json"

        # Search in prompt
        local prompt_match=false
        if grep -qi "$query" "$prompt_file" 2>/dev/null; then
            prompt_match=true
        fi

        # Search in answer
        local answer_match=false
        if [[ -f "$answer_file" ]] && grep -qi "$query" "$answer_file" 2>/dev/null; then
            answer_match=true
        fi

        # If matched, add to results
        if [[ "$prompt_match" == true ]] || [[ "$answer_match" == true ]]; then
            local score=1
            [[ "$prompt_match" == true ]] && ((score++))
            [[ "$answer_match" == true ]] && ((score++))

            # Get metadata if available
            local flow_id=""
            local created=""
            if [[ -f "$metadata_file" ]]; then
                flow_id=$(jq -r '.flow_id // empty' "$metadata_file" 2>/dev/null)
                created=$(jq -r '.created // empty' "$metadata_file" 2>/dev/null)
            fi

            # Output: score|qa_id|flow_id|created
            echo "$score|$qa_id|$flow_id|$created"
            ((count++))
        fi
    done | sort -t'|' -k1 -rn

    if [[ $count -eq 0 ]]; then
        echo "No results found" >&2
        return 1
    fi

    echo "" >&2
    echo "Found $count result(s)" >&2
}

# List QA entries with preview
# Usage: qa_retrieval_list [--limit N] [--flow flow-id]
qa_retrieval_list() {
    local limit=""
    local filter_flow=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --limit|-n)
                limit="$2"
                shift 2
                ;;
            --flow)
                filter_flow="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    if [[ ! -d "$QA_DB_DIR" ]]; then
        echo "Error: QA database not found at $QA_DB_DIR" >&2
        return 1
    fi

    local count=0
    local displayed=0

    # List by timestamp (newest first)
    for prompt_file in $(ls -t "$QA_DB_DIR"/*.prompt 2>/dev/null); do
        [[ ! -f "$prompt_file" ]] && continue

        local qa_id=$(basename "$prompt_file" .prompt)
        local metadata_file="$QA_DB_DIR/$qa_id.metadata.json"

        # Apply flow filter
        if [[ -n "$filter_flow" ]]; then
            if [[ ! -f "$metadata_file" ]]; then
                continue
            fi
            local flow_id=$(jq -r '.flow_id // empty' "$metadata_file" 2>/dev/null)
            if [[ "$flow_id" != "$filter_flow" ]]; then
                continue
            fi
        fi

        # Apply limit
        if [[ -n "$limit" ]] && [[ $displayed -ge $limit ]]; then
            break
        fi

        # Display entry
        qa_retrieval_show_preview "$qa_id"
        echo ""

        ((displayed++))
    done

    if [[ $displayed -eq 0 ]]; then
        echo "No QA entries found"
        return 1
    fi
}

# Show preview of a QA entry
# Usage: qa_retrieval_show_preview <qa_id>
qa_retrieval_show_preview() {
    local qa_id="$1"

    if [[ -z "$qa_id" ]]; then
        echo "Error: QA ID required" >&2
        return 1
    fi

    local prompt_file="$QA_DB_DIR/$qa_id.prompt"
    local answer_file="$QA_DB_DIR/$qa_id.answer"
    local metadata_file="$QA_DB_DIR/$qa_id.metadata.json"

    if [[ ! -f "$prompt_file" ]]; then
        echo "Error: QA entry $qa_id not found" >&2
        return 1
    fi

    # Show metadata
    local created=$(date -r "$qa_id" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
    echo "QA ID: $qa_id ($created)"

    if [[ -f "$metadata_file" ]]; then
        local flow_id=$(jq -r '.flow_id // empty' "$metadata_file" 2>/dev/null)
        local source=$(jq -r '.source // empty' "$metadata_file" 2>/dev/null)
        [[ -n "$flow_id" ]] && echo "  Flow: $flow_id"
        [[ -n "$source" ]] && echo "  Source: $source"
    fi

    # Show prompt preview
    local prompt=$(head -3 "$prompt_file" | tr '\n' ' ')
    echo "  Prompt: ${prompt:0:80}..."

    # Show answer preview
    if [[ -f "$answer_file" ]]; then
        local answer=$(head -2 "$answer_file" | tr '\n' ' ')
        echo "  Answer: ${answer:0:80}..."
    fi
}

# Add QA entry as evidence to current flow
# Usage: qa_retrieval_add_evidence <qa_id>
qa_retrieval_add_evidence() {
    local qa_id="$1"

    if [[ -z "$qa_id" ]]; then
        echo "Error: QA ID required" >&2
        echo "Usage: qa_retrieval_add_evidence <qa_id>" >&2
        return 1
    fi

    # Get active flow
    local flow_dir=""
    if command -v get_active_flow_dir >/dev/null 2>&1; then
        flow_dir=$(get_active_flow_dir)
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local prompt_file="$QA_DB_DIR/$qa_id.prompt"
    local answer_file="$QA_DB_DIR/$qa_id.answer"
    local metadata_file="$QA_DB_DIR/$qa_id.metadata.json"

    if [[ ! -f "$prompt_file" ]]; then
        echo "Error: QA entry $qa_id not found" >&2
        return 1
    fi

    # Create evidence directory
    local evidence_dir="$flow_dir/ctx/evidence"
    mkdir -p "$evidence_dir"

    # Generate evidence file
    local evidence_file="$evidence_dir/qa_${qa_id}.evidence.md"

    # Build evidence markdown
    cat > "$evidence_file" <<EOF
# QA Evidence: $qa_id

**Source:** QA History
**Created:** $(date -r "$qa_id" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
EOF

    # Add flow link if available
    if [[ -f "$metadata_file" ]]; then
        local source_flow=$(jq -r '.flow_id // empty' "$metadata_file" 2>/dev/null)
        if [[ -n "$source_flow" ]]; then
            echo "**Original Flow:** $source_flow  " >> "$evidence_file"
        fi
    fi

    echo "" >> "$evidence_file"

    # Add prompt
    echo "## Prompt" >> "$evidence_file"
    echo "" >> "$evidence_file"
    echo '```' >> "$evidence_file"
    cat "$prompt_file" >> "$evidence_file"
    echo '```' >> "$evidence_file"
    echo "" >> "$evidence_file"

    # Add answer
    if [[ -f "$answer_file" ]]; then
        echo "## Answer" >> "$evidence_file"
        echo "" >> "$evidence_file"
        cat "$answer_file" >> "$evidence_file"
    fi

    echo "✓ Added QA evidence: $evidence_file"

    # Log event
    if [[ -f "$flow_dir/events.ndjson" ]]; then
        echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"qa_evidence_added\",\"qa_id\":\"$qa_id\"}" \
            >> "$flow_dir/events.ndjson"
    fi
}

# Export functions
export -f qa_retrieval_search
export -f qa_retrieval_list
export -f qa_retrieval_show_preview
export -f qa_retrieval_add_evidence
