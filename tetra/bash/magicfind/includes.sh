#!/usr/bin/env bash
# magicfind - LLM-assisted file search with command database
# Module loader

MAGICFIND_SRC="${BASH_SOURCE[0]%/*}"
MAGICFIND_DIR="${TETRA_DIR:-$HOME/tetra}/magicfind"

# Ensure directories exist
[[ -d "$MAGICFIND_DIR/db" ]] || mkdir -p "$MAGICFIND_DIR/db"
[[ -d "$MAGICFIND_DIR/config" ]] || mkdir -p "$MAGICFIND_DIR/config"

# Source module components
source "$MAGICFIND_SRC/db.sh"
source "$MAGICFIND_SRC/rules.sh"
source "$MAGICFIND_SRC/scanspec.sh"
source "$MAGICFIND_SRC/doctor.sh"
source "$MAGICFIND_SRC/core.sh"
