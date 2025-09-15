#!/usr/bin/env bash

# Melvin Module Includes - Controls what gets loaded for Melvin functionality

# TETRA_SRC should never be redefined - it points to the tetra project root
# Use TETRA_BASH for the bash directory
: "${TETRA_BASH:=$TETRA_SRC/bash}"

# Set Melvin module variables with proper override guards
: "${MELVIN_SRC:=$TETRA_BASH/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Source the main Melvin module
source "$MELVIN_SRC/melvin.sh"

# Export Melvin module variables
export MELVIN_SRC MELVIN_DIR
