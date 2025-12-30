#!/usr/bin/env bash

# vox/includes.sh - VOX Module Bootstrap
#
# Unified entry point for VOX subsystem:
#   - TTS providers (openai, coqui, formant)
#   - Content-addressed caching
#   - Tau audio engine integration (real-time playback/synthesis)
#   - G2P, annotation, pipeline, TUI (optional)
#
# Usage:
#   source $TETRA_SRC/bash/vox/includes.sh

#==============================================================================
# BASH VERSION CHECK
#==============================================================================

if [[ ${BASH_VERSINFO[0]} -lt 5 || (${BASH_VERSINFO[0]} -eq 5 && ${BASH_VERSINFO[1]} -lt 2) ]]; then
    echo "vox: requires bash 5.2+, found ${BASH_VERSION}" >&2
    return 1
fi

#==============================================================================
# LOAD GUARD
#==============================================================================

[[ -n "$_VOX_LOADED" ]] && return 0
declare -g _VOX_LOADED=1

#==============================================================================
# TETRA MODULE INIT
#==============================================================================

: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${TETRA_DIR:=$HOME/tetra}"

# Load tetra module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions (sets VOX_SRC, VOX_DIR)
tetra_module_init_with_alias "vox" "VOX"

# Vox depends on QA module for database and API keys
: "${QA_DIR:=$TETRA_DIR/qa}"
: "${QA_SRC:=$TETRA_SRC/bash/qa}"
export QA_DIR QA_SRC

# Chroma for CST parsing (optional)
declare -g CHROMA_SRC="$TETRA_SRC/bash/chroma"

# Ensure data directories exist
mkdir -p "$VOX_DIR"/{db,cache,export}

#==============================================================================
# DEPENDENCY CHECK
#==============================================================================

_vox_check_deps() {
    local missing=()

    # Required: jq for JSON processing
    command -v jq &>/dev/null || missing+=("jq")

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "vox: missing required dependencies: ${missing[*]}" >&2
        return 1
    fi

    return 0
}

#==============================================================================
# VERSION & INFO
#==============================================================================

declare -g VOX_VERSION="1.1.0"

vox_version() {
    echo "VOX $VOX_VERSION"
    echo "Location: $VOX_SRC"
    echo "Data: $VOX_DIR"
}

vox_info() {
    echo "VOX - Voice Synthesis & Annotation System"
    echo ""
    vox_version
    echo ""
    echo "Providers:"
    printf "  %-12s %s\n" "openai" "$(declare -F vox_openai &>/dev/null && echo '✓' || echo '✗')"
    printf "  %-12s %s\n" "coqui" "$(declare -F vox_coqui_provider &>/dev/null && echo '✓' || echo '✗')"
    printf "  %-12s %s\n" "formant" "$(declare -F vox_formant_provider &>/dev/null && echo '✓' || echo '✗')"
    echo ""
    echo "Audio backend:"
    printf "  %-12s %s\n" "tau" "$(declare -F vox_tau_cmd &>/dev/null && echo '✓' || echo '–')"
    if declare -F _vox_tau_is_running &>/dev/null; then
        if _vox_tau_is_running 2>/dev/null; then
            printf "  %-12s %s\n" "tau-engine" "running"
        else
            printf "  %-12s %s\n" "tau-engine" "stopped"
        fi
    fi
    echo ""
    echo "Optional modules:"
    printf "  %-12s %s\n" "g2p" "$(declare -F vox_g2p &>/dev/null && echo '✓' || echo '–')"
    printf "  %-12s %s\n" "annotate" "$(declare -F vox_annotate &>/dev/null && echo '✓' || echo '–')"
    printf "  %-12s %s\n" "pipeline" "$(declare -F vox_pipeline &>/dev/null && echo '✓' || echo '–')"
    printf "  %-12s %s\n" "tui" "$(declare -F vox_tui &>/dev/null && echo '✓' || echo '–')"
    echo ""
    echo "Dependencies:"
    printf "  %-12s %s\n" "jq" "$(command -v jq &>/dev/null && echo '✓' || echo '✗ required')"
    printf "  %-12s %s\n" "espeak-ng" "$(command -v espeak-ng &>/dev/null && echo '✓' || echo '– for G2P')"
}

#==============================================================================
# MODULE LOADING
#==============================================================================

# Check dependencies (warning only, don't fail boot)
_vox_check_deps 2>/dev/null || true

# Source the main vox dispatcher (TTS system)
source "$VOX_SRC/vox.sh"

# Load optional annotation/phoneme modules (fail silently if not present)
[[ -f "$VOX_SRC/vox_g2p.sh" ]] && source "$VOX_SRC/vox_g2p.sh" 2>/dev/null || true
[[ -f "$VOX_SRC/vox_annotate.sh" ]] && source "$VOX_SRC/vox_annotate.sh" 2>/dev/null || true
[[ -f "$VOX_SRC/vox_pipeline.sh" ]] && source "$VOX_SRC/vox_pipeline.sh" 2>/dev/null || true
[[ -f "$VOX_SRC/vox_tui.sh" ]] && source "$VOX_SRC/vox_tui.sh" 2>/dev/null || true

# Load chroma CST if available
[[ -f "$CHROMA_SRC/core/cst_render.sh" ]] && source "$CHROMA_SRC/core/cst_render.sh" 2>/dev/null || true

# Register tab completion
[[ -f "$VOX_SRC/index.sh" ]] && source "$VOX_SRC/index.sh"
declare -f vox_register_completion &>/dev/null && vox_register_completion

#==============================================================================
# EXPORTS
#==============================================================================

export VOX_SRC VOX_DIR VOX_VERSION QA_DIR QA_SRC
export -f vox vox_version vox_info _vox_check_deps
