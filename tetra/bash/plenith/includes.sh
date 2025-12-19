#!/usr/bin/env bash

# Plenith Module Includes - Standard tetra module entry point
# Retro TV channel system with quasar audio integration

# Plenith app lives outside tetra - set paths explicitly
PLENITH_SRC="${PLENITH_SRC:-$HOME/src/pixeljam/pja/plenith}"
PLENITH_DIR="${PLENITH_DIR:-${TETRA_DIR:-$HOME/tetra}/plenith}"
PLENITH_MOD="$TETRA_SRC/bash/plenith"
export PLENITH_SRC PLENITH_DIR

# Ensure runtime directory exists
[[ -d "$PLENITH_DIR" ]] || mkdir -p "$PLENITH_DIR"

# Source main module from tetra
source "$PLENITH_MOD/plenith.sh"
