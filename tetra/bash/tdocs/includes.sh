#!/usr/bin/env bash

# tdocs module includes
# Entry point for the tdocs (Tetra Document Manager) module

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tdocs" "TDOCS"

# Source TPS for context integration (if available)
tetra_source_if_exists "$TETRA_SRC/bash/tps/includes.sh"

# Source PData core (needed by tdocs_ctx)
source "$TDOCS_SRC/core/pdata.sh"

# Source context integration (TPS T[org:project:subject] line)
source "$TDOCS_SRC/tdocs_ctx.sh"

# Source UI components (colors first for TDS integration)
source "$TDOCS_SRC/ui/colors.sh"
source "$TDOCS_SRC/ui/color_explorer.sh"

# Source core tdocs functionality
source "$TDOCS_SRC/tdocs.sh"

# Source publish module
source "$TDOCS_SRC/core/publish.sh"

# Source tab completion
source "$TDOCS_SRC/tdocs_completion.sh"

# Source tree help registration
source "$TDOCS_SRC/tdocs_tree.sh" 2>/dev/null || true

# Initialize module (creates directories, indexes, help tree)
tdocs_module_init
