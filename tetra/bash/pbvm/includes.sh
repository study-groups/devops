#!/usr/bin/env bash

# PBVM - PocketBase Version Manager
# Tetra module integration

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "pbvm" "PBVM"

# Set default PBVM_ROOT if not already set
export PBVM_ROOT=${PBVM_ROOT:-"$HOME/.pbvm"}

# Source the main pbvm functionality
source "$PBVM_SRC/pbvm.sh"