#!/usr/bin/env bash

# MELVIN Module Includes
# Machine Electronics Live Virtual Intelligence Network
# Entry point for the MELVIN module

# TETRA_SRC should never be redefined - it points to the tetra project root
# Use TETRA_BASH for the bash directory
: "${TETRA_BASH:=$TETRA_SRC/bash}"

# Set MELVIN module variables with proper override guards
: "${MELVIN_SRC:=$TETRA_BASH/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Export MELVIN module variables
export MELVIN_SRC MELVIN_DIR

# Create MELVIN runtime directory if it doesn't exist
[[ ! -d "$MELVIN_DIR" ]] && mkdir -p "$MELVIN_DIR"

# Source the main MELVIN module
source "$MELVIN_SRC/melvin.sh"

# Initialize MELVIN on first load
# This ensures classification data is available for queries
if [[ -z "${MELVIN_INITIALIZED:-}" ]]; then
    # Run classification in background to avoid blocking shell startup
    # Only if MELVIN is actively used (not just loaded)
    export MELVIN_INITIALIZED=1
fi
