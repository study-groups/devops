#!/usr/bin/env bash

# vox/pipeline/batch.sh - Batch Operations & Statistics
#
# Handles multi-file processing and analytics

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

#==============================================================================
# BATCH OPERATIONS
#==============================================================================

# Process multiple files
vox_pipeline_batch() {
    local pattern="$1"
    local lang="${2:-en-us}"

    local count=0
    local failed=0

    for file in $pattern; do
        [[ -f "$file" ]] || continue

        _vox_pipeline_log "Processing: $file"

        local doc_id
        if doc_id=$(vox_pipeline_process_file "$file" "$lang"); then
            echo "$file → $doc_id"
            ((count++))
        else
            echo "$file → FAILED" >&2
            ((failed++))
        fi
    done

    echo ""
    echo "Processed: $count files, $failed failed"
}

# Regenerate phonemes for existing document
vox_pipeline_regen_phonemes() {
    local doc_id="$1"
    local lang="${2:-en-us}"

    if ! vox_annotate_exists "$doc_id"; then
        _vox_pipeline_error "Document not found: $doc_id"
        return 1
    fi

    local source
    source=$(vox_annotate_read "$doc_id" "source")

    local tokens_json
    tokens_json=$(echo "$source" | vox_g2p_full "$lang")

    local phonemes_path
    phonemes_path=$(vox_annotate_path "$doc_id" "phonemes")

    # Backup existing
    [[ -f "$phonemes_path" ]] && cp "$phonemes_path" "${phonemes_path}.bak"

    # Write new phonemes
    echo "$tokens_json" | jq '{
        version: "1.0",
        doc_id: "'"$doc_id"'",
        regenerated: (now | todate),
        tokens: [.tokens[] | select(.type == "word") | {
            id: .pos.offset,
            word: .text,
            ipa: .ipa,
            duration_ms: .duration_ms,
            phonemes: .phonemes
        }]
    }' > "$phonemes_path"

    echo "Regenerated phonemes for: $doc_id"
}

#==============================================================================
# STATISTICS
#==============================================================================

vox_pipeline_stats() {
    local doc_id="$1"

    if ! vox_annotate_exists "$doc_id"; then
        _vox_pipeline_error "Document not found: $doc_id"
        return 1
    fi

    local phonemes
    phonemes=$(vox_annotate_read "$doc_id" "phonemes") || return 1

    echo "Document: $doc_id"
    echo ""

    echo "$phonemes" | jq -r '
        "Words: \(.tokens | length)",
        "Total phonemes: \([.tokens[].phonemes | length] | add)",
        "Total duration: \([.tokens[].duration_ms] | add // 0)ms",
        "Average word duration: \(([.tokens[].duration_ms] | add // 0) / ((.tokens | length) | if . == 0 then 1 else . end) | floor)ms",
        "",
        "Phoneme distribution:",
        (
            [.tokens[].phonemes[].ipa] | group_by(.) |
            map({ipa: .[0], count: length}) |
            sort_by(-.count) |
            .[:10][] |
            "  \(.ipa): \(.count)"
        )
    '
}

# Word frequency analysis
vox_pipeline_word_freq() {
    local doc_id="$1"
    local limit="${2:-20}"

    if ! vox_annotate_exists "$doc_id"; then
        _vox_pipeline_error "Document not found: $doc_id"
        return 1
    fi

    vox_annotate_read "$doc_id" "phonemes" | jq -r --argjson limit "$limit" '
        [.tokens[].word | ascii_downcase] |
        group_by(.) |
        map({word: .[0], count: length}) |
        sort_by(-.count) |
        .[:$limit][] |
        "\(.count)\t\(.word)"
    ' | column -t
}

# Duration analysis
vox_pipeline_duration_analysis() {
    local doc_id="$1"

    if ! vox_annotate_exists "$doc_id"; then
        _vox_pipeline_error "Document not found: $doc_id"
        return 1
    fi

    vox_annotate_read "$doc_id" "phonemes" | jq -r '
        def stats(arr):
            (arr | add / length) as $mean |
            (arr | min) as $min |
            (arr | max) as $max |
            {mean: ($mean | floor), min: $min, max: $max};

        .tokens as $tokens |
        ($tokens | map(.duration_ms)) as $word_durs |
        ([$tokens[].phonemes[].duration_ms]) as $ph_durs |

        "Word durations:",
        "  Min: \(stats($word_durs).min)ms",
        "  Max: \(stats($word_durs).max)ms",
        "  Mean: \(stats($word_durs).mean)ms",
        "",
        "Phoneme durations:",
        "  Min: \(stats($ph_durs).min)ms",
        "  Max: \(stats($ph_durs).max)ms",
        "  Mean: \(stats($ph_durs).mean)ms",
        "",
        "Slowest words:",
        ($tokens | sort_by(-.duration_ms) | .[:5][] | "  \(.word): \(.duration_ms)ms"),
        "",
        "Fastest words:",
        ($tokens | sort_by(.duration_ms) | .[:5][] | "  \(.word): \(.duration_ms)ms")
    '
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_pipeline_batch vox_pipeline_regen_phonemes
export -f vox_pipeline_stats vox_pipeline_word_freq vox_pipeline_duration_analysis
