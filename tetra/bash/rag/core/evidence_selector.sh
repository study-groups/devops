#!/usr/bin/env bash
# evidence_selector.sh - Evidence selection using ULM for RAG module
#
# Wraps ULM ranking to create evidence files

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${TETRA_SRC:=$HOME/tetra}"

# Source flow manager for directory helpers
source "$RAG_SRC/core/flow_manager_ttm.sh"

# Select evidence using ULM query
select_evidence() {
    local query="$1"
    local flow_dir="${2:-}"
    local top_n="${3:-10}"
    local ulm_algorithm="${4:-multi_head}"

    if [[ -z "$query" ]]; then
        echo "Error: Query required" >&2
        return 1
    fi

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"
    mkdir -p "$evidence_dir"

    # Check if ULM is available
    local ulm_path="$TETRA_SRC/bash/ulm/ulm.sh"
    if [[ ! -x "$ulm_path" ]]; then
        echo "Error: ULM not found at $ulm_path" >&2
        return 1
    fi

    echo "Selecting evidence with ULM..."
    echo "Query: $query"
    echo "Top: $top_n"
    echo ""

    # Run ULM ranking
    local ulm_output
    ulm_output=$("$ulm_path" rank "$query" . --algorithm "$ulm_algorithm" --top "$top_n" 2>&1)
    local ulm_exit=$?

    if [[ $ulm_exit -ne 0 ]]; then
        echo "Error: ULM ranking failed" >&2
        echo "$ulm_output" >&2
        return 1
    fi

    # Parse ULM output and create evidence files
    local rank=100
    local count=0

    while IFS= read -r line; do
        # Skip empty lines and headers
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^(Rank|File|─) ]] && continue

        # Parse file path (assuming ULM outputs file paths)
        local file_path
        if [[ "$line" =~ ^[[:space:]]*([^[:space:]]+) ]]; then
            file_path="${BASH_REMATCH[1]}"
        else
            file_path="$line"
        fi

        # Clean up path
        file_path=$(echo "$file_path" | tr -d '\r' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

        # Skip if not a file
        [[ -f "$file_path" ]] || continue

        # Create evidence filename
        local basename=$(basename "$file_path")
        local kind=$(echo "$basename" | tr '.' '_' | tr '[:upper:]' '[:lower:]' | sed 's/__*/_/g')
        local evidence_file="$evidence_dir/${rank}_${kind}.evidence.md"

        # Check if file already exists
        if [[ -f "$evidence_file" ]]; then
            echo "Skipping (exists): $evidence_file"
            rank=$((rank + 10))
            continue
        fi

        # Create evidence file
        {
            echo "## Evidence: $file_path"
            echo "<!-- source_uri=file://$file_path; cid=sha256:$(compute_digest_for_file "$file_path"); span=full -->"
            echo ""

            # Determine file type and format appropriately
            local ext="${file_path##*.}"
            case "$ext" in
                sh|bash|js|ts|tsx|jsx|py|go|rs|c|cpp|h|java|rb|php)
                    echo '```'"$ext"
                    cat "$file_path"
                    echo '```'
                    ;;
                json|yaml|yml|toml|xml|html|css|scss|md)
                    echo '```'"$ext"
                    cat "$file_path"
                    echo '```'
                    ;;
                *)
                    # Plain text or unknown - include without fence
                    cat "$file_path"
                    ;;
            esac
        } > "$evidence_file"

        echo "Created: ${rank}_${kind}.evidence.md"
        count=$((count + 1))
        rank=$((rank + 10))

    done <<< "$ulm_output"

    echo ""
    echo "Selected $count evidence files"

    # Log event
    if [[ -f "$flow_dir/events.ndjson" ]]; then
        echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"evidence_selected\",\"query\":\"$query\",\"count\":$count}" \
            >> "$flow_dir/events.ndjson"
    fi

    return 0
}

# Compute digest helper (duplicate from assembler for independence)
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

# Select specific files as evidence
select_files_as_evidence() {
    local flow_dir="${1:-}"
    shift
    local files=("$@")

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "Error: No files specified" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"
    mkdir -p "$evidence_dir"

    echo "Selecting specific files as evidence..."
    echo ""

    local rank=100
    local count=0

    # Find highest existing rank
    for existing in "$evidence_dir"/*.evidence.md; do
        [[ -f "$existing" ]] || continue
        local existing_rank=$(basename "$existing" | cut -d'_' -f1)
        if [[ "$existing_rank" =~ ^[0-9]+$ ]] && [[ $existing_rank -ge $rank ]]; then
            rank=$((existing_rank + 10))
        fi
    done

    for file_path in "${files[@]}"; do
        if [[ ! -f "$file_path" ]]; then
            echo "Warning: File not found: $file_path" >&2
            continue
        fi

        # Create evidence filename
        local basename=$(basename "$file_path")
        local kind=$(echo "$basename" | tr '.' '_' | tr '[:upper:]' '[:lower:]' | sed 's/__*/_/g')
        local evidence_file="$evidence_dir/${rank}_${kind}.evidence.md"

        # Create evidence file
        {
            echo "## Evidence: $file_path"
            echo "<!-- source_uri=file://$file_path; cid=sha256:$(compute_digest_for_file "$file_path"); span=full -->"
            echo ""

            # Determine file type
            local ext="${file_path##*.}"
            case "$ext" in
                sh|bash|js|ts|tsx|jsx|py|go|rs|c|cpp|h|java|rb|php|json|yaml|yml|toml|xml|html|css|scss|md)
                    echo '```'"$ext"
                    cat "$file_path"
                    echo '```'
                    ;;
                *)
                    cat "$file_path"
                    ;;
            esac
        } > "$evidence_file"

        echo "Created: ${rank}_${kind}.evidence.md"
        count=$((count + 1))
        rank=$((rank + 10))
    done

    echo ""
    echo "Selected $count evidence files"

    # Log event
    if [[ -f "$flow_dir/events.ndjson" ]]; then
        echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"evidence_selected\",\"method\":\"manual\",\"count\":$count}" \
            >> "$flow_dir/events.ndjson"
    fi

    return 0
}

# Preview evidence selection (dry-run)
preview_evidence_selection() {
    local query="$1"
    local top_n="${2:-10}"
    local ulm_algorithm="${3:-multi_head}"

    if [[ -z "$query" ]]; then
        echo "Error: Query required" >&2
        return 1
    fi

    # Check if ULM is available
    local ulm_path="$TETRA_SRC/bash/ulm/ulm.sh"
    if [[ ! -x "$ulm_path" ]]; then
        echo "Error: ULM not found at $ulm_path" >&2
        return 1
    fi

    echo "ULM Ranking Results (Preview)"
    echo "═══════════════════════════════════════════════════════════"
    echo "Query: $query"
    echo "Algorithm: $ulm_algorithm"
    echo "Top: $top_n"
    echo ""

    # Run ULM ranking
    "$ulm_path" rank "$query" . --algorithm "$ulm_algorithm" --top "$top_n"
    local ulm_exit=$?

    if [[ $ulm_exit -ne 0 ]]; then
        echo ""
        echo "Error: ULM ranking failed" >&2
        return 1
    fi

    echo ""
    echo "Run 'rag select \"$query\"' to create evidence files"
    return 0
}

# Add evidence with selector format: file::start,finish#tags
evidence_add() {
    local selector="$1"
    local mode="${2:-copy}"  # copy or symlink
    local custom_rank="${3:-}"
    local flow_dir=""

    if [[ -z "$selector" ]]; then
        echo "Error: Selector required" >&2
        echo "Usage: evidence_add <file[::range][#tags]> [copy|symlink] [rank]" >&2
        echo "Examples:" >&2
        echo "  evidence_add core/flow.sh" >&2
        echo "  evidence_add core/flow.sh::100,200" >&2
        echo "  evidence_add core/flow.sh::100" >&2
        echo "  evidence_add core/flow.sh::100c,500c" >&2
        echo "  evidence_add core/flow.sh#flow,manager" >&2
        return 1
    fi

    flow_dir="$(get_active_flow_dir)"
    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local evidence_dir="$flow_dir/ctx/evidence"
    mkdir -p "$evidence_dir"

    # Parse selector: file[::range][#tags]
    local file_path="" range="" tags=""

    # Extract tags first (anything after #)
    if [[ "$selector" =~ ^([^#]+)#(.+)$ ]]; then
        selector="${BASH_REMATCH[1]}"
        tags="${BASH_REMATCH[2]}"
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

    # Create evidence filename
    local basename=$(basename "$file_path")
    local kind=$(echo "$basename" | tr '.' '_' | tr '[:upper:]' '[:lower:]' | sed 's/__*/_/g')
    local evidence_file="$evidence_dir/${rank}_${kind}.evidence.md"

    # Symlink mode: create symlink instead of copying content
    if [[ "$mode" == "symlink" ]]; then
        # Get absolute path
        local abs_path="$(cd "$(dirname "$file_path")" && pwd)/$(basename "$file_path")"

        # Create symlink with .link extension instead of .evidence.md
        local link_file="$evidence_dir/${rank}_${kind}.evidence.link"
        ln -sf "$abs_path" "$link_file"

        echo "✓ Linked evidence: ${rank}_${kind}.evidence.link -> $abs_path"
        [[ -n "$tags" ]] && echo "  Tags: $tags"

        # Log event
        if [[ -f "$flow_dir/events.ndjson" ]]; then
            echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"evidence_linked\",\"file\":\"$file_path\",\"tags\":\"$tags\"}" \
                >> "$flow_dir/events.ndjson"
        fi

        return 0
    fi

    # Extract content based on range
    local content=""
    local span_info="full"

    if [[ -n "$range" ]]; then
        # Parse range: start[,end] with optional 'c' suffix for character mode
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
            # Character/byte mode
            if [[ -n "$end" ]]; then
                local length=$((end - start))
                content=$(dd if="$file_path" bs=1 skip="$start" count="$length" 2>/dev/null)
                span_info="bytes=${start}:${end}"
            else
                content=$(dd if="$file_path" bs=1 skip="$start" 2>/dev/null)
                span_info="bytes=${start}:EOF"
            fi
        else
            # Line mode
            if [[ -n "$end" ]]; then
                content=$(sed -n "${start},${end}p" "$file_path")
                span_info="lines=${start}:${end}"
            else
                content=$(sed -n "${start},\$p" "$file_path")
                span_info="lines=${start}:EOF"
            fi
        fi
    else
        # Whole file
        content=$(cat "$file_path")
        span_info="full"
    fi

    # Build evidence file
    local ext="${file_path##*.}"
    {
        echo "## Evidence: $file_path"

        # Metadata line
        local meta="source_uri=file://$file_path; cid=sha256:$(compute_digest_for_file "$file_path"); span=$span_info"
        [[ -n "$tags" ]] && meta="$meta; tags=$tags"
        echo "<!-- $meta -->"
        echo ""

        # Content
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
    } > "$evidence_file"

    echo "✓ Added evidence: ${rank}_${kind}.evidence.md"
    [[ -n "$range" ]] && echo "  Range: $span_info"
    [[ -n "$tags" ]] && echo "  Tags: $tags"

    # Log event
    if [[ -f "$flow_dir/events.ndjson" ]]; then
        echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"evidence_added\",\"file\":\"$file_path\",\"span\":\"$span_info\",\"tags\":\"$tags\"}" \
            >> "$flow_dir/events.ndjson"
    fi

    return 0
}

# Export functions
export -f select_evidence
export -f select_files_as_evidence
export -f preview_evidence_selection
export -f compute_digest_for_file
export -f evidence_add
