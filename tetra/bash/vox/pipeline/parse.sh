#!/usr/bin/env bash

# vox/pipeline/parse.sh - Parsing and Tokenization
#
# Handles markdown → CST → tokenized segments

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${CHROMA_SRC:=$TETRA_SRC/bash/chroma}"

#==============================================================================
# STAGE: PARSE
#==============================================================================

# Parse markdown to CST
vox_pipeline_parse() {
    local input="${1:--}"
    local content

    if [[ "$input" == "-" ]]; then
        content=$(cat)
    else
        content=$(cat "$input")
    fi

    _vox_pipeline_log "Parsing markdown to CST"

    # Use chroma_cst_parse if available
    if declare -F chroma_cst_parse &>/dev/null; then
        echo "$content" | chroma_cst_parse
    else
        # Fallback: wrap in simple document structure
        local escaped
        escaped=$(echo "$content" | jq -Rs '.')
        cat <<EOF
{
  "type": "document",
  "children": [
    {
      "type": "paragraph",
      "children": [
        {"type": "text", "raw": $escaped}
      ]
    }
  ]
}
EOF
    fi
}

#==============================================================================
# STAGE: TOKENIZE
#==============================================================================

# Tokenize CST into speakable segments
vox_pipeline_tokenize() {
    local cst
    cst=$(cat)

    _vox_pipeline_log "Tokenizing CST"

    # Extract all text content from CST, preserving structure hints
    echo "$cst" | jq '
        def extract_text:
            if type == "object" then
                if .type == "text" then
                    [{type: "text", content: (.raw // .content // "")}]
                elif .type == "heading" then
                    [{type: "break", pause_ms: 300}] +
                    (.children | map(extract_text) | flatten) +
                    [{type: "break", pause_ms: 400}]
                elif .type == "paragraph" then
                    (.children | map(extract_text) | flatten) +
                    [{type: "break", pause_ms: 200}]
                elif .type == "code_block" then
                    [{type: "code", content: .content, lang: .lang}]
                elif .type == "list_item" then
                    (.children | map(extract_text) | flatten) +
                    [{type: "break", pause_ms: 150}]
                elif .children then
                    .children | map(extract_text) | flatten
                else
                    []
                end
            else
                []
            end;

        {
            version: "1.0",
            segments: extract_text
        }
    '
}

#==============================================================================
# STAGE: PHONEMIZE
#==============================================================================

# Convert text segments to phonemes
vox_pipeline_phonemize() {
    local lang="${1:-en-us}"
    local tokens
    tokens=$(cat)

    _vox_pipeline_log "Converting to phonemes (lang: $lang)"

    if ! declare -F vox_g2p_full &>/dev/null; then
        _vox_pipeline_error "vox_g2p not loaded"
        echo "$tokens"
        return 1
    fi

    # Process each text segment
    echo "$tokens" | jq -c '.segments[]' | while IFS= read -r segment; do
        local seg_type
        seg_type=$(echo "$segment" | jq -r '.type')

        if [[ "$seg_type" == "text" ]]; then
            local content
            content=$(echo "$segment" | jq -r '.content')

            # Get phonemes for the text
            local phonemized
            phonemized=$(echo "$content" | vox_g2p_full "$lang")

            # Merge into segment
            echo "$segment" | jq --argjson ph "$phonemized" '. + {phonemes: $ph}'
        else
            echo "$segment"
        fi
    done | jq -s '{version: "1.0", segments: .}'
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_pipeline_parse vox_pipeline_tokenize vox_pipeline_phonemize
