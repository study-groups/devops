#!/usr/bin/env bash

# vox/pipeline/synth.sh - Audio Synthesis
#
# Generate synthesis scripts and audio files

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"

#==============================================================================
# STAGE: SYNTHESIZE SCRIPT
#==============================================================================

# Generate synthesis script for a document
vox_pipeline_synthesize_script() {
    local doc_id="$1"
    local voice="${2:-default}"
    local format="${3:-esto}"

    case "$format" in
        ssml)
            vox_annotate_export_ssml "$doc_id" "$voice"
            ;;
        esto)
            vox_annotate_export_esto "$doc_id"
            ;;
        json)
            # Raw phoneme timeline
            vox_annotate_read "$doc_id" "phonemes" | jq '
                {
                    format: "phoneme_timeline",
                    tokens: [.tokens[] | {
                        word: .word,
                        start_ms: 0,
                        duration_ms: .duration_ms,
                        phonemes: .phonemes
                    }]
                }
            '
            ;;
        *)
            _vox_pipeline_error "Unknown format: $format"
            return 1
            ;;
    esac
}

#==============================================================================
# STAGE: SYNTHESIZE AUDIO
#==============================================================================

# Generate audio using external synthesizer
vox_pipeline_synthesize_audio() {
    local doc_id="$1"
    local voice="${2:-default}"
    local output="${3:-}"

    if ! vox_annotate_exists "$doc_id"; then
        _vox_pipeline_error "Document not found: $doc_id"
        return 1
    fi

    local source
    source=$(vox_annotate_read "$doc_id" "source")

    # Default output path
    if [[ -z "$output" ]]; then
        output=$(vox_annotate_path "$doc_id" "audio" "$voice")
    fi

    # Try espeak synthesis
    local espeak_cmd
    for cmd in espeak-ng espeak; do
        if command -v "$cmd" &>/dev/null; then
            espeak_cmd="$cmd"
            break
        fi
    done

    if [[ -z "$espeak_cmd" ]]; then
        _vox_pipeline_error "No synthesizer found (need espeak or espeak-ng)"
        return 1
    fi

    _vox_pipeline_log "Synthesizing with $espeak_cmd → $output"

    # Get prosody settings
    local prosody
    prosody=$(vox_annotate_read "$doc_id" "prosody" 2>/dev/null)

    local rate=175
    local pitch=50
    if [[ -n "$prosody" ]]; then
        rate=$(echo "$prosody" | jq -r '.global.rate // 1.0' | awk '{print int($1 * 175)}')
        pitch=$(echo "$prosody" | jq -r '.global.pitch_base_hz // 180' | awk '{print int(($1 - 80) / 4)}')
    fi

    # Synthesize - try ffmpeg for mp3, fallback to wav
    echo "$source" | "$espeak_cmd" -v "$voice" -s "$rate" -p "$pitch" --stdout | \
        ffmpeg -y -i - -acodec libmp3lame -q:a 2 "$output" 2>/dev/null || \
        echo "$source" | "$espeak_cmd" -v "$voice" -s "$rate" -p "$pitch" -w "$output" 2>/dev/null

    if [[ -f "$output" ]]; then
        echo "Generated: $output"

        # Update meta with voice
        local meta_path="$VOX_DIR/db/${doc_id}.vox.meta.json"
        if [[ -f "$meta_path" ]]; then
            local tmp=$(mktemp)
            jq --arg v "$voice" '.voices += [$v] | .voices |= unique' "$meta_path" > "$tmp" && mv "$tmp" "$meta_path"
        fi
    else
        _vox_pipeline_error "Synthesis failed"
        return 1
    fi
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_pipeline_synthesize_script vox_pipeline_synthesize_audio
