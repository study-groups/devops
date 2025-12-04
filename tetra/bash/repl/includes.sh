#!/usr/bin/env bash

# REPL Module Includes - Standard tetra module entry point
# Controls what gets loaded for the REPL system

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "repl" "REPL" "history"

# Source the universal REPL launcher
source "$MOD_SRC/trepl.sh"

# Create convenience alias
alias repl='trepl'

echo "✓ REPL system loaded (use 'trepl' or 'repl' to launch)"
