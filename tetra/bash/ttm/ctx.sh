#!/usr/bin/env bash
# ctx.sh - Context and evidence management
# Implements the numbered file pattern from TTS

: "${TTM_DIR:=$TETRA_DIR/ttm}"

# Get next context sequence number
_ctx_next_seq() {
    local ctx_dir="$1"

    # Find highest sequence number in user range (100+)
    local max_seq=90
    if [[ -d "$ctx_dir" ]]; then
        for file in "$ctx_dir"/*; do
            [[ -f "$file" ]] || continue
            local basename=$(basename "$file")
            local seq=$(echo "$basename" | grep -o '^[0-9]\+' | head -1)
            if [[ -n "$seq" ]] && [[ $seq -ge 100 ]] && [[ $seq -gt $max_seq ]]; then
                max_seq=$seq
            fi
        done
    fi

    echo $((max_seq + 10))
}

# Add context/evidence file to transaction
# Args: source_file description [txn_id]
txn_add_ctx() {
    local source_file="${1:?Source file required}"
    local description="${2:?Description required}"
    local txn_id="${3:-}"

    local dir="$(txn_dir "$txn_id")" || return 1
    txn_id=$(basename "$dir")

    if [[ ! -f "$source_file" ]] && [[ ! -d "$source_file" ]]; then
        echo "Error: Source file not found: $source_file" >&2
        return 1
    fi

    local ctx_dir="$dir/ctx"
    local next_seq=$(_ctx_next_seq "$ctx_dir")

    # Get file extension
    local ext=""
    if [[ -f "$source_file" ]]; then
        ext="${source_file##*.}"
        [[ "$ext" == "$(basename "$source_file")" ]] && ext=""
    fi

    # Create context filename
    local ctx_filename="${next_seq}_${description}"
    [[ -n "$ext" ]] && ctx_filename="${ctx_filename}.${ext}"

    local ctx_path="$ctx_dir/$ctx_filename"

    # Copy file to context
    if [[ -d "$source_file" ]]; then
        cp -r "$source_file" "$ctx_path"
    else
        cp "$source_file" "$ctx_path"
    fi

    # Log evidence_added event
    echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"evidence_added\",\"file\":\"$ctx_filename\",\"source\":\"$source_file\"}" \
        >> "$dir/events.ndjson"

    # Publish event
    ttm_publish "txn.evidence_added" "$txn_id" "$ctx_filename"

    echo "Added context: $ctx_filename"
}

# List context files in transaction
# Args: [txn_id]
txn_list_ctx() {
    local txn_id="${1:-}"
    local dir="$(txn_dir "$txn_id")" || return 1

    local ctx_dir="$dir/ctx"
    if [[ ! -d "$ctx_dir" ]]; then
        echo "No context files"
        return 0
    fi

    echo "Context files:"
    ls -1 "$ctx_dir" | sort -n
}

# Initialize evidence variables ($e1, $e2, etc.)
# Args: [txn_id]
init_evidence_vars() {
    local txn_id="${1:-}"
    local dir="$(txn_dir "$txn_id")" || return 1

    local ctx_dir="$dir/ctx"

    # Clear previous variables
    unset e1 e2 e3 e4 e5 e6 e7 e8 e9
    local e_count=0

    # Assign $e1, $e2, etc. to evidence files (100+)
    local files
    readarray -t files < <(ls "$ctx_dir" 2>/dev/null | grep -E '^[1-9][0-9]{2}_' | sort -n)
    for i in "${!files[@]}"; do
        local var_num=$((i + 1))
        eval "e$var_num=\"$ctx_dir/${files[$i]}\""
        ((e_count++))
    done

    export e_count

    # Show what was loaded
    if [[ $e_count -gt 0 ]]; then
        echo "Evidence variables initialized: $e_count file(s)"
        for i in $(seq 1 $e_count); do
            eval "echo \"  \$e$i = \${e$i}\""
        done
    else
        echo "No evidence files found"
    fi
}

# Get context digest (for idempotency)
# Args: [txn_id]
txn_ctx_digest() {
    local txn_id="${1:-}"
    local dir="$(txn_dir "$txn_id")" || return 1

    local ctx_dir="$dir/ctx"
    if [[ ! -d "$ctx_dir" ]]; then
        echo "none"
        return 0
    fi

    # Generate hash of all context files
    if command -v shasum >/dev/null 2>&1; then
        find "$ctx_dir" -type f -exec shasum -a 256 {} \; | \
            sort | shasum -a 256 | cut -d' ' -f1
    elif command -v sha256sum >/dev/null 2>&1; then
        find "$ctx_dir" -type f -exec sha256sum {} \; | \
            sort | sha256sum | cut -d' ' -f1
    else
        echo "unknown"
    fi
}

# Export functions
export -f txn_add_ctx
export -f txn_list_ctx
export -f init_evidence_vars
export -f txn_ctx_digest
