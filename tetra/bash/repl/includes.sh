#!/usr/bin/env bash

# REPL Module Includes - Standard tetra module entry point
# Controls what gets loaded for the REPL system

# Follow tetra convention: MOD_SRC for source code, MOD_DIR for runtime data
MOD_SRC="${MOD_SRC:-$TETRA_SRC/bash/repl}"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/repl}"

# Backward compatibility
REPL_SRC="$MOD_SRC"
REPL_DIR="$MOD_DIR"

# Create runtime directories if they don't exist
[[ ! -d "$MOD_DIR" ]] && mkdir -p "$MOD_DIR"
[[ ! -d "$MOD_DIR/history" ]] && mkdir -p "$MOD_DIR/history"

# Export for subprocesses
export MOD_SRC MOD_DIR REPL_SRC REPL_DIR

# Source the universal REPL launcher
source "$MOD_SRC/trepl.sh"

# Create convenience alias
alias repl='trepl'

echo "✓ REPL system loaded (use 'trepl' or 'repl' to launch)"
