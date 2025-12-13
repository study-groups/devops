#!/usr/bin/env bash
# Formant Module - TCS 3.0 Entry Point
# Audio-visual synthesis with formant-based voice synthesis

[[ -n "$_FORMANT_LOADED" ]] && return 0
_FORMANT_LOADED=1

FORMANT_SRC="${TETRA_SRC}/bash/formant"
FORMANT_DIR="${TETRA_DIR}/formant"

# Ensure data directory exists
[[ ! -d "$FORMANT_DIR" ]] && mkdir -p "$FORMANT_DIR"

source "$FORMANT_SRC/formant.sh"
