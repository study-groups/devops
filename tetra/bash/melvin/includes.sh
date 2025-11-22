#!/usr/bin/env bash

# MELVIN Module Includes
# Machine Electronics Live Virtual Intelligence Network
# Universal Bash Codebase Meta-Agent

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

# Source the main MELVIN module (which loads all components)
source "$MELVIN_SRC/melvin.sh"

# Initialize MELVIN on first load
if [[ -z "${MELVIN_INITIALIZED:-}" ]]; then
    export MELVIN_INITIALIZED=1

    # Context already initialized by melvin.sh
    # Just display info if verbose
    if [[ -n "${MELVIN_VERBOSE:-}" ]]; then
        echo "MELVIN initialized"
        echo "Context: $MELVIN_CONTEXT"
        echo "Root: $MELVIN_ROOT"
    fi
fi
