#!/usr/bin/env bash

# Quasar Module Includes - Standard tetra module entry point
# Multi-mode audio synthesizer for tetra games (TIA, PWM, SIDPlus)

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "quasar" "QUASAR"

# Source main module
source "$MOD_SRC/quasar.sh"

# Source tab completion
source "$MOD_SRC/quasar_complete.sh"
