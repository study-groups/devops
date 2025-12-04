#!/usr/bin/env bash
# assembler.sh - Context assembly for RAG module
#
# Assembles ctx/*.md files into prompt.mdctx with deterministic ordering

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Source flow manager for directory helpers
source "$RAG_SRC/core/flow_manager_ttm.sh"

# Compute SHA256 digest
compute_digest() {
    local file="$1"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        echo "Error: No SHA256 utility found" >&2
        return 1
    fi
}

# Get file CID (content ID)
get_file_cid() {
    local file="$1"
    echo "sha256:$(compute_digest "$file")"
}

# Assemble context from parts
assemble_ctx() {
    local flow_dir="${1:-}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local ctx_dir="$flow_dir/ctx"
    local build_dir="$flow_dir/build"
    local output_file="$build_dir/prompt.mdctx"
    local plan_file="$build_dir/ctxplan.json"
    local meta_file="$build_dir/runmeta.json"

    if [[ ! -d "$ctx_dir" ]]; then
        echo "Error: ctx directory not found: $ctx_dir" >&2
        return 1
    fi

    mkdir -p "$build_dir"

    # Get flow_id from state
    local flow_id
    if command -v jq >/dev/null 2>&1 && [[ -f "$flow_dir/state.json" ]]; then
        flow_id=$(jq -r '.flow_id' "$flow_dir/state.json")
    else
        flow_id=$(basename "$flow_dir")
    fi

    echo "Assembling context for flow: $flow_id"

    # Find all .md files in ctx/ (including subdirectories)
    local parts=()
    while IFS= read -r -d '' file; do
        parts+=("$file")
    done < <(find "$ctx_dir" -name "*.md" -type f -print0 | sort -z)

    if [[ ${#parts[@]} -eq 0 ]]; then
        echo "Error: No .md files found in $ctx_dir" >&2
        return 1
    fi

    echo "Found ${#parts[@]} parts"

    # Start building ctxplan.json
    local plan_parts="[]"
    local total_bytes=0

    # Write mdctx header
    cat > "$output_file" <<EOF
<!-- mdctx:version=1.0; flow_id=$flow_id; assembly=lexical -->

EOF

    # Process each part
    local rank=0
    for part in "${parts[@]}"; do
        local rel_path="${part#$ctx_dir/}"
        local basename=$(basename "$part" .md)
        local role
        local kind

        # Extract role and kind from filename pattern: <rank>_<kind>.<role>.md
        if [[ "$basename" =~ ^[0-9]+_(.*)\.([^.]+)$ ]]; then
            kind="${BASH_REMATCH[1]}"
            role="${BASH_REMATCH[2]}"
        else
            # Fallback: infer from path
            if [[ "$rel_path" == evidence/* ]]; then
                role="evidence"
                kind=$(basename "$part" .evidence.md)
            else
                role="user"
                kind="$basename"
            fi
        fi

        # Get file metadata
        local bytes=$(wc -c < "$part" | tr -d ' ')
        local cid=$(get_file_cid "$part")
        total_bytes=$((total_bytes + bytes))

        # Add section header based on role
        case "$role" in
            system)
                echo "# System" >> "$output_file"
                echo "" >> "$output_file"
                ;;
            user)
                echo "# User Request" >> "$output_file"
                echo "" >> "$output_file"
                ;;
            evidence)
                echo "## Evidence: $kind" >> "$output_file"
                echo "<!-- source_uri=file://$rel_path; cid=$cid -->" >> "$output_file"
                echo "" >> "$output_file"
                ;;
        esac

        # Append content
        cat "$part" >> "$output_file"
        echo "" >> "$output_file"
        echo "" >> "$output_file"

        # Build plan entry (if jq available)
        if command -v jq >/dev/null 2>&1; then
            local rank_str=$(printf "%03d" $rank)
            local part_json=$(jq -n \
                --arg rank "$rank_str" \
                --arg kind "$kind" \
                --arg role "$role" \
                --arg uri "file://$rel_path" \
                --arg cid "$cid" \
                --argjson bytes "$bytes" \
                '{rank: $rank, kind: $kind, role: $role, uri: $uri, cid: $cid, bytes: $bytes}')
            plan_parts=$(echo "$plan_parts" | jq --argjson part "$part_json" '. += [$part]')
        fi

        rank=$((rank + 1))
    done

    # Compute ctx_digest
    local ctx_digest=$(compute_digest "$output_file")

    echo "Assembled: $output_file"
    echo "Total bytes: $total_bytes"
    echo "Context digest: sha256:${ctx_digest:0:16}..."

    # Write ctxplan.json
    if command -v jq >/dev/null 2>&1; then
        jq -n \
            --arg version "1.0" \
            --arg flow_id "$flow_id" \
            --arg order_rule "lexical" \
            --argjson parts "$plan_parts" \
            --argjson total_bytes "$total_bytes" \
            --arg ctx_digest "sha256:$ctx_digest" \
            '{
                version: $version,
                flow_id: $flow_id,
                order_rule: $order_rule,
                snippets: [],
                parts: $parts,
                total_bytes: $total_bytes,
                ctx_digest: $ctx_digest
            }' > "$plan_file"
        echo "Plan: $plan_file"
    fi

    # Write runmeta.json
    if command -v jq >/dev/null 2>&1 && [[ -f "$flow_dir/state.json" ]]; then
        local agent=$(jq -r '.agent' "$flow_dir/state.json")
        jq -n \
            --arg ctx_digest "sha256:$ctx_digest" \
            --arg flow_id "$flow_id" \
            --arg agent "$agent" \
            --arg timestamp "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
            '{
                ctx_digest: $ctx_digest,
                flow_id: $flow_id,
                agent: $agent,
                timestamp: $timestamp
            }' > "$meta_file"
        echo "Metadata: $meta_file"
    fi

    # Update flow state with ctx_digest and transition to ASSEMBLE stage
    if command -v jq >/dev/null 2>&1 && [[ -f "$flow_dir/state.json" ]]; then
        local state_file="$flow_dir/state.json"
        local temp_file=$(mktemp)
        jq --arg digest "sha256:$ctx_digest" \
           --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
           '.ctx_digest = $digest | .stage = "ASSEMBLE" | .last_checkpoint = $ts' \
           "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    fi

    # Log event
    if [[ -f "$flow_dir/events.ndjson" ]]; then
        echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"event\":\"ctx_assembled\",\"ctx_digest\":\"sha256:$ctx_digest\",\"parts\":${#parts[@]},\"bytes\":$total_bytes}" \
            >> "$flow_dir/events.ndjson"
    fi

    echo ""
    echo "Assembly complete!"
    echo "Stage: ASSEMBLE"
    echo ""
    echo "Next: /submit @qa to send to LLM"
    return 0
}

# Preview assembly plan (dry-run)
plan_ctx() {
    local flow_dir="${1:-}"

    if [[ -z "$flow_dir" ]]; then
        flow_dir="$(get_active_flow_dir)"
    fi

    if [[ -z "$flow_dir" ]] || [[ ! -d "$flow_dir" ]]; then
        echo "Error: No active flow" >&2
        return 1
    fi

    local ctx_dir="$flow_dir/ctx"

    echo "Assembly Plan"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # Find all .md files
    local parts=()
    while IFS= read -r -d '' file; do
        parts+=("$file")
    done < <(find "$ctx_dir" -name "*.md" -type f -print0 | sort -z)

    if [[ ${#parts[@]} -eq 0 ]]; then
        echo "No .md files found in $ctx_dir"
        return 0
    fi

    local total_bytes=0
    local rank=1

    for part in "${parts[@]}"; do
        local rel_path="${part#$ctx_dir/}"
        local bytes=$(wc -c < "$part" | tr -d ' ')
        total_bytes=$((total_bytes + bytes))

        printf "%2d. %-50s  %6d bytes\n" "$rank" "$rel_path" "$bytes"
        rank=$((rank + 1))
    done

    echo "───────────────────────────────────────────────────────────"
    printf "%-53s  %6d bytes\n" "Total:" "$total_bytes"

    # Estimate tokens (rough: 1 token ≈ 4 bytes)
    local est_tokens=$((total_bytes / 4))
    echo ""
    echo "Estimated tokens: ~$est_tokens"
    echo ""
    echo "Output: build/prompt.mdctx"
}

# Export functions
export -f compute_digest
export -f get_file_cid
export -f assemble_ctx
export -f plan_ctx
