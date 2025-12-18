#!/usr/bin/env bash

# Games Module - Entry Point
# Simple game management with pak/unpak support

[[ -n "$_GAMES_LOADED" ]] && return 0
_GAMES_LOADED=1

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: games module requires bash 5.2+" >&2
    return 1
fi

# Module paths
GAMES_SRC="${TETRA_SRC}/bash/games"
GAMES_DIR="${TETRA_DIR}/orgs/tetra/games"
export GAMES_SRC GAMES_DIR

# Source main module
source "$GAMES_SRC/games.sh"
