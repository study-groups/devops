#!/usr/bin/env bash

# MELVIN Module Includes
# Machine Electronics Live Virtual Intelligence Network
# Universal Bash Codebase Meta-Agent

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "melvin" "MELVIN"

# Source the main MELVIN module (which loads all components)
source "$MELVIN_SRC/melvin.sh"

# Initialize MELVIN on first load
if [[ -z "${MELVIN_INITIALIZED:-}" ]]; then
    export MELVIN_INITIALIZED=1

    # Context already initialized by melvin.sh
    # Just display info if verbose
    if [[ -n "${MELVIN_VERBOSE:-}" ]]; then
        echo "MELVIN initialized"
        echo "Context: $MELVIN_CONTEXT"
        echo "Root: $MELVIN_ROOT"
    fi
fi
