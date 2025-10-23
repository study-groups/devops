#!/usr/bin/env bash

# Game Module Includes
# Standard includes pattern for tetra module system

# This file can be sourced to load the game module
# following the tetra module pattern

if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# Source the main game module
source "$TETRA_SRC/bash/game/game.sh"
