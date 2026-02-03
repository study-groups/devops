#!/usr/bin/env bash
# vocoder/includes.sh - Audio Codec Module Bootstrap
#
# Owns audio encoding (Opus, Codec2) and a reusable browser player component.
# Vox calls vocoder for encoding, terrain loads the player.
#
# Usage:
#   source $TETRA_SRC/bash/vocoder/includes.sh

[[ -n "$_VOCODER_LOADED" ]] && return 0
declare -g _VOCODER_LOADED=1

: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${TETRA_DIR:=$HOME/tetra}"

source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

tetra_module_init_with_alias "vocoder" "VOCODER" "cache"

declare -g VOCODER_VERSION="1.0.0"

# Source submodules
source "$VOCODER_SRC/vocoder_encode.sh"
source "$VOCODER_SRC/vocoder.sh"

# Tab completion
[[ -f "$VOCODER_SRC/vocoder_complete.sh" ]] && source "$VOCODER_SRC/vocoder_complete.sh"

export VOCODER_SRC VOCODER_DIR VOCODER_VERSION
export -f vocoder
