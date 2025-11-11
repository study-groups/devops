#!/usr/bin/env bash

# tdocs module includes
# Entry point for the tdocs (Tetra Document Manager) module

TDOCS_MOD_DIR="$(dirname "${BASH_SOURCE[0]}")"
TDOCS_SRC="$TDOCS_MOD_DIR"

# Strong globals (following Tetra convention)
: "${TDOCS_SRC:=$TETRA_SRC/bash/tdocs}"
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Export for runtime use
export TDOCS_SRC TDOCS_DIR

# Source UI components (colors first for TDS integration)
source "$TDOCS_SRC/ui/colors.sh"
source "$TDOCS_SRC/ui/color_explorer.sh"

# Source core tdocs functionality
source "$TDOCS_SRC/tdocs.sh"

# Source tab completion
source "$TDOCS_SRC/tdocs_completion.sh"

# Initialize module (creates directories, indexes, help tree)
tdocs_module_init
