#!/usr/bin/env bash

# tdoc module includes
# Entry point for the tdoc (Tetra Document Manager) module

TDOC_MOD_DIR="$(dirname "${BASH_SOURCE[0]}")"
TDOC_SRC="$TDOC_MOD_DIR"

# Strong globals (following Tetra convention)
: "${TDOC_SRC:=$TETRA_SRC/bash/tdoc}"
: "${TDOC_DIR:=$TETRA_DIR/tdoc}"

# Export for runtime use
export TDOC_SRC TDOC_DIR

# Source core tdoc functionality
source "$TDOC_SRC/tdoc.sh"

# Initialize module (creates directories, indexes, help tree)
tdoc_module_init
