#!/usr/bin/env bash
# evidence_add_enhanced.sh - Enhanced evidence addition with semantic metadata
#
# Requires bash 5.2+

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source dependencies
source "$RAG_SRC/core/evidence_metadata.sh"
source "$RAG_SRC/core/flow_manager_ttm.sh" 2>/dev/null || source "$RAG_SRC/core/flow_manager.sh"

# Compute digest for file
compute_digest_for_file() {
    local file="$1"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        echo "unknown"
    fi
}

# Enhanced evidence add with full metadata support
evidence_add_enhanced() {
    local selector="$1"
    shift

    # Parse options
    local evidence_type="context_definition"
    local relevance="medium"
    local justification=""
    local tags=""
    local relates_to=""
    local context_note=""
    local custom_rank=""
    local mode="copy"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type|-t)
                evidence_type="$2"
                shift 2
                ;;
            --why|-w)
                justification="$2"
                shift 2
                ;;
            --tags)
                tags="$2"
                shift 2
                ;;
            --relates)
                relates_to="$2"
                shift 2
                ;;
            --relevance|-r)
                relevance="$2"
                shift 2
                ;;
            --note|-n)
                context_note="$2"
                shift 2
                ;;
            --rank)
                custom_rank="$2"
                shift 2
                ;;
            --symlink|-l)
                mode="symlink"
                shift
                ;;
            *)
                echo "Unknown option: $1" >&2
                return 1
                ;;
        esac
    done

    # Validate inputs
    if [[ -z "$selector" ]]; then
        echo "Error: Selector required" >&2
        echo "Usage: /e add <file[::range][#tags]> [options]" >&2
        echo "" >&2
        echo "Options:" >&2
        echo "  --type, -t <type>           Evidence type (default: context_definition)" >&2
        echo "  --why, -w <text>            Justification for inclusion" >&2
        echo "  --tags <tag1,tag2>          Semantic tags" >&2
        echo "  --relates <id1,id2>         Related evidence IDs" >&2
        echo "  --relevance, -r <level>     Importance (high/medium/low)" >&2
        echo "  --note, -n <text>           Additional context note" >&2
        echo "  --rank <number>             Custom rank" >&2
        echo "  --symlink, -l               Create symlink instead of copy" >&2
        echo "" >&2
        echo "Examples:" >&2
        echo "  /e add core/flow.sh::145,165 --type bug_investigation --why \"Shows auth bypass\"" >&2
        echo "  /e add tests/auth.sh --type test_specification --tags auth,test --relates 100" >&2
        return 1
    fi

    # Validate evidence type
    if [[ ! -v EVIDENCE_TYPES[$evidence_type] ]]; then
        echo "Error: Invalid evidence type: $evidence_type" >&2
        echo "Valid types: ${!EVIDENCE_TYPES[@]}" >&2
        return 1
    fi

    # Validate relevance
    if [[ ! -v RELEVANCE_LEVELS[$relevance] ]]; then
        echo "Error: Invalid relevance level: $relevance" >&2
        echo "Valid levels: ${!RELEVANCE_LEVELS[@]}" >&2
        return 1
    fi

    # Get active flow
    local flow_dir
    flow_dir="$(get_active_flow_dir)"
    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"
    mkdir -p "$evidence_dir"

    # Parse selector: file[::range][#tags]
    local file_path="" range="" selector_tags=""

    # Extract tags from selector (anything after #)
    if [[ "$selector" =~ ^([^#]+)#(.+)$ ]]; then
        selector="${BASH_REMATCH[1]}"
        selector_tags="${BASH_REMATCH[2]}"
        # Merge with --tags if provided
        if [[ -n "$tags" ]]; then
            tags="$tags,$selector_tags"
        else
            tags="$selector_tags"
        fi
    fi

    # Extract range (anything after ::)
    if [[ "$selector" =~ ^([^:]+)::(.+)$ ]]; then
        file_path="${BASH_REMATCH[1]}"
        range="${BASH_REMATCH[2]}"
    else
        file_path="$selector"
    fi

    # Validate file exists
    if [[ ! -f "$file_path" ]]; then
        echo "Error: File not found: $file_path" >&2
        return 1
    fi

    # Determine rank
    local rank=100
    if [[ -n "$custom_rank" ]]; then
        rank="$custom_rank"
    else
        # Find highest existing rank
        for existing in "$evidence_dir"/*.evidence.md; do
            [[ -f "$existing" ]] || continue
            local existing_rank=$(basename "$existing" | cut -d'_' -f1)
            if [[ "$existing_rank" =~ ^[0-9]+$ ]] && [[ $existing_rank -ge $rank ]]; then
                rank=$((existing_rank + 10))
            fi
        done
    fi

    # Create evidence filename (sanitize file path for name)
    local basename=$(basename "$file_path")
    local kind=$(echo "$basename" | tr '.' '_' | tr '[:upper:]' '[:lower:]' | sed 's/__*/_/g')

    # Add type hint to filename for clarity
    local type_hint=$(echo "$evidence_type" | cut -d'_' -f1)
    local evidence_file="$evidence_dir/${rank}_${kind}.evidence.md"

    # Symlink mode
    if [[ "$mode" == "symlink" ]]; then
        local abs_path="$(cd "$(dirname "$file_path")" && pwd)/$(basename "$file_path")"
        local link_file="$evidence_dir/${rank}_${kind}.evidence.link"
        ln -sf "$abs_path" "$link_file"

        echo "✓ Linked evidence: ${rank}_${kind}.evidence.link"
        echo "  → $abs_path"
        [[ -n "$tags" ]] && echo "  Tags: $tags"

        # Log event
        if [[ -f "$flow_dir/events.ndjson" ]]; then
            echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"evidence_linked\",\"file\":\"$file_path\",\"type\":\"$evidence_type\",\"tags\":\"$tags\"}" \
                >> "$flow_dir/events.ndjson"
        fi

        return 0
    fi

    # Extract content based on range
    local content=""
    local span_info="full"

    if [[ -n "$range" ]]; then
        local start="" end="" char_mode=false

        if [[ "$range" =~ ^([0-9]+)c?,?([0-9]*)c?$ ]]; then
            start="${BASH_REMATCH[1]}"
            end="${BASH_REMATCH[2]}"
            [[ "$range" =~ c ]] && char_mode=true
        else
            echo "Error: Invalid range format: $range" >&2
            echo "Expected: start[,end] or startc,endc" >&2
            return 1
        fi

        if [[ "$char_mode" == true ]]; then
            if [[ -n "$end" ]]; then
                local length=$((end - start))
                content=$(dd if="$file_path" bs=1 skip="$start" count="$length" 2>/dev/null)
                span_info="bytes=${start}:${end}"
            else
                content=$(dd if="$file_path" bs=1 skip="$start" 2>/dev/null)
                span_info="bytes=${start}:EOF"
            fi
        else
            if [[ -n "$end" ]]; then
                content=$(sed -n "${start},${end}p" "$file_path")
                span_info="lines=${start}:${end}"
            else
                content=$(sed -n "${start},\$p" "$file_path")
                span_info="lines=${start}:EOF"
            fi
        fi
    else
        content=$(cat "$file_path")
        span_info="full"
    fi

    # Compute content digest
    local content_digest="sha256:$(compute_digest_for_file "$file_path")"

    # Get absolute path for source_uri
    local abs_file_path="$(cd "$(dirname "$file_path")" && pwd)/$(basename "$file_path")"

    # Build evidence file with enhanced metadata
    local ext="${file_path##*.}"
    {
        # Header
        echo "## Evidence: $file_path"
        echo ""

        # Enhanced metadata block
        cat <<METADATA
<!--evidence
evidence_id: $rank
evidence_type: $evidence_type
source_uri: file://$abs_file_path
span: $span_info
content_digest: $content_digest
relevance: $relevance
tags: [$tags]
relates_to: [$relates_to]
justification: |
  $justification
METADATA

        # Add context note if provided
        if [[ -n "$context_note" ]]; then
            cat <<CONTEXT_NOTE
context_note: |
  $context_note
CONTEXT_NOTE
        fi

        # Timestamp
        echo "added: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        echo "-->"
        echo ""

        # Content with syntax highlighting
        case "$ext" in
            sh|bash|js|ts|tsx|jsx|py|go|rs|c|cpp|h|java|rb|php|json|yaml|yml|toml|xml|html|css|scss|md)
                echo '```'"$ext"
                echo "$content"
                echo '```'
                ;;
            *)
                echo "$content"
                ;;
        esac

        # Optional context note section at bottom
        if [[ -n "$context_note" ]]; then
            echo ""
            echo "### Context Note"
            echo ""
            echo "$context_note"
        fi

    } > "$evidence_file"

    # Success feedback
    echo "✓ Added evidence: ${rank}_${kind}.evidence.md"
    echo "  Type: $evidence_type"
    echo "  Relevance: $relevance"
    [[ -n "$range" ]] && echo "  Span: $span_info"
    [[ -n "$tags" ]] && echo "  Tags: $tags"
    [[ -n "$relates_to" ]] && echo "  Relates to: $relates_to"
    [[ -n "$justification" ]] && echo "  Why: ${justification:0:60}..."

    # Calculate size
    local file_bytes=$(wc -c < "$evidence_file")
    local file_tokens=$((file_bytes / 4))
    echo "  Size: $file_bytes bytes (~$file_tokens tokens)"

    # Log event
    if [[ -f "$flow_dir/events.ndjson" ]]; then
        local event_json=$(cat <<EVENT_JSON
{"ts":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","event":"evidence_added","file":"$file_path","span":"$span_info","type":"$evidence_type","relevance":"$relevance","tags":"$tags","relates_to":"$relates_to","bytes":$file_bytes}
EVENT_JSON
)
        echo "$event_json" >> "$flow_dir/events.ndjson"
    fi

    # Clear stats cache
    rm -f "$evidence_dir/.stats.cache" 2>/dev/null

    return 0
}

# Export functions
export -f evidence_add_enhanced
export -f compute_digest_for_file
