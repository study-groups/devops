#!/usr/bin/env bash
# kb_manager.sh - RAG Knowledge Base Manager
# Promote flows to searchable knowledge base

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${RAG_DIR:=$TETRA_DIR/rag}"

# Knowledge base directories
KB_DIR="${RAG_DIR}/db/kb"
KB_INDEX_DIR="${RAG_DIR}/db/index"
KB_TAGS_FILE="${RAG_DIR}/db/tags.txt"

# Initialize knowledge base structure
kb_init() {
    mkdir -p "$KB_DIR" "$KB_INDEX_DIR/by_tag" "$KB_INDEX_DIR/by_date"
    touch "$KB_TAGS_FILE"
}

# Promote a flow to knowledge base with tags
# Usage: kb_promote <flow_id> [tags...]
kb_promote() {
    local flow_id="${1:?Flow ID required}"
    shift || true
    local tags=("$@")

    # Get flow directory
    local flow_dir
    if [[ -d "$TTM_TXNS_DIR/$flow_id" ]]; then
        flow_dir="$TTM_TXNS_DIR/$flow_id"
    else
        echo "Error: Flow not found: $flow_id" >&2
        return 1
    fi

    # Check if answer exists
    local answer_file="$flow_dir/build/answer.md"
    if [[ ! -f "$answer_file" ]]; then
        echo "Error: No answer found for flow: $flow_id" >&2
        echo "Run /submit @qa first" >&2
        return 1
    fi

    # Initialize KB if needed
    kb_init

    # Create KB entry
    local kb_file="$KB_DIR/${flow_id}.kb.md"
    local meta_file="$KB_DIR/${flow_id}.meta"

    # Get prompt/question
    local prompt_file
    if [[ -f "$flow_dir/ctx/010_prompt.user.md" ]]; then
        prompt_file="$flow_dir/ctx/010_prompt.user.md"
    elif [[ -f "$flow_dir/ctx/010_request.user.md" ]]; then
        prompt_file="$flow_dir/ctx/010_request.user.md"
    else
        echo "Error: No prompt found" >&2
        return 1
    fi

    # Extract question (skip metadata header)
    local question=$(grep -v "^<!--" "$prompt_file" | grep -v "^$" | head -5)

    # Build KB entry with question, answer, and metadata
    cat > "$kb_file" <<EOF
# Knowledge Base Entry: $flow_id

## Question

$question

## Answer

$(cat "$answer_file")

## Metadata

- **Flow ID**: $flow_id
- **Created**: $(date -u '+%Y-%m-%dT%H:%M:%SZ')
- **Tags**: ${tags[*]:-untagged}
- **Evidence Files**: $(find "$flow_dir/ctx/evidence" -name "*.evidence.md" 2>/dev/null | wc -l | tr -d ' ')

## Evidence

$(find "$flow_dir/ctx/evidence" -name "*.evidence.md" 2>/dev/null | while read -r efile; do
    echo "### $(basename "$efile" .evidence.md)"
    echo ""
    echo '```'
    head -20 "$efile"
    echo '```'
    echo ""
done)
EOF

    # Create metadata file (JSON for easy parsing)
    cat > "$meta_file" <<EOF
{
  "flow_id": "$flow_id",
  "created": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "tags": [$(printf '"%s",' "${tags[@]}" | sed 's/,$//')]
  "rating": null,
  "quality": null
}
EOF

    # Update tag vocabulary
    for tag in "${tags[@]}"; do
        if ! grep -qx "$tag" "$KB_TAGS_FILE" 2>/dev/null; then
            echo "$tag" >> "$KB_TAGS_FILE"
        fi
    done

    # Update indexes
    kb_reindex

    echo "✓ Flow promoted to knowledge base: $kb_file"
    echo "Tags: ${tags[*]:-untagged}"
}

# List knowledge base entries
kb_list() {
    local filter_tag="$1"

    kb_init

    local entries=()
    while IFS= read -r -d '' kb_file; do
        entries+=("$kb_file")
    done < <(find "$KB_DIR" -name "*.kb.md" -print0 | sort -z)

    if [[ ${#entries[@]} -eq 0 ]]; then
        echo "No knowledge base entries"
        echo ""
        echo "Use: /tag <flow-id> tag1 tag2 ... to promote a flow"
        return 0
    fi

    echo "Knowledge Base Entries"
    echo "═══════════════════════════════════════"
    echo ""

    local count=0
    for kb_file in "${entries[@]}"; do
        local flow_id=$(basename "$kb_file" .kb.md)
        local meta_file="$KB_DIR/${flow_id}.meta"

        # Get tags
        local tags=""
        if [[ -f "$meta_file" ]] && command -v jq >/dev/null 2>&1; then
            tags=$(jq -r '.tags | join(", ")' "$meta_file" 2>/dev/null)
        fi

        # Filter by tag if specified
        if [[ -n "$filter_tag" ]] && [[ "$tags" != *"$filter_tag"* ]]; then
            continue
        fi

        # Get question (first line after "## Question")
        local question=$(sed -n '/^## Question$/,/^$/p' "$kb_file" | sed '1d;$d' | head -1)

        count=$((count + 1))
        printf "%2d. %s\n" "$count" "$flow_id"
        printf "    Q: %s\n" "$question"
        printf "    Tags: %s\n" "${tags:-none}"
        echo ""
    done

    if [[ $count -eq 0 ]] && [[ -n "$filter_tag" ]]; then
        echo "No entries with tag: $filter_tag"
    else
        echo "Total: $count entries"
    fi
}

# View a knowledge base entry
kb_view() {
    local flow_id="$1"

    if [[ -z "$flow_id" ]]; then
        echo "Error: Flow ID required" >&2
        echo "Usage: /kb view <flow-id>" >&2
        return 1
    fi

    local kb_file="$KB_DIR/${flow_id}.kb.md"

    if [[ ! -f "$kb_file" ]]; then
        echo "Error: No KB entry for: $flow_id" >&2
        echo "Use: /kb list to see available entries" >&2
        return 1
    fi

    # Use tdoc if available, otherwise cat
    if command -v tds_markdown >/dev/null 2>&1; then
        tds_markdown --pager "$kb_file"
    else
        cat "$kb_file" | ${PAGER:-less}
    fi
}

# Rebuild indexes
kb_reindex() {
    kb_init

    # Clear indexes
    rm -rf "$KB_INDEX_DIR/by_tag"/*
    rm -rf "$KB_INDEX_DIR/by_date"/*
    mkdir -p "$KB_INDEX_DIR/by_tag" "$KB_INDEX_DIR/by_date"

    # Index by tag
    for meta_file in "$KB_DIR"/*.meta; do
        [[ -f "$meta_file" ]] || continue
        local flow_id=$(basename "$meta_file" .meta)

        if command -v jq >/dev/null 2>&1; then
            # Extract tags and create symlinks
            local tags=$(jq -r '.tags[]' "$meta_file" 2>/dev/null)
            while IFS= read -r tag; do
                [[ -z "$tag" ]] && continue
                local tag_dir="$KB_INDEX_DIR/by_tag/$tag"
                mkdir -p "$tag_dir"
                ln -sf "$KB_DIR/${flow_id}.kb.md" "$tag_dir/"
            done <<< "$tags"

            # Index by date
            local date=$(jq -r '.created' "$meta_file" 2>/dev/null | cut -d'T' -f1)
            if [[ -n "$date" ]]; then
                local date_dir="$KB_INDEX_DIR/by_date/$date"
                mkdir -p "$date_dir"
                ln -sf "$KB_DIR/${flow_id}.kb.md" "$date_dir/"
            fi
        fi
    done
}

# Search knowledge base
kb_search() {
    local query="$*"

    if [[ -z "$query" ]]; then
        echo "Error: Search query required" >&2
        echo "Usage: /kb search <query>" >&2
        return 1
    fi

    kb_init

    echo "Searching knowledge base for: $query"
    echo "═══════════════════════════════════════"
    echo ""

    local found=0
    for kb_file in "$KB_DIR"/*.kb.md; do
        [[ -f "$kb_file" ]] || continue

        if grep -qi "$query" "$kb_file"; then
            local flow_id=$(basename "$kb_file" .kb.md)
            local question=$(sed -n '/^## Question$/,/^$/p' "$kb_file" | sed '1d;$d' | head -1)

            found=$((found + 1))
            echo "$found. $flow_id"
            echo "   Q: $question"
            echo ""
        fi
    done

    if [[ $found -eq 0 ]]; then
        echo "No matches found"
    else
        echo "Found: $found entries"
    fi
}

# Export functions
export -f kb_init
export -f kb_promote
export -f kb_list
export -f kb_view
export -f kb_reindex
export -f kb_search
