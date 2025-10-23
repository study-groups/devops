#!/usr/bin/env bash
# Test script for Pulsar REPL

# Set up environment
export TETRA_SRC="${TETRA_SRC:-$HOME/src/devops/tetra}"
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export GAME_SRC="$TETRA_SRC/bash/game"

# Create directories if needed
mkdir -p "$TETRA_DIR/game"

# Source minimal dependencies
source "$TETRA_SRC/bash/color/color_core.sh" 2>/dev/null || {
    # Minimal color fallbacks
    COLOR_RESET=$'\033[0m'
    COLOR_BOLD=$'\033[1m'
    COLOR_DIM=$'\033[2m'
    COLOR_RED=$'\033[31m'
    COLOR_GREEN=$'\033[32m'
    COLOR_CYAN=$'\033[36m'
}

# Source pulsar core
source "$GAME_SRC/core/pulsar.sh"

# Source REPL
source "$GAME_SRC/core/pulsar_repl.sh"

# Run REPL
pulsar_repl_run
