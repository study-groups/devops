#!/usr/bin/env bash

# Quick launcher for Quadrapole demo

# Ensure TETRA_SRC is set
if [[ -z "$TETRA_SRC" ]]; then
    export TETRA_SRC="/Users/mricos/src/devops/tetra"
fi

# Load game module
source "$TETRA_SRC/bash/game/game.sh"

# Run quadrapole
game quadrapole
