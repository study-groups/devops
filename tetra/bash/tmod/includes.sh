#!/usr/bin/env bash

# tmod module includes - Module manager for tetra
# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tmod" "TMOD"

source "$TMOD_SRC/tmod.sh"
