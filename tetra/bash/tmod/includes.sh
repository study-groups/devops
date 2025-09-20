#!/usr/bin/env bash

# tmod module includes
# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
TMOD_DIR="${TMOD_DIR:-$TETRA_DIR/tmod}"
TMOD_SRC="${TMOD_SRC:-$TETRA_SRC/bash/tmod}"

# Create data directory if it doesn't exist
[[ ! -d "$TMOD_DIR" ]] && mkdir -p "$TMOD_DIR"

# Export for subprocesses
export TMOD_DIR TMOD_SRC

source "$TMOD_SRC/tmod.sh"
