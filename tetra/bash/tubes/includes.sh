#!/usr/bin/env bash

# tubes Module Includes - Standard tetra module entry point
# Controls what gets loaded for tubes (terminal FIFO networks) functionality

# Follow tetra convention: MOD_SRC for source code, MOD_DIR for runtime data
# Per CLAUDE.md: "MOD_SRC is a strong global. A module can count on it."
MOD_SRC="${MOD_SRC:-$TETRA_SRC/bash/tubes}"  # Source files
MOD_DIR="${MOD_DIR:-$TETRA_DIR/tubes}"        # Runtime data

# Backward compatibility - modules may still reference TUBES_*
TUBES_SRC="$MOD_SRC"
TUBES_DIR="$MOD_DIR"

# Create runtime directories if they don't exist
[[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"
[[ ! -d "$MOD_DIR/db" ]] && mkdir -p "$MOD_DIR/db"
[[ ! -d "$MOD_DIR/config" ]] && mkdir -p "$MOD_DIR/config"
[[ ! -d "$MOD_DIR/fifos" ]] && mkdir -p "$MOD_DIR/fifos"
[[ ! -d "$MOD_DIR/logs" ]] && mkdir -p "$MOD_DIR/logs"

# Export for subprocesses
export MOD_SRC MOD_DIR TUBES_SRC TUBES_DIR

# Source the main tubes module (which sources paths, core, router)
source "$MOD_SRC/tubes.sh"

# Initialize on load
if declare -f tubes_init >/dev/null 2>&1; then
    tubes_init
fi
