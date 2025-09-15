#!/usr/bin/env bash

# tmod module includes
# Use TETRA_SRC if available, otherwise derive from script location
if [[ -n "$TETRA_SRC" ]]; then
    TMOD_DIR="$TETRA_SRC/bash/tmod"
else
    TMOD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

source "$TMOD_DIR/tmod.sh"
