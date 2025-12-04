#!/usr/bin/env bash

# Vox Module Includes - Controls what gets loaded for Vox functionality

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "vox" "VOX"

# Vox depends on QA module for database and API keys
: "${QA_DIR:=$TETRA_DIR/qa}"
: "${QA_SRC:=$TETRA_SRC/bash/qa}"
export QA_DIR QA_SRC

# Source the main Vox module
source "$VOX_SRC/vox.sh"
