#!/usr/bin/env bash

# Node module includes

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "node" "NODE"

source "$NODE_SRC/node.sh"
tetra_source_if_exists "$NODE_SRC/pm2.sh"
tetra_source_if_exists "$NODE_SRC/tetragon.sh"
