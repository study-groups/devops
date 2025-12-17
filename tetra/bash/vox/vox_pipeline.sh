#!/usr/bin/env bash

# vox_pipeline.sh - End-to-End Voice Annotation Pipeline
#
# Orchestrates the full document-to-speech workflow:
#   Document → CST → Tokenize → Phonemize → Annotate → Synthesize
#
# Usage:
#   cat document.md | vox_pipeline process
#   vox_pipeline render 1760229927
#   vox_pipeline synthesize 1760229927 --voice neural

#==============================================================================
# CONFIGURATION
#==============================================================================

: "${VOX_SRC:=$TETRA_SRC/bash/vox}"
: "${VOX_DIR:=$TETRA_DIR/vox}"
: "${CHROMA_SRC:=$TETRA_SRC/bash/chroma}"

: "${VOX_PIPELINE_VERBOSE:=0}"
: "${VOX_PIPELINE_CACHE:=$VOX_DIR/cache}"

mkdir -p "$VOX_PIPELINE_CACHE"

#==============================================================================
# LOGGING
#==============================================================================

_vox_pipeline_log() {
    (( VOX_PIPELINE_VERBOSE )) && echo "[vox_pipeline] $*" >&2
}

_vox_pipeline_error() {
    echo "[vox_pipeline] ERROR: $*" >&2
}

#==============================================================================
# SOURCE SUBMODULES
#==============================================================================

_vox_pipeline_source_modules() {
    local pipeline_dir="$VOX_SRC/pipeline"

    [[ -f "$pipeline_dir/parse.sh" ]] && source "$pipeline_dir/parse.sh"
    [[ -f "$pipeline_dir/render.sh" ]] && source "$pipeline_dir/render.sh"
    [[ -f "$pipeline_dir/synth.sh" ]] && source "$pipeline_dir/synth.sh"
    [[ -f "$pipeline_dir/batch.sh" ]] && source "$pipeline_dir/batch.sh"
}

_vox_pipeline_source_modules

#==============================================================================
# CORE PIPELINE
#==============================================================================

# Run complete pipeline: parse → tokenize → phonemize → store
vox_pipeline_process() {
    local lang="${1:-en-us}"
    local voice="${2:-}"
    local content
    content=$(cat)

    if [[ -z "$content" ]]; then
        _vox_pipeline_error "No content provided"
        return 1
    fi

    _vox_pipeline_log "Running full pipeline"

    # Create annotation (this handles parse + phonemize internally)
    local doc_id
    doc_id=$(echo "$content" | vox_annotate_create "$voice")

    if [[ -z "$doc_id" ]]; then
        _vox_pipeline_error "Failed to create annotation"
        return 1
    fi

    # Generate and store tokenized CST
    local cst_path
    cst_path=$(vox_annotate_path "$doc_id" "cst")

    if [[ -f "$cst_path" ]]; then
        local tokens_full
        tokens_full=$(cat "$cst_path" | vox_pipeline_tokenize)

        # Store enhanced tokens
        echo "$tokens_full" > "$VOX_DIR/db/${doc_id}.vox.tokens_full.json"
    fi

    echo "$doc_id"
}

# Process from file
vox_pipeline_process_file() {
    local file="$1"
    local lang="${2:-en-us}"
    local voice="${3:-}"

    if [[ ! -f "$file" ]]; then
        _vox_pipeline_error "File not found: $file"
        return 1
    fi

    cat "$file" | vox_pipeline_process "$lang" "$voice"
}

#==============================================================================
# CLI INTERFACE
#==============================================================================

vox_pipeline() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        # Core pipeline
        process|p)
            vox_pipeline_process "$@"
            ;;
        process-file|pf)
            vox_pipeline_process_file "$@"
            ;;
        batch|b)
            vox_pipeline_batch "$@"
            ;;

        # Parsing stages
        parse)
            vox_pipeline_parse "$@"
            ;;
        tokenize|tok)
            vox_pipeline_tokenize "$@"
            ;;
        phonemize|ph)
            vox_pipeline_phonemize "$@"
            ;;

        # Output stages
        render|r)
            vox_pipeline_render "$@"
            ;;
        render-annotated|ra)
            vox_pipeline_render_annotated "$@"
            ;;

        # Synthesis
        script|s)
            vox_pipeline_synthesize_script "$@"
            ;;
        synth|audio)
            vox_pipeline_synthesize_audio "$@"
            ;;

        # Utility
        regen)
            vox_pipeline_regen_phonemes "$@"
            ;;
        stats)
            vox_pipeline_stats "$@"
            ;;
        word-freq|wf)
            vox_pipeline_word_freq "$@"
            ;;
        duration|dur)
            vox_pipeline_duration_analysis "$@"
            ;;

        help|--help|-h|*)
            cat <<'EOF'
vox_pipeline - End-to-End Voice Annotation Pipeline

Usage: vox_pipeline <command> [options]

PIPELINE:
  process [lang]              Full pipeline from stdin, returns doc_id
  process-file FILE [lang]    Process a file
  batch PATTERN [lang]        Process multiple files

STAGES:
  parse                       Parse markdown to CST (stdin → stdout)
  tokenize                    Tokenize CST (stdin → stdout)
  phonemize [lang]            Add phonemes (stdin → stdout)

OUTPUT:
  render ID [show_ipa]        Render document to terminal
  render-annotated ID         Show words with IPA

SYNTHESIS:
  script ID [voice] [format]  Generate synthesis script (ssml|esto|json)
  synth ID [voice] [output]   Generate audio file

ANALYSIS:
  stats ID                    Show phoneme statistics
  word-freq ID [limit]        Word frequency analysis
  duration ID                 Duration analysis

UTILITY:
  regen ID [lang]             Regenerate phonemes for document

Examples:
  cat README.md | vox_pipeline process
  vox_pipeline render 1760229927 1
  vox_pipeline synth 1760229927 en-us
  vox_pipeline stats 1760229927

Environment:
  VOX_PIPELINE_VERBOSE=1      Enable debug logging
EOF
            ;;
    esac
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f vox_pipeline
export -f vox_pipeline_process vox_pipeline_process_file
export -f _vox_pipeline_log _vox_pipeline_error _vox_pipeline_source_modules
