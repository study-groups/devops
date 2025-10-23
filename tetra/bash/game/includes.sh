#!/usr/bin/env bash

# Game Module - Entry Point
# Following Tetra Module Convention v2.0

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Module paths (strong globals)
GAME_SRC="${GAME_SRC:-$TETRA_SRC/bash/game}"
export GAME_SRC

GAME_DIR="${GAME_DIR:-$TETRA_DIR/game}"
export GAME_DIR

# Source main module file
source "$GAME_SRC/game.sh"

# Module loaded
export GAME_LOADED=true
