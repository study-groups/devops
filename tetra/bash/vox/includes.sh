#!/usr/bin/env bash

# Vox Module Includes - Controls what gets loaded for Vox functionality

# Follow tetra convention: MOD_DIR for data, MOD_SRC for source
VOX_DIR="${VOX_DIR:-$TETRA_DIR/vox}"
VOX_SRC="${VOX_SRC:-$TETRA_SRC/bash/vox}"

# Vox depends on QA module for database and API keys
QA_DIR="${QA_DIR:-$TETRA_DIR/qa}"
QA_SRC="${QA_SRC:-$TETRA_SRC/bash/qa}"

# Create data directory if it doesn't exist
[[ ! -d "$VOX_DIR" ]] && mkdir -p "$VOX_DIR"

# Export for subprocesses
export VOX_DIR VOX_SRC QA_DIR QA_SRC

# Source the main Vox module
source "$VOX_SRC/vox.sh"
