#!/usr/bin/env bash

export TETRA_SRC=/Users/mricos/src/devops/tetra
cd "$TETRA_SRC"

# Simple test without full tetra bootstrap
source bash/game/game.sh

# Run quadrapole
game quadrapole
