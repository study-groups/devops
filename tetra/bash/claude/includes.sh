#!/usr/bin/env bash

# Claude module includes

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "claude" "CLAUDE"

source "$CLAUDE_SRC/claude.sh"