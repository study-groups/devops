#!/usr/bin/env bash
# mf - LLM-assisted file search with command database
# Module: bash/magicfind/  Command: mf  Data: ~/tetra/magicfind/

MF_SRC="${BASH_SOURCE[0]%/*}"
MF_DIR="${TETRA_DIR:-$HOME/tetra}/magicfind"

# Ensure directories exist
[[ -d "$MF_DIR/db" ]] || mkdir -p "$MF_DIR/db"
[[ -d "$MF_DIR/config" ]] || mkdir -p "$MF_DIR/config"

# Source module components
source "$MF_SRC/db.sh"
source "$MF_SRC/rules.sh"
source "$MF_SRC/core.sh"

# Function wrapper for discoverability
magicfind() { mf "$@"; }
