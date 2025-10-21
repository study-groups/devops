#!/usr/bin/env bash

# TSM Module Includes - Standard tetra module entry point
# Controls what gets loaded for TSM (Tetra Service Manager) functionality

# Follow tetra convention: MOD_SRC for source code, MOD_DIR for runtime data
# Per CLAUDE.md: "MOD_SRC is a strong global. A module can count on it."
MOD_SRC="${MOD_SRC:-$TETRA_SRC/bash/tsm}"  # Source files
MOD_DIR="${MOD_DIR:-$TETRA_DIR/tsm}"        # Runtime data

# Backward compatibility - modules may still reference TSM_*
TSM_SRC="$MOD_SRC"
TSM_DIR="$MOD_DIR"

# Create runtime directories if they don't exist
[[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"
[[ ! -d "$MOD_DIR/runtime" ]] && mkdir -p "$MOD_DIR/runtime"
[[ ! -d "$MOD_DIR/runtime/processes" ]] && mkdir -p "$MOD_DIR/runtime/processes"
[[ ! -d "$MOD_DIR/logs" ]] && mkdir -p "$MOD_DIR/logs"

# Export for subprocesses
export MOD_SRC MOD_DIR TSM_SRC TSM_DIR

# Source the main TSM module (which handles all component loading)
source "$MOD_SRC/tsm.sh"
