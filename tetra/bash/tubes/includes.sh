#!/usr/bin/env bash

# tubes Module Includes - Standard tetra module entry point
# Controls what gets loaded for tubes (terminal FIFO networks) functionality

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "tubes" "TUBES" "db:config:fifos:logs"

# Source the main tubes module (which sources paths, core, router)
source "$TUBES_SRC/tubes.sh"

# Initialize on load
tetra_call_if_exists tubes_init
