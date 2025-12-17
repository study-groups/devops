#!/usr/bin/env bash

# vox/pipeline/render.sh - Terminal Rendering
#
# Display documents with phoneme annotations

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

#==============================================================================
# STAGE: RENDER
#==============================================================================

# Render document to terminal with phoneme annotations
vox_pipeline_render() {
    local doc_id="$1"
    local show_ipa="${2:-0}"

    if ! vox_annotate_exists "$doc_id"; then
        _vox_pipeline_error "Document not found: $doc_id"
        return 1
    fi

    local source_path
    source_path=$(vox_annotate_path "$doc_id" "source")

    # If CST exists and chroma_cst_render available, use it
    local cst_path
    cst_path=$(vox_annotate_path "$doc_id" "cst")

    if [[ -f "$cst_path" ]] && declare -F chroma_cst_render &>/dev/null; then
        _vox_pipeline_log "Rendering via CST"
        chroma_cst_render "$cst_path"
    else
        # Fallback: cat source
        cat "$source_path"
    fi

    # Optionally show IPA below
    if (( show_ipa )); then
        echo ""
        echo "─── IPA Transcription ───"
        vox_annotate_read "$doc_id" "phonemes" | \
            jq -r '.tokens[] | "\(.word): [\(.ipa)]"'
    fi
}

# Render with inline phoneme display
vox_pipeline_render_annotated() {
    local doc_id="$1"

    if ! vox_annotate_exists "$doc_id"; then
        _vox_pipeline_error "Document not found: $doc_id"
        return 1
    fi

    local phonemes
    phonemes=$(vox_annotate_read "$doc_id" "phonemes") || return 1

    # Display each word with its IPA underneath
    echo "$phonemes" | jq -r '.tokens[] | "\(.word)\t[\(.ipa)]\t\(.duration_ms)ms"' | \
        column -t -s $'\t'
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_pipeline_render vox_pipeline_render_annotated
