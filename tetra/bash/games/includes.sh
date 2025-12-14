#!/usr/bin/env bash

# Games Module - Entry Point
# Following Tetra Module Convention v2.0

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "games" "GAMES"

# Source main module file
source "$GAMES_SRC/games.sh"

# Enable prompt display
export TETRA_PROMPT_GAMES=1

# Module loaded
export GAMES_LOADED=true
