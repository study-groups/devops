#!/usr/bin/env bash

# Game Module - Entry Point
# Following Tetra Module Convention v2.0

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "game" "GAME"

# Source main module file
source "$GAME_SRC/game.sh"

# Module loaded
export GAME_LOADED=true
